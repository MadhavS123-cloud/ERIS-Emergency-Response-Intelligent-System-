"""
Training Pipeline CLI
Command-line interface for manual training runs and scheduling
"""
import argparse
import sys
from datetime import datetime, timedelta
import logging
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from ml_service.training.pipeline import TrainingPipeline
from ml_service.config import Config

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def parse_args():
    """Parse command-line arguments"""
    parser = argparse.ArgumentParser(
        description="ML Model Training Pipeline CLI"
    )
    
    parser.add_argument(
        "--model",
        type=str,
        required=True,
        choices=["delay_predictor", "severity_classifier", "demand_forecaster"],
        help="Model to train"
    )
    
    parser.add_argument(
        "--start-date",
        type=str,
        help="Start date for training data (YYYY-MM-DD). Default: 90 days ago"
    )
    
    parser.add_argument(
        "--end-date",
        type=str,
        help="End date for training data (YYYY-MM-DD). Default: today"
    )
    
    parser.add_argument(
        "--model-type",
        type=str,
        default="regression",
        choices=["regression", "classification", "forecasting"],
        help="Type of model (default: regression)"
    )
    
    parser.add_argument(
        "--no-tuning",
        action="store_true",
        help="Skip hyperparameter tuning"
    )
    
    parser.add_argument(
        "--n-trials",
        type=int,
        default=50,
        help="Number of Optuna trials for hyperparameter tuning (default: 50)"
    )
    
    parser.add_argument(
        "--mlflow-uri",
        type=str,
        default=None,
        help=f"MLflow tracking URI (default: {Config.MLFLOW_TRACKING_URI})"
    )
    
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print configuration without running training"
    )
    
    return parser.parse_args()


def main():
    """Main CLI entry point"""
    args = parse_args()
    
    # Parse dates
    if args.end_date:
        end_date = datetime.strptime(args.end_date, "%Y-%m-%d")
    else:
        end_date = datetime.now()
    
    if args.start_date:
        start_date = datetime.strptime(args.start_date, "%Y-%m-%d")
    else:
        start_date = end_date - timedelta(days=90)
    
    # Print configuration
    logger.info("=" * 60)
    logger.info("ML Model Training Pipeline")
    logger.info("=" * 60)
    logger.info(f"Model: {args.model}")
    logger.info(f"Model Type: {args.model_type}")
    logger.info(f"Start Date: {start_date.date()}")
    logger.info(f"End Date: {end_date.date()}")
    logger.info(f"Hyperparameter Tuning: {'No' if args.no_tuning else 'Yes'}")
    if not args.no_tuning:
        logger.info(f"Optuna Trials: {args.n_trials}")
    logger.info(f"MLflow URI: {args.mlflow_uri or Config.MLFLOW_TRACKING_URI}")
    logger.info("=" * 60)
    
    if args.dry_run:
        logger.info("Dry run mode - exiting without training")
        return 0
    
    try:
        # Initialize pipeline
        pipeline = TrainingPipeline(mlflow_uri=args.mlflow_uri)
        
        # Run training
        run_id = pipeline.run_training(
            model_name=args.model,
            start_date=start_date,
            end_date=end_date,
            model_type=args.model_type,
            hyperparameter_tuning=not args.no_tuning,
            n_trials=args.n_trials
        )
        
        logger.info("=" * 60)
        logger.info(f"Training completed successfully!")
        logger.info(f"MLflow Run ID: {run_id}")
        logger.info(f"View results: {args.mlflow_uri or Config.MLFLOW_TRACKING_URI}")
        logger.info("=" * 60)
        
        return 0
        
    except Exception as e:
        logger.error("=" * 60)
        logger.error(f"Training failed: {e}")
        logger.error("=" * 60)
        import traceback
        traceback.print_exc()
        return 1


def run_scheduled_training():
    """
    Run scheduled training for all models.
    This function is called by cron jobs.
    """
    logger.info("Starting scheduled training for all models")
    
    pipeline = TrainingPipeline()
    
    # Define models to train
    models = [
        {
            "name": "delay_predictor",
            "type": "regression"
        },
        {
            "name": "severity_classifier",
            "type": "classification"
        },
        {
            "name": "demand_forecaster",
            "type": "forecasting"
        }
    ]
    
    # Training data: last 90 days
    end_date = datetime.now()
    start_date = end_date - timedelta(days=90)
    
    results = []
    
    for model_config in models:
        try:
            logger.info(f"Training {model_config['name']}...")
            
            run_id = pipeline.run_training(
                model_name=model_config["name"],
                start_date=start_date,
                end_date=end_date,
                model_type=model_config["type"],
                hyperparameter_tuning=True,
                n_trials=50
            )
            
            results.append({
                "model": model_config["name"],
                "status": "success",
                "run_id": run_id
            })
            
            logger.info(f"✓ {model_config['name']} training completed: {run_id}")
            
        except Exception as e:
            logger.error(f"✗ {model_config['name']} training failed: {e}")
            results.append({
                "model": model_config["name"],
                "status": "failed",
                "error": str(e)
            })
    
    # Summary
    logger.info("=" * 60)
    logger.info("Scheduled Training Summary")
    logger.info("=" * 60)
    
    for result in results:
        status_symbol = "✓" if result["status"] == "success" else "✗"
        logger.info(f"{status_symbol} {result['model']}: {result['status']}")
        if result["status"] == "success":
            logger.info(f"  Run ID: {result['run_id']}")
        else:
            logger.info(f"  Error: {result.get('error', 'Unknown')}")
    
    logger.info("=" * 60)
    
    # Return exit code (0 if all succeeded, 1 if any failed)
    return 0 if all(r["status"] == "success" for r in results) else 1


if __name__ == "__main__":
    sys.exit(main())

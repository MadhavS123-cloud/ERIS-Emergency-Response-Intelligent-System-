"""
Training Pipeline
Automated ML model training, evaluation, and deployment pipeline
"""
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import Dict, Any, Tuple, Optional, List
from pathlib import Path
import logging
import mlflow
import mlflow.sklearn
from sklearn.model_selection import train_test_split

from ml_service.config import Config
from ml_service.utils.db_client import DatabaseClient
from ml_service.feature_store.feature_store import FeatureStore
from ml_service.training.evaluator import ModelEvaluator
from ml_service.training.tuner import HyperparameterTuner

logger = logging.getLogger(__name__)


class TrainingPipeline:
    """Automated ML model training pipeline with MLflow tracking"""
    
    def __init__(self, mlflow_uri: str = None):
        """
        Initialize training pipeline.
        
        Args:
            mlflow_uri: MLflow tracking URI (uses config if None)
        """
        self.mlflow_uri = mlflow_uri or Config.MLFLOW_TRACKING_URI
        mlflow.set_tracking_uri(self.mlflow_uri)
        
        # Set experiment
        mlflow.set_experiment(Config.MLFLOW_EXPERIMENT_NAME)
        
        self.feature_store = FeatureStore()
        self.evaluator = ModelEvaluator()
        self.tuner = HyperparameterTuner()
        
        logger.info(f"Training pipeline initialized with MLflow URI: {self.mlflow_uri}")
    
    def run_training(
        self,
        model_name: str,
        start_date: datetime,
        end_date: datetime,
        model_type: str = "regression",
        hyperparameter_tuning: bool = True,
        n_trials: int = 50
    ) -> str:
        """
        Execute complete training pipeline.
        
        Args:
            model_name: Name of the model to train
            start_date: Start date for training data
            end_date: End date for training data
            model_type: Type of model ("regression", "classification", "forecasting")
            hyperparameter_tuning: Whether to perform hyperparameter tuning
            n_trials: Number of Optuna trials for tuning
        
        Returns:
            MLflow run_id
        """
        logger.info(f"Starting training pipeline for {model_name}")
        logger.info(f"Date range: {start_date} to {end_date}")
        
        # Start MLflow run
        with mlflow.start_run(run_name=f"{model_name}_{datetime.now().strftime('%Y%m%d_%H%M%S')}") as run:
            run_id = run.info.run_id
            
            try:
                # Log parameters
                mlflow.log_param("model_name", model_name)
                mlflow.log_param("start_date", start_date.isoformat())
                mlflow.log_param("end_date", end_date.isoformat())
                mlflow.log_param("model_type", model_type)
                
                # Store training run in database
                self._store_training_run_start(model_name, run_id, start_date, end_date)
                
                # Step 1: Extract training data
                logger.info("Step 1: Extracting training data from PostgreSQL")
                df = self.extract_training_data(start_date, end_date)
                logger.info(f"Extracted {len(df)} records")
                mlflow.log_metric("num_samples", len(df))
                
                if len(df) < 100:
                    raise ValueError(f"Insufficient training data: {len(df)} samples (minimum 100 required)")
                
                # Step 2: Compute features
                logger.info("Step 2: Computing features via Feature Store")
                df_features = self._compute_features_for_training(df)
                logger.info(f"Computed {len(df_features.columns)} features")
                
                # Step 3: Split data with temporal ordering
                logger.info("Step 3: Splitting data (70/15/15 train/val/test)")
                X_train, X_val, X_test, y_train, y_val, y_test = self.split_data_temporal(
                    df_features, 
                    target_column="delay_minutes" if model_type == "regression" else "risk_category"
                )
                
                mlflow.log_metric("train_samples", len(X_train))
                mlflow.log_metric("val_samples", len(X_val))
                mlflow.log_metric("test_samples", len(X_test))
                
                # Step 4: Hyperparameter tuning (optional)
                best_params = None
                if hyperparameter_tuning:
                    logger.info(f"Step 4: Hyperparameter tuning with Optuna ({n_trials} trials)")
                    best_params = self.tuner.tune(
                        X_train, y_train,
                        X_val, y_val,
                        model_type=model_type,
                        n_trials=n_trials
                    )
                    logger.info(f"Best parameters: {best_params}")
                    mlflow.log_params({f"best_{k}": v for k, v in best_params.items()})
                
                # Step 5: Train final model
                logger.info("Step 5: Training final model")
                model = self._train_model(X_train, y_train, model_type, best_params)
                
                # Step 6: Evaluate on test set
                logger.info("Step 6: Evaluating model on test set")
                metrics = self.evaluator.evaluate(
                    model, X_test, y_test, model_type
                )
                logger.info(f"Test metrics: {metrics}")
                
                # Log metrics to MLflow
                for metric_name, metric_value in metrics.items():
                    mlflow.log_metric(f"test_{metric_name}", metric_value)
                
                # Step 7: Compare with production model
                logger.info("Step 7: Comparing with production model")
                should_promote = self._compare_with_production(model_name, metrics)
                
                # Step 8: Log model to MLflow
                logger.info("Step 8: Logging model to MLflow")
                mlflow.sklearn.log_model(
                    model,
                    artifact_path="model",
                    registered_model_name=model_name
                )
                
                # Step 9: Promote if better
                if should_promote:
                    logger.info("Step 9: Promoting model to production")
                    self._promote_model(run_id, model_name)
                else:
                    logger.info("Step 9: Model not promoted (production model is better)")
                
                # Update training run status
                self._store_training_run_complete(
                    run_id, 
                    best_params or {}, 
                    metrics, 
                    "completed",
                    should_promote
                )
                
                logger.info(f"Training pipeline completed successfully. Run ID: {run_id}")
                return run_id
                
            except Exception as e:
                logger.error(f"Training pipeline failed: {e}")
                self._store_training_run_complete(run_id, {}, {}, "failed", False)
                mlflow.log_param("error", str(e))
                raise
    
    def extract_training_data(
        self,
        start_date: datetime,
        end_date: datetime
    ) -> pd.DataFrame:
        """
        Extract historical data from PostgreSQL for training.
        
        Args:
            start_date: Start date for data extraction
            end_date: End date for data extraction
        
        Returns:
            DataFrame with historical emergency requests and outcomes
        """
        query = """
        SELECT 
            r.id as request_id,
            r.created_at as timestamp,
            r.pickup_lat as location_lat,
            r.pickup_lng as location_lng,
            r.emergency_type,
            r.status,
            h.id as hospital_id,
            h.name as hospital_name,
            h.location_lat as hospital_lat,
            h.location_lng as hospital_lng,
            a.id as ambulance_id,
            a.plate_number,
            -- Calculate actual delay (if completed)
            CASE 
                WHEN r.status IN ('COMPLETED', 'IN_TRANSIT') 
                THEN EXTRACT(EPOCH FROM (r.updated_at - r.created_at)) / 60.0
                ELSE NULL
            END as delay_minutes
        FROM requests r
        LEFT JOIN hospitals h ON r.hospital_id = h.id
        LEFT JOIN ambulances a ON r.ambulance_id = a.id
        WHERE r.created_at >= %s 
          AND r.created_at <= %s
          AND r.status IN ('COMPLETED', 'IN_TRANSIT', 'ARRIVED')
        ORDER BY r.created_at ASC
        """
        
        results = DatabaseClient.execute_query(query, (start_date, end_date))
        df = pd.DataFrame(results)
        
        if len(df) == 0:
            logger.warning("No training data found for the specified date range")
            return df
        
        # Convert timestamp to datetime
        df['timestamp'] = pd.to_datetime(df['timestamp'])
        
        # Filter out records with missing critical data
        df = df.dropna(subset=['location_lat', 'location_lng', 'delay_minutes'])
        
        logger.info(f"Extracted {len(df)} valid training records")
        return df
    
    def _compute_features_for_training(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Compute features for all training samples.
        
        Args:
            df: DataFrame with raw training data
        
        Returns:
            DataFrame with computed features
        """
        features_list = []
        
        for idx, row in df.iterrows():
            request_data = {
                "location_lat": row['location_lat'],
                "location_lng": row['location_lng'],
                "timestamp": row['timestamp'],
                "emergency_type": row.get('emergency_type', 'unknown')
            }
            
            # Compute features
            features = self.feature_store.compute_features(request_data, {})
            features['delay_minutes'] = row['delay_minutes']
            features['request_id'] = row['request_id']
            
            features_list.append(features)
        
        df_features = pd.DataFrame(features_list)
        return df_features
    
    def split_data_temporal(
        self,
        df: pd.DataFrame,
        target_column: str,
        train_ratio: float = 0.7,
        val_ratio: float = 0.15
    ) -> Tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame, pd.Series, pd.Series, pd.Series]:
        """
        Split data with temporal ordering (no data leakage).
        
        Args:
            df: DataFrame with features and target
            target_column: Name of target column
            train_ratio: Proportion for training set (default 0.7)
            val_ratio: Proportion for validation set (default 0.15)
        
        Returns:
            Tuple of (X_train, X_val, X_test, y_train, y_val, y_test)
        """
        # Sort by timestamp if available
        if 'timestamp' in df.columns:
            df = df.sort_values('timestamp')
        
        # Calculate split indices
        n = len(df)
        train_end = int(n * train_ratio)
        val_end = int(n * (train_ratio + val_ratio))
        
        # Split data
        train_df = df.iloc[:train_end]
        val_df = df.iloc[train_end:val_end]
        test_df = df.iloc[val_end:]
        
        # Separate features and target
        feature_columns = [col for col in df.columns 
                          if col not in [target_column, 'request_id', 'timestamp']]
        
        X_train = train_df[feature_columns]
        X_val = val_df[feature_columns]
        X_test = test_df[feature_columns]
        
        y_train = train_df[target_column]
        y_val = val_df[target_column]
        y_test = test_df[target_column]
        
        logger.info(f"Data split: train={len(X_train)}, val={len(X_val)}, test={len(X_test)}")
        
        # Verify temporal ordering
        if 'timestamp' in df.columns:
            assert train_df['timestamp'].max() < val_df['timestamp'].min(), "Data leakage: train overlaps with val"
            assert val_df['timestamp'].max() < test_df['timestamp'].min(), "Data leakage: val overlaps with test"
        
        return X_train, X_val, X_test, y_train, y_val, y_test
    
    def _train_model(
        self,
        X_train: pd.DataFrame,
        y_train: pd.Series,
        model_type: str,
        hyperparameters: Optional[Dict] = None
    ):
        """Train model with given hyperparameters"""
        from sklearn.ensemble import GradientBoostingRegressor, RandomForestClassifier
        
        if model_type == "regression":
            default_params = {
                "n_estimators": 200,
                "max_depth": 8,
                "learning_rate": 0.05,
                "min_samples_split": 10,
                "min_samples_leaf": 4,
                "subsample": 0.8,
                "random_state": 42
            }
            params = {**default_params, **(hyperparameters or {})}
            model = GradientBoostingRegressor(**params)
        
        elif model_type == "classification":
            default_params = {
                "n_estimators": 100,
                "max_depth": 10,
                "min_samples_split": 5,
                "min_samples_leaf": 2,
                "random_state": 42
            }
            params = {**default_params, **(hyperparameters or {})}
            model = RandomForestClassifier(**params)
        
        else:
            raise ValueError(f"Unsupported model type: {model_type}")
        
        model.fit(X_train, y_train)
        return model
    
    def _compare_with_production(
        self,
        model_name: str,
        new_metrics: Dict[str, float]
    ) -> bool:
        """
        Compare new model with production model.
        
        Args:
            model_name: Name of the model
            new_metrics: Metrics from new model
        
        Returns:
            True if new model should be promoted
        """
        try:
            # Get production model from MLflow registry
            client = mlflow.tracking.MlflowClient()
            
            # Get latest production version
            versions = client.get_latest_versions(model_name, stages=["Production"])
            
            if not versions:
                logger.info("No production model found, promoting new model")
                return True
            
            production_version = versions[0]
            production_run = client.get_run(production_version.run_id)
            
            # Get production metrics
            production_metrics = production_run.data.metrics
            
            # Compare key metrics (model-type specific)
            if "test_mae" in new_metrics and "test_mae" in production_metrics:
                # For regression: lower MAE is better
                improvement = production_metrics["test_mae"] - new_metrics["test_mae"]
                threshold = 0.1  # Require 0.1 minute improvement
                
                if improvement > threshold:
                    logger.info(f"New model is better: MAE improved by {improvement:.2f}")
                    return True
                else:
                    logger.info(f"New model not significantly better: MAE improvement {improvement:.2f} < {threshold}")
                    return False
            
            elif "test_accuracy" in new_metrics and "test_accuracy" in production_metrics:
                # For classification: higher accuracy is better
                improvement = new_metrics["test_accuracy"] - production_metrics["test_accuracy"]
                threshold = 0.01  # Require 1% improvement
                
                if improvement > threshold:
                    logger.info(f"New model is better: Accuracy improved by {improvement:.2%}")
                    return True
                else:
                    logger.info(f"New model not significantly better: Accuracy improvement {improvement:.2%} < {threshold:.2%}")
                    return False
            
            # Default: promote if no comparison possible
            logger.warning("Could not compare metrics, promoting new model")
            return True
            
        except Exception as e:
            logger.warning(f"Error comparing with production model: {e}")
            return True
    
    def _promote_model(self, run_id: str, model_name: str):
        """Promote model to production in MLflow registry"""
        client = mlflow.tracking.MlflowClient()
        
        # Get model version for this run
        versions = client.search_model_versions(f"run_id='{run_id}'")
        
        if not versions:
            logger.error(f"No model version found for run {run_id}")
            return
        
        version = versions[0].version
        
        # Transition to production
        client.transition_model_version_stage(
            name=model_name,
            version=version,
            stage="Production",
            archive_existing_versions=True
        )
        
        logger.info(f"Model {model_name} version {version} promoted to Production")
    
    def _store_training_run_start(
        self,
        model_name: str,
        run_id: str,
        start_date: datetime,
        end_date: datetime
    ):
        """Store training run start in database"""
        query = """
        INSERT INTO model_training_runs 
        (model_name, run_id, training_start, data_version, status)
        VALUES (%s, %s, %s, %s, %s)
        """
        
        data_version = f"{start_date.date()}_{end_date.date()}"
        
        DatabaseClient.execute_insert(
            query,
            (model_name, run_id, datetime.now(), data_version, "running")
        )
    
    def _store_training_run_complete(
        self,
        run_id: str,
        hyperparameters: Dict,
        metrics: Dict,
        status: str,
        promoted: bool
    ):
        """Update training run completion in database"""
        import json
        
        query = """
        UPDATE model_training_runs
        SET training_end = %s,
            hyperparameters = %s,
            metrics = %s,
            status = %s,
            promoted_to_production = %s,
            promoted_at = %s
        WHERE run_id = %s
        """
        
        DatabaseClient.execute_update(
            query,
            (
                datetime.now(),
                json.dumps(hyperparameters),
                json.dumps(metrics),
                status,
                promoted,
                datetime.now() if promoted else None,
                run_id
            )
        )

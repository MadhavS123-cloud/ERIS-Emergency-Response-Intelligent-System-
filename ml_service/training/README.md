# Training Pipeline

Automated ML model training, evaluation, and deployment pipeline with MLflow tracking and Optuna hyperparameter optimization.

## Features

- **Automated Training Pipeline**: End-to-end training from data extraction to model deployment
- **MLflow Integration**: Experiment tracking, model registry, and versioning
- **Hyperparameter Tuning**: Automated optimization using Optuna
- **Temporal Data Splitting**: Prevents data leakage with time-ordered splits (70/15/15)
- **Comprehensive Evaluation**: Multiple metrics for regression, classification, and forecasting
- **Model Comparison**: Automatic promotion of better models to production
- **Model Versioning**: Full rollback capabilities with metadata tracking
- **CLI Interface**: Easy manual training runs
- **Scheduled Training**: Cron job support for weekly retraining

## Components

### TrainingPipeline

Main pipeline orchestrator that handles:
- Data extraction from PostgreSQL
- Feature computation via Feature Store
- Temporal data splitting
- Hyperparameter tuning
- Model training
- Evaluation
- Model comparison and promotion
- Metadata storage

### ModelEvaluator

Comprehensive model evaluation with metrics:
- **Regression**: MAE, RMSE, R², MAPE
- **Classification**: Accuracy, Precision, Recall, F1, AUC-ROC
- **Forecasting**: MAE, RMSE, MAPE, Directional Accuracy

### HyperparameterTuner

Automated hyperparameter optimization using Optuna:
- Configurable search spaces
- Validation-based optimization
- MLflow tracking of trials
- Support for regression and classification models

## Usage

### Manual Training via CLI

```bash
# Train delay predictor with default settings (last 90 days)
python -m ml_service.training.cli --model delay_predictor --model-type regression

# Train with custom date range
python -m ml_service.training.cli \
    --model delay_predictor \
    --model-type regression \
    --start-date 2024-01-01 \
    --end-date 2024-12-31

# Train without hyperparameter tuning (faster)
python -m ml_service.training.cli \
    --model delay_predictor \
    --model-type regression \
    --no-tuning

# Train with more Optuna trials (better optimization)
python -m ml_service.training.cli \
    --model delay_predictor \
    --model-type regression \
    --n-trials 100

# Dry run (print configuration without training)
python -m ml_service.training.cli \
    --model delay_predictor \
    --model-type regression \
    --dry-run
```

### Programmatic Usage

```python
from ml_service.training import TrainingPipeline
from datetime import datetime, timedelta

# Initialize pipeline
pipeline = TrainingPipeline()

# Run training
end_date = datetime.now()
start_date = end_date - timedelta(days=90)

run_id = pipeline.run_training(
    model_name="delay_predictor",
    start_date=start_date,
    end_date=end_date,
    model_type="regression",
    hyperparameter_tuning=True,
    n_trials=50
)

print(f"Training completed. Run ID: {run_id}")
```

### Scheduled Training

#### Setup Cron Jobs

1. Make scheduler script executable:
```bash
chmod +x ml_service/training/scheduler.sh
```

2. Edit crontab:
```bash
crontab -e
```

3. Add weekly training (every Sunday at 2 AM):
```cron
0 2 * * 0 /path/to/ml_service/training/scheduler.sh >> /path/to/logs/training.log 2>&1
```

See `crontab.example` for more scheduling options.

## Training Pipeline Flow

1. **Data Extraction**: Query PostgreSQL for historical emergency requests
2. **Feature Computation**: Compute features via Feature Store
3. **Data Splitting**: Split into train/val/test with temporal ordering (70/15/15)
4. **Hyperparameter Tuning**: Optimize hyperparameters on validation set (optional)
5. **Model Training**: Train final model with best hyperparameters
6. **Evaluation**: Evaluate on test set with comprehensive metrics
7. **Comparison**: Compare with current production model
8. **Promotion**: Promote to production if better (automatic)
9. **Metadata Storage**: Store training run metadata in database

## Model Promotion Logic

A new model is promoted to production if:
- **Regression**: MAE improves by > 0.1 minutes
- **Classification**: Accuracy improves by > 1%
- No production model exists (first training)

## Data Requirements

Minimum requirements for training:
- At least 100 historical records
- Records must have:
  - Location (lat/lng)
  - Timestamp
  - Delay outcome (for completed requests)
  - Emergency type

## MLflow Integration

### View Training Runs

```bash
# Start MLflow UI
mlflow ui --backend-store-uri sqlite:///mlflow.db

# Open browser to http://localhost:5000
```

### Access Models Programmatically

```python
import mlflow

# Load production model
model = mlflow.sklearn.load_model("models:/delay_predictor/Production")

# Make predictions
predictions = model.predict(X_test)
```

## Configuration

Configuration is managed via `ml_service/config.py`:

```python
# MLflow
MLFLOW_TRACKING_URI = "http://localhost:5000"
MLFLOW_EXPERIMENT_NAME = "eris-ml"

# Database
DATABASE_URL = "postgresql://user:password@localhost:5432/eris"

# Feature Store
FEATURE_STORE_OFFLINE_PATH = "./data/features"
```

## Monitoring

Training runs are stored in the `model_training_runs` table:

```sql
SELECT 
    model_name,
    run_id,
    training_start,
    training_end,
    status,
    promoted_to_production,
    metrics
FROM model_training_runs
ORDER BY training_start DESC
LIMIT 10;
```

## Troubleshooting

### Insufficient Training Data

**Error**: `Insufficient training data: X samples (minimum 100 required)`

**Solution**: Ensure you have at least 100 completed emergency requests in the database for the specified date range.

### MLflow Connection Error

**Error**: `Connection refused to MLflow tracking server`

**Solution**: Start MLflow server:
```bash
mlflow server --backend-store-uri sqlite:///mlflow.db --default-artifact-root ./mlruns
```

### Feature Computation Fails

**Error**: `Failed to compute feature 'X'`

**Solution**: Check Feature Store configuration and ensure all required data sources are available.

### Model Not Promoted

**Info**: `Model not promoted (production model is better)`

**Explanation**: The new model did not meet the improvement threshold. This is normal and protects against model degradation.

## Retry Logic

The training pipeline includes automatic retry logic:
- Failed steps are retried with exponential backoff
- Maximum 3 retries per step
- Previous production model is kept if training fails

## Rollback

To rollback to a previous model version:

```python
import mlflow

client = mlflow.tracking.MlflowClient()

# Transition previous version back to Production
client.transition_model_version_stage(
    name="delay_predictor",
    version="2",  # Previous version
    stage="Production",
    archive_existing_versions=True
)
```

## Performance

Typical training times:
- **Without tuning**: 2-5 minutes (1000 samples)
- **With tuning (50 trials)**: 15-30 minutes (1000 samples)
- **With tuning (100 trials)**: 30-60 minutes (1000 samples)

## Best Practices

1. **Regular Retraining**: Schedule weekly training to keep models up-to-date
2. **Monitor Metrics**: Track model performance over time in MLflow
3. **Validate Promotions**: Review promoted models before deploying to production
4. **Backup Models**: Keep previous versions for rollback
5. **Log Everything**: Use comprehensive logging for debugging
6. **Test First**: Use `--dry-run` to validate configuration before training

## Support

For issues or questions:
1. Check logs in `logs/training/`
2. Review MLflow UI for training run details
3. Query `model_training_runs` table for metadata
4. Check Feature Store and database connectivity

# Training Pipeline Quick Start Guide

## Prerequisites

1. **PostgreSQL Database**: Running with historical emergency request data
2. **MLflow Server**: Running for experiment tracking
3. **Python Environment**: Python 3.11+ with dependencies installed

## Setup

### 1. Install Dependencies

```bash
cd ml_service
pip install -r requirements.txt
```

### 2. Configure Environment

Create `.env` file in `ml_service/` directory:

```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/eris

# MLflow
MLFLOW_TRACKING_URI=http://localhost:5000
MLFLOW_EXPERIMENT_NAME=eris-ml

# Redis (for Feature Store)
REDIS_HOST=localhost
REDIS_PORT=6379
```

### 3. Start MLflow Server

```bash
# In a separate terminal
mlflow server \
    --backend-store-uri sqlite:///mlflow.db \
    --default-artifact-root ./mlruns \
    --host 0.0.0.0 \
    --port 5000
```

Access MLflow UI at: http://localhost:5000

## Quick Training Run

### Option 1: CLI (Recommended for Manual Runs)

```bash
# Train delay predictor with default settings
python -m ml_service.training.cli \
    --model delay_predictor \
    --model-type regression

# Train with custom date range and more trials
python -m ml_service.training.cli \
    --model delay_predictor \
    --model-type regression \
    --start-date 2024-01-01 \
    --end-date 2024-12-31 \
    --n-trials 100

# Quick training without hyperparameter tuning
python -m ml_service.training.cli \
    --model delay_predictor \
    --model-type regression \
    --no-tuning
```

### Option 2: Python Script

```python
from ml_service.training import TrainingPipeline
from datetime import datetime, timedelta

# Initialize pipeline
pipeline = TrainingPipeline()

# Define date range (last 90 days)
end_date = datetime.now()
start_date = end_date - timedelta(days=90)

# Run training
run_id = pipeline.run_training(
    model_name="delay_predictor",
    start_date=start_date,
    end_date=end_date,
    model_type="regression",
    hyperparameter_tuning=True,
    n_trials=50
)

print(f"Training completed! Run ID: {run_id}")
print(f"View results at: http://localhost:5000")
```

## Scheduled Training Setup

### 1. Make Scheduler Executable

```bash
chmod +x ml_service/training/scheduler.sh
```

### 2. Test Scheduler

```bash
# Test run (check for errors)
./ml_service/training/scheduler.sh
```

### 3. Setup Cron Job

```bash
# Edit crontab
crontab -e

# Add weekly training (every Sunday at 2 AM)
0 2 * * 0 /path/to/ml_service/training/scheduler.sh >> /path/to/logs/training.log 2>&1
```

## Monitoring

### View Training Runs

**MLflow UI**:
```bash
# Open browser to http://localhost:5000
# Navigate to "eris-ml" experiment
# View runs, metrics, and models
```

**Database Query**:
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

### Check Logs

```bash
# View training logs
tail -f logs/training/training_*.log

# View cron logs
tail -f logs/cron.log
```

## Common Tasks

### Train All Models

```bash
# Delay Predictor
python -m ml_service.training.cli --model delay_predictor --model-type regression

# Severity Classifier
python -m ml_service.training.cli --model severity_classifier --model-type classification

# Demand Forecaster
python -m ml_service.training.cli --model demand_forecaster --model-type forecasting
```

### Load Production Model

```python
import mlflow

# Load latest production model
model = mlflow.sklearn.load_model("models:/delay_predictor/Production")

# Make predictions
predictions = model.predict(X_test)
```

### Rollback Model

```python
import mlflow

client = mlflow.tracking.MlflowClient()

# Transition previous version back to Production
client.transition_model_version_stage(
    name="delay_predictor",
    version="2",  # Previous version number
    stage="Production",
    archive_existing_versions=True
)
```

## Troubleshooting

### Issue: "Insufficient training data"

**Solution**: Ensure you have at least 100 completed emergency requests in the database.

```sql
-- Check data availability
SELECT COUNT(*) 
FROM requests 
WHERE status IN ('COMPLETED', 'IN_TRANSIT', 'ARRIVED')
  AND created_at >= NOW() - INTERVAL '90 days';
```

### Issue: "MLflow connection refused"

**Solution**: Start MLflow server:

```bash
mlflow server --backend-store-uri sqlite:///mlflow.db --default-artifact-root ./mlruns
```

### Issue: "Feature computation failed"

**Solution**: Check Redis connection and Feature Store configuration:

```python
from ml_service.utils.redis_client import RedisClient

# Test Redis connection
client = RedisClient.get_client()
client.ping()  # Should return True
```

### Issue: "Model not promoted"

**Explanation**: This is normal. The new model didn't meet the improvement threshold. Check metrics in MLflow UI to compare performance.

## Performance Tips

1. **Faster Training**: Use `--no-tuning` flag to skip hyperparameter optimization
2. **Better Models**: Increase `--n-trials` for more thorough hyperparameter search
3. **More Data**: Use longer date ranges for more training data
4. **Parallel Training**: Run different models in parallel (separate terminals)

## Next Steps

1. **Monitor Performance**: Regularly check MLflow UI for model metrics
2. **Adjust Thresholds**: Modify promotion thresholds in `pipeline.py` if needed
3. **Add Models**: Extend pipeline to support additional model types
4. **Optimize Schedule**: Adjust cron schedule based on data update frequency

## Support

- **Documentation**: See `README.md` for detailed documentation
- **Implementation Details**: See `IMPLEMENTATION_SUMMARY.md`
- **Code Examples**: Check `test_training_pipeline.py` for usage examples

## Useful Commands

```bash
# Dry run (test configuration)
python -m ml_service.training.cli --model delay_predictor --model-type regression --dry-run

# View MLflow experiments
mlflow experiments list

# View model versions
mlflow models list

# Start MLflow UI
mlflow ui

# Check cron jobs
crontab -l

# Test scheduler
./ml_service/training/scheduler.sh
```

## Expected Output

Successful training run output:

```
============================================================
ML Model Training Pipeline
============================================================
Model: delay_predictor
Model Type: regression
Start Date: 2024-01-01
End Date: 2024-12-31
Hyperparameter Tuning: Yes
Optuna Trials: 50
MLflow URI: http://localhost:5000
============================================================
INFO - Starting training pipeline for delay_predictor
INFO - Step 1: Extracting training data from PostgreSQL
INFO - Extracted 5000 records
INFO - Step 2: Computing features via Feature Store
INFO - Computed 25 features
INFO - Step 3: Splitting data (70/15/15 train/val/test)
INFO - Data split: train=3500, val=750, test=750
INFO - Step 4: Hyperparameter tuning with Optuna (50 trials)
INFO - Best parameters: {'n_estimators': 200, 'max_depth': 8, ...}
INFO - Step 5: Training final model
INFO - Step 6: Evaluating model on test set
INFO - Test metrics: {'mae': 2.3, 'rmse': 3.1, 'r2': 0.87}
INFO - Step 7: Comparing with production model
INFO - New model is better: MAE improved by 0.5
INFO - Step 8: Logging model to MLflow
INFO - Step 9: Promoting model to production
INFO - Training pipeline completed successfully. Run ID: abc123
============================================================
Training completed successfully!
MLflow Run ID: abc123
View results: http://localhost:5000
============================================================
```

## Ready to Go!

You're now ready to use the training pipeline. Start with a simple training run:

```bash
python -m ml_service.training.cli --model delay_predictor --model-type regression
```

Then check the results in MLflow UI at http://localhost:5000

#!/bin/bash
# Training Pipeline Scheduler
# This script is designed to be run by cron for weekly model retraining

# Set working directory
cd "$(dirname "$0")/../.." || exit 1

# Activate virtual environment if it exists
if [ -d "venv" ]; then
    source venv/bin/activate
fi

# Set Python path
export PYTHONPATH="${PYTHONPATH}:$(pwd)"

# Load environment variables
if [ -f ".env" ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Log file
LOG_DIR="logs/training"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/training_$(date +%Y%m%d_%H%M%S).log"

echo "========================================" | tee -a "$LOG_FILE"
echo "ML Training Pipeline - Scheduled Run" | tee -a "$LOG_FILE"
echo "Started at: $(date)" | tee -a "$LOG_FILE"
echo "========================================" | tee -a "$LOG_FILE"

# Run training for all models
python -m ml_service.training.cli \
    --model delay_predictor \
    --model-type regression \
    --n-trials 50 \
    2>&1 | tee -a "$LOG_FILE"

DELAY_EXIT_CODE=$?

python -m ml_service.training.cli \
    --model severity_classifier \
    --model-type classification \
    --n-trials 50 \
    2>&1 | tee -a "$LOG_FILE"

SEVERITY_EXIT_CODE=$?

python -m ml_service.training.cli \
    --model demand_forecaster \
    --model-type forecasting \
    --n-trials 50 \
    2>&1 | tee -a "$LOG_FILE"

FORECASTER_EXIT_CODE=$?

echo "========================================" | tee -a "$LOG_FILE"
echo "Training Pipeline Completed" | tee -a "$LOG_FILE"
echo "Delay Predictor: $([ $DELAY_EXIT_CODE -eq 0 ] && echo 'SUCCESS' || echo 'FAILED')" | tee -a "$LOG_FILE"
echo "Severity Classifier: $([ $SEVERITY_EXIT_CODE -eq 0 ] && echo 'SUCCESS' || echo 'FAILED')" | tee -a "$LOG_FILE"
echo "Demand Forecaster: $([ $FORECASTER_EXIT_CODE -eq 0 ] && echo 'SUCCESS' || echo 'FAILED')" | tee -a "$LOG_FILE"
echo "Finished at: $(date)" | tee -a "$LOG_FILE"
echo "========================================" | tee -a "$LOG_FILE"

# Exit with error if any training failed
if [ $DELAY_EXIT_CODE -ne 0 ] || [ $SEVERITY_EXIT_CODE -ne 0 ] || [ $FORECASTER_EXIT_CODE -ne 0 ]; then
    exit 1
fi

exit 0

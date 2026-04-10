# ERIS ML Service

Machine Learning service for the Emergency Response Intelligence System (ERIS).

## Features

- **Data Generation**: Create realistic emergency response datasets
- **Feature Store**: Centralized feature management with Redis and Parquet
- **Multi-Model Predictions**: Delay, severity, hospital recommendations, demand forecasting, resource allocation, pattern analysis
- **Explainability**: SHAP values and natural language explanations for all predictions
- **Training Pipeline**: Automated model training with MLflow
- **Data Quality Monitoring**: Automated quality checks and alerting

## Setup

### Prerequisites

- Python 3.11+
- PostgreSQL
- Redis
- MLflow (optional, for model registry)

### Installation

1. Create virtual environment:
```bash
cd ml_service
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Configure environment:
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Run database migrations:
```bash
cd ../backend
npx prisma migrate deploy
```

### Running the Service

Development mode:
```bash
python app.py
```

Production mode:
```bash
uvicorn app:app --host 0.0.0.0 --port 8000 --workers 4
```

### Running Tests

```bash
pytest tests/
```

With coverage:
```bash
pytest --cov=. --cov-report=html tests/
```

## API Documentation

Once running, visit:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## Directory Structure

```
ml_service/
├── app.py                 # FastAPI application
├── config.py              # Configuration management
├── requirements.txt       # Python dependencies
├── data_generator/        # Dataset generation
├── feature_store/         # Feature management
├── models/                # ML models
├── explainability/        # SHAP and explanations
├── training/              # Training pipeline
├── utils/                 # Utilities
├── tests/                 # Tests
└── data/                  # Data storage
    └── features/          # Feature store offline storage
```

## Development

### Adding a New Model

1. Create model class in `models/`
2. Add training logic in `training/`
3. Add prediction endpoint in `app.py`
4. Add tests in `tests/`

### Adding a New Feature

1. Define feature in `feature_store/registry.py`
2. Implement computation in `feature_store/features.py`
3. Add tests in `tests/feature_store/`

## License

See main project LICENSE file.

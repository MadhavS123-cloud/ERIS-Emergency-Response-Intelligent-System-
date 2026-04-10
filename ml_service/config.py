"""
Configuration management for ML Service
"""
import os
from dotenv import load_dotenv
from pathlib import Path

load_dotenv()


class Config:
    """ML Service configuration"""
    
    # Service
    ML_SERVICE_PORT = int(os.getenv("ML_SERVICE_PORT", 8000))
    ML_SERVICE_HOST = os.getenv("ML_SERVICE_HOST", "0.0.0.0")
    
    # Database
    DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://user:password@localhost:5432/eris")
    
    # Redis (Feature Store)
    REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
    REDIS_PORT = int(os.getenv("REDIS_PORT", 6379))
    REDIS_DB = int(os.getenv("REDIS_DB", 0))
    REDIS_PASSWORD = os.getenv("REDIS_PASSWORD", "")
    
    # MLflow
    MLFLOW_TRACKING_URI = os.getenv("MLFLOW_TRACKING_URI", "http://localhost:5000")
    MLFLOW_EXPERIMENT_NAME = os.getenv("MLFLOW_EXPERIMENT_NAME", "eris-ml")
    
    # Feature Store
    FEATURE_STORE_OFFLINE_PATH = Path(os.getenv("FEATURE_STORE_OFFLINE_PATH", "./data/features"))
    
    # Model paths
    MODEL_CACHE_DIR = Path(os.getenv("MODEL_CACHE_DIR", "./models/cache"))
    MODEL_CACHE_TTL = int(os.getenv("MODEL_CACHE_TTL", 3600))
    
    # Performance
    MAX_WORKERS = int(os.getenv("MAX_WORKERS", 4))
    BATCH_SIZE = int(os.getenv("BATCH_SIZE", 32))
    
    # Logging
    LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
    
    @classmethod
    def ensure_directories(cls):
        """Ensure required directories exist"""
        cls.FEATURE_STORE_OFFLINE_PATH.mkdir(parents=True, exist_ok=True)
        cls.MODEL_CACHE_DIR.mkdir(parents=True, exist_ok=True)


# Ensure directories exist on import
Config.ensure_directories()

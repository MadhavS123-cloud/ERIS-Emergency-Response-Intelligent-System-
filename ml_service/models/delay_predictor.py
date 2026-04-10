"""
Delay Predictor Model
Enhanced gradient boosting model for ambulance arrival delay prediction
"""
from sklearn.ensemble import GradientBoostingRegressor
import pandas as pd
import numpy as np
import joblib
from pathlib import Path
import logging
from ml_service.utils.cache import get_model_cache

logger = logging.getLogger(__name__)


class DelayPredictor:
    """Predicts ambulance arrival delays using gradient boosting"""
    
    FEATURE_NAMES = [
        "hour_of_day",
        "day_of_week",
        "distance_to_nearest_hospital_km",
        "traffic_severity_score",
        "weather_adjusted_delay",
        "available_ambulances_nearby",
        "traffic_adjusted_distance",
        "is_weekend"
    ]
    
    def __init__(self, model_path: str = None):
        """
        Initialize delay predictor.
        
        Args:
            model_path: Path to saved model file (optional)
        """
        self.model = None
        self.is_trained = False
        
        if model_path and Path(model_path).exists():
            self.load(model_path)
    
    def train(self, X: pd.DataFrame, y: pd.Series) -> dict:
        """
        Train the delay prediction model.
        
        Args:
            X: Feature DataFrame
            y: Target delays in minutes
        
        Returns:
            Training metrics
        """
        logger.info("Training delay predictor...")
        
        # Initialize model
        self.model = GradientBoostingRegressor(
            n_estimators=200,
            max_depth=8,
            learning_rate=0.05,
            min_samples_split=10,
            min_samples_leaf=4,
            subsample=0.8,
            random_state=42
        )
        
        # Train
        self.model.fit(X[self.FEATURE_NAMES], y)
        self.is_trained = True
        
        # Calculate training metrics
        train_pred = self.model.predict(X[self.FEATURE_NAMES])
        mae = np.mean(np.abs(train_pred - y))
        rmse = np.sqrt(np.mean((train_pred - y) ** 2))
        
        logger.info(f"Training complete. MAE: {mae:.2f}, RMSE: {rmse:.2f}")
        
        return {
            "mae": float(mae),
            "rmse": float(rmse),
            "n_samples": len(X)
        }
    
    def predict(self, features: dict) -> dict:
        """
        Predict delay for a single request.
        
        Args:
            features: Dictionary of feature values
        
        Returns:
            Prediction dict with delay_minutes, risk_category, confidence
        """
        if not self.is_trained:
            # Return default prediction if model not trained
            logger.warning("Model not trained, returning default prediction")
            return self._default_prediction(features)
        
        # Prepare features
        X = pd.DataFrame([features])[self.FEATURE_NAMES]
        
        # Predict
        delay = self.model.predict(X)[0]
        delay = max(3.0, delay)  # Minimum 3 minutes
        
        # Categorize risk
        risk_category = self._categorize_risk(delay)
        
        # Estimate confidence (simplified)
        confidence = 0.85
        
        return {
            "delay_minutes": round(delay, 2),
            "risk_category": risk_category,
            "confidence": confidence,
            "prediction_interval": [
                round(delay * 0.8, 2),
                round(delay * 1.2, 2)
            ]
        }
    
    def _categorize_risk(self, delay: float) -> str:
        """Categorize delay into risk levels"""
        if delay < 8:
            return "Low"
        elif delay < 15:
            return "Medium"
        elif delay < 25:
            return "High"
        else:
            return "Severe"
    
    def _default_prediction(self, features: dict) -> dict:
        """Generate default prediction when model not trained"""
        # Simple heuristic based on distance and traffic
        distance = features.get("distance_to_nearest_hospital_km", 5.0)
        traffic_score = features.get("traffic_severity_score", 0.5)
        
        delay = distance * 2.0 * (1 + traffic_score)
        
        return {
            "delay_minutes": round(delay, 2),
            "risk_category": self._categorize_risk(delay),
            "confidence": 0.5,
            "prediction_interval": [round(delay * 0.7, 2), round(delay * 1.3, 2)],
            "note": "Default prediction (model not trained)"
        }
    
    def save(self, path: str):
        """Save model to disk"""
        if not self.is_trained:
            raise ValueError("Cannot save untrained model")
        
        joblib.dump(self.model, path)
        logger.info(f"Model saved to {path}")
    
    def load(self, path: str):
        """Load model from disk with caching"""
        # Try to get from cache first
        cache = get_model_cache()
        cached_model = cache.get(f"delay_predictor_{path}")
        
        if cached_model is not None:
            self.model = cached_model
            self.is_trained = True
            logger.info(f"Model loaded from cache for {path}")
            return
        
        # Load from disk
        self.model = joblib.load(path)
        self.is_trained = True
        
        # Cache the model
        cache.set(f"delay_predictor_{path}", self.model)
        logger.info(f"Model loaded from {path} and cached")

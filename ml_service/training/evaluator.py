"""
Model Evaluator
Comprehensive model evaluation with multiple metrics
"""
import numpy as np
import pandas as pd
from typing import Dict, Any, List
from sklearn.metrics import (
    mean_absolute_error,
    mean_squared_error,
    r2_score,
    accuracy_score,
    precision_recall_fscore_support,
    roc_auc_score,
    confusion_matrix,
    classification_report
)
import logging

logger = logging.getLogger(__name__)


class ModelEvaluator:
    """Evaluates ML models with comprehensive metrics"""
    
    def evaluate(
        self,
        model: Any,
        X_test: pd.DataFrame,
        y_test: pd.Series,
        model_type: str
    ) -> Dict[str, float]:
        """
        Evaluate model performance.
        
        Args:
            model: Trained model
            X_test: Test features
            y_test: Test labels
            model_type: Type of model ("regression", "classification", "forecasting")
        
        Returns:
            Dictionary of evaluation metrics
        """
        logger.info(f"Evaluating {model_type} model on {len(X_test)} test samples")
        
        # Make predictions
        y_pred = model.predict(X_test)
        
        if model_type == "regression":
            metrics = self._evaluate_regression(y_test, y_pred)
        elif model_type == "classification":
            metrics = self._evaluate_classification(y_test, y_pred, model, X_test)
        elif model_type == "forecasting":
            metrics = self._evaluate_forecasting(y_test, y_pred)
        else:
            raise ValueError(f"Unsupported model type: {model_type}")
        
        logger.info(f"Evaluation complete: {metrics}")
        return metrics
    
    def _evaluate_regression(
        self,
        y_true: pd.Series,
        y_pred: np.ndarray
    ) -> Dict[str, float]:
        """
        Evaluate regression model.
        
        Metrics:
        - MAE (Mean Absolute Error)
        - RMSE (Root Mean Squared Error)
        - R² Score
        - MAPE (Mean Absolute Percentage Error)
        """
        mae = mean_absolute_error(y_true, y_pred)
        rmse = np.sqrt(mean_squared_error(y_true, y_pred))
        r2 = r2_score(y_true, y_pred)
        
        # MAPE (avoid division by zero)
        mask = y_true != 0
        mape = np.mean(np.abs((y_true[mask] - y_pred[mask]) / y_true[mask])) * 100 if mask.sum() > 0 else 0
        
        return {
            "mae": float(mae),
            "rmse": float(rmse),
            "r2": float(r2),
            "mape": float(mape)
        }
    
    def _evaluate_classification(
        self,
        y_true: pd.Series,
        y_pred: np.ndarray,
        model: Any,
        X_test: pd.DataFrame
    ) -> Dict[str, float]:
        """
        Evaluate classification model.
        
        Metrics:
        - Accuracy
        - Precision (macro average)
        - Recall (macro average)
        - F1 Score (macro average)
        - AUC-ROC (if probability predictions available)
        """
        accuracy = accuracy_score(y_true, y_pred)
        
        # Precision, Recall, F1
        precision, recall, f1, _ = precision_recall_fscore_support(
            y_true, y_pred, average='macro', zero_division=0
        )
        
        metrics = {
            "accuracy": float(accuracy),
            "precision": float(precision),
            "recall": float(recall),
            "f1": float(f1)
        }
        
        # AUC-ROC (if model supports probability predictions)
        try:
            if hasattr(model, 'predict_proba'):
                y_proba = model.predict_proba(X_test)
                
                # For binary classification
                if y_proba.shape[1] == 2:
                    auc = roc_auc_score(y_true, y_proba[:, 1])
                    metrics["auc_roc"] = float(auc)
                # For multi-class
                else:
                    auc = roc_auc_score(y_true, y_proba, multi_class='ovr', average='macro')
                    metrics["auc_roc"] = float(auc)
        except Exception as e:
            logger.warning(f"Could not compute AUC-ROC: {e}")
        
        return metrics
    
    def _evaluate_forecasting(
        self,
        y_true: pd.Series,
        y_pred: np.ndarray
    ) -> Dict[str, float]:
        """
        Evaluate forecasting model.
        
        Metrics:
        - MAE (Mean Absolute Error)
        - RMSE (Root Mean Squared Error)
        - MAPE (Mean Absolute Percentage Error)
        - Directional Accuracy (% of correct direction predictions)
        """
        mae = mean_absolute_error(y_true, y_pred)
        rmse = np.sqrt(mean_squared_error(y_true, y_pred))
        
        # MAPE
        mask = y_true != 0
        mape = np.mean(np.abs((y_true[mask] - y_pred[mask]) / y_true[mask])) * 100 if mask.sum() > 0 else 0
        
        # Directional accuracy (for time series)
        if len(y_true) > 1:
            true_direction = np.diff(y_true) > 0
            pred_direction = np.diff(y_pred) > 0
            directional_accuracy = np.mean(true_direction == pred_direction) * 100
        else:
            directional_accuracy = 0
        
        return {
            "mae": float(mae),
            "rmse": float(rmse),
            "mape": float(mape),
            "directional_accuracy": float(directional_accuracy)
        }
    
    def generate_evaluation_report(
        self,
        model: Any,
        X_test: pd.DataFrame,
        y_test: pd.Series,
        model_type: str,
        model_name: str
    ) -> Dict[str, Any]:
        """
        Generate comprehensive evaluation report.
        
        Args:
            model: Trained model
            X_test: Test features
            y_test: Test labels
            model_type: Type of model
            model_name: Name of the model
        
        Returns:
            Dictionary with metrics, feature importance, and error analysis
        """
        logger.info(f"Generating evaluation report for {model_name}")
        
        # Get metrics
        metrics = self.evaluate(model, X_test, y_test, model_type)
        
        # Get feature importance (if available)
        feature_importance = self._get_feature_importance(model, X_test.columns)
        
        # Error analysis
        y_pred = model.predict(X_test)
        error_analysis = self._analyze_errors(y_test, y_pred, model_type)
        
        report = {
            "model_name": model_name,
            "model_type": model_type,
            "num_test_samples": len(X_test),
            "metrics": metrics,
            "feature_importance": feature_importance,
            "error_analysis": error_analysis
        }
        
        return report
    
    def _get_feature_importance(
        self,
        model: Any,
        feature_names: List[str]
    ) -> Dict[str, float]:
        """Extract feature importance from model"""
        try:
            if hasattr(model, 'feature_importances_'):
                importances = model.feature_importances_
                return {
                    name: float(importance)
                    for name, importance in zip(feature_names, importances)
                }
        except Exception as e:
            logger.warning(f"Could not extract feature importance: {e}")
        
        return {}
    
    def _analyze_errors(
        self,
        y_true: pd.Series,
        y_pred: np.ndarray,
        model_type: str
    ) -> Dict[str, Any]:
        """Analyze prediction errors"""
        if model_type == "regression":
            errors = y_true - y_pred
            
            return {
                "mean_error": float(np.mean(errors)),
                "std_error": float(np.std(errors)),
                "max_error": float(np.max(np.abs(errors))),
                "error_percentiles": {
                    "p25": float(np.percentile(errors, 25)),
                    "p50": float(np.percentile(errors, 50)),
                    "p75": float(np.percentile(errors, 75)),
                    "p90": float(np.percentile(errors, 90))
                }
            }
        
        elif model_type == "classification":
            # Confusion matrix
            cm = confusion_matrix(y_true, y_pred)
            
            return {
                "confusion_matrix": cm.tolist(),
                "num_classes": len(np.unique(y_true)),
                "misclassification_rate": float(1 - accuracy_score(y_true, y_pred))
            }
        
        return {}

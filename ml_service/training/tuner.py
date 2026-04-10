"""
Hyperparameter Tuner
Automated hyperparameter optimization using Optuna
"""
import optuna
import pandas as pd
import numpy as np
from typing import Dict, Any
from sklearn.ensemble import GradientBoostingRegressor, RandomForestClassifier
from sklearn.metrics import mean_absolute_error, accuracy_score
import logging
import mlflow

logger = logging.getLogger(__name__)


class HyperparameterTuner:
    """Hyperparameter optimization using Optuna"""
    
    def tune(
        self,
        X_train: pd.DataFrame,
        y_train: pd.Series,
        X_val: pd.DataFrame,
        y_val: pd.Series,
        model_type: str = "regression",
        n_trials: int = 50,
        timeout: int = 3600
    ) -> Dict[str, Any]:
        """
        Perform hyperparameter tuning.
        
        Args:
            X_train: Training features
            y_train: Training labels
            X_val: Validation features
            y_val: Validation labels
            model_type: Type of model ("regression" or "classification")
            n_trials: Number of Optuna trials
            timeout: Timeout in seconds
        
        Returns:
            Dictionary of best hyperparameters
        """
        logger.info(f"Starting hyperparameter tuning for {model_type} model")
        logger.info(f"Running {n_trials} trials with {timeout}s timeout")
        
        # Create Optuna study
        direction = "minimize" if model_type == "regression" else "maximize"
        study = optuna.create_study(direction=direction)
        
        # Define objective function
        def objective(trial):
            return self._objective(
                trial, X_train, y_train, X_val, y_val, model_type
            )
        
        # Run optimization
        study.optimize(
            objective,
            n_trials=n_trials,
            timeout=timeout,
            show_progress_bar=True
        )
        
        logger.info(f"Best trial: {study.best_trial.number}")
        logger.info(f"Best value: {study.best_value}")
        logger.info(f"Best params: {study.best_params}")
        
        # Log to MLflow
        mlflow.log_params({f"optuna_{k}": v for k, v in study.best_params.items()})
        mlflow.log_metric("optuna_best_value", study.best_value)
        mlflow.log_metric("optuna_n_trials", len(study.trials))
        
        return study.best_params
    
    def _objective(
        self,
        trial: optuna.Trial,
        X_train: pd.DataFrame,
        y_train: pd.Series,
        X_val: pd.DataFrame,
        y_val: pd.Series,
        model_type: str
    ) -> float:
        """
        Objective function for Optuna optimization.
        
        Args:
            trial: Optuna trial
            X_train: Training features
            y_train: Training labels
            X_val: Validation features
            y_val: Validation labels
            model_type: Type of model
        
        Returns:
            Validation metric (MAE for regression, accuracy for classification)
        """
        if model_type == "regression":
            return self._objective_regression(trial, X_train, y_train, X_val, y_val)
        elif model_type == "classification":
            return self._objective_classification(trial, X_train, y_train, X_val, y_val)
        else:
            raise ValueError(f"Unsupported model type: {model_type}")
    
    def _objective_regression(
        self,
        trial: optuna.Trial,
        X_train: pd.DataFrame,
        y_train: pd.Series,
        X_val: pd.DataFrame,
        y_val: pd.Series
    ) -> float:
        """Objective function for regression models"""
        # Define hyperparameter search space
        params = {
            "n_estimators": trial.suggest_int("n_estimators", 100, 500),
            "max_depth": trial.suggest_int("max_depth", 3, 15),
            "learning_rate": trial.suggest_float("learning_rate", 0.01, 0.3, log=True),
            "min_samples_split": trial.suggest_int("min_samples_split", 2, 20),
            "min_samples_leaf": trial.suggest_int("min_samples_leaf", 1, 10),
            "subsample": trial.suggest_float("subsample", 0.6, 1.0),
            "random_state": 42
        }
        
        # Train model
        model = GradientBoostingRegressor(**params)
        model.fit(X_train, y_train)
        
        # Evaluate on validation set
        y_pred = model.predict(X_val)
        mae = mean_absolute_error(y_val, y_pred)
        
        return mae
    
    def _objective_classification(
        self,
        trial: optuna.Trial,
        X_train: pd.DataFrame,
        y_train: pd.Series,
        X_val: pd.DataFrame,
        y_val: pd.Series
    ) -> float:
        """Objective function for classification models"""
        # Define hyperparameter search space
        params = {
            "n_estimators": trial.suggest_int("n_estimators", 50, 300),
            "max_depth": trial.suggest_int("max_depth", 3, 20),
            "min_samples_split": trial.suggest_int("min_samples_split", 2, 20),
            "min_samples_leaf": trial.suggest_int("min_samples_leaf", 1, 10),
            "max_features": trial.suggest_categorical("max_features", ["sqrt", "log2", None]),
            "random_state": 42
        }
        
        # Train model
        model = RandomForestClassifier(**params)
        model.fit(X_train, y_train)
        
        # Evaluate on validation set
        y_pred = model.predict(X_val)
        accuracy = accuracy_score(y_val, y_pred)
        
        return accuracy
    
    def get_search_space(self, model_type: str) -> Dict[str, Any]:
        """
        Get hyperparameter search space for a model type.
        
        Args:
            model_type: Type of model
        
        Returns:
            Dictionary describing search space
        """
        if model_type == "regression":
            return {
                "n_estimators": {"type": "int", "range": [100, 500]},
                "max_depth": {"type": "int", "range": [3, 15]},
                "learning_rate": {"type": "float", "range": [0.01, 0.3], "log": True},
                "min_samples_split": {"type": "int", "range": [2, 20]},
                "min_samples_leaf": {"type": "int", "range": [1, 10]},
                "subsample": {"type": "float", "range": [0.6, 1.0]}
            }
        
        elif model_type == "classification":
            return {
                "n_estimators": {"type": "int", "range": [50, 300]},
                "max_depth": {"type": "int", "range": [3, 20]},
                "min_samples_split": {"type": "int", "range": [2, 20]},
                "min_samples_leaf": {"type": "int", "range": [1, 10]},
                "max_features": {"type": "categorical", "choices": ["sqrt", "log2", None]}
            }
        
        else:
            raise ValueError(f"Unsupported model type: {model_type}")

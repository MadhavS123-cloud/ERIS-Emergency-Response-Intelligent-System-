"""
Tests for Training Pipeline
"""
import pytest
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from unittest.mock import Mock, patch, MagicMock

from ml_service.training.pipeline import TrainingPipeline
from ml_service.training.evaluator import ModelEvaluator
from ml_service.training.tuner import HyperparameterTuner


class TestTrainingPipeline:
    """Test TrainingPipeline class"""
    
    def test_split_data_temporal(self):
        """Test temporal data splitting maintains ordering"""
        # Create sample data with timestamps
        dates = pd.date_range(start='2024-01-01', end='2024-12-31', freq='D')
        df = pd.DataFrame({
            'timestamp': dates,
            'feature1': np.random.randn(len(dates)),
            'feature2': np.random.randn(len(dates)),
            'delay_minutes': np.random.uniform(5, 30, len(dates))
        })
        
        pipeline = TrainingPipeline()
        
        X_train, X_val, X_test, y_train, y_val, y_test = pipeline.split_data_temporal(
            df, target_column='delay_minutes'
        )
        
        # Verify split sizes (70/15/15)
        total = len(df)
        assert len(X_train) == int(total * 0.7)
        assert len(X_val) == int(total * 0.15)
        assert len(X_test) == total - len(X_train) - len(X_val)
        
        # Verify no data leakage (temporal ordering)
        train_df = df.iloc[:len(X_train)]
        val_df = df.iloc[len(X_train):len(X_train) + len(X_val)]
        test_df = df.iloc[len(X_train) + len(X_val):]
        
        assert train_df['timestamp'].max() < val_df['timestamp'].min()
        assert val_df['timestamp'].max() < test_df['timestamp'].min()
    
    def test_split_data_proportions(self):
        """Test data split proportions are correct"""
        df = pd.DataFrame({
            'feature1': np.random.randn(1000),
            'feature2': np.random.randn(1000),
            'target': np.random.randn(1000)
        })
        
        pipeline = TrainingPipeline()
        
        X_train, X_val, X_test, y_train, y_val, y_test = pipeline.split_data_temporal(
            df, target_column='target'
        )
        
        # Check proportions (with tolerance)
        total = len(df)
        assert abs(len(X_train) / total - 0.7) < 0.01
        assert abs(len(X_val) / total - 0.15) < 0.01
        assert abs(len(X_test) / total - 0.15) < 0.01


class TestModelEvaluator:
    """Test ModelEvaluator class"""
    
    def test_evaluate_regression(self):
        """Test regression model evaluation"""
        evaluator = ModelEvaluator()
        
        # Create mock predictions
        y_true = pd.Series([10, 15, 20, 25, 30])
        y_pred = np.array([11, 14, 21, 24, 29])
        
        metrics = evaluator._evaluate_regression(y_true, y_pred)
        
        # Verify metrics are computed
        assert 'mae' in metrics
        assert 'rmse' in metrics
        assert 'r2' in metrics
        assert 'mape' in metrics
        
        # Verify MAE is correct
        expected_mae = np.mean(np.abs(y_true - y_pred))
        assert abs(metrics['mae'] - expected_mae) < 0.01
    
    def test_evaluate_classification(self):
        """Test classification model evaluation"""
        evaluator = ModelEvaluator()
        
        # Create mock predictions
        y_true = pd.Series([0, 1, 0, 1, 1, 0, 1, 0])
        y_pred = np.array([0, 1, 0, 1, 0, 0, 1, 1])
        
        # Create mock model
        mock_model = Mock()
        mock_model.predict_proba = Mock(return_value=np.array([
            [0.9, 0.1], [0.2, 0.8], [0.8, 0.2], [0.3, 0.7],
            [0.6, 0.4], [0.7, 0.3], [0.1, 0.9], [0.4, 0.6]
        ]))
        
        X_test = pd.DataFrame({'feature1': range(8)})
        
        metrics = evaluator._evaluate_classification(y_true, y_pred, mock_model, X_test)
        
        # Verify metrics are computed
        assert 'accuracy' in metrics
        assert 'precision' in metrics
        assert 'recall' in metrics
        assert 'f1' in metrics
        assert 'auc_roc' in metrics
        
        # Verify accuracy is correct
        expected_accuracy = np.mean(y_true == y_pred)
        assert abs(metrics['accuracy'] - expected_accuracy) < 0.01


class TestHyperparameterTuner:
    """Test HyperparameterTuner class"""
    
    def test_get_search_space_regression(self):
        """Test regression search space definition"""
        tuner = HyperparameterTuner()
        
        search_space = tuner.get_search_space("regression")
        
        # Verify search space has expected parameters
        assert 'n_estimators' in search_space
        assert 'max_depth' in search_space
        assert 'learning_rate' in search_space
        assert 'min_samples_split' in search_space
        assert 'min_samples_leaf' in search_space
        assert 'subsample' in search_space
    
    def test_get_search_space_classification(self):
        """Test classification search space definition"""
        tuner = HyperparameterTuner()
        
        search_space = tuner.get_search_space("classification")
        
        # Verify search space has expected parameters
        assert 'n_estimators' in search_space
        assert 'max_depth' in search_space
        assert 'min_samples_split' in search_space
        assert 'min_samples_leaf' in search_space
        assert 'max_features' in search_space
    
    @pytest.mark.slow
    def test_tune_regression_small(self):
        """Test hyperparameter tuning with small dataset"""
        # Create small synthetic dataset
        np.random.seed(42)
        X_train = pd.DataFrame({
            'feature1': np.random.randn(100),
            'feature2': np.random.randn(100)
        })
        y_train = pd.Series(X_train['feature1'] * 2 + X_train['feature2'] + np.random.randn(100) * 0.1)
        
        X_val = pd.DataFrame({
            'feature1': np.random.randn(30),
            'feature2': np.random.randn(30)
        })
        y_val = pd.Series(X_val['feature1'] * 2 + X_val['feature2'] + np.random.randn(30) * 0.1)
        
        tuner = HyperparameterTuner()
        
        # Run tuning with few trials
        best_params = tuner.tune(
            X_train, y_train,
            X_val, y_val,
            model_type="regression",
            n_trials=5,
            timeout=30
        )
        
        # Verify best params are returned
        assert isinstance(best_params, dict)
        assert 'n_estimators' in best_params
        assert 'max_depth' in best_params


class TestTrainingPipelineIntegration:
    """Integration tests for training pipeline"""
    
    @patch('ml_service.training.pipeline.DatabaseClient')
    @patch('ml_service.training.pipeline.mlflow')
    def test_extract_training_data(self, mock_mlflow, mock_db):
        """Test training data extraction from database"""
        # Mock database response
        mock_db.execute_query.return_value = [
            {
                'request_id': 'uuid1',
                'timestamp': datetime(2024, 1, 1, 10, 0),
                'location_lat': 40.7128,
                'location_lng': -74.0060,
                'emergency_type': 'cardiac',
                'delay_minutes': 15.5
            },
            {
                'request_id': 'uuid2',
                'timestamp': datetime(2024, 1, 2, 14, 30),
                'location_lat': 40.7580,
                'location_lng': -73.9855,
                'emergency_type': 'trauma',
                'delay_minutes': 12.3
            }
        ]
        
        pipeline = TrainingPipeline()
        
        start_date = datetime(2024, 1, 1)
        end_date = datetime(2024, 1, 31)
        
        df = pipeline.extract_training_data(start_date, end_date)
        
        # Verify data extraction
        assert len(df) == 2
        assert 'request_id' in df.columns
        assert 'timestamp' in df.columns
        assert 'location_lat' in df.columns
        assert 'delay_minutes' in df.columns
        
        # Verify database was queried
        mock_db.execute_query.assert_called_once()


if __name__ == '__main__':
    pytest.main([__file__, '-v'])

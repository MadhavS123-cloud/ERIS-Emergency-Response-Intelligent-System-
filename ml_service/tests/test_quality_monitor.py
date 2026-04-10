"""
Unit tests for DataQualityMonitor
"""
import pytest
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from unittest.mock import Mock, patch, MagicMock
from sqlalchemy import create_engine

from ml_service.quality.monitor import DataQualityMonitor


@pytest.fixture
def mock_engine():
    """Create a mock database engine"""
    engine = Mock()
    return engine


@pytest.fixture
def quality_monitor(mock_engine):
    """Create a DataQualityMonitor instance with mocked engine"""
    with patch('ml_service.quality.monitor.create_engine', return_value=mock_engine):
        monitor = DataQualityMonitor()
    return monitor


class TestDataCompleteness:
    """Tests for data completeness monitoring"""
    
    def test_completeness_all_complete(self, quality_monitor, mock_engine):
        """Test completeness check with 100% complete data"""
        # Mock data with no missing values
        df = pd.DataFrame({
            'col1': [1, 2, 3, 4, 5],
            'col2': ['a', 'b', 'c', 'd', 'e'],
            'col3': [1.0, 2.0, 3.0, 4.0, 5.0]
        })
        
        with patch('pandas.read_sql', return_value=df):
            result = quality_monitor.check_data_completeness(
                'test_table',
                ['col1', 'col2', 'col3']
            )
        
        assert result['status'] == 'pass'
        assert result['metric_value'] == 1.0
        assert result['details']['overall_completeness'] == 1.0
        assert result['details']['total_rows'] == 5
    
    def test_completeness_with_missing_values(self, quality_monitor, mock_engine):
        """Test completeness check with missing values"""
        # Mock data with missing values
        df = pd.DataFrame({
            'col1': [1, 2, None, 4, 5],
            'col2': ['a', None, 'c', 'd', 'e'],
            'col3': [1.0, 2.0, 3.0, None, 5.0]
        })
        
        with patch('pandas.read_sql', return_value=df):
            result = quality_monitor.check_data_completeness(
                'test_table',
                ['col1', 'col2', 'col3']
            )
        
        assert result['status'] in ['warning', 'fail']
        assert result['metric_value'] < 1.0
        assert result['details']['by_column']['col1']['missing_count'] == 1
        assert result['details']['by_column']['col2']['missing_count'] == 1
    
    def test_completeness_empty_table(self, quality_monitor, mock_engine):
        """Test completeness check with empty table"""
        df = pd.DataFrame(columns=['col1', 'col2'])
        
        with patch('pandas.read_sql', return_value=df):
            result = quality_monitor.check_data_completeness(
                'test_table',
                ['col1', 'col2']
            )
        
        assert result['status'] == 'warning'
        assert result['details']['total_rows'] == 0


class TestDistributionShift:
    """Tests for distribution shift detection"""
    
    def test_no_distribution_shift(self, quality_monitor, mock_engine):
        """Test drift detection with no shift"""
        # Create baseline and recent data from same distribution
        np.random.seed(42)
        baseline_df = pd.DataFrame({
            'value': np.random.normal(100, 10, 1000)
        })
        recent_df = pd.DataFrame({
            'value': np.random.normal(100, 10, 100)
        })
        
        def mock_read_sql(query, engine, params):
            if 'end_date' in params:
                return baseline_df
            else:
                return recent_df
        
        with patch('pandas.read_sql', side_effect=mock_read_sql):
            result = quality_monitor.detect_distribution_shift(
                'test_table',
                'value'
            )
        
        assert result['status'] == 'pass'
        assert result['details']['p_value'] >= 0.05
    
    def test_significant_distribution_shift(self, quality_monitor, mock_engine):
        """Test drift detection with significant shift"""
        # Create baseline and recent data from different distributions
        np.random.seed(42)
        baseline_df = pd.DataFrame({
            'value': np.random.normal(100, 10, 1000)
        })
        recent_df = pd.DataFrame({
            'value': np.random.normal(150, 10, 100)  # Shifted mean
        })
        
        def mock_read_sql(query, engine, params):
            if 'end_date' in params:
                return baseline_df
            else:
                return recent_df
        
        with patch('pandas.read_sql', side_effect=mock_read_sql):
            result = quality_monitor.detect_distribution_shift(
                'test_table',
                'value'
            )
        
        assert result['status'] in ['warning', 'fail']
        assert result['details']['p_value'] < 0.05
    
    def test_insufficient_data_for_drift(self, quality_monitor, mock_engine):
        """Test drift detection with insufficient data"""
        baseline_df = pd.DataFrame({'value': [1, 2, 3]})
        recent_df = pd.DataFrame({'value': [4, 5, 6]})
        
        def mock_read_sql(query, engine, params):
            if 'end_date' in params:
                return baseline_df
            else:
                return recent_df
        
        with patch('pandas.read_sql', side_effect=mock_read_sql):
            result = quality_monitor.detect_distribution_shift(
                'test_table',
                'value'
            )
        
        assert result['status'] == 'warning'
        assert 'Insufficient data' in result['message']


class TestConsistencyValidation:
    """Tests for data consistency validation"""
    
    def test_range_validation_pass(self, quality_monitor, mock_engine):
        """Test range validation with all values in range"""
        result_df = pd.DataFrame({
            'total': [100],
            'violations': [0]
        })
        
        with patch('pandas.read_sql', return_value=result_df):
            result = quality_monitor.validate_data_consistency(
                'test_table',
                [{'type': 'range', 'column': 'value', 'rule': {'min': 0, 'max': 100}}]
            )
        
        assert result['status'] == 'pass'
        assert result['metric_value'] == 1.0
    
    def test_range_validation_with_violations(self, quality_monitor, mock_engine):
        """Test range validation with violations"""
        result_df = pd.DataFrame({
            'total': [100],
            'violations': [5]
        })
        
        with patch('pandas.read_sql', return_value=result_df):
            result = quality_monitor.validate_data_consistency(
                'test_table',
                [{'type': 'range', 'column': 'value', 'rule': {'min': 0, 'max': 100}}]
            )
        
        assert result['status'] in ['warning', 'fail']
        assert result['metric_value'] == 0.95
    
    def test_non_negative_validation(self, quality_monitor, mock_engine):
        """Test non-negative validation"""
        result_df = pd.DataFrame({
            'total': [100],
            'violations': [0]
        })
        
        with patch('pandas.read_sql', return_value=result_df):
            result = quality_monitor.validate_data_consistency(
                'test_table',
                [{'type': 'non_negative', 'column': 'distance_km'}]
            )
        
        assert result['status'] == 'pass'


class TestOutlierDetection:
    """Tests for outlier detection"""
    
    def test_outlier_detection_zscore_no_outliers(self, quality_monitor, mock_engine):
        """Test Z-score outlier detection with no outliers"""
        np.random.seed(42)
        df = pd.DataFrame({
            'value': np.random.normal(100, 10, 1000)
        })
        
        with patch('pandas.read_sql', return_value=df):
            result = quality_monitor.detect_outliers(
                'test_table',
                'value',
                method='zscore'
            )
        
        assert result['status'] == 'pass'
        assert result['details']['outlier_percentage'] <= 1.0
    
    def test_outlier_detection_with_outliers(self, quality_monitor, mock_engine):
        """Test outlier detection with injected outliers"""
        np.random.seed(42)
        values = list(np.random.normal(100, 10, 95))
        values.extend([200, 210, 220, 230, 240])  # Add outliers
        
        df = pd.DataFrame({'value': values})
        
        with patch('pandas.read_sql', return_value=df):
            result = quality_monitor.detect_outliers(
                'test_table',
                'value',
                method='zscore'
            )
        
        assert result['details']['outlier_count'] > 0
        assert result['details']['outlier_percentage'] > 0
    
    def test_outlier_detection_iqr_method(self, quality_monitor, mock_engine):
        """Test IQR outlier detection method"""
        np.random.seed(42)
        df = pd.DataFrame({
            'value': np.random.normal(100, 10, 1000)
        })
        
        with patch('pandas.read_sql', return_value=df):
            result = quality_monitor.detect_outliers(
                'test_table',
                'value',
                method='iqr'
            )
        
        assert result['status'] in ['pass', 'warning']
        assert 'outlier_percentage' in result['details']


class TestDataFreshness:
    """Tests for data freshness monitoring"""
    
    def test_freshness_recent_data(self, quality_monitor, mock_engine):
        """Test freshness check with recent data"""
        recent_time = datetime.now() - timedelta(hours=1)
        result_df = pd.DataFrame({
            'latest_timestamp': [recent_time],
            'total_records': [100]
        })
        
        with patch('pandas.read_sql', return_value=result_df):
            result = quality_monitor.check_data_freshness('test_table')
        
        assert result['status'] == 'pass'
        assert result['details']['age_hours'] < 24
    
    def test_freshness_stale_data(self, quality_monitor, mock_engine):
        """Test freshness check with stale data"""
        stale_time = datetime.now() - timedelta(days=3)
        result_df = pd.DataFrame({
            'latest_timestamp': [stale_time],
            'total_records': [100]
        })
        
        with patch('pandas.read_sql', return_value=result_df):
            result = quality_monitor.check_data_freshness('test_table')
        
        assert result['status'] == 'fail'
        assert result['details']['age_hours'] > 48
    
    def test_freshness_no_data(self, quality_monitor, mock_engine):
        """Test freshness check with no data"""
        result_df = pd.DataFrame({
            'latest_timestamp': [None],
            'total_records': [0]
        })
        
        with patch('pandas.read_sql', return_value=result_df):
            result = quality_monitor.check_data_freshness('test_table')
        
        assert result['status'] == 'fail'
        assert 'No data found' in result['message']


class TestAlertGeneration:
    """Tests for quality alert generation"""
    
    def test_alert_generation_for_warning(self, quality_monitor):
        """Test alert generation for warning status"""
        metric_result = {
            'metric_name': 'test_completeness',
            'status': 'warning',
            'metric_value': 0.92,
            'threshold_value': 0.95,
            'details': {'message': 'Completeness below threshold'},
            'measured_at': datetime.now()
        }
        
        alert = quality_monitor.generate_quality_alert(metric_result)
        
        assert alert is not None
        assert alert['severity'] == 'medium'
        assert len(alert['recommended_actions']) > 0
    
    def test_alert_generation_for_fail(self, quality_monitor):
        """Test alert generation for fail status"""
        metric_result = {
            'metric_name': 'test_drift',
            'status': 'fail',
            'metric_value': 0.8,
            'threshold_value': 0.05,
            'details': {'message': 'Significant drift detected'},
            'measured_at': datetime.now()
        }
        
        alert = quality_monitor.generate_quality_alert(metric_result)
        
        assert alert is not None
        assert alert['severity'] == 'high'
        assert len(alert['recommended_actions']) > 0
    
    def test_no_alert_for_pass(self, quality_monitor):
        """Test no alert generated for pass status"""
        metric_result = {
            'metric_name': 'test_metric',
            'status': 'pass',
            'metric_value': 0.98,
            'threshold_value': 0.95,
            'measured_at': datetime.now()
        }
        
        alert = quality_monitor.generate_quality_alert(metric_result)
        
        assert alert is None


class TestQualityChecksIntegration:
    """Integration tests for running multiple quality checks"""
    
    def test_run_quality_checks_comprehensive(self, quality_monitor, mock_engine):
        """Test running comprehensive quality checks"""
        # Mock all check methods
        quality_monitor.check_data_completeness = Mock(return_value={
            'metric_name': 'test_completeness',
            'status': 'pass',
            'metric_value': 0.98,
            'measured_at': datetime.now()
        })
        
        quality_monitor.detect_distribution_shift = Mock(return_value={
            'metric_name': 'test_drift',
            'status': 'warning',
            'metric_value': 0.03,
            'measured_at': datetime.now()
        })
        
        quality_monitor.store_quality_metrics = Mock(return_value=2)
        
        config = {
            'completeness': [{'table': 'test', 'columns': ['col1']}],
            'drift': [{'table': 'test', 'column': 'col1'}]
        }
        
        results = quality_monitor.run_quality_checks(config)
        
        assert 'metrics' in results
        assert 'alerts' in results
        assert 'summary' in results
        assert results['summary']['total_checks'] == 2
        assert results['summary']['passed'] == 1
        assert results['summary']['warnings'] == 1


if __name__ == '__main__':
    pytest.main([__file__, '-v'])

"""
Integration tests for Quality Monitoring API endpoints
"""
import pytest
from unittest.mock import Mock, patch, MagicMock
from datetime import datetime


# Mock FastAPI dependencies
@pytest.fixture
def mock_quality_monitor():
    """Mock DataQualityMonitor"""
    monitor = Mock()
    
    # Mock run_quality_checks response
    monitor.run_quality_checks.return_value = {
        'metrics': [
            {
                'metric_name': 'requests_completeness',
                'status': 'pass',
                'metric_value': 0.98,
                'threshold_value': 0.95,
                'measured_at': datetime.now()
            }
        ],
        'alerts': [],
        'summary': {
            'total_checks': 1,
            'passed': 1,
            'warnings': 0,
            'failed': 0,
            'errors': 0,
            'stored_metrics': 1
        }
    }
    
    return monitor


class TestQualityAPIEndpoints:
    """Tests for quality monitoring API endpoints"""
    
    def test_run_quality_checks_endpoint(self, mock_quality_monitor):
        """Test /api/quality/check endpoint"""
        from ml_service.routers.quality import run_quality_checks, QualityCheckConfig
        
        config = QualityCheckConfig(
            completeness=[
                {
                    'table': 'requests',
                    'columns': ['location_lat', 'location_lng']
                }
            ]
        )
        
        with patch('ml_service.routers.quality.DataQualityMonitor', return_value=mock_quality_monitor):
            # This would be called by FastAPI
            import asyncio
            result = asyncio.run(run_quality_checks(config))
        
        assert result.summary['total_checks'] == 1
        assert result.summary['passed'] == 1
        assert len(result.metrics) == 1
    
    def test_quality_check_config_validation(self):
        """Test QualityCheckConfig model validation"""
        from ml_service.routers.quality import QualityCheckConfig
        
        # Valid config
        config = QualityCheckConfig(
            completeness=[{'table': 'test', 'columns': ['col1']}],
            drift=[{'table': 'test', 'column': 'col1'}]
        )
        
        assert config.completeness is not None
        assert config.drift is not None
        assert len(config.completeness) == 1
    
    def test_quality_check_response_structure(self):
        """Test QualityCheckResponse model structure"""
        from ml_service.routers.quality import QualityCheckResponse
        
        response = QualityCheckResponse(
            metrics=[
                {
                    'metric_name': 'test_metric',
                    'status': 'pass',
                    'metric_value': 0.95
                }
            ],
            alerts=[],
            summary={
                'total_checks': 1,
                'passed': 1,
                'warnings': 0,
                'failed': 0
            }
        )
        
        assert len(response.metrics) == 1
        assert response.summary['total_checks'] == 1


class TestQualityMonitoringIntegration:
    """Integration tests for quality monitoring workflow"""
    
    def test_complete_quality_check_workflow(self, mock_quality_monitor):
        """Test complete workflow from config to results"""
        from ml_service.quality.monitor import DataQualityMonitor
        
        # Create monitor
        with patch('ml_service.quality.monitor.create_engine'):
            monitor = DataQualityMonitor()
        
        # Mock all check methods
        monitor.check_data_completeness = Mock(return_value={
            'metric_name': 'test_completeness',
            'status': 'pass',
            'metric_value': 0.98,
            'threshold_value': 0.95,
            'measured_at': datetime.now()
        })
        
        monitor.detect_distribution_shift = Mock(return_value={
            'metric_name': 'test_drift',
            'status': 'pass',
            'metric_value': 0.02,
            'threshold_value': 0.05,
            'measured_at': datetime.now()
        })
        
        monitor.store_quality_metrics = Mock(return_value=2)
        
        # Run checks
        config = {
            'completeness': [{'table': 'test', 'columns': ['col1']}],
            'drift': [{'table': 'test', 'column': 'col1'}]
        }
        
        results = monitor.run_quality_checks(config)
        
        # Verify results
        assert results['summary']['total_checks'] == 2
        assert results['summary']['passed'] == 2
        assert len(results['metrics']) == 2
        assert results['summary']['stored_metrics'] == 2
    
    def test_quality_check_with_alerts(self, mock_quality_monitor):
        """Test quality check that generates alerts"""
        from ml_service.quality.monitor import DataQualityMonitor
        
        with patch('ml_service.quality.monitor.create_engine'):
            monitor = DataQualityMonitor()
        
        # Mock check that returns warning
        monitor.check_data_completeness = Mock(return_value={
            'metric_name': 'test_completeness',
            'status': 'warning',
            'metric_value': 0.92,
            'threshold_value': 0.95,
            'details': {'message': 'Completeness below threshold'},
            'measured_at': datetime.now()
        })
        
        monitor.store_quality_metrics = Mock(return_value=1)
        
        # Run checks
        config = {
            'completeness': [{'table': 'test', 'columns': ['col1']}]
        }
        
        results = monitor.run_quality_checks(config)
        
        # Verify alert was generated
        assert len(results['alerts']) == 1
        assert results['alerts'][0]['severity'] == 'medium'
        assert len(results['alerts'][0]['recommended_actions']) > 0


if __name__ == '__main__':
    pytest.main([__file__, '-v'])

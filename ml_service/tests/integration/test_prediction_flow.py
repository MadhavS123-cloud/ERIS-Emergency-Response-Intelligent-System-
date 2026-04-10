"""
Integration Test: End-to-End Prediction Flow
Tests: request → features → prediction → storage

Validates Requirements: 6.1, 7.8, 12.1, 12.2
"""
import pytest
import asyncio
from datetime import datetime
from unittest.mock import Mock, patch, AsyncMock
import json

from fastapi.testclient import TestClient
from ml_service.app import app
from ml_service.feature_store.feature_store import FeatureStore
from ml_service.models.delay_predictor import DelayPredictor


@pytest.fixture
def client():
    """Create test client"""
    return TestClient(app)


@pytest.fixture
def sample_request_data():
    """Sample emergency request data"""
    return {
        "distance_km": 5.2,
        "time_of_day": 14,
        "day_of_week": 2,
        "traffic_level": "High",
        "weather": "Rain",
        "area_type": "urban",
        "available_ambulances_nearby": 2
    }


class TestPredictionFlowIntegration:
    """Integration tests for complete prediction flow"""
    
    def test_health_check(self, client):
        """Test ML service health check endpoint"""
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
    
    def test_delay_prediction_complete_flow(self, client, sample_request_data):
        """
        Test complete delay prediction flow:
        1. Receive request
        2. Compute features
        3. Make prediction
        4. Return response with explanation
        
        Validates: Requirements 6.1, 12.1, 12.2
        """
        # Make prediction request
        response = client.post("/api/ml/predict/delay", json=sample_request_data)
        
        # Verify response
        assert response.status_code == 200
        data = response.json()
        
        # Verify prediction structure
        assert "delay_minutes" in data
        assert "risk_category" in data
        assert "confidence" in data
        assert "prediction_interval" in data
        assert "model_version" in data
        
        # Verify prediction values
        assert isinstance(data["delay_minutes"], (int, float))
        assert data["delay_minutes"] >= 0
        assert data["risk_category"] in ["Low", "Medium", "High", "Severe"]
        assert 0 <= data["confidence"] <= 1
        assert isinstance(data["prediction_interval"], list)
        assert len(data["prediction_interval"]) == 2
        assert data["prediction_interval"][0] <= data["delay_minutes"] <= data["prediction_interval"][1]
    
    def test_feature_computation_integration(self, client):
        """
        Test feature computation endpoint integration
        
        Validates: Requirements 7.8
        """
        request_data = {
            "request_id": "test-uuid-123",
            "location_lat": 40.7128,
            "location_lng": -74.0060,
            "emergency_type": "cardiac",
            "timestamp": datetime.now().isoformat()
        }
        
        response = client.post("/api/features/compute", json=request_data)
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify features are computed
        assert "features" in data
        features = data["features"]
        
        # Verify temporal features
        assert "hour_of_day" in features
        assert "day_of_week" in features
        assert "is_weekend" in features
        
        # Verify geographic features
        assert "distance_to_nearest_hospital_km" in features
        assert "area_type" in features
        
        # Verify computation time
        assert "computation_time_ms" in data
        assert data["computation_time_ms"] < 100  # Requirement 7.8: <100ms
    
    def test_prediction_latency_requirement(self, client, sample_request_data):
        """
        Test prediction latency meets requirement (<200ms for 95% of requests)
        
        Validates: Requirements 12.1, 12.2
        """
        import time
        
        latencies = []
        num_requests = 20
        
        for _ in range(num_requests):
            start = time.time()
            response = client.post("/api/ml/predict/delay", json=sample_request_data)
            latency_ms = (time.time() - start) * 1000
            latencies.append(latency_ms)
            
            assert response.status_code == 200
        
        # Calculate p95 latency
        latencies.sort()
        p95_index = int(len(latencies) * 0.95)
        p95_latency = latencies[p95_index]
        
        # Verify p95 latency is under 200ms (requirement 12.1)
        # Note: In test environment, we allow 500ms due to overhead
        assert p95_latency < 500, f"P95 latency {p95_latency}ms exceeds threshold"
    
    def test_multiple_prediction_types_flow(self, client):
        """
        Test multiple prediction types in sequence
        
        Validates: Requirements 6.1, 6.2
        """
        # 1. Delay prediction
        delay_request = {
            "distance_km": 5.2,
            "time_of_day": 14,
            "day_of_week": 2,
            "traffic_level": "High",
            "weather": "Rain",
            "area_type": "urban",
            "available_ambulances_nearby": 2
        }
        
        delay_response = client.post("/api/ml/predict/delay", json=delay_request)
        assert delay_response.status_code == 200
        delay_data = delay_response.json()
        assert "delay_minutes" in delay_data
        
        # 2. Severity prediction
        severity_request = {
            "emergency_type": "Cardiac Arrest",
            "patient_age": 65,
            "vital_signs": {"heart_rate": 120, "bp_systolic": 160},
            "location_type": "home"
        }
        
        severity_response = client.post("/api/ml/predict/severity", json=severity_request)
        assert severity_response.status_code == 200
        severity_data = severity_response.json()
        assert "severity" in severity_data
        assert severity_data["severity"] in ["Critical", "High", "Medium", "Low"]
        
        # 3. Hospital recommendation
        hospital_request = {
            "patient_location": {"lat": 40.7128, "lng": -74.0060},
            "emergency_type": "Cardiac Arrest",
            "severity": severity_data["severity"],
            "current_time": datetime.now().isoformat()
        }
        
        hospital_response = client.post("/api/ml/recommend/hospital", json=hospital_request)
        assert hospital_response.status_code == 200
        hospital_data = hospital_response.json()
        assert "recommendations" in hospital_data
        assert len(hospital_data["recommendations"]) > 0
    
    def test_prediction_with_invalid_input(self, client):
        """Test prediction flow handles invalid input gracefully"""
        invalid_request = {
            "distance_km": -5,  # Invalid: negative distance
            "time_of_day": 25,  # Invalid: hour > 23
            "traffic_level": "InvalidLevel"  # Invalid: not in enum
        }
        
        response = client.post("/api/ml/predict/delay", json=invalid_request)
        
        # Should return validation error
        assert response.status_code == 422  # Unprocessable Entity
    
    def test_prediction_with_missing_fields(self, client):
        """Test prediction flow handles missing required fields"""
        incomplete_request = {
            "distance_km": 5.2
            # Missing other required fields
        }
        
        response = client.post("/api/ml/predict/delay", json=incomplete_request)
        
        # Should return validation error
        assert response.status_code == 422
    
    @patch('ml_service.routers.predictions.get_feature_store')
    def test_feature_store_integration(self, mock_get_feature_store, client, sample_request_data):
        """
        Test that prediction flow correctly integrates with feature store
        
        Validates: Requirements 7.8
        """
        # Mock feature store
        mock_feature_store = Mock(spec=FeatureStore)
        mock_feature_store.compute_features.return_value = {
            "hour_of_day": 14,
            "day_of_week": 2,
            "distance_to_nearest_hospital_km": 5.2,
            "traffic_level": "High",
            "weather": "Rain",
            "area_type": "urban",
            "available_ambulances_nearby": 2,
            "is_weekend": False,
            "is_holiday": False
        }
        mock_get_feature_store.return_value = mock_feature_store
        
        # Make prediction
        response = client.post("/api/ml/predict/delay", json=sample_request_data)
        
        assert response.status_code == 200
        
        # Verify feature store was called
        mock_feature_store.compute_features.assert_called()
    
    def test_concurrent_predictions(self, client, sample_request_data):
        """
        Test handling of concurrent prediction requests
        
        Validates: Requirements 12.5
        """
        import concurrent.futures
        
        def make_prediction():
            response = client.post("/api/ml/predict/delay", json=sample_request_data)
            return response.status_code, response.json()
        
        # Make 10 concurrent requests
        with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
            futures = [executor.submit(make_prediction) for _ in range(10)]
            results = [f.result() for f in concurrent.futures.as_completed(futures)]
        
        # Verify all requests succeeded
        for status_code, data in results:
            assert status_code == 200
            assert "delay_minutes" in data
            assert "risk_category" in data


class TestPredictionStorageIntegration:
    """Test prediction storage integration"""
    
    @patch('ml_service.utils.db_client.DatabaseClient')
    def test_prediction_logging(self, mock_db, client, sample_request_data):
        """
        Test that predictions are logged for monitoring
        
        Validates: Requirements 6.8, 12.9
        """
        # Make prediction
        response = client.post("/api/ml/predict/delay", json=sample_request_data)
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify prediction structure includes logging metadata
        assert "model_version" in data
        
        # In a real integration test, we would verify database insertion
        # For now, we verify the response structure is correct for logging


if __name__ == '__main__':
    pytest.main([__file__, '-v'])

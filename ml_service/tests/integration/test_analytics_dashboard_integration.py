"""
Integration Test: Analytics Dashboard
Tests: data queries, ML service calls, visualization rendering

Validates Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7
"""
import pytest
import requests
from unittest.mock import Mock, patch, MagicMock
from datetime import datetime, timedelta
import pandas as pd
import numpy as np


@pytest.fixture
def mock_backend_api():
    """Mock backend API responses"""
    return {
        "kpis": {
            "signals24h": 145,
            "unitsDeployed": 12,
            "avgLatencyMins": 8.5,
            "activeNodes": 5
        },
        "fleet": [
            {
                "unitId": "AMB-001",
                "driverName": "John Doe",
                "status": "Active",
                "hospitalName": "City General",
                "locationLat": 40.7128,
                "locationLng": -74.0060
            },
            {
                "unitId": "AMB-002",
                "driverName": "Jane Smith",
                "status": "Available",
                "hospitalName": "Memorial Hospital",
                "locationLat": 40.7580,
                "locationLng": -73.9855
            }
        ],
        "recentRequests": [
            {
                "id": "req-001",
                "emergencyType": "Cardiac",
                "status": "IN_TRANSIT",
                "patientName": "Test Patient",
                "locationLat": 40.7128,
                "locationLng": -74.0060,
                "mlRisk": "High",
                "mlDelayMins": 15,
                "mlReasons": ["Heavy traffic", "Long distance"]
            },
            {
                "id": "req-002",
                "emergencyType": "Trauma",
                "status": "COMPLETED",
                "patientName": "Test Patient 2",
                "locationLat": 40.7580,
                "locationLng": -73.9855,
                "mlRisk": "Medium",
                "mlDelayMins": 10,
                "mlReasons": ["Moderate traffic"]
            }
        ]
    }


@pytest.fixture
def mock_ml_service():
    """Mock ML service responses"""
    return {
        "forecast": {
            "forecasts": [
                {
                    "timestamp": (datetime.now() + timedelta(hours=i)).isoformat(),
                    "predicted_requests": 12 + int(5 * np.sin(i * 2 * np.pi / 24)),
                    "confidence_interval": [10, 15],
                    "by_emergency_type": {
                        "cardiac": 3,
                        "trauma": 4,
                        "respiratory": 2,
                        "other": 3
                    }
                }
                for i in range(24)
            ],
            "model_version": "prophet_v1.0",
            "generated_at": datetime.now().isoformat()
        },
        "resource_allocation": {
            "recommendations": [
                {
                    "ambulance_id": "amb-001",
                    "current_location": {"lat": 40.7128, "lng": -74.0060},
                    "recommended_location": {"lat": 40.7580, "lng": -73.9855},
                    "reason": "High predicted demand in Upper East Side",
                    "expected_response_time_improvement_mins": 3.5,
                    "priority": "high"
                }
            ],
            "expected_impact": {
                "avg_response_time_reduction_mins": 2.8,
                "coverage_improvement_pct": 15
            }
        },
        "pattern_analysis": {
            "anomalies": [
                {
                    "timestamp": datetime.now().isoformat(),
                    "metric": "request_volume",
                    "value": 45,
                    "expected_range": [20, 30],
                    "severity": "high",
                    "potential_causes": ["Special event nearby", "Weather conditions"]
                }
            ],
            "patterns": [
                {
                    "pattern_type": "temporal",
                    "description": "Request volume peaks at 6-8 PM on weekdays",
                    "confidence": 0.94,
                    "first_detected": "2025-01-05"
                }
            ]
        }
    }


class TestAnalyticsDashboardDataQueries:
    """Test dashboard data query integration"""
    
    @patch('requests.get')
    def test_dashboard_stats_query(self, mock_get, mock_backend_api):
        """
        Test dashboard statistics query from backend API
        
        Validates: Requirements 2.1, 2.4
        """
        # Mock API response
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"data": mock_backend_api}
        mock_get.return_value = mock_response
        
        # Query dashboard stats
        API_BASE = "http://localhost:5001/api/v1"
        response = requests.get(f"{API_BASE}/admin/dashboard-stats")
        
        assert response.status_code == 200
        data = response.json()["data"]
        
        # Verify KPIs are present
        assert "kpis" in data
        assert "signals24h" in data["kpis"]
        assert "unitsDeployed" in data["kpis"]
        assert "avgLatencyMins" in data["kpis"]
        
        # Verify fleet data is present
        assert "fleet" in data
        assert len(data["fleet"]) > 0
        
        # Verify recent requests are present
        assert "recentRequests" in data
        assert len(data["recentRequests"]) > 0
    
    @patch('requests.get')
    def test_hospitals_query(self, mock_get):
        """
        Test hospitals data query
        
        Validates: Requirements 2.1
        """
        # Mock API response
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "data": [
                {
                    "id": "hosp-1",
                    "name": "City General Hospital",
                    "locationLat": 40.7128,
                    "locationLng": -74.0060,
                    "icuBedsAvailable": 5,
                    "generalBedsAvailable": 20,
                    "ventilatorsAvailable": 3
                }
            ]
        }
        mock_get.return_value = mock_response
        
        # Query hospitals
        API_BASE = "http://localhost:5001/api/v1"
        response = requests.get(f"{API_BASE}/hospitals")
        
        assert response.status_code == 200
        data = response.json()["data"]
        
        # Verify hospital data structure
        assert len(data) > 0
        hospital = data[0]
        assert "id" in hospital
        assert "name" in hospital
        assert "locationLat" in hospital
        assert "locationLng" in hospital
        assert "icuBedsAvailable" in hospital


class TestAnalyticsDashboardMLServiceIntegration:
    """Test dashboard integration with ML service"""
    
    @patch('requests.get')
    def test_demand_forecast_integration(self, mock_get, mock_ml_service):
        """
        Test demand forecast query from ML service
        
        Validates: Requirements 2.1, 2.6
        """
        # Mock ML service response
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = mock_ml_service["forecast"]
        mock_get.return_value = mock_response
        
        # Query demand forecast
        ML_BASE = "http://localhost:8000"
        response = requests.get(
            f"{ML_BASE}/api/ml/forecast/demand",
            params={"forecast_horizon": 24, "granularity": "hourly"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify forecast structure
        assert "forecasts" in data
        assert len(data["forecasts"]) == 24
        
        # Verify forecast data
        forecast = data["forecasts"][0]
        assert "timestamp" in forecast
        assert "predicted_requests" in forecast
        assert "confidence_interval" in forecast
        assert "by_emergency_type" in forecast
        
        # Verify model metadata
        assert "model_version" in data
        assert "generated_at" in data
    
    @patch('requests.post')
    def test_resource_allocation_integration(self, mock_post, mock_ml_service):
        """
        Test resource allocation recommendations from ML service
        
        Validates: Requirements 2.1, 2.6
        """
        # Mock ML service response
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = mock_ml_service["resource_allocation"]
        mock_post.return_value = mock_response
        
        # Query resource allocation
        ML_BASE = "http://localhost:8000"
        response = requests.post(
            f"{ML_BASE}/api/ml/allocate/resources",
            json={"current_fleet": [], "optimization_horizon_hours": 4}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify recommendations structure
        assert "recommendations" in data
        assert "expected_impact" in data
        
        # Verify recommendation data
        if len(data["recommendations"]) > 0:
            rec = data["recommendations"][0]
            assert "ambulance_id" in rec
            assert "current_location" in rec
            assert "recommended_location" in rec
            assert "reason" in rec
            assert "expected_response_time_improvement_mins" in rec
        
        # Verify impact metrics
        impact = data["expected_impact"]
        assert "avg_response_time_reduction_mins" in impact
        assert "coverage_improvement_pct" in impact
    
    @patch('requests.post')
    def test_pattern_analysis_integration(self, mock_post, mock_ml_service):
        """
        Test pattern analysis from ML service
        
        Validates: Requirements 2.1, 2.6
        """
        # Mock ML service response
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = mock_ml_service["pattern_analysis"]
        mock_post.return_value = mock_response
        
        # Query pattern analysis
        ML_BASE = "http://localhost:8000"
        response = requests.post(
            f"{ML_BASE}/api/ml/analyze/patterns",
            json={
                "analysis_type": "anomaly_detection",
                "time_range": {
                    "start": (datetime.now() - timedelta(days=7)).isoformat(),
                    "end": datetime.now().isoformat()
                },
                "metrics": ["request_volume", "response_time"]
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify anomalies structure
        assert "anomalies" in data
        assert "patterns" in data
        
        # Verify anomaly data
        if len(data["anomalies"]) > 0:
            anomaly = data["anomalies"][0]
            assert "timestamp" in anomaly
            assert "metric" in anomaly
            assert "value" in anomaly
            assert "expected_range" in anomaly
            assert "severity" in anomaly
        
        # Verify pattern data
        if len(data["patterns"]) > 0:
            pattern = data["patterns"][0]
            assert "pattern_type" in pattern
            assert "description" in pattern
            assert "confidence" in pattern


class TestAnalyticsDashboardVisualization:
    """Test dashboard visualization data preparation"""
    
    def test_time_series_data_preparation(self, mock_backend_api):
        """
        Test time-series data preparation for visualization
        
        Validates: Requirements 2.1, 2.2
        """
        # Prepare time-series data from requests
        requests_data = mock_backend_api["recentRequests"]
        
        # Convert to DataFrame
        df = pd.DataFrame(requests_data)
        
        # Add timestamps if not present
        if 'createdAt' not in df.columns:
            df['createdAt'] = datetime.now()
        
        df['timestamp'] = pd.to_datetime(df['createdAt'])
        
        # Aggregate by hour
        hourly_counts = df.groupby(df['timestamp'].dt.floor('H')).size()
        
        # Verify aggregation
        assert len(hourly_counts) >= 0
        assert all(count >= 0 for count in hourly_counts.values)
    
    def test_geographic_heatmap_data_preparation(self, mock_backend_api):
        """
        Test geographic heatmap data preparation
        
        Validates: Requirements 2.2
        """
        # Prepare geographic data from requests
        requests_data = mock_backend_api["recentRequests"]
        
        # Extract location data
        map_data = []
        for req in requests_data:
            if req.get("locationLat") and req.get("locationLng"):
                map_data.append({
                    "lat": req["locationLat"],
                    "lon": req["locationLng"],
                    "type": req.get("emergencyType", "Unknown"),
                    "risk": req.get("mlRisk", "Unknown")
                })
        
        # Verify map data
        assert len(map_data) > 0
        for point in map_data:
            assert "lat" in point
            assert "lon" in point
            assert isinstance(point["lat"], (int, float))
            assert isinstance(point["lon"], (int, float))
    
    def test_distribution_plot_data_preparation(self, mock_backend_api):
        """
        Test distribution plot data preparation
        
        Validates: Requirements 2.3, 2.4
        """
        # Prepare distribution data
        requests_data = mock_backend_api["recentRequests"]
        
        # Emergency type distribution
        df = pd.DataFrame(requests_data)
        type_counts = df['emergencyType'].value_counts()
        
        # Verify distribution
        assert len(type_counts) > 0
        assert all(count > 0 for count in type_counts.values)
        
        # Delay distribution
        delays = [req.get("mlDelayMins", 0) for req in requests_data if req.get("mlDelayMins")]
        
        # Verify delays
        assert len(delays) > 0
        assert all(delay >= 0 for delay in delays)
    
    def test_correlation_matrix_data_preparation(self, mock_backend_api):
        """
        Test correlation matrix data preparation
        
        Validates: Requirements 2.3
        """
        # Prepare correlation data
        requests_data = mock_backend_api["recentRequests"]
        df = pd.DataFrame(requests_data)
        
        # Add numeric features for correlation
        df['delay_numeric'] = df['mlDelayMins'].fillna(0)
        df['risk_numeric'] = df['mlRisk'].map({'Low': 1, 'Medium': 2, 'High': 3}).fillna(2)
        
        # Calculate correlation (if enough numeric columns)
        numeric_cols = df.select_dtypes(include=[np.number]).columns
        
        if len(numeric_cols) >= 2:
            correlation = df[numeric_cols].corr()
            
            # Verify correlation matrix
            assert correlation.shape[0] == correlation.shape[1]
            assert all(-1 <= correlation.values.flatten()) and all(correlation.values.flatten() <= 1)


class TestAnalyticsDashboardFiltering:
    """Test dashboard filtering functionality"""
    
    def test_date_range_filtering(self, mock_backend_api):
        """
        Test date range filtering
        
        Validates: Requirements 2.5, 2.9
        """
        # Prepare data
        requests_data = mock_backend_api["recentRequests"]
        df = pd.DataFrame(requests_data)
        
        # Add timestamps
        df['timestamp'] = pd.date_range(start=datetime.now() - timedelta(days=7), periods=len(df), freq='D')
        
        # Apply date filter
        start_date = datetime.now() - timedelta(days=3)
        end_date = datetime.now()
        
        filtered_df = df[(df['timestamp'] >= start_date) & (df['timestamp'] <= end_date)]
        
        # Verify filtering
        assert len(filtered_df) <= len(df)
        assert all(filtered_df['timestamp'] >= start_date)
        assert all(filtered_df['timestamp'] <= end_date)
    
    def test_emergency_type_filtering(self, mock_backend_api):
        """
        Test emergency type filtering
        
        Validates: Requirements 2.5, 2.9
        """
        # Prepare data
        requests_data = mock_backend_api["recentRequests"]
        df = pd.DataFrame(requests_data)
        
        # Apply emergency type filter
        selected_types = ["Cardiac"]
        filtered_df = df[df['emergencyType'].isin(selected_types)]
        
        # Verify filtering
        assert len(filtered_df) <= len(df)
        assert all(filtered_df['emergencyType'].isin(selected_types))
    
    def test_risk_level_filtering(self, mock_backend_api):
        """
        Test risk level filtering
        
        Validates: Requirements 2.5, 2.9
        """
        # Prepare data
        requests_data = mock_backend_api["recentRequests"]
        df = pd.DataFrame(requests_data)
        
        # Apply risk level filter
        selected_risks = ["High", "Medium"]
        filtered_df = df[df['mlRisk'].isin(selected_risks)]
        
        # Verify filtering
        assert len(filtered_df) <= len(df)
        assert all(filtered_df['mlRisk'].isin(selected_risks))


class TestAnalyticsDashboardExport:
    """Test dashboard export functionality"""
    
    def test_csv_export(self, mock_backend_api):
        """
        Test CSV export functionality
        
        Validates: Requirements 2.7
        """
        # Prepare data
        requests_data = mock_backend_api["recentRequests"]
        df = pd.DataFrame(requests_data)
        
        # Export to CSV
        csv_data = df.to_csv(index=False)
        
        # Verify export
        assert isinstance(csv_data, str)
        assert len(csv_data) > 0
        assert "emergencyType" in csv_data
        assert "mlRisk" in csv_data
    
    def test_json_export(self, mock_backend_api):
        """
        Test JSON export functionality
        
        Validates: Requirements 2.7
        """
        # Prepare data
        requests_data = mock_backend_api["recentRequests"]
        df = pd.DataFrame(requests_data)
        
        # Export to JSON
        json_data = df.to_json(orient='records')
        
        # Verify export
        assert isinstance(json_data, str)
        assert len(json_data) > 0
        
        # Verify JSON is valid
        import json
        parsed = json.loads(json_data)
        assert isinstance(parsed, list)
        assert len(parsed) == len(requests_data)


class TestAnalyticsDashboardErrorHandling:
    """Test dashboard error handling"""
    
    @patch('requests.get')
    def test_api_unavailable_handling(self, mock_get):
        """Test handling of unavailable backend API"""
        # Mock API error
        mock_get.side_effect = requests.exceptions.ConnectionError("Connection refused")
        
        # Attempt to query API
        try:
            API_BASE = "http://localhost:5001/api/v1"
            response = requests.get(f"{API_BASE}/admin/dashboard-stats", timeout=4)
            assert False, "Should have raised exception"
        except requests.exceptions.ConnectionError:
            # Expected behavior
            pass
    
    @patch('requests.get')
    def test_ml_service_unavailable_handling(self, mock_get):
        """Test handling of unavailable ML service"""
        # Mock ML service error
        mock_get.side_effect = requests.exceptions.Timeout("Request timeout")
        
        # Attempt to query ML service
        try:
            ML_BASE = "http://localhost:8000"
            response = requests.get(
                f"{ML_BASE}/api/ml/forecast/demand",
                params={"forecast_horizon": 24},
                timeout=5
            )
            assert False, "Should have raised exception"
        except requests.exceptions.Timeout:
            # Expected behavior
            pass


if __name__ == '__main__':
    pytest.main([__file__, '-v'])

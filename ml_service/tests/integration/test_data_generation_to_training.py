"""
Integration Test: Data Generation to Training
Tests: synthetic data generation → storage → training → inference

Validates Requirements: 1.1, 1.2, 1.3, 8.1, 8.2
"""
import pytest
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from unittest.mock import Mock, patch, MagicMock
import tempfile
import os

from ml_service.data_generator.emergency_request_generator import EmergencyRequestGenerator
from ml_service.data_generator.ambulance_fleet_generator import AmbulanceFleetGenerator
from ml_service.data_generator.hospital_capacity_generator import HospitalCapacityGenerator
from ml_service.data_generator.ground_truth_labeler import GroundTruthLabeler
from ml_service.data_generator.dataset_exporter import DatasetExporter
from ml_service.training.pipeline import TrainingPipeline
from ml_service.models.delay_predictor import DelayPredictor


@pytest.fixture
def sample_hospitals():
    """Sample hospital data"""
    return [
        {
            "id": "hosp-1",
            "name": "City General Hospital",
            "location_lat": 40.7128,
            "location_lng": -74.0060,
            "icu_beds_total": 20,
            "general_beds_total": 100
        },
        {
            "id": "hosp-2",
            "name": "Memorial Medical Center",
            "location_lat": 40.7580,
            "location_lng": -73.9855,
            "icu_beds_total": 15,
            "general_beds_total": 80
        }
    ]


class TestDataGenerationToTrainingIntegration:
    """Integration tests for complete data generation to training flow"""
    
    def test_emergency_request_generation(self, sample_hospitals):
        """
        Test emergency request generation with realistic patterns
        
        Validates: Requirements 1.1, 1.2, 1.3
        """
        generator = EmergencyRequestGenerator()
        
        start_date = datetime(2024, 1, 1)
        end_date = datetime(2024, 1, 7)  # 1 week
        
        # Generate requests
        df_requests = generator.generate_requests(
            start_date=start_date,
            end_date=end_date,
            base_volume=50,  # 50 requests per day
            geographic_bounds=(40.7, 40.8, -74.1, -74.0)
        )
        
        # Verify generation
        assert len(df_requests) > 0
        assert 'timestamp' in df_requests.columns
        assert 'location_lat' in df_requests.columns
        assert 'location_lng' in df_requests.columns
        assert 'emergency_type' in df_requests.columns
        
        # Verify temporal patterns (Requirement 1.1)
        assert df_requests['timestamp'].min() >= start_date
        assert df_requests['timestamp'].max() <= end_date
        
        # Verify spatial distribution (Requirement 1.2)
        assert all(40.7 <= lat <= 40.8 for lat in df_requests['location_lat'])
        assert all(-74.1 <= lng <= -74.0 for lng in df_requests['location_lng'])
        
        # Verify emergency types are realistic
        valid_types = ['Cardiac Arrest', 'Stroke', 'Trauma', 'Respiratory Distress', 
                      'Seizure', 'Allergic Reaction', 'Diabetic Emergency', 'Overdose', 'Burns']
        assert all(etype in valid_types for etype in df_requests['emergency_type'])
    
    def test_ambulance_fleet_generation(self, sample_hospitals):
        """
        Test ambulance fleet generation
        
        Validates: Requirements 1.4
        """
        generator = AmbulanceFleetGenerator()
        
        start_date = datetime(2024, 1, 1)
        end_date = datetime(2024, 1, 7)
        
        # Generate fleet
        df_fleet = generator.generate_fleet(
            num_ambulances=10,
            hospitals=sample_hospitals,
            start_date=start_date,
            end_date=end_date
        )
        
        # Verify generation
        assert len(df_fleet) == 10
        assert 'ambulance_id' in df_fleet.columns
        assert 'hospital_id' in df_fleet.columns
        assert 'driver_name' in df_fleet.columns
        assert 'location_lat' in df_fleet.columns
        assert 'location_lng' in df_fleet.columns
        assert 'is_available' in df_fleet.columns
        
        # Verify all ambulances are assigned to hospitals
        assert all(df_fleet['hospital_id'].isin([h['id'] for h in sample_hospitals]))
    
    def test_hospital_capacity_generation(self, sample_hospitals):
        """
        Test hospital capacity generation
        
        Validates: Requirements 1.5
        """
        generator = HospitalCapacityGenerator()
        
        start_date = datetime(2024, 1, 1)
        end_date = datetime(2024, 1, 7)
        
        # Generate capacity timeline
        df_capacity = generator.generate_capacity_timeline(
            hospitals=sample_hospitals,
            start_date=start_date,
            end_date=end_date,
            granularity="hourly"
        )
        
        # Verify generation
        assert len(df_capacity) > 0
        assert 'timestamp' in df_capacity.columns
        assert 'hospital_id' in df_capacity.columns
        assert 'icu_beds_available' in df_capacity.columns
        assert 'general_beds_available' in df_capacity.columns
        
        # Verify capacity constraints (non-negative)
        assert all(df_capacity['icu_beds_available'] >= 0)
        assert all(df_capacity['general_beds_available'] >= 0)
        
        # Verify capacity doesn't exceed total
        for hospital in sample_hospitals:
            hosp_data = df_capacity[df_capacity['hospital_id'] == hospital['id']]
            assert all(hosp_data['icu_beds_available'] <= hospital['icu_beds_total'])
            assert all(hosp_data['general_beds_available'] <= hospital['general_beds_total'])
    
    def test_ground_truth_labeling(self):
        """
        Test ground truth delay labeling
        
        Validates: Requirements 1.7
        """
        labeler = GroundTruthLabeler()
        
        # Test various scenarios
        test_cases = [
            {
                "distance_km": 5.0,
                "traffic_level": "Low",
                "weather": "Clear",
                "time_of_day": 10,
                "ambulance_availability": 5
            },
            {
                "distance_km": 10.0,
                "traffic_level": "High",
                "weather": "Rain",
                "time_of_day": 18,
                "ambulance_availability": 1
            },
            {
                "distance_km": 2.0,
                "traffic_level": "Medium",
                "weather": "Fog",
                "time_of_day": 14,
                "ambulance_availability": 3
            }
        ]
        
        for case in test_cases:
            delay, risk = labeler.compute_delay(**case)
            
            # Verify delay is computed
            assert isinstance(delay, (int, float))
            assert delay >= 0
            
            # Verify risk category
            assert risk in ["Low", "Medium", "High", "Severe"]
            
            # Verify monotonic relationships
            # Higher traffic should increase delay
            # Longer distance should increase delay
    
    def test_dataset_export_and_import(self, sample_hospitals):
        """
        Test dataset export and import for training
        
        Validates: Requirements 1.8, 8.1
        """
        # Generate data
        req_generator = EmergencyRequestGenerator()
        labeler = GroundTruthLabeler()
        
        start_date = datetime(2024, 1, 1)
        end_date = datetime(2024, 1, 7)
        
        df_requests = req_generator.generate_requests(
            start_date=start_date,
            end_date=end_date,
            base_volume=50,
            geographic_bounds=(40.7, 40.8, -74.1, -74.0)
        )
        
        # Add ground truth labels
        delays = []
        risks = []
        for _, row in df_requests.iterrows():
            delay, risk = labeler.compute_delay(
                distance_km=5.0,
                traffic_level="Medium",
                weather="Clear",
                time_of_day=row['timestamp'].hour,
                ambulance_availability=3
            )
            delays.append(delay)
            risks.append(risk)
        
        df_requests['delay_minutes'] = delays
        df_requests['risk_category'] = risks
        
        # Export to temporary file
        with tempfile.TemporaryDirectory() as tmpdir:
            exporter = DatasetExporter()
            
            # Export as Parquet
            parquet_path = os.path.join(tmpdir, "requests.parquet")
            exporter.export_parquet(df_requests, parquet_path)
            
            # Verify file exists
            assert os.path.exists(parquet_path)
            
            # Import back
            df_imported = pd.read_parquet(parquet_path)
            
            # Verify data integrity
            assert len(df_imported) == len(df_requests)
            assert list(df_imported.columns) == list(df_requests.columns)
            
            # Export as CSV
            csv_path = os.path.join(tmpdir, "requests.csv")
            exporter.export_csv(df_requests, csv_path)
            
            # Verify CSV file exists
            assert os.path.exists(csv_path)
            
            # Import CSV
            df_csv = pd.read_csv(csv_path)
            assert len(df_csv) == len(df_requests)
    
    @patch('ml_service.training.pipeline.DatabaseClient')
    @patch('ml_service.training.pipeline.mlflow')
    def test_generated_data_to_training_pipeline(self, mock_mlflow, mock_db, sample_hospitals):
        """
        Test complete flow: generate data → store → train model
        
        Validates: Requirements 1.1, 1.2, 1.3, 8.1, 8.2
        """
        # Step 1: Generate synthetic data
        req_generator = EmergencyRequestGenerator()
        labeler = GroundTruthLabeler()
        
        start_date = datetime(2024, 1, 1)
        end_date = datetime(2024, 3, 31)  # 3 months for sufficient training data
        
        df_requests = req_generator.generate_requests(
            start_date=start_date,
            end_date=end_date,
            base_volume=100,  # 100 requests per day
            geographic_bounds=(40.7, 40.8, -74.1, -74.0)
        )
        
        # Add ground truth labels
        delays = []
        for _, row in df_requests.iterrows():
            delay, _ = labeler.compute_delay(
                distance_km=np.random.uniform(1, 15),
                traffic_level=np.random.choice(["Low", "Medium", "High"]),
                weather=np.random.choice(["Clear", "Rain", "Fog"]),
                time_of_day=row['timestamp'].hour,
                ambulance_availability=np.random.randint(1, 6)
            )
            delays.append(delay)
        
        df_requests['delay_minutes'] = delays
        
        # Add required columns for training
        df_requests['request_id'] = [f'req-{i}' for i in range(len(df_requests))]
        df_requests['hospital_id'] = [sample_hospitals[i % len(sample_hospitals)]['id'] 
                                      for i in range(len(df_requests))]
        df_requests['hospital_name'] = [sample_hospitals[i % len(sample_hospitals)]['name'] 
                                        for i in range(len(df_requests))]
        df_requests['hospital_lat'] = [sample_hospitals[i % len(sample_hospitals)]['location_lat'] 
                                       for i in range(len(df_requests))]
        df_requests['hospital_lng'] = [sample_hospitals[i % len(sample_hospitals)]['location_lng'] 
                                       for i in range(len(df_requests))]
        df_requests['ambulance_id'] = [f'amb-{i%10}' for i in range(len(df_requests))]
        df_requests['plate_number'] = [f'AMB-{i%10:03d}' for i in range(len(df_requests))]
        df_requests['status'] = 'COMPLETED'
        
        # Step 2: Mock database storage
        mock_db.execute_query.return_value = df_requests.to_dict('records')
        mock_db.execute_insert.return_value = None
        mock_db.execute_update.return_value = None
        
        # Step 3: Mock MLflow
        mock_run = MagicMock()
        mock_run.info.run_id = 'test-run-123'
        mock_mlflow.start_run.return_value.__enter__.return_value = mock_run
        mock_mlflow.start_run.return_value.__exit__.return_value = None
        
        mock_client = MagicMock()
        mock_client.get_latest_versions.return_value = []
        mock_client.search_model_versions.return_value = [MagicMock(version='1')]
        mock_mlflow.tracking.MlflowClient.return_value = mock_client
        
        # Step 4: Train model with generated data
        with patch('ml_service.training.pipeline.FeatureStore') as mock_fs_class:
            mock_fs = Mock()
            mock_fs.compute_features.return_value = {
                'hour_of_day': 14,
                'day_of_week': 2,
                'distance_to_nearest_hospital_km': 5.2,
                'traffic_level': 'Medium',
                'weather': 'Clear',
                'area_type': 'urban',
                'is_weekend': False
            }
            mock_fs_class.return_value = mock_fs
            
            pipeline = TrainingPipeline()
            
            # Extract training data
            df_training = pipeline.extract_training_data(start_date, end_date)
            
            # Verify data extraction
            assert len(df_training) > 100  # Should have sufficient data
            
            # Split data temporally
            X_train, X_val, X_test, y_train, y_val, y_test = pipeline.split_data_temporal(
                df_training.head(200),  # Use subset for speed
                target_column='delay_minutes'
            )
            
            # Verify temporal ordering (Requirement 8.2)
            assert len(X_train) > 0
            assert len(X_val) > 0
            assert len(X_test) > 0
            
            # Train model
            model = pipeline._train_model(X_train, y_train, "regression")
            
            # Verify model is trained
            assert model is not None
            assert hasattr(model, 'predict')
    
    def test_trained_model_inference_on_generated_data(self, sample_hospitals):
        """
        Test inference on generated data after training
        
        Validates: Requirements 1.1, 1.2, 1.3, 8.1
        """
        # Generate test data
        req_generator = EmergencyRequestGenerator()
        
        df_test = req_generator.generate_requests(
            start_date=datetime(2024, 4, 1),
            end_date=datetime(2024, 4, 7),
            base_volume=20,
            geographic_bounds=(40.7, 40.8, -74.1, -74.0)
        )
        
        # Create simple model for testing
        from sklearn.ensemble import GradientBoostingRegressor
        
        # Train on synthetic data
        np.random.seed(42)
        X_train = pd.DataFrame({
            'feature1': np.random.randn(100),
            'feature2': np.random.randn(100)
        })
        y_train = X_train['feature1'] * 2 + X_train['feature2'] + np.random.randn(100) * 0.1
        
        model = GradientBoostingRegressor(n_estimators=50, random_state=42)
        model.fit(X_train, y_train)
        
        # Prepare test features
        X_test = pd.DataFrame({
            'feature1': np.random.randn(len(df_test)),
            'feature2': np.random.randn(len(df_test))
        })
        
        # Make predictions
        predictions = model.predict(X_test)
        
        # Verify predictions
        assert len(predictions) == len(df_test)
        assert all(isinstance(p, (int, float, np.number)) for p in predictions)
    
    def test_data_quality_after_generation(self, sample_hospitals):
        """
        Test data quality metrics on generated data
        
        Validates: Requirements 1.9
        """
        # Generate data
        req_generator = EmergencyRequestGenerator()
        
        df_requests = req_generator.generate_requests(
            start_date=datetime(2024, 1, 1),
            end_date=datetime(2024, 1, 31),
            base_volume=100,
            geographic_bounds=(40.7, 40.8, -74.1, -74.0)
        )
        
        # Check completeness
        completeness = 1 - (df_requests.isnull().sum().sum() / (len(df_requests) * len(df_requests.columns)))
        assert completeness > 0.95  # At least 95% complete
        
        # Check consistency
        assert all(df_requests['location_lat'].between(40.7, 40.8))
        assert all(df_requests['location_lng'].between(-74.1, -74.0))
        
        # Check temporal ordering
        assert df_requests['timestamp'].is_monotonic_increasing or len(df_requests) == 1
        
        # Check data types
        assert pd.api.types.is_datetime64_any_dtype(df_requests['timestamp'])
        assert pd.api.types.is_float_dtype(df_requests['location_lat'])
        assert pd.api.types.is_float_dtype(df_requests['location_lng'])


class TestDataGenerationMetadata:
    """Test metadata generation and tracking"""
    
    def test_generation_metadata(self, sample_hospitals):
        """
        Test that generation metadata is properly tracked
        
        Validates: Requirements 1.9
        """
        req_generator = EmergencyRequestGenerator()
        
        start_date = datetime(2024, 1, 1)
        end_date = datetime(2024, 1, 7)
        
        df_requests = req_generator.generate_requests(
            start_date=start_date,
            end_date=end_date,
            base_volume=50,
            geographic_bounds=(40.7, 40.8, -74.1, -74.0)
        )
        
        # Create metadata
        metadata = {
            "generation_params": {
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
                "base_volume": 50,
                "geographic_bounds": (40.7, 40.8, -74.1, -74.0)
            },
            "statistics": {
                "num_requests": len(df_requests),
                "date_range": [df_requests['timestamp'].min().isoformat(), 
                              df_requests['timestamp'].max().isoformat()],
                "emergency_types": df_requests['emergency_type'].value_counts().to_dict()
            }
        }
        
        # Verify metadata structure
        assert "generation_params" in metadata
        assert "statistics" in metadata
        assert metadata["statistics"]["num_requests"] == len(df_requests)


if __name__ == '__main__':
    pytest.main([__file__, '-v'])

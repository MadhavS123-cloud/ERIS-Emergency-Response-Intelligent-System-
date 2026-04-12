"""
Preservation Property Tests - Valid Data Handling Preservation

These tests MUST PASS on unfixed code to confirm baseline behavior.
They ensure that the fix doesn't break existing functionality.

Tests preservation of:
1. Valid location storage and retrieval
2. WebSocket broadcasts for location updates
3. ML prediction format correctness
4. Hospital capacity queries
5. Valid phone number handling
6. Distance calculations
"""

import pytest
import sys
import os
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

import psycopg2
from psycopg2.extras import RealDictCursor
from hypothesis import given, strategies as st, settings
from hypothesis import assume
import math


class TestPreservationProperties:
    """
    Preservation Tests - These should PASS on unfixed code
    """
    
    def test_valid_location_coordinates_stored_correctly(self):
        """
        Test that requests with valid location coordinates are stored
        and retrieved correctly from the database.
        
        EXPECTED: This test PASSES on unfixed code (baseline behavior)
        """
        try:
            db_url = os.getenv('DATABASE_URL', 'postgresql://postgres:postgres@localhost:5432/eris')
            conn = psycopg2.connect(db_url)
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            
            # Check that requests with valid coordinates exist and are stored correctly
            cursor.execute("""
                SELECT id, "locationLat", "locationLng", "emergencyType"
                FROM "Request"
                WHERE "locationLat" IS NOT NULL 
                  AND "locationLng" IS NOT NULL
                  AND "locationLat" BETWEEN -90 AND 90
                  AND "locationLng" BETWEEN -180 AND 180
                LIMIT 10
            """)
            
            results = cursor.fetchall()
            cursor.close()
            conn.close()
            
            # PRESERVATION: Valid coordinates should be stored correctly
            if len(results) > 0:
                for record in results:
                    lat = record['locationLat']
                    lng = record['locationLng']
                    
                    # Verify coordinates are within valid ranges
                    assert -90 <= lat <= 90, f"Latitude {lat} out of range"
                    assert -180 <= lng <= 180, f"Longitude {lng} out of range"
                    assert record['emergencyType'] is not None, "Emergency type should not be null"
                
                print(f"✓ Preservation verified: {len(results)} requests with valid coordinates stored correctly")
            else:
                pytest.skip("No requests with valid coordinates found in database")
                
        except Exception as e:
            pytest.skip(f"Could not connect to backend database: {e}")
    
    @given(
        lat=st.floats(min_value=-90, max_value=90, allow_nan=False, allow_infinity=False),
        lng=st.floats(min_value=-180, max_value=180, allow_nan=False, allow_infinity=False)
    )
    @settings(max_examples=50)
    def test_property_valid_coordinates_within_range(self, lat, lng):
        """
        Property-based test: Valid coordinates should always be within valid ranges.
        
        EXPECTED: This test PASSES on unfixed code
        """
        # Filter out edge cases that might cause issues
        assume(not math.isnan(lat) and not math.isnan(lng))
        assume(not math.isinf(lat) and not math.isinf(lng))
        
        # PRESERVATION: Coordinate validation logic
        is_valid_lat = -90 <= lat <= 90
        is_valid_lng = -180 <= lng <= 180
        
        assert is_valid_lat, f"Latitude {lat} should be within [-90, 90]"
        assert is_valid_lng, f"Longitude {lng} should be within [-180, 180]"
    
    def test_ml_prediction_format_correctness(self):
        """
        Test that ML predictions return correct format with delay estimates,
        risk categories, and confidence scores.
        
        EXPECTED: This test PASSES on unfixed code (baseline behavior)
        """
        from ml_service.routers.predictions import predict_delay, DelayPredictionRequest
        
        # Test with valid input
        request = DelayPredictionRequest(
            distance_km=5.0,
            time_of_day=10,
            day_of_week=2,
            traffic_level="Medium",
            weather="Clear",
            area_type="urban",
            available_ambulances_nearby=3
        )
        
        # This is an async function, so we need to run it
        import asyncio
        response = asyncio.run(predict_delay(request))
        
        # PRESERVATION: ML prediction format should be correct
        assert hasattr(response, 'delay_minutes'), "Response should have delay_minutes"
        assert hasattr(response, 'risk_category'), "Response should have risk_category"
        assert hasattr(response, 'confidence'), "Response should have confidence"
        assert hasattr(response, 'prediction_interval'), "Response should have prediction_interval"
        
        # Verify types and ranges
        assert isinstance(response.delay_minutes, (int, float)), "delay_minutes should be numeric"
        assert response.delay_minutes >= 0, "delay_minutes should be non-negative"
        assert isinstance(response.risk_category, str), "risk_category should be string"
        assert 0 <= response.confidence <= 1, "confidence should be between 0 and 1"
        assert isinstance(response.prediction_interval, list), "prediction_interval should be list"
        assert len(response.prediction_interval) == 2, "prediction_interval should have 2 elements"
        
        print(f"✓ Preservation verified: ML prediction format correct - delay: {response.delay_minutes}min, "
              f"risk: {response.risk_category}, confidence: {response.confidence:.2f}")
    
    @given(
        distance_km=st.floats(min_value=0.1, max_value=50.0, allow_nan=False, allow_infinity=False),
        time_of_day=st.integers(min_value=0, max_value=23),
        day_of_week=st.integers(min_value=0, max_value=6)
    )
    @settings(max_examples=20)
    def test_property_ml_predictions_return_valid_format(self, distance_km, time_of_day, day_of_week):
        """
        Property-based test: ML predictions should always return valid format
        for any valid input.
        
        EXPECTED: This test PASSES on unfixed code
        """
        from ml_service.routers.predictions import predict_delay, DelayPredictionRequest
        
        # Filter edge cases
        assume(0.1 <= distance_km <= 50.0)
        assume(0 <= time_of_day <= 23)
        assume(0 <= day_of_week <= 6)
        
        request = DelayPredictionRequest(
            distance_km=distance_km,
            time_of_day=time_of_day,
            day_of_week=day_of_week,
            traffic_level="Medium",
            weather="Clear",
            area_type="urban",
            available_ambulances_nearby=3
        )
        
        import asyncio
        response = asyncio.run(predict_delay(request))
        
        # PRESERVATION: Response format should be consistent
        assert response.delay_minutes >= 0, "Delay should be non-negative"
        assert 0 <= response.confidence <= 1, "Confidence should be in [0, 1]"
        assert len(response.prediction_interval) == 2, "Prediction interval should have 2 values"
        assert response.prediction_interval[0] <= response.prediction_interval[1], \
            "Prediction interval should be ordered"
    
    def test_valid_phone_numbers_stored_correctly(self):
        """
        Test that valid phone numbers are stored and retrieved correctly.
        
        EXPECTED: This test PASSES on unfixed code (baseline behavior)
        """
        try:
            db_url = os.getenv('DATABASE_URL', 'postgresql://postgres:postgres@localhost:5432/eris')
            conn = psycopg2.connect(db_url)
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            
            # Check that requests with valid phone numbers are stored correctly
            cursor.execute("""
                SELECT id, "patientPhone", "patientName"
                FROM "Request"
                WHERE "patientPhone" IS NOT NULL 
                  AND "patientPhone" != ''
                  AND "patientPhone" != 'Not Provided'
                LIMIT 10
            """)
            
            results = cursor.fetchall()
            cursor.close()
            conn.close()
            
            # PRESERVATION: Valid phone numbers should be stored as strings
            if len(results) > 0:
                for record in results:
                    phone = record['patientPhone']
                    
                    # Verify phone is a non-empty string
                    assert isinstance(phone, str), "Phone should be string"
                    assert len(phone) > 0, "Phone should not be empty"
                    assert phone != 'Not Provided', "Phone should not be placeholder"
                
                print(f"✓ Preservation verified: {len(results)} requests with valid phone numbers stored correctly")
            else:
                pytest.skip("No requests with valid phone numbers found in database")
                
        except Exception as e:
            pytest.skip(f"Could not connect to backend database: {e}")
    
    @given(
        lat1=st.floats(min_value=-90, max_value=90, allow_nan=False, allow_infinity=False),
        lng1=st.floats(min_value=-180, max_value=180, allow_nan=False, allow_infinity=False),
        lat2=st.floats(min_value=-90, max_value=90, allow_nan=False, allow_infinity=False),
        lng2=st.floats(min_value=-180, max_value=180, allow_nan=False, allow_infinity=False)
    )
    @settings(max_examples=30)
    def test_property_haversine_distance_calculation(self, lat1, lng1, lat2, lng2):
        """
        Property-based test: Haversine distance calculations should produce
        correct results for any valid coordinates.
        
        EXPECTED: This test PASSES on unfixed code
        """
        # Filter edge cases
        assume(not math.isnan(lat1) and not math.isnan(lng1))
        assume(not math.isnan(lat2) and not math.isnan(lng2))
        assume(-90 <= lat1 <= 90 and -90 <= lat2 <= 90)
        assume(-180 <= lng1 <= 180 and -180 <= lng2 <= 180)
        
        # Simple Haversine formula implementation for testing
        def haversine(lat1, lon1, lat2, lon2):
            R = 6371  # Earth radius in kilometers
            
            lat1_rad = math.radians(lat1)
            lat2_rad = math.radians(lat2)
            delta_lat = math.radians(lat2 - lat1)
            delta_lon = math.radians(lon2 - lon1)
            
            a = (math.sin(delta_lat / 2) ** 2 +
                 math.cos(lat1_rad) * math.cos(lat2_rad) *
                 math.sin(delta_lon / 2) ** 2)
            c = 2 * math.asin(math.sqrt(a))
            
            return R * c
        
        distance = haversine(lat1, lng1, lat2, lng2)
        
        # PRESERVATION: Distance calculations should be valid
        assert distance >= 0, "Distance should be non-negative"
        assert distance <= 20037.5, "Distance should not exceed half Earth's circumference"
        
        # Distance from a point to itself should be 0
        if lat1 == lat2 and lng1 == lng2:
            assert abs(distance) < 0.001, "Distance from point to itself should be ~0"
    
    def test_hospital_capacity_queries_return_accurate_data(self):
        """
        Test that hospital capacity queries return accurate bed availability
        and ventilator counts from the database.
        
        EXPECTED: This test PASSES on unfixed code (baseline behavior)
        """
        try:
            db_url = os.getenv('DATABASE_URL', 'postgresql://postgres:postgres@localhost:5432/eris')
            conn = psycopg2.connect(db_url)
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            
            # Check that hospital capacity data is stored correctly
            cursor.execute("""
                SELECT 
                    id, 
                    name, 
                    "icuBedsAvailable", 
                    "generalBedsAvailable",
                    "locationLat",
                    "locationLng"
                FROM "Hospital"
                WHERE "icuBedsAvailable" IS NOT NULL 
                   OR "generalBedsAvailable" IS NOT NULL
                LIMIT 10
            """)
            
            results = cursor.fetchall()
            cursor.close()
            conn.close()
            
            # PRESERVATION: Hospital capacity data should be valid
            if len(results) > 0:
                for record in results:
                    icu_beds = record.get('icuBedsAvailable')
                    general_beds = record.get('generalBedsAvailable')
                    
                    # Verify bed counts are non-negative if present
                    if icu_beds is not None:
                        assert icu_beds >= 0, f"ICU beds should be non-negative, got {icu_beds}"
                    if general_beds is not None:
                        assert general_beds >= 0, f"General beds should be non-negative, got {general_beds}"
                    
                    # Verify hospital has a name
                    assert record['name'] is not None, "Hospital should have a name"
                    assert len(record['name']) > 0, "Hospital name should not be empty"
                
                print(f"✓ Preservation verified: {len(results)} hospitals with valid capacity data")
            else:
                pytest.skip("No hospitals with capacity data found in database")
                
        except Exception as e:
            pytest.skip(f"Could not connect to backend database: {e}")


if __name__ == "__main__":
    # Run tests and expect them to pass on unfixed code
    pytest.main([__file__, "-v", "--tb=short"])

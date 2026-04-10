# ML Service Integration Test Guide

## Prerequisites

1. ML Service must be running on http://localhost:8000
2. Backend must be running on http://localhost:5001
3. Database must have the ML tables migrated

## Test Endpoints

### 1. Test Demand Forecast
```bash
# Login as admin first to get token
curl -X POST http://localhost:5001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"admin123"}'

# Get demand forecast
curl -X GET "http://localhost:5001/api/v1/forecasts/demand?forecast_horizon=24&granularity=hourly&region=all" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 2. Test Resource Recommendations
```bash
curl -X GET http://localhost:5001/api/v1/resources/recommendations \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 3. Test Pattern Analysis - Anomalies
```bash
curl -X GET "http://localhost:5001/api/v1/patterns/anomalies?start_date=2025-01-01&end_date=2025-01-15" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 4. Test Pattern Analysis - Trends
```bash
curl -X GET "http://localhost:5001/api/v1/patterns/trends?start_date=2025-01-01&end_date=2025-01-31" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 5. Test Request Creation with ML Predictions
```bash
# Create a request (as patient)
curl -X POST http://localhost:5001/api/v1/requests \
  -H "Authorization: Bearer YOUR_PATIENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "locationLat": 40.7128,
    "locationLng": -74.0060,
    "emergencyType": "Cardiac Arrest",
    "pickupAddress": "123 Main St, New York, NY",
    "patientName": "John Doe",
    "patientPhone": "+1234567890",
    "medicalNotes": "Chest pain, difficulty breathing"
  }'

# Check if ML predictions were stored
# Query the database: SELECT * FROM ml_predictions WHERE request_id = 'REQUEST_ID';
```

## Expected Behavior

### Demand Forecast Response
```json
{
  "status": "success",
  "data": {
    "forecasts": [
      {
        "timestamp": "2025-01-15T15:00:00Z",
        "predicted_requests": 12,
        "confidence_interval": [9, 15],
        "by_emergency_type": {
          "cardiac": 3,
          "trauma": 4,
          "respiratory": 2,
          "other": 3
        }
      }
    ],
    "model_version": "prophet_v1.0",
    "generated_at": "2025-01-15T14:30:00Z"
  }
}
```

### Resource Recommendations Response
```json
{
  "status": "success",
  "data": {
    "recommendations": [
      {
        "ambulance_id": "uuid1",
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
  }
}
```

### Anomalies Response
```json
{
  "status": "success",
  "data": {
    "anomalies": [
      {
        "timestamp": "2025-01-10T18:00:00Z",
        "metric": "request_volume",
        "value": 45,
        "expected_range": [20, 30],
        "severity": "high",
        "potential_causes": ["Special event nearby", "Weather conditions"]
      }
    ],
    "time_range": {
      "start": "2025-01-01",
      "end": "2025-01-15"
    }
  }
}
```

## Graceful Degradation

If ML service is unavailable, endpoints should return:
- Empty arrays for forecasts/recommendations/anomalies
- An "error" field indicating "ML service unavailable"
- HTTP 200 status (not 500) to indicate the API itself is working

## ML Predictions Storage

After creating a request, check the database:
```sql
SELECT 
  id,
  request_id,
  model_name,
  prediction_type,
  prediction_value,
  confidence_score,
  latency_ms,
  created_at
FROM ml_predictions
WHERE request_id = 'YOUR_REQUEST_ID'
ORDER BY created_at DESC;
```

You should see 3 predictions:
1. delay_predictor - delay prediction
2. severity_classifier - severity classification
3. hospital_recommender - hospital recommendations

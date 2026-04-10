# ML Service Integration Documentation

## Overview

The backend API now integrates with the ML Service to provide:
1. **Automatic ML predictions** during request creation (delay, severity, hospital recommendations)
2. **Demand forecasting** endpoints for operations planning
3. **Resource allocation recommendations** for ambulance positioning
4. **Pattern analysis** for anomaly detection and trend identification

## Architecture

```
┌─────────────────┐
│  Backend API    │
│  (Node.js)      │
└────────┬────────┘
         │
         │ HTTP Requests
         │
         ▼
┌─────────────────┐      ┌──────────────┐
│  ML Service     │◄─────┤ Feature Store│
│  (FastAPI)      │      │  (Redis)     │
└─────────────────┘      └──────────────┘
         │
         │ Predictions
         ▼
┌─────────────────┐
│  PostgreSQL     │
│  (ml_predictions│
│   table)        │
└─────────────────┘
```

## Components

### 1. ML Service Client (`backend/src/services/ml.service.js`)

Provides methods to call ML service endpoints:
- `predictDelay(payload)` - Get delay predictions
- `predictSeverity(payload)` - Get severity classifications
- `recommendHospital(payload)` - Get hospital recommendations
- `computeFeatures(payload)` - Compute features for a request
- `getDemandForecast(params)` - Get demand forecasts
- `getResourceRecommendations(payload)` - Get resource allocation recommendations
- `analyzePatterns(payload)` - Get pattern analysis results
- `storePrediction(data)` - Store predictions in database
- `isAvailable()` - Check if ML service is available

All methods include:
- 5-second timeout
- Error handling with logging
- Graceful degradation (return null on failure)

### 2. Request Service Integration

The request creation flow now includes ML predictions:

```javascript
async createRequest(patientId, data) {
  // 1. Create request in database
  const request = await requestRepository.createRequest({...});
  
  // 2. Get ML predictions (non-blocking)
  const predictions = await this.getMLPredictions(request);
  
  // 3. Store predictions in database
  if (predictions) {
    await this.storeMlPredictions(request.id, predictions);
  }
  
  // 4. Add to queue and emit events
  await addEmergencyRequestToQueue(request);
  io.emit('new_emergency', request);
  
  return request;
}
```

### 3. New API Endpoints

#### Forecasts Module (`/api/v1/forecasts`)
- `GET /demand` - Get demand forecasts
  - Query params: `forecast_horizon`, `granularity`, `region`
  - Auth: Admin, Hospital staff only

#### Resources Module (`/api/v1/resources`)
- `GET /recommendations` - Get resource allocation recommendations
  - Auth: Admin, Hospital staff only

#### Patterns Module (`/api/v1/patterns`)
- `GET /anomalies` - Get detected anomalies
  - Query params: `start_date`, `end_date`, `metrics`
  - Auth: Admin, Hospital staff only
- `GET /trends` - Get identified trends
  - Query params: `start_date`, `end_date`
  - Auth: Admin, Hospital staff only

## Database Schema

### ml_predictions Table
Stores all ML predictions with:
- `request_id` - Link to request
- `model_name` - Which model made the prediction
- `model_version` - Model version
- `prediction_type` - Type of prediction (delay, severity, hospital_recommendation)
- `prediction_value` - JSONB prediction result
- `features_used` - JSONB features used for prediction
- `explanation` - JSONB explanation (SHAP values, natural language)
- `confidence_score` - Confidence level
- `latency_ms` - Prediction latency

### Other ML Tables
- `feature_definitions` - Feature metadata
- `demand_forecasts` - Demand forecast history
- `resource_recommendations` - Resource allocation recommendations
- `pattern_analysis` - Detected patterns and anomalies
- `data_quality_metrics` - Data quality monitoring
- `model_training_runs` - Model training history

## Error Handling & Graceful Degradation

### ML Service Unavailable
If the ML service is unavailable:
1. Request creation continues normally (predictions are optional)
2. Forecast/resource/pattern endpoints return empty results with error indicator
3. Errors are logged but don't block operations
4. HTTP 200 status returned (not 500) to indicate API is working

### Timeout Handling
All ML service calls have a 5-second timeout:
- If timeout occurs, null is returned
- Request creation continues
- Error is logged for monitoring

### Prediction Storage Failure
If storing predictions fails:
- Error is logged
- Request creation continues
- Predictions are lost but request is saved

## Configuration

### Environment Variables
```bash
ML_SERVICE_URL=http://localhost:8000  # ML service URL
```

### Timeouts
- ML service calls: 5000ms (5 seconds)
- Health check: 2000ms (2 seconds)

## Monitoring

### Logs
All ML service interactions are logged:
- `Calling ML service for [prediction type]`
- `ML [prediction type] received successfully`
- `Error calling ML service for [prediction type]`
- `ML predictions stored for request`

### Metrics to Monitor
1. ML service availability (health check)
2. Prediction latency (stored in `latency_ms`)
3. Prediction storage success rate
4. Request creation with/without predictions

## Testing

See `INTEGRATION_TEST.md` for detailed testing instructions.

### Quick Test
```bash
# 1. Start ML service
cd ml_service
python -m uvicorn app:app --reload

# 2. Start backend
cd backend
npm run dev

# 3. Create a request and check predictions
curl -X POST http://localhost:5001/api/v1/requests \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"locationLat": 40.7128, "locationLng": -74.0060, ...}'

# 4. Query predictions
psql -d eris -c "SELECT * FROM ml_predictions ORDER BY created_at DESC LIMIT 5;"
```

## Future Enhancements

1. **Caching**: Cache predictions for similar requests
2. **Batch predictions**: Process multiple requests in batch
3. **Real-time updates**: Stream predictions via WebSocket
4. **A/B testing**: Compare predictions with actual outcomes
5. **Model monitoring**: Track prediction accuracy over time
6. **Feature drift detection**: Monitor feature distributions
7. **Prediction explanations**: Surface SHAP values to frontend
8. **Recommendation tracking**: Track which recommendations were followed

## Troubleshooting

### ML service not responding
```bash
# Check if ML service is running
curl http://localhost:8000/health

# Check logs
tail -f ml_service/logs/app.log
```

### Predictions not being stored
```bash
# Check database connection
psql -d eris -c "SELECT COUNT(*) FROM ml_predictions;"

# Check Prisma client generation
cd backend
npx prisma generate
```

### High latency
```bash
# Check ML service performance
curl -w "@curl-format.txt" http://localhost:8000/api/ml/predict/delay

# Check feature store (Redis)
redis-cli ping
```

## Support

For issues or questions:
1. Check logs in `backend/logs/` and `ml_service/logs/`
2. Verify ML service is running and healthy
3. Check database migrations are applied
4. Review `INTEGRATION_TEST.md` for test cases

# Feature Store

Centralized feature management system with online (Redis) and offline (Parquet) storage.

## Architecture

- **Online Store**: Redis for low-latency feature serving (<100ms)
- **Offline Store**: Parquet files for batch training
- **Feature Registry**: Metadata store for feature definitions

## Features

### Temporal Features (5)
- `hour_of_day` - Hour of day (0-23)
- `day_of_week` - Day of week (0=Monday, 6=Sunday)
- `month` - Month (1-12)
- `is_weekend` - Whether it's weekend
- `is_holiday` - Whether it's a holiday

### Geographic Features (3)
- `distance_to_nearest_hospital_km` - Distance to nearest hospital
- `area_type` - Area type (urban/suburban/rural)
- `population_density` - Population density

### Contextual Features (5)
- `traffic_level` - Current traffic level (Low/Medium/High)
- `traffic_severity_score` - Traffic severity score (0-1)
- `weather` - Current weather condition
- `temperature` - Current temperature in Celsius
- `available_ambulances_nearby` - Number of available ambulances

### Historical Aggregation Features (2)
- `avg_delay_last_7days_area` - Average delay in area over last 7 days
- `hospital_utilization_rate_24h` - Hospital utilization rate

### Derived Features (2)
- `traffic_adjusted_distance` - Distance adjusted for traffic
- `weather_adjusted_delay` - Base delay adjusted for weather

**Total: 17 features**

## Usage

### Compute Features

```python
from ml_service.feature_store.feature_store import FeatureStore
from datetime import datetime

feature_store = FeatureStore()

request_data = {
    "timestamp": datetime.now(),
    "location_lat": 40.7128,
    "location_lng": -74.0060,
    "emergency_type": "cardiac"
}

context_data = {
    "traffic_level": "High",
    "weather": "Rain",
    "available_ambulances_nearby": 2
}

features = feature_store.compute_features(request_data, context_data)
```

### Online Feature Serving

```python
# Store features
feature_store.set_online_features("request-123", features, ttl=3600)

# Retrieve features
features = feature_store.get_online_features(
    ["hour_of_day", "traffic_level"],
    "request-123"
)
```

### Offline Feature Retrieval

```python
# For training
df = feature_store.get_offline_features(
    feature_names=["hour_of_day", "traffic_level", "distance_to_nearest_hospital_km"],
    entity_ids=["req-1", "req-2", "req-3"],
    timestamp_range=(start_date, end_date)
)
```

## API Endpoints

### POST /api/features/compute

Compute all features for a request.

**Request:**
```json
{
  "request_id": "req-123",
  "location_lat": 40.7128,
  "location_lng": -74.0060,
  "emergency_type": "cardiac",
  "timestamp": "2025-01-15T14:30:00Z",
  "traffic_level": "High",
  "weather": "Rain",
  "available_ambulances_nearby": 2
}
```

**Response:**
```json
{
  "features": {
    "hour_of_day": 14,
    "day_of_week": 2,
    "traffic_level": "High",
    "traffic_severity_score": 0.9,
    "distance_to_nearest_hospital_km": 3.5,
    ...
  },
  "computation_time_ms": 45
}
```

### GET /api/features/list

List all registered features with metadata.

**Query Parameters:**
- `category` (optional): Filter by category (temporal, geographic, contextual, historical, derived)

### GET /api/features/metadata/{feature_name}

Get metadata for a specific feature.

## Adding New Features

1. Define computation function in `features.py`:
```python
def my_new_feature(param1: float, param2: str, **kwargs) -> float:
    """Compute my new feature"""
    return param1 * 2.0
```

2. Register in `register_features()`:
```python
registry.register_feature(
    "my_new_feature",
    my_new_feature,
    dependencies=["param1", "param2"],
    data_type="float",
    description="My new feature description",
    category="derived"
)
```

## Performance

- Online feature serving: <100ms (Redis)
- Feature computation: ~45ms for all 17 features
- Offline batch retrieval: Depends on data size

## Testing

Run tests:
```bash
pytest tests/feature_store/
```

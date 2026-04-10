# Data Generation Engine

The Data Generation Engine creates realistic emergency response datasets for ML training and system testing.

## Components

### 1. EmergencyRequestGenerator
Generates emergency requests with realistic temporal and spatial patterns.

**Features:**
- Temporal patterns: hourly, daily, weekly seasonality
- Spatial distribution: clustered around population centers
- Correlated features: traffic-time, weather-delay, emergency type-location
- Configurable parameters: date ranges, geographic bounds, volume

**Usage:**
```python
from ml_service.data_generator.emergency_request_generator import EmergencyRequestGenerator

gen = EmergencyRequestGenerator()
df = gen.generate_requests(
    start_date=datetime(2025, 1, 1),
    end_date=datetime(2025, 12, 31),
    base_volume=100,  # requests per day
    geographic_bounds=(40.5, 40.9, -74.3, -73.7)  # NYC area
)
```

### 2. AmbulanceFleetGenerator
Generates ambulance fleet data with driver schedules and maintenance windows.

**Features:**
- Realistic shift patterns (morning, afternoon, night)
- Maintenance schedules (every 2-4 weeks)
- Performance metrics (response times, call volumes)
- No overlapping shifts per ambulance

**Usage:**
```python
from ml_service.data_generator.ambulance_fleet_generator import AmbulanceFleetGenerator

gen = AmbulanceFleetGenerator()
fleet_df, schedule_df = gen.generate_fleet(
    num_ambulances=50,
    hospitals=hospitals_list,
    start_date=datetime(2025, 1, 1),
    end_date=datetime(2025, 12, 31)
)
```

### 3. HospitalCapacityGenerator
Generates hospital capacity timelines with realistic availability patterns.

**Features:**
- Time-varying bed availability (ICU, general, ventilators)
- Realistic capacity changes (admissions/discharges)
- Hourly or daily granularity
- Maintains capacity invariants (non-negative, within bounds)

**Usage:**
```python
from ml_service.data_generator.hospital_capacity_generator import HospitalCapacityGenerator

gen = HospitalCapacityGenerator()
capacity_df = gen.generate_capacity_timeline(
    hospitals=hospitals_list,
    start_date=datetime(2025, 1, 1),
    end_date=datetime(2025, 12, 31),
    granularity="hourly"
)
```

### 4. GroundTruthLabeler
Generates ground truth delay labels based on causal factors.

**Features:**
- Deterministic delay computation
- Realistic causal factors: distance, traffic, weather, time, availability
- Monotonic relationships (more traffic = more delay)
- Risk categorization (Low/Medium/High/Severe)

**Usage:**
```python
from ml_service.data_generator.ground_truth_labeler import GroundTruthLabeler

labeler = GroundTruthLabeler()
delay, risk = labeler.compute_delay(
    distance_km=5.2,
    traffic_level="High",
    weather="Rain",
    time_of_day=17,  # 5 PM
    ambulance_availability=2
)
```

### 5. DatasetExporter
Exports datasets in multiple formats with metadata.

**Features:**
- Supports CSV, JSON, Parquet formats
- Includes metadata (generation params, statistics)
- Round-trip import/export

**Usage:**
```python
from ml_service.data_generator.dataset_exporter import DatasetExporter

# Export
path = DatasetExporter.export_dataset(
    df=requests_df,
    file_path="./data/requests",
    format="parquet",
    metadata={"param": "value"}
)

# Import
df = DatasetExporter.import_dataset(path, format="parquet")
```

## API Endpoint

### POST /api/ml/generate/dataset

Generate a complete emergency response dataset.

**Request:**
```json
{
  "start_date": "2025-01-01",
  "end_date": "2025-12-31",
  "volume_per_day": 100,
  "geographic_bounds": [40.5, 40.9, -74.3, -73.7],
  "export_format": "parquet",
  "num_ambulances": 50,
  "hospitals": [...]
}
```

**Response:**
```json
{
  "dataset_id": "uuid",
  "num_requests": 36500,
  "num_ambulances": 50,
  "num_hospitals": 3,
  "date_range": ["2025-01-01", "2025-12-31"],
  "file_paths": {
    "requests": "./data/generated/uuid/requests.parquet",
    "fleet": "./data/generated/uuid/fleet.parquet",
    "schedule": "./data/generated/uuid/schedule.parquet",
    "capacity": "./data/generated/uuid/capacity.parquet"
  },
  "metadata": {...}
}
```

## Testing

Property-based tests validate correctness properties:
- Temporal patterns match expected seasonality
- Spatial distribution correlates with population density
- Feature correlations are maintained
- Constraints are satisfied (no overlapping shifts, capacity bounds)
- Export/import round-trip preserves data

Run tests:
```bash
pytest tests/data_generator/
```

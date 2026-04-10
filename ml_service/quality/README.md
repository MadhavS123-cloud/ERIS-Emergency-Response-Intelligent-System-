# Data Quality Monitoring

This module provides comprehensive data quality monitoring for the ERIS ML service.

## Features

### 1. Data Completeness Monitoring
- Monitors missing values and null fields across tables
- Calculates completeness percentage per column
- Generates alerts when completeness falls below threshold (default: 95%)

### 2. Distribution Shift Detection
- Detects changes in data distributions over time
- Uses Kolmogorov-Smirnov test for statistical significance
- Compares baseline period (default: 30 days) with recent period (default: 7 days)
- Alerts on significant distribution shifts (p-value < 0.05)

### 3. Consistency Validation
- Validates data against defined rules:
  - Range checks (min/max values)
  - Enum validation (allowed values)
  - Non-negative constraints
- Calculates consistency percentage
- Generates alerts when consistency falls below threshold (default: 99%)

### 4. Outlier Detection
- Detects anomalous values using:
  - Z-score method (default threshold: 3.0)
  - IQR (Interquartile Range) method
- Calculates outlier percentage
- Provides statistical summaries (mean, std, quartiles)

### 5. Data Freshness Monitoring
- Monitors time since last data update
- Alerts when data becomes stale (default: 24 hours)
- Tracks data age in hours and days

### 6. Quality Alert Generation
- Generates alerts with severity levels:
  - **Low**: Minor issues
  - **Medium**: Warning status
  - **High**: Failed checks
  - **Critical**: System-level issues
- Provides recommended actions for each alert type
- Includes contextual information for investigation

### 7. Historical Metrics Storage
- Stores all quality metrics in `data_quality_metrics` table
- Maintains historical trends for analysis
- Supports time-series queries for trend analysis

## Usage

### Basic Usage

```python
from ml_service.quality.monitor import DataQualityMonitor

# Initialize monitor
monitor = DataQualityMonitor()

# Check data completeness
result = monitor.check_data_completeness(
    table_name='requests',
    columns=['location_lat', 'location_lng', 'emergency_type']
)

# Detect distribution shift
result = monitor.detect_distribution_shift(
    table_name='requests',
    column='distance_km',
    baseline_period_days=30,
    recent_period_days=7
)

# Validate consistency
result = monitor.validate_data_consistency(
    table_name='requests',
    validations=[
        {'type': 'non_negative', 'column': 'distance_km'},
        {'type': 'range', 'column': 'distance_km', 'rule': {'min': 0, 'max': 100}}
    ]
)

# Detect outliers
result = monitor.detect_outliers(
    table_name='requests',
    column='distance_km',
    method='zscore'
)

# Check data freshness
result = monitor.check_data_freshness(
    table_name='requests',
    timestamp_column='created_at'
)
```

### Comprehensive Quality Checks

```python
# Define quality check configuration
config = {
    'completeness': [
        {
            'table': 'requests',
            'columns': ['location_lat', 'location_lng', 'emergency_type', 'status']
        }
    ],
    'drift': [
        {
            'table': 'requests',
            'column': 'distance_km',
            'baseline_days': 30,
            'recent_days': 7
        }
    ],
    'consistency': [
        {
            'table': 'requests',
            'validations': [
                {'type': 'non_negative', 'column': 'distance_km'},
                {'type': 'enum', 'column': 'status', 'rule': {
                    'values': ['PENDING', 'ACCEPTED', 'COMPLETED']
                }}
            ]
        }
    ],
    'outliers': [
        {
            'table': 'requests',
            'column': 'distance_km',
            'method': 'zscore'
        }
    ],
    'freshness': [
        {
            'table': 'requests',
            'timestamp_column': 'created_at'
        }
    ]
}

# Run all checks
results = monitor.run_quality_checks(config)

# Access results
print(f"Total checks: {results['summary']['total_checks']}")
print(f"Passed: {results['summary']['passed']}")
print(f"Warnings: {results['summary']['warnings']}")
print(f"Failed: {results['summary']['failed']}")

# Process alerts
for alert in results['alerts']:
    print(f"Alert: {alert['metric_name']}")
    print(f"Severity: {alert['severity']}")
    print(f"Recommended actions: {alert['recommended_actions']}")
```

## API Endpoints

### POST /api/quality/check
Run comprehensive quality checks.

**Request:**
```json
{
    "completeness": [
        {
            "table": "requests",
            "columns": ["location_lat", "location_lng", "emergency_type"]
        }
    ],
    "drift": [
        {
            "table": "requests",
            "column": "distance_km",
            "baseline_days": 30,
            "recent_days": 7
        }
    ],
    "consistency": [
        {
            "table": "requests",
            "validations": [
                {"type": "non_negative", "column": "distance_km"}
            ]
        }
    ],
    "outliers": [
        {
            "table": "requests",
            "column": "distance_km",
            "method": "zscore"
        }
    ],
    "freshness": [
        {
            "table": "requests",
            "timestamp_column": "created_at"
        }
    ]
}
```

**Response:**
```json
{
    "metrics": [
        {
            "metric_name": "requests_completeness",
            "metric_value": 0.98,
            "threshold_value": 0.95,
            "status": "pass",
            "details": {...},
            "measured_at": "2025-01-15T14:30:00Z"
        }
    ],
    "alerts": [
        {
            "metric_name": "requests_drift",
            "severity": "medium",
            "status": "warning",
            "message": "Moderate distribution shift detected",
            "recommended_actions": [...]
        }
    ],
    "summary": {
        "total_checks": 5,
        "passed": 4,
        "warnings": 1,
        "failed": 0,
        "errors": 0,
        "stored_metrics": 5
    }
}
```

### GET /api/quality/metrics/recent
Get recent quality metrics from database.

**Query Parameters:**
- `metric_name` (optional): Filter by specific metric
- `hours` (default: 24): Number of hours to look back

**Response:**
```json
{
    "metrics": [...],
    "count": 10,
    "time_range_hours": 24
}
```

### GET /api/quality/metrics/trends
Get historical trends for a specific metric.

**Query Parameters:**
- `metric_name` (required): Name of the metric
- `days` (default: 7): Number of days to look back

**Response:**
```json
{
    "metric_name": "requests_completeness",
    "trends": [...],
    "summary": {
        "count": 168,
        "avg_value": 0.97,
        "min_value": 0.92,
        "max_value": 0.99,
        "status_distribution": {"pass": 160, "warning": 8}
    },
    "time_range_days": 7
}
```

### GET /api/quality/alerts/active
Get currently active quality alerts.

**Response:**
```json
{
    "alerts": [...],
    "alert_count": 2,
    "summary": {...}
}
```

### GET /api/quality/health
Health check for quality monitoring service.

**Response:**
```json
{
    "status": "healthy",
    "database": "connected",
    "timestamp": "2025-01-15T14:30:00Z"
}
```

## Configuration

### Thresholds

Default thresholds can be customized:

```python
monitor = DataQualityMonitor()

# Customize thresholds
monitor.thresholds = {
    'completeness_min': 0.95,      # 95% completeness required
    'drift_max_pvalue': 0.05,      # p-value threshold for drift
    'outlier_zscore': 3.0,         # Z-score threshold
    'freshness_max_hours': 24,     # Maximum data age
    'consistency_min': 0.99,       # 99% consistency required
}
```

## Database Schema

Quality metrics are stored in the `data_quality_metrics` table:

```sql
CREATE TABLE data_quality_metrics (
    id UUID PRIMARY KEY,
    metric_name VARCHAR(100) NOT NULL,
    metric_value FLOAT NOT NULL,
    threshold_value FLOAT,
    status VARCHAR(20),  -- 'pass', 'warning', 'fail'
    details JSONB,
    measured_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_data_quality_measured ON data_quality_metrics(metric_name, measured_at);
```

## Testing

Run unit tests:
```bash
pytest ml_service/tests/test_quality_monitor.py -v
```

Run integration tests:
```bash
pytest ml_service/tests/test_quality_api.py -v
```

## Requirements

- Python 3.11+
- pandas
- numpy
- scipy
- sqlalchemy
- psycopg2 (for PostgreSQL)

## Implementation Details

### Completeness Check
- Calculates non-null percentage for each column
- Aggregates to overall completeness score
- Status: pass (≥95%), warning (≥90%), fail (<90%)

### Distribution Shift Detection
- Uses Kolmogorov-Smirnov two-sample test
- Compares baseline and recent distributions
- Requires minimum 30 samples per period
- Status based on p-value: pass (≥0.05), warning (≥0.01), fail (<0.01)

### Consistency Validation
- Supports multiple validation types
- Calculates violation percentage
- Status: pass (≥99%), warning (≥95%), fail (<95%)

### Outlier Detection
- Z-score method: |z| > 3.0 considered outlier
- IQR method: values outside [Q1-1.5*IQR, Q3+1.5*IQR]
- Status based on outlier percentage: pass (≤1%), warning (≤5%), fail (>5%)

### Freshness Check
- Calculates time since last record
- Status: pass (≤24h), warning (≤48h), fail (>48h)

## Best Practices

1. **Regular Monitoring**: Run quality checks on a schedule (e.g., hourly or daily)
2. **Alert Thresholds**: Adjust thresholds based on your data characteristics
3. **Historical Analysis**: Review trends to identify gradual degradation
4. **Action on Alerts**: Investigate and resolve alerts promptly
5. **Baseline Updates**: Periodically update baseline distributions for drift detection
6. **Custom Validations**: Add domain-specific validation rules as needed

## Troubleshooting

### High False Positive Rate
- Adjust thresholds to match your data quality expectations
- Review validation rules for overly strict constraints
- Consider data seasonality in drift detection

### Missing Metrics
- Verify database connectivity
- Check table and column names in configuration
- Ensure sufficient data volume for statistical tests

### Performance Issues
- Add database indexes on timestamp columns
- Limit time ranges for large tables
- Consider sampling for very large datasets

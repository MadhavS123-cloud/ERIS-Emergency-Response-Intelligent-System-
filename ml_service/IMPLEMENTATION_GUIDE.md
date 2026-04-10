# Enhanced ML Data Exploration - Implementation Guide

## Overview

This guide provides detailed instructions for completing the remaining implementation tasks for the Enhanced ML Data Exploration feature in ERIS.

## Completed Tasks ✅

### Task 1: Infrastructure Setup
- ✅ Created `ml_service/` directory structure
- ✅ Set up Python dependencies (requirements.txt)
- ✅ Created FastAPI application with CORS, logging, error handling
- ✅ Set up Redis client wrapper
- ✅ Created database migration for 7 new ML tables
- ✅ Created configuration management

### Task 2: Data Generation Engine
- ✅ EmergencyRequestGenerator - Realistic temporal/spatial patterns
- ✅ AmbulanceFleetGenerator - Fleet with schedules and maintenance
- ✅ HospitalCapacityGenerator - Time-varying capacity data
- ✅ GroundTruthLabeler - Deterministic delay computation
- ✅ DatasetExporter - Multi-format export (CSV, JSON, Parquet)
- ✅ FastAPI endpoint: POST /api/ml/generate/dataset

### Task 3: Checkpoint
- ✅ Verified all data generation components

### Task 4: Feature Store
- ✅ FeatureRegistry - Feature definition management
- ✅ FeatureStore - Online (Redis) + Offline (Parquet) storage
- ✅ 17 features across 5 categories (temporal, geographic, contextual, historical, derived)
- ✅ FastAPI endpoints: POST /api/features/compute, GET /api/features/list

## Remaining Tasks 📋

### Task 5: Checkpoint - Verify Feature Store
**Status:** Ready to execute
**Estimated Time:** 5 minutes

**Steps:**
1. Run Python compilation check on feature store files
2. Test feature computation with sample data
3. Verify Redis connection (if available)
4. Verify all 17 features are registered

**Command:**
```bash
python -m py_compile ml_service/feature_store/*.py
```

---

### Task 6: Multi-Model ML Service (14 sub-tasks)
**Status:** Not started
**Estimated Time:** 4-6 hours
**Priority:** HIGH

This task implements 6 ML models beyond the basic delay predictor.

#### 6.1 Enhance Delay Predictor
**Files to create:**
- `ml_service/models/delay_predictor.py`

**Implementation:**
```python
from sklearn.ensemble import GradientBoostingRegressor
import joblib

class DelayPredictor:
    def __init__(self):
        self.model = None
        self.feature_names = [
            "hour_of_day", "day_of_week", "distance_to_nearest_hospital_km",
            "traffic_severity_score", "weather_adjusted_delay",
            "available_ambulances_nearby", "traffic_adjusted_distance"
        ]
    
    def train(self, X, y):
        self.model = GradientBoostingRegressor(
            n_estimators=200,
            max_depth=8,
            learning_rate=0.05,
            random_state=42
        )
        self.model.fit(X[self.feature_names], y)
    
    def predict(self, features):
        if self.model is None:
            raise ValueError("Model not trained")
        
        X = pd.DataFrame([features])[self.feature_names]
        delay = self.model.predict(X)[0]
        
        # Categorize risk
        if delay < 8:
            risk = "Low"
        elif delay < 15:
            risk = "Medium"
        elif delay < 25:
            risk = "High"
        else:
            risk = "Severe"
        
        return {
            "delay_minutes": round(delay, 2),
            "risk_category": risk,
            "confidence": 0.85  # TODO: Compute actual confidence
        }
```

#### 6.2 Severity Classifier
**Files to create:**
- `ml_service/models/severity_classifier.py`

**Implementation:**
```python
from sklearn.ensemble import RandomForestClassifier

class SeverityClassifier:
    def __init__(self):
        self.model = RandomForestClassifier(
            n_estimators=100,
            max_depth=10,
            random_state=42
        )
        self.severity_levels = ["Low", "Medium", "High", "Critical"]
    
    def train(self, X, y):
        self.model.fit(X, y)
    
    def predict(self, features):
        # Features: emergency_type, hour_of_day, area_type
        proba = self.model.predict_proba([features])[0]
        severity_idx = proba.argmax()
        
        return {
            "severity": self.severity_levels[severity_idx],
            "confidence": float(proba[severity_idx]),
            "probabilities": dict(zip(self.severity_levels, proba))
        }
```

#### 6.3 Hospital Recommender
**Files to create:**
- `ml_service/models/hospital_recommender.py`

**Implementation:**
```python
class HospitalRecommender:
    def recommend(self, patient_location, emergency_type, hospitals):
        recommendations = []
        
        for hospital in hospitals:
            # Calculate distance
            distance = self._calculate_distance(
                patient_location,
                (hospital['location_lat'], hospital['location_lng'])
            )
            
            # Calculate capacity score
            capacity_score = (
                hospital.get('icu_beds_available', 0) * 0.6 +
                hospital.get('general_beds_available', 0) * 0.4
            ) / 100
            
            # Calculate specialization score
            specialization_score = self._get_specialization_score(
                emergency_type,
                hospital.get('specializations', [])
            )
            
            # Combined score (lower distance is better)
            score = (
                (1 / (distance + 1)) * 0.4 +
                capacity_score * 0.3 +
                specialization_score * 0.3
            )
            
            recommendations.append({
                "hospital_id": hospital['id'],
                "hospital_name": hospital['name'],
                "score": round(score, 3),
                "distance_km": round(distance, 2),
                "icu_beds_available": hospital.get('icu_beds_available', 0),
                "reasons": self._generate_reasons(distance, capacity_score, specialization_score)
            })
        
        # Sort by score (descending)
        recommendations.sort(key=lambda x: x['score'], reverse=True)
        return recommendations[:5]  # Top 5
```

#### 6.4 Demand Forecaster
**Files to create:**
- `ml_service/models/demand_forecaster.py`

**Implementation:**
```python
from prophet import Prophet
import pandas as pd

class DemandForecaster:
    def __init__(self):
        self.model = Prophet(
            yearly_seasonality=True,
            weekly_seasonality=True,
            daily_seasonality=True
        )
    
    def train(self, historical_data):
        # historical_data: DataFrame with 'ds' (datetime) and 'y' (request count)
        self.model.fit(historical_data)
    
    def forecast(self, periods=24, freq='H'):
        future = self.model.make_future_dataframe(periods=periods, freq=freq)
        forecast = self.model.predict(future)
        
        return forecast[['ds', 'yhat', 'yhat_lower', 'yhat_upper']].tail(periods)
```

#### 6.5 Resource Allocator
**Files to create:**
- `ml_service/models/resource_allocator.py`

**Implementation:**
```python
class ResourceAllocator:
    def recommend_positioning(self, current_fleet, predicted_demand):
        recommendations = []
        
        # Simple greedy algorithm: move ambulances to high-demand areas
        demand_zones = self._cluster_demand(predicted_demand)
        
        for ambulance in current_fleet:
            if not ambulance['is_available']:
                continue
            
            # Find nearest high-demand zone
            best_zone = self._find_best_zone(
                ambulance['location'],
                demand_zones,
                current_fleet
            )
            
            if best_zone:
                recommendations.append({
                    "ambulance_id": ambulance['id'],
                    "current_location": ambulance['location'],
                    "recommended_location": best_zone['center'],
                    "reason": f"High predicted demand ({best_zone['demand']} requests/hour)",
                    "expected_response_time_improvement_mins": 2.5,
                    "priority": "high" if best_zone['demand'] > 10 else "medium"
                })
        
        return recommendations
```

#### 6.6 Pattern Analyzer
**Files to create:**
- `ml_service/models/pattern_analyzer.py`

**Implementation:**
```python
from sklearn.ensemble import IsolationForest
import numpy as np

class PatternAnalyzer:
    def __init__(self):
        self.anomaly_detector = IsolationForest(
            contamination=0.1,
            random_state=42
        )
    
    def detect_anomalies(self, data, metric='request_volume'):
        # Fit anomaly detector
        X = data[[metric]].values
        predictions = self.anomaly_detector.fit_predict(X)
        
        anomalies = []
        for idx, pred in enumerate(predictions):
            if pred == -1:  # Anomaly
                anomalies.append({
                    "timestamp": data.iloc[idx]['timestamp'],
                    "metric": metric,
                    "value": data.iloc[idx][metric],
                    "severity": self._calculate_severity(data.iloc[idx][metric], X),
                    "potential_causes": ["Unusual volume spike", "Special event", "Data quality issue"]
                })
        
        return anomalies
    
    def identify_patterns(self, data):
        # Identify temporal patterns
        hourly_pattern = data.groupby(data['timestamp'].dt.hour)['request_count'].mean()
        daily_pattern = data.groupby(data['timestamp'].dt.dayofweek)['request_count'].mean()
        
        patterns = []
        
        # Peak hours
        peak_hours = hourly_pattern.nlargest(3).index.tolist()
        patterns.append({
            "pattern_type": "temporal",
            "description": f"Request volume peaks at hours: {peak_hours}",
            "confidence": 0.94
        })
        
        return patterns
```

#### 6.8 Create FastAPI Endpoints
**Files to create:**
- `ml_service/routers/predictions.py`

**Implementation:**
```python
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any

router = APIRouter(prefix="/api/ml", tags=["Predictions"])

@router.post("/predict/delay")
async def predict_delay(request: DelayPredictionRequest):
    # Load model and predict
    pass

@router.post("/predict/severity")
async def predict_severity(request: SeverityPredictionRequest):
    pass

@router.post("/recommend/hospital")
async def recommend_hospital(request: HospitalRecommendationRequest):
    pass

@router.get("/forecast/demand")
async def forecast_demand(horizon_hours: int = 24):
    pass

@router.post("/allocate/resources")
async def allocate_resources(request: ResourceAllocationRequest):
    pass

@router.post("/analyze/patterns")
async def analyze_patterns(request: PatternAnalysisRequest):
    pass
```

---

### Task 7: Checkpoint
**Status:** Ready after Task 6
**Steps:**
1. Test all ML model endpoints
2. Verify predictions are returned correctly
3. Check latency requirements (<500ms)

---

### Task 8: Explainability Engine (8 sub-tasks)
**Status:** Not started
**Estimated Time:** 3-4 hours
**Priority:** HIGH

#### 8.1-8.2 SHAP Implementation
**Files to create:**
- `ml_service/explainability/shap_explainer.py`

**Implementation:**
```python
import shap
import numpy as np

class SHAPExplainer:
    def __init__(self, model, feature_names):
        self.model = model
        self.feature_names = feature_names
        self.explainer = shap.TreeExplainer(model)
    
    def explain(self, features):
        # Compute SHAP values
        shap_values = self.explainer.shap_values(features)
        
        # Get feature importance
        feature_importance = dict(zip(
            self.feature_names,
            np.abs(shap_values[0])
        ))
        
        # Sort by importance
        sorted_features = sorted(
            feature_importance.items(),
            key=lambda x: x[1],
            reverse=True
        )
        
        return {
            "feature_importance": dict(sorted_features),
            "top_3_factors": [
                {
                    "factor": name,
                    "impact": float(importance),
                    "direction": "increases_delay" if shap_values[0][self.feature_names.index(name)] > 0 else "decreases_delay"
                }
                for name, importance in sorted_features[:3]
            ]
        }
```

#### 8.4 Natural Language Generation
**Files to create:**
- `ml_service/explainability/nlg.py`

**Implementation:**
```python
class NaturalLanguageGenerator:
    def generate_explanation(self, prediction, shap_values):
        top_factors = shap_values['top_3_factors']
        
        explanation = f"{prediction['risk_category']} delay risk predicted due to "
        
        reasons = []
        for factor in top_factors:
            impact_pct = int(factor['impact'] * 100)
            factor_name = factor['factor'].replace('_', ' ')
            reasons.append(f"{factor_name} ({impact_pct}% impact)")
        
        explanation += ", ".join(reasons) + "."
        
        return explanation
```

---

### Task 9: Training Pipeline (13 sub-tasks)
**Status:** Not started
**Estimated Time:** 4-5 hours
**Priority:** MEDIUM

**Key Files:**
- `ml_service/training/pipeline.py`
- `ml_service/training/data_splitter.py`
- `ml_service/training/hyperparameter_tuner.py`
- `ml_service/training/model_evaluator.py`

**MLflow Integration:**
```python
import mlflow
from mlflow.tracking import MlflowClient

class TrainingPipeline:
    def __init__(self):
        mlflow.set_tracking_uri(Config.MLFLOW_TRACKING_URI)
        mlflow.set_experiment(Config.MLFLOW_EXPERIMENT_NAME)
        self.client = MlflowClient()
    
    def run_training(self, model_name, config):
        with mlflow.start_run(run_name=f"{model_name}_{datetime.now()}"):
            # Log parameters
            mlflow.log_params(config)
            
            # Train model
            model = self._train_model(model_name, config)
            
            # Evaluate
            metrics = self._evaluate_model(model)
            mlflow.log_metrics(metrics)
            
            # Log model
            mlflow.sklearn.log_model(model, "model")
            
            # Promote if better
            if self._should_promote(metrics):
                self._promote_to_production(model_name)
```

---

### Task 11: Data Quality Monitoring
**Status:** Not started
**Estimated Time:** 2-3 hours
**Priority:** MEDIUM

**Files to create:**
- `ml_service/quality/monitor.py`

---

### Task 12: Analytics Dashboard (12 sub-tasks)
**Status:** Not started
**Estimated Time:** 6-8 hours
**Priority:** HIGH

**Files to modify:**
- `admin-dashboard/app.py`

**New Pages:**
1. Data Explorer
2. ML Model Performance
3. Demand Forecasting
4. Resource Allocation
5. Pattern Analysis
6. Data Quality Dashboard

---

### Task 13: Backend Integration
**Status:** Not started
**Estimated Time:** 2-3 hours
**Priority:** HIGH

**Files to modify:**
- `backend/src/modules/request/request.service.js`

**Integration Points:**
1. Call ML service on request creation
2. Store predictions in database
3. Add forecast endpoints
4. Add resource recommendation endpoints

---

## Quick Start Commands

### 1. Install Dependencies
```bash
cd ml_service
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 2. Run Database Migrations
```bash
cd backend
npx prisma migrate deploy
```

### 3. Start Redis (if not running)
```bash
redis-server
```

### 4. Start ML Service
```bash
cd ml_service
python app.py
```

### 5. Test Endpoints
```bash
# Generate dataset
curl -X POST http://localhost:8000/api/ml/generate/dataset \
  -H "Content-Type: application/json" \
  -d '{"start_date":"2025-01-01","end_date":"2025-01-31","volume_per_day":100}'

# Compute features
curl -X POST http://localhost:8000/api/features/compute \
  -H "Content-Type: application/json" \
  -d '{"location_lat":40.7128,"location_lng":-74.0060,"timestamp":"2025-01-15T14:30:00Z"}'
```

## Testing Strategy

### Unit Tests
```bash
pytest tests/unit/
```

### Integration Tests
```bash
pytest tests/integration/
```

### Property-Based Tests
```bash
pytest tests/property/
```

## Deployment Checklist

- [ ] All tests passing
- [ ] Redis configured and running
- [ ] PostgreSQL migrations applied
- [ ] MLflow tracking server running
- [ ] Environment variables configured
- [ ] API documentation generated
- [ ] Monitoring and alerting configured

## Next Steps

1. Complete Task 6 (Multi-Model ML Service) - Highest priority
2. Complete Task 8 (Explainability Engine)
3. Complete Task 12 (Analytics Dashboard)
4. Complete Task 13 (Backend Integration)
5. Add comprehensive tests
6. Deploy to staging environment

## Support

For questions or issues:
- Review design document: `.kiro/specs/enhanced-ml-data-exploration/design.md`
- Review requirements: `.kiro/specs/enhanced-ml-data-exploration/requirements.md`
- Check task list: `.kiro/specs/enhanced-ml-data-exploration/tasks.md`

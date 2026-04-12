"""
ML Predictions API Router
Endpoints for all ML prediction types
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from datetime import datetime
import logging
import time

from ml_service.models.delay_predictor import DelayPredictor
from ml_service.feature_store.feature_store import FeatureStore
from ml_service.explainability.explainer import ExplainabilityEngine
from ml_service.utils.metrics import track_performance, get_performance_monitor

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ml", tags=["ML Predictions"])

# Initialize models (singletons)
_delay_predictor = None
_feature_store = None
_explainer = None

def get_delay_predictor() -> DelayPredictor:
    global _delay_predictor
    if _delay_predictor is None:
        _delay_predictor = DelayPredictor()
    return _delay_predictor

def get_feature_store() -> FeatureStore:
    global _feature_store
    if _feature_store is None:
        _feature_store = FeatureStore()
    return _feature_store

def get_explainer() -> ExplainabilityEngine:
    global _explainer
    if _explainer is None:
        _explainer = ExplainabilityEngine()
    return _explainer


# ========== REQUEST/RESPONSE MODELS ==========

class DelayPredictionRequest(BaseModel):
    distance_km: float = Field(..., ge=0)
    time_of_day: int = Field(..., ge=0, le=23)
    day_of_week: int = Field(..., ge=0, le=6)
    traffic_level: str = Field(..., pattern="^(Low|Medium|High)$")
    weather: str = Field(..., pattern="^(Clear|Rain|Fog|Snow)$")
    area_type: str = Field("urban", pattern="^(urban|suburban|rural)$")
    available_ambulances_nearby: int = Field(3, ge=0)
    location_lat: Optional[float] = None
    location_lng: Optional[float] = None


class DelayPredictionResponse(BaseModel):
    delay_minutes: float
    risk_category: str
    confidence: float
    prediction_interval: List[float]
    model_version: str = "v2.0"


class SeverityPredictionRequest(BaseModel):
    emergency_type: str
    patient_age: Optional[int] = None
    vital_signs: Optional[Dict[str, float]] = None
    location_type: str = "home"


class SeverityPredictionResponse(BaseModel):
    severity: str
    confidence: float
    recommended_actions: List[str]
    model_version: str = "v1.0"


class HospitalRecommendationRequest(BaseModel):
    patient_location: Dict[str, float]  # {"lat": ..., "lng": ...}
    emergency_type: str
    severity: str
    current_time: str


class HospitalRecommendation(BaseModel):
    hospital_id: str
    hospital_name: str
    score: float
    distance_km: float
    estimated_travel_time_mins: int
    icu_beds_available: int
    has_specialization: bool
    reasons: List[str]


class HospitalRecommendationResponse(BaseModel):
    recommendations: List[HospitalRecommendation]


# ========== ENDPOINTS ==========

@router.post("/predict/delay", response_model=DelayPredictionResponse)
@track_performance("predict_delay")
async def predict_delay(request: DelayPredictionRequest):
    """
    Predict ambulance arrival delay.
    
    Returns delay in minutes, risk category, and confidence score.
    """
    try:
        # Get feature store
        feature_store = get_feature_store()
        
        # Compute features
        timestamp = datetime.now().replace(hour=request.time_of_day)
        
        request_data = {
            "timestamp": timestamp,
            "location_lat": request.location_lat if hasattr(request, 'location_lat') else 0.0,
            "location_lng": request.location_lng if hasattr(request, 'location_lng') else 0.0
        }
        
        context_data = {
            "traffic_level": request.traffic_level,
            "weather": request.weather,
            "available_ambulances_nearby": request.available_ambulances_nearby,
            "nearest_hospital_lat": request.location_lat,
            "nearest_hospital_lng": request.location_lng
        }
        
        features = feature_store.compute_features(request_data, context_data)
        features["distance_to_nearest_hospital_km"] = request.distance_km
        
        # Get predictor and predict
        predictor = get_delay_predictor()
        prediction = predictor.predict(features)
        
        # Add explanation
        explainer = get_explainer()
        explanation = explainer.explain_prediction(prediction, features, "delay")
        prediction["explanation"] = explanation
        
        logger.info("Delay prediction completed")
        
        return DelayPredictionResponse(**{k: v for k, v in prediction.items() if k != "explanation"})
    
    except Exception as e:
        logger.error(f"Error predicting delay: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/predict/severity", response_model=SeverityPredictionResponse)
@track_performance("predict_severity")
async def predict_severity(request: SeverityPredictionRequest):
    """
    Predict emergency severity level.
    
    Returns severity classification (Critical/High/Medium/Low) with confidence.
    """
    try:
        # Simplified severity prediction (would use trained model)
        severity_map = {
            "Cardiac Arrest": "Critical",
            "Stroke": "Critical",
            "Trauma": "High",
            "Respiratory Distress": "High",
            "Seizure": "Medium",
            "Allergic Reaction": "Medium",
            "Diabetic Emergency": "Medium",
            "Overdose": "High",
            "Burns": "High"
        }
        
        severity = severity_map.get(request.emergency_type, "Medium")
        
        recommended_actions = []
        if severity == "Critical":
            recommended_actions = [
                "Dispatch ALS ambulance immediately",
                "Alert receiving hospital",
                "Prepare for immediate intervention"
            ]
        elif severity == "High":
            recommended_actions = [
                "Dispatch BLS ambulance",
                "Notify hospital",
                "Monitor patient status"
            ]
        else:
            recommended_actions = [
                "Dispatch standard ambulance",
                "Standard protocol"
            ]
        
        return SeverityPredictionResponse(
            severity=severity,
            confidence=0.88,
            recommended_actions=recommended_actions
        )
    
    except Exception as e:
        logger.error(f"Error predicting severity: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/recommend/hospital", response_model=HospitalRecommendationResponse)
@track_performance("recommend_hospital")
async def recommend_hospital(request: HospitalRecommendationRequest):
    """
    Recommend optimal hospitals for patient.
    
    Returns ranked list of hospitals with scores and reasons.
    Queries real hospitals from PostgreSQL database and ranks them by:
    - Distance from patient location
    - Bed availability (ICU and general)
    - Specialization match with emergency type
    """
    try:
        from ml_service.utils.database import query_hospitals_from_database, rank_hospitals_by_criteria
        
        # Extract patient location
        patient_lat = request.patient_location.get("lat")
        patient_lng = request.patient_location.get("lng")
        
        if patient_lat is None or patient_lng is None:
            raise HTTPException(status_code=400, detail="Patient location (lat, lng) is required")
        
        # Validate coordinates
        if not (-90 <= patient_lat <= 90) or not (-180 <= patient_lng <= 180):
            raise HTTPException(status_code=400, detail="Invalid patient coordinates")
        
        # Query real hospitals from database
        hospitals = query_hospitals_from_database()
        
        if not hospitals:
            logger.warning("No hospitals found in database")
            return HospitalRecommendationResponse(recommendations=[])
        
        # Rank hospitals by distance, capacity, and specialization
        ranked_hospitals = rank_hospitals_by_criteria(
            hospitals=hospitals,
            patient_lat=patient_lat,
            patient_lng=patient_lng,
            emergency_type=request.emergency_type,
            severity=request.severity
        )
        
        # Convert to response format (top 5 recommendations)
        recommendations = []
        for hospital in ranked_hospitals[:5]:
            recommendations.append(
                HospitalRecommendation(
                    hospital_id=hospital['hospital_id'],
                    hospital_name=hospital['hospital_name'],
                    score=hospital['score'],
                    distance_km=hospital['distance_km'],
                    estimated_travel_time_mins=hospital['estimated_travel_time_mins'],
                    icu_beds_available=hospital['icu_beds_available'],
                    has_specialization=hospital['has_specialization'],
                    reasons=hospital['reasons']
                )
            )
        
        logger.info(f"Recommended {len(recommendations)} hospitals for patient at ({patient_lat}, {patient_lng})")
        return HospitalRecommendationResponse(recommendations=recommendations)
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error recommending hospital: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/forecast/demand")
@track_performance("forecast_demand")
async def forecast_demand(
    forecast_horizon: int = 24,
    granularity: str = "hourly",
    region: str = "all"
):
    """
    Forecast emergency request demand.
    
    Returns predicted request volumes for the next N hours/days.
    """
    try:
        # Simplified forecast (would use Prophet model)
        forecasts = []
        base_volume = 12
        
        for i in range(forecast_horizon):
            # Simple pattern: higher during day, lower at night
            hour = (datetime.now().hour + i) % 24
            multiplier = 1.5 if 7 <= hour <= 20 else 0.6
            
            predicted = int(base_volume * multiplier)
            
            forecasts.append({
                "timestamp": (datetime.now().replace(minute=0, second=0) + 
                             pd.Timedelta(hours=i)).isoformat(),
                "predicted_requests": predicted,
                "confidence_interval": [int(predicted * 0.8), int(predicted * 1.2)],
                "by_emergency_type": {
                    "cardiac": int(predicted * 0.2),
                    "trauma": int(predicted * 0.25),
                    "respiratory": int(predicted * 0.15),
                    "other": int(predicted * 0.4)
                }
            })
        
        return {
            "forecasts": forecasts,
            "model_version": "prophet_v1.0",
            "generated_at": datetime.now().isoformat()
        }
    
    except Exception as e:
        logger.error(f"Error forecasting demand: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/allocate/resources")
@track_performance("allocate_resources")
async def allocate_resources(request: Dict[str, Any]):
    """
    Recommend resource allocation for ambulance fleet.
    
    Returns repositioning recommendations to optimize coverage.
    """
    try:
        # Simplified resource allocation
        recommendations = [
            {
                "ambulance_id": "amb-001",
                "current_location": {"lat": 40.7128, "lng": -74.0060},
                "recommended_location": {"lat": 40.7580, "lng": -73.9855},
                "reason": "High predicted demand in Upper East Side",
                "expected_response_time_improvement_mins": 3.5,
                "priority": "high"
            }
        ]
        
        return {
            "recommendations": recommendations,
            "expected_impact": {
                "avg_response_time_reduction_mins": 2.8,
                "coverage_improvement_pct": 15
            }
        }
    
    except Exception as e:
        logger.error(f"Error allocating resources: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/analyze/patterns")
@track_performance("analyze_patterns")
async def analyze_patterns(request: Dict[str, Any]):
    """
    Analyze patterns and detect anomalies in emergency data.
    
    Returns detected patterns and anomalies with severity levels.
    """
    try:
        # Simplified pattern analysis
        return {
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
                    "confidence": 0.94
                }
            ]
        }
    
    except Exception as e:
        logger.error(f"Error analyzing patterns: {e}")
        raise HTTPException(status_code=500, detail=str(e))


import pandas as pd  # Import at top in actual implementation

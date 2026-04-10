"""
Feature Store API Router
Endpoints for feature computation and serving
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Dict, Any, List, Optional
from datetime import datetime
import logging
import time

from ml_service.feature_store.feature_store import FeatureStore
from ml_service.utils.metrics import track_performance

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/features", tags=["Features"])

# Initialize feature store (singleton)
_feature_store = None

def get_feature_store() -> FeatureStore:
    """Get or create feature store instance"""
    global _feature_store
    if _feature_store is None:
        _feature_store = FeatureStore()
    return _feature_store


class FeatureComputeRequest(BaseModel):
    """Request model for feature computation"""
    request_id: Optional[str] = None
    location_lat: float = Field(..., description="Latitude")
    location_lng: float = Field(..., description="Longitude")
    emergency_type: Optional[str] = None
    timestamp: str = Field(..., description="ISO format timestamp")
    traffic_level: Optional[str] = Field(None, description="Low/Medium/High")
    weather: Optional[str] = Field(None, description="Clear/Rain/Fog/Snow")
    available_ambulances_nearby: Optional[int] = None
    nearest_hospital_lat: Optional[float] = None
    nearest_hospital_lng: Optional[float] = None


class FeatureComputeResponse(BaseModel):
    """Response model for feature computation"""
    features: Dict[str, Any]
    computation_time_ms: int


@router.post("/compute", response_model=FeatureComputeResponse)
@track_performance("compute_features")
async def compute_features(request: FeatureComputeRequest):
    """
    Compute all features for a request.
    
    This endpoint computes temporal, geographic, contextual, historical,
    and derived features for an emergency request.
    """
    try:
        start_time = time.time()
        
        # Parse timestamp
        timestamp = datetime.fromisoformat(request.timestamp.replace('Z', '+00:00'))
        
        # Prepare request data
        request_data = {
            "timestamp": timestamp,
            "location_lat": request.location_lat,
            "location_lng": request.location_lng,
            "emergency_type": request.emergency_type
        }
        
        # Prepare context data
        context_data = {}
        if request.traffic_level:
            context_data["traffic_level"] = request.traffic_level
        if request.weather:
            context_data["weather"] = request.weather
        if request.available_ambulances_nearby is not None:
            context_data["available_ambulances_nearby"] = request.available_ambulances_nearby
        if request.nearest_hospital_lat is not None:
            context_data["nearest_hospital_lat"] = request.nearest_hospital_lat
        if request.nearest_hospital_lng is not None:
            context_data["nearest_hospital_lng"] = request.nearest_hospital_lng
        
        # Compute features
        feature_store = get_feature_store()
        features = feature_store.compute_features(request_data, context_data)
        
        # Store in online store if request_id provided
        if request.request_id and feature_store.redis_available:
            feature_store.set_online_features(request.request_id, features)
        
        computation_time = int((time.time() - start_time) * 1000)
        
        return FeatureComputeResponse(
            features=features,
            computation_time_ms=computation_time
        )
    
    except ValueError as e:
        logger.error(f"Validation error: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error computing features: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to compute features: {str(e)}")


@router.get("/list")
async def list_features(category: Optional[str] = None):
    """
    List all registered features.
    
    Args:
        category: Optional category filter (temporal, geographic, contextual, historical, derived)
    """
    try:
        feature_store = get_feature_store()
        features = feature_store.registry.list_features(category=category)
        
        # Get metadata for each feature
        feature_metadata = {
            name: feature_store.registry.get_metadata(name)
            for name in features
        }
        
        return {
            "count": len(features),
            "features": feature_metadata
        }
    
    except Exception as e:
        logger.error(f"Error listing features: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/metadata/{feature_name}")
async def get_feature_metadata(feature_name: str):
    """Get metadata for a specific feature"""
    try:
        feature_store = get_feature_store()
        metadata = feature_store.registry.get_metadata(feature_name)
        
        if not metadata:
            raise HTTPException(status_code=404, detail=f"Feature '{feature_name}' not found")
        
        return metadata
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting feature metadata: {e}")
        raise HTTPException(status_code=500, detail=str(e))

"""
Data Generation API Router
Endpoints for generating realistic emergency response datasets
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, Tuple, List, Dict
from datetime import datetime
import uuid
import logging

from ml_service.data_generator.emergency_request_generator import EmergencyRequestGenerator
from ml_service.data_generator.ambulance_fleet_generator import AmbulanceFleetGenerator
from ml_service.data_generator.hospital_capacity_generator import HospitalCapacityGenerator
from ml_service.data_generator.ground_truth_labeler import GroundTruthLabeler
from ml_service.data_generator.dataset_exporter import DatasetExporter

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ml/generate", tags=["Data Generation"])


class DatasetGenerationRequest(BaseModel):
    """Request model for dataset generation"""
    start_date: str = Field(..., description="Start date (YYYY-MM-DD)")
    end_date: str = Field(..., description="End date (YYYY-MM-DD)")
    volume_per_day: int = Field(100, description="Average requests per day", ge=1, le=1000)
    geographic_bounds: Optional[Tuple[float, float, float, float]] = Field(
        None,
        description="Geographic bounds (lat_min, lat_max, lng_min, lng_max)"
    )
    export_format: str = Field("parquet", description="Export format (csv, json, parquet)")
    num_ambulances: Optional[int] = Field(None, description="Number of ambulances to generate", ge=1)
    hospitals: Optional[List[Dict]] = Field(None, description="List of hospital data")


class DatasetGenerationResponse(BaseModel):
    """Response model for dataset generation"""
    dataset_id: str
    num_requests: int
    num_ambulances: int
    num_hospitals: int
    date_range: Tuple[str, str]
    file_paths: Dict[str, str]
    metadata: Dict


@router.post("/dataset", response_model=DatasetGenerationResponse)
async def generate_dataset(request: DatasetGenerationRequest):
    """
    Generate a complete emergency response dataset.
    
    This endpoint generates:
    - Emergency requests with realistic temporal and spatial patterns
    - Ambulance fleet with driver schedules
    - Hospital capacity timeline
    - Ground truth delay labels
    """
    try:
        logger.info(f"Generating dataset from {request.start_date} to {request.end_date}")
        
        # Parse dates
        start_date = datetime.fromisoformat(request.start_date)
        end_date = datetime.fromisoformat(request.end_date)
        
        if end_date <= start_date:
            raise HTTPException(status_code=400, detail="end_date must be after start_date")
        
        # Generate dataset ID
        dataset_id = str(uuid.uuid4())
        
        # Initialize generators
        request_gen = EmergencyRequestGenerator()
        fleet_gen = AmbulanceFleetGenerator()
        capacity_gen = HospitalCapacityGenerator()
        labeler = GroundTruthLabeler()
        
        # Use provided hospitals or create default ones
        hospitals = request.hospitals or [
            {"id": f"hosp-{i}", "name": f"Hospital {i}", "location_lat": 40.7 + i*0.05, "location_lng": -74.0 + i*0.05}
            for i in range(1, 4)
        ]
        
        # Generate emergency requests
        requests_df = request_gen.generate_requests(
            start_date=start_date,
            end_date=end_date,
            base_volume=request.volume_per_day,
            geographic_bounds=request.geographic_bounds
        )
        
        # Generate ambulance fleet
        num_ambulances = request.num_ambulances or len(hospitals) * 5
        fleet_df, schedule_df = fleet_gen.generate_fleet(
            num_ambulances=num_ambulances,
            hospitals=hospitals,
            start_date=start_date,
            end_date=end_date
        )
        
        # Generate hospital capacity timeline
        capacity_df = capacity_gen.generate_capacity_timeline(
            hospitals=hospitals,
            start_date=start_date,
            end_date=end_date,
            granularity="hourly"
        )
        
        # Generate ground truth labels for requests
        delays = []
        risk_categories = []
        
        for _, row in requests_df.iterrows():
            # Simulate contextual factors
            distance = np.random.uniform(1, 15)  # km
            traffic = np.random.choice(["Low", "Medium", "High"], p=[0.3, 0.5, 0.2])
            weather = np.random.choice(["Clear", "Rain", "Fog", "Snow"], p=[0.6, 0.25, 0.1, 0.05])
            hour = row["timestamp"].hour
            availability = np.random.randint(0, 5)
            
            delay, risk = labeler.compute_delay(distance, traffic, weather, hour, availability)
            delays.append(delay)
            risk_categories.append(risk)
        
        requests_df["delay_minutes"] = delays
        requests_df["risk_category"] = risk_categories
        
        # Export datasets
        base_path = f"./data/generated/{dataset_id}"
        
        requests_path = DatasetExporter.export_dataset(
            requests_df,
            f"{base_path}/requests",
            request.export_format,
            metadata=DatasetExporter.generate_metadata(requests_df, {
                "start_date": request.start_date,
                "end_date": request.end_date,
                "volume_per_day": request.volume_per_day
            })
        )
        
        fleet_path = DatasetExporter.export_dataset(
            fleet_df,
            f"{base_path}/fleet",
            request.export_format
        )
        
        schedule_path = DatasetExporter.export_dataset(
            schedule_df,
            f"{base_path}/schedule",
            request.export_format
        )
        
        capacity_path = DatasetExporter.export_dataset(
            capacity_df,
            f"{base_path}/capacity",
            request.export_format
        )
        
        # Generate response
        return DatasetGenerationResponse(
            dataset_id=dataset_id,
            num_requests=len(requests_df),
            num_ambulances=len(fleet_df),
            num_hospitals=len(hospitals),
            date_range=(request.start_date, request.end_date),
            file_paths={
                "requests": requests_path,
                "fleet": fleet_path,
                "schedule": schedule_path,
                "capacity": capacity_path
            },
            metadata={
                "generation_params": {
                    "volume_per_day": request.volume_per_day,
                    "geographic_bounds": request.geographic_bounds,
                    "num_ambulances": num_ambulances
                },
                "statistics": {
                    "avg_requests_per_day": len(requests_df) / ((end_date - start_date).days or 1),
                    "emergency_type_distribution": requests_df["emergency_type"].value_counts().to_dict(),
                    "area_type_distribution": requests_df["area_type"].value_counts().to_dict(),
                    "risk_distribution": requests_df["risk_category"].value_counts().to_dict()
                }
            }
        )
    
    except ValueError as e:
        logger.error(f"Validation error: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error generating dataset: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to generate dataset: {str(e)}")


import numpy as np  # Import at top in actual implementation

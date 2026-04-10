"""
Ambulance Fleet Generator
Creates realistic ambulance fleet data with driver schedules and maintenance
"""
import pandas as pd
import numpy as np
from datetime import datetime, timedelta, time
from typing import List, Dict
from faker import Faker
import logging

logger = logging.getLogger(__name__)


class AmbulanceFleetGenerator:
    """Generates realistic ambulance fleet data"""
    
    SHIFT_PATTERNS = [
        {"start": time(7, 0), "end": time(15, 0), "name": "morning"},
        {"start": time(15, 0), "end": time(23, 0), "name": "afternoon"},
        {"start": time(23, 0), "end": time(7, 0), "name": "night"}
    ]
    
    def __init__(self, seed: int = None):
        """Initialize generator with optional random seed"""
        if seed is not None:
            np.random.seed(seed)
            Faker.seed(seed)
        self.fake = Faker()
    
    def generate_fleet(
        self,
        num_ambulances: int,
        hospitals: List[Dict],
        start_date: datetime,
        end_date: datetime
    ) -> pd.DataFrame:
        """
        Generate ambulance fleet with driver schedules and maintenance windows.
        
        Args:
            num_ambulances: Number of ambulances to generate
            hospitals: List of hospital dicts with id, location_lat, location_lng
            start_date: Start date for schedule generation
            end_date: End date for schedule generation
        
        Returns:
            DataFrame with ambulance fleet data
        """
        logger.info(f"Generating fleet of {num_ambulances} ambulances")
        
        if not hospitals:
            raise ValueError("At least one hospital required")
        
        ambulances = []
        
        for i in range(num_ambulances):
            # Assign to hospital (weighted by capacity if available)
            hospital = np.random.choice(hospitals)
            
            # Generate ambulance data
            ambulance_id = f"AMB-{i+1:04d}"
            plate_number = self.fake.license_plate()
            driver_name = self.fake.name()
            
            # Assign base location (hospital location with small offset)
            base_lat = hospital.get("location_lat", 40.7128) + np.random.normal(0, 0.01)
            base_lng = hospital.get("location_lng", -74.0060) + np.random.normal(0, 0.01)
            
            # Generate shift schedule
            shift_pattern = np.random.choice(self.SHIFT_PATTERNS)
            
            # Generate maintenance schedule (every 2-4 weeks)
            maintenance_interval_days = np.random.randint(14, 29)
            
            # Performance metrics (realistic ranges)
            avg_response_time = np.random.uniform(6, 12)  # minutes
            total_calls = np.random.randint(50, 200)
            
            ambulances.append({
                "ambulance_id": ambulance_id,
                "hospital_id": hospital.get("id"),
                "hospital_name": hospital.get("name", "Unknown Hospital"),
                "plate_number": plate_number,
                "driver_name": driver_name,
                "base_location_lat": base_lat,
                "base_location_lng": base_lng,
                "shift_start": shift_pattern["start"].strftime("%H:%M"),
                "shift_end": shift_pattern["end"].strftime("%H:%M"),
                "shift_pattern": shift_pattern["name"],
                "maintenance_interval_days": maintenance_interval_days,
                "avg_response_time_mins": round(avg_response_time, 2),
                "total_calls_completed": total_calls,
                "is_available": True
            })
        
        df = pd.DataFrame(ambulances)
        
        # Generate detailed schedule entries for date range
        schedule_df = self._generate_detailed_schedule(df, start_date, end_date)
        
        logger.info(f"Generated {len(df)} ambulances with {len(schedule_df)} schedule entries")
        
        return df, schedule_df
    
    def _generate_detailed_schedule(
        self,
        fleet_df: pd.DataFrame,
        start_date: datetime,
        end_date: datetime
    ) -> pd.DataFrame:
        """Generate detailed day-by-day schedule with availability"""
        schedule_entries = []
        
        current_date = start_date.date()
        end = end_date.date()
        
        for _, ambulance in fleet_df.iterrows():
            maintenance_counter = 0
            ambulance_start = current_date
            
            while ambulance_start <= end:
                # Check if maintenance day
                is_maintenance = (maintenance_counter % ambulance["maintenance_interval_days"]) == 0
                
                schedule_entries.append({
                    "ambulance_id": ambulance["ambulance_id"],
                    "date": ambulance_start,
                    "shift_start": ambulance["shift_start"],
                    "shift_end": ambulance["shift_end"],
                    "is_available": not is_maintenance,
                    "reason_unavailable": "Maintenance" if is_maintenance else None,
                    "location_lat": ambulance["base_location_lat"],
                    "location_lng": ambulance["base_location_lng"]
                })
                
                ambulance_start += timedelta(days=1)
                maintenance_counter += 1
        
        return pd.DataFrame(schedule_entries)

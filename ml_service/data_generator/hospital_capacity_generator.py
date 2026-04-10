"""
Hospital Capacity Generator
Creates realistic hospital capacity data with time-varying availability
"""
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import List, Dict
import logging

logger = logging.getLogger(__name__)


class HospitalCapacityGenerator:
    """Generates realistic hospital capacity data with time-varying availability"""
    
    def __init__(self, seed: int = None):
        """Initialize generator with optional random seed"""
        if seed is not None:
            np.random.seed(seed)
    
    def generate_capacity_timeline(
        self,
        hospitals: List[Dict],
        start_date: datetime,
        end_date: datetime,
        granularity: str = "hourly"
    ) -> pd.DataFrame:
        """
        Generate hospital capacity timeline.
        
        Args:
            hospitals: List of hospital dicts with id, name, bed_capacity, icu_beds, general_beds
            start_date: Start datetime
            end_date: End datetime
            granularity: "hourly" or "daily"
        
        Returns:
            DataFrame with capacity timeline
        """
        logger.info(f"Generating capacity timeline for {len(hospitals)} hospitals")
        
        if granularity not in ["hourly", "daily"]:
            raise ValueError("granularity must be 'hourly' or 'daily'")
        
        # Determine time delta
        delta = timedelta(hours=1) if granularity == "hourly" else timedelta(days=1)
        
        capacity_entries = []
        
        for hospital in hospitals:
            # Get hospital capacities
            total_icu = hospital.get("icu_beds_available", hospital.get("bedCapacity", 20) // 5)
            total_general = hospital.get("general_beds_available", hospital.get("bedCapacity", 100) - total_icu)
            total_ventilators = hospital.get("ventilatorsAvailable", total_icu // 2)
            
            # Initialize current availability (start at 70-90% available)
            current_icu = int(total_icu * np.random.uniform(0.7, 0.9))
            current_general = int(total_general * np.random.uniform(0.7, 0.9))
            current_ventilators = int(total_ventilators * np.random.uniform(0.7, 0.9))
            
            current_time = start_date
            
            while current_time <= end_date:
                # Simulate capacity changes (admissions and discharges)
                current_icu, current_general, current_ventilators = self._simulate_capacity_change(
                    current_icu, current_general, current_ventilators,
                    total_icu, total_general, total_ventilators,
                    current_time
                )
                
                capacity_entries.append({
                    "timestamp": current_time,
                    "hospital_id": hospital.get("id"),
                    "hospital_name": hospital.get("name", "Unknown Hospital"),
                    "icu_beds_available": current_icu,
                    "general_beds_available": current_general,
                    "ventilators_available": current_ventilators,
                    "icu_beds_total": total_icu,
                    "general_beds_total": total_general,
                    "ventilators_total": total_ventilators,
                    "icu_utilization_pct": round((1 - current_icu / total_icu) * 100, 2) if total_icu > 0 else 0,
                    "general_utilization_pct": round((1 - current_general / total_general) * 100, 2) if total_general > 0 else 0
                })
                
                current_time += delta
        
        df = pd.DataFrame(capacity_entries)
        logger.info(f"Generated {len(df)} capacity timeline entries")
        
        return df
    
    def _simulate_capacity_change(
        self,
        current_icu: int,
        current_general: int,
        current_ventilators: int,
        total_icu: int,
        total_general: int,
        total_ventilators: int,
        current_time: datetime
    ) -> tuple:
        """Simulate realistic capacity changes"""
        # Time-based patterns (more admissions during day, more discharges in afternoon)
        hour = current_time.hour
        
        # ICU changes (slower turnover)
        if np.random.random() < 0.05:  # 5% chance of change per hour
            icu_change = np.random.choice([-1, 1], p=[0.4, 0.6])  # Slightly more discharges
            current_icu = np.clip(current_icu + icu_change, 0, total_icu)
        
        # General bed changes (faster turnover)
        if np.random.random() < 0.15:  # 15% chance of change per hour
            # More admissions in morning/evening, more discharges in afternoon
            if 8 <= hour <= 12:
                general_change = np.random.choice([-2, -1, 1], p=[0.5, 0.3, 0.2])
            elif 14 <= hour <= 17:
                general_change = np.random.choice([-1, 1, 2], p=[0.2, 0.3, 0.5])
            else:
                general_change = np.random.choice([-1, 1], p=[0.5, 0.5])
            
            current_general = np.clip(current_general + general_change, 0, total_general)
        
        # Ventilator changes (tied to ICU but slower)
        if np.random.random() < 0.03:
            vent_change = np.random.choice([-1, 1], p=[0.45, 0.55])
            current_ventilators = np.clip(current_ventilators + vent_change, 0, total_ventilators)
        
        # Ensure non-negative and within bounds
        current_icu = max(0, min(current_icu, total_icu))
        current_general = max(0, min(current_general, total_general))
        current_ventilators = max(0, min(current_ventilators, total_ventilators))
        
        return current_icu, current_general, current_ventilators

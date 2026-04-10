"""
Emergency Request Generator
Creates realistic emergency request datasets with temporal and spatial patterns
"""
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import Tuple, Optional, Dict, List
from faker import Faker
import logging

logger = logging.getLogger(__name__)
fake = Faker()


class EmergencyRequestGenerator:
    """Generates realistic emergency requests with temporal and spatial patterns"""
    
    EMERGENCY_TYPES = [
        "Cardiac Arrest",
        "Stroke",
        "Trauma",
        "Respiratory Distress",
        "Seizure",
        "Allergic Reaction",
        "Diabetic Emergency",
        "Overdose",
        "Burns",
        "Other"
    ]
    
    # Emergency type probabilities by area type
    EMERGENCY_TYPE_DIST = {
        "urban": {
            "Cardiac Arrest": 0.15,
            "Stroke": 0.12,
            "Trauma": 0.20,
            "Respiratory Distress": 0.15,
            "Seizure": 0.08,
            "Allergic Reaction": 0.05,
            "Diabetic Emergency": 0.07,
            "Overdose": 0.08,
            "Burns": 0.05,
            "Other": 0.05
        },
        "suburban": {
            "Cardiac Arrest": 0.18,
            "Stroke": 0.15,
            "Trauma": 0.15,
            "Respiratory Distress": 0.12,
            "Seizure": 0.10,
            "Allergic Reaction": 0.08,
            "Diabetic Emergency": 0.10,
            "Overdose": 0.04,
            "Burns": 0.04,
            "Other": 0.04
        },
        "rural": {
            "Cardiac Arrest": 0.20,
            "Stroke": 0.18,
            "Trauma": 0.18,
            "Respiratory Distress": 0.10,
            "Seizure": 0.08,
            "Allergic Reaction": 0.06,
            "Diabetic Emergency": 0.08,
            "Overdose": 0.03,
            "Burns": 0.06,
            "Other": 0.03
        }
    }
    
    def __init__(self, seed: Optional[int] = None):
        """Initialize generator with optional random seed"""
        if seed is not None:
            np.random.seed(seed)
            Faker.seed(seed)
        self.fake = Faker()
    
    def generate_requests(
        self,
        start_date: datetime,
        end_date: datetime,
        base_volume: int = 100,
        geographic_bounds: Optional[Tuple[float, float, float, float]] = None
    ) -> pd.DataFrame:
        """
        Generate emergency requests with realistic patterns.
        
        Args:
            start_date: Start date for generation
            end_date: End date for generation
            base_volume: Average requests per day
            geographic_bounds: (lat_min, lat_max, lng_min, lng_max)
        
        Returns:
            DataFrame with emergency request data
        """
        logger.info(f"Generating requests from {start_date} to {end_date}")
        
        # Default to NYC area if no bounds specified
        if geographic_bounds is None:
            geographic_bounds = (40.5, 40.9, -74.3, -73.7)
        
        lat_min, lat_max, lng_min, lng_max = geographic_bounds
        
        # Calculate total days
        num_days = (end_date - start_date).days
        if num_days <= 0:
            raise ValueError("end_date must be after start_date")
        
        # Generate timestamps with temporal patterns
        timestamps = self._generate_temporal_pattern(start_date, end_date, base_volume)
        num_requests = len(timestamps)
        
        logger.info(f"Generated {num_requests} timestamps")
        
        # Generate spatial distribution
        locations = self._generate_spatial_distribution(
            num_requests, lat_min, lat_max, lng_min, lng_max
        )
        
        # Determine area types based on location
        area_types = self._assign_area_types(locations)
        
        # Generate emergency types based on area and time
        emergency_types = self._generate_emergency_types(timestamps, area_types)
        
        # Generate patient information
        patient_names = [self.fake.name() for _ in range(num_requests)]
        patient_phones = [self.fake.phone_number() for _ in range(num_requests)]
        pickup_addresses = [
            self.fake.street_address() for _ in range(num_requests)
        ]
        
        # Create DataFrame
        df = pd.DataFrame({
            "timestamp": timestamps,
            "location_lat": locations[:, 0],
            "location_lng": locations[:, 1],
            "emergency_type": emergency_types,
            "area_type": area_types,
            "patient_name": patient_names,
            "patient_phone": patient_phones,
            "pickup_address": pickup_addresses
        })
        
        logger.info(f"Generated {len(df)} emergency requests")
        return df
    
    def _generate_temporal_pattern(
        self,
        start_date: datetime,
        end_date: datetime,
        base_volume: int
    ) -> List[datetime]:
        """Generate timestamps with realistic temporal patterns"""
        timestamps = []
        current_date = start_date
        
        while current_date < end_date:
            # Day of week effect (weekends slightly lower)
            day_of_week = current_date.weekday()
            day_multiplier = 0.85 if day_of_week >= 5 else 1.0
            
            # Generate hourly volumes for this day
            daily_volume = int(base_volume * day_multiplier)
            
            for hour in range(24):
                # Hourly pattern (peaks at 7-9am and 5-8pm)
                hour_multiplier = self._get_hour_multiplier(hour)
                hour_volume = int(daily_volume / 24 * hour_multiplier)
                
                # Add some randomness
                hour_volume = max(0, int(np.random.normal(hour_volume, hour_volume * 0.2)))
                
                # Generate timestamps within this hour
                for _ in range(hour_volume):
                    minute = np.random.randint(0, 60)
                    second = np.random.randint(0, 60)
                    timestamp = current_date.replace(
                        hour=hour, minute=minute, second=second
                    )
                    timestamps.append(timestamp)
            
            current_date += timedelta(days=1)
        
        return sorted(timestamps)
    
    def _get_hour_multiplier(self, hour: int) -> float:
        """Get volume multiplier for given hour (peak hours have higher multipliers)"""
        # Morning peak: 7-9am
        if 7 <= hour <= 9:
            return 1.5
        # Evening peak: 5-8pm
        elif 17 <= hour <= 20:
            return 1.6
        # Late night low: 2-5am
        elif 2 <= hour <= 5:
            return 0.4
        # Normal hours
        else:
            return 1.0
    
    def _generate_spatial_distribution(
        self,
        num_requests: int,
        lat_min: float,
        lat_max: float,
        lng_min: float,
        lng_max: float
    ) -> np.ndarray:
        """Generate locations with realistic spatial distribution (clustered)"""
        # Create 3-5 population centers
        num_centers = np.random.randint(3, 6)
        centers = np.random.uniform(
            low=[lat_min, lng_min],
            high=[lat_max, lng_max],
            size=(num_centers, 2)
        )
        
        # Assign each request to a center with probability based on "population"
        center_weights = np.random.dirichlet(np.ones(num_centers))
        center_assignments = np.random.choice(
            num_centers, size=num_requests, p=center_weights
        )
        
        # Generate locations around centers with normal distribution
        locations = np.zeros((num_requests, 2))
        for i in range(num_requests):
            center = centers[center_assignments[i]]
            # Smaller std for more clustering
            std = 0.02  # ~2km radius
            location = np.random.normal(center, std)
            # Clip to bounds
            location[0] = np.clip(location[0], lat_min, lat_max)
            location[1] = np.clip(location[1], lng_min, lng_max)
            locations[i] = location
        
        return locations
    
    def _assign_area_types(self, locations: np.ndarray) -> List[str]:
        """Assign area types (urban/suburban/rural) based on location density"""
        num_requests = len(locations)
        area_types = []
        
        # Simple heuristic: calculate local density
        for i in range(num_requests):
            # Count nearby points (within 0.05 degrees ~5km)
            distances = np.sqrt(
                (locations[:, 0] - locations[i, 0])**2 +
                (locations[:, 1] - locations[i, 1])**2
            )
            nearby_count = np.sum(distances < 0.05)
            
            # Classify based on density
            if nearby_count > num_requests * 0.1:
                area_type = "urban"
            elif nearby_count > num_requests * 0.03:
                area_type = "suburban"
            else:
                area_type = "rural"
            
            area_types.append(area_type)
        
        return area_types
    
    def _generate_emergency_types(
        self,
        timestamps: List[datetime],
        area_types: List[str]
    ) -> List[str]:
        """Generate emergency types based on area type and time"""
        emergency_types = []
        
        for timestamp, area_type in zip(timestamps, area_types):
            # Get distribution for this area type
            dist = self.EMERGENCY_TYPE_DIST.get(area_type, self.EMERGENCY_TYPE_DIST["urban"])
            
            # Time-based adjustments (e.g., more cardiac arrests in morning)
            hour = timestamp.hour
            adjusted_dist = dist.copy()
            
            if 6 <= hour <= 10:  # Morning: more cardiac arrests
                adjusted_dist["Cardiac Arrest"] *= 1.3
            elif 22 <= hour or hour <= 2:  # Late night: more trauma, overdose
                adjusted_dist["Trauma"] *= 1.4
                adjusted_dist["Overdose"] *= 1.5
            
            # Normalize
            total = sum(adjusted_dist.values())
            adjusted_dist = {k: v/total for k, v in adjusted_dist.items()}
            
            # Sample
            emergency_type = np.random.choice(
                list(adjusted_dist.keys()),
                p=list(adjusted_dist.values())
            )
            emergency_types.append(emergency_type)
        
        return emergency_types

"""
Ground Truth Labeler
Generates ground truth delay labels based on causal factors
"""
import numpy as np
from typing import Tuple
import logging

logger = logging.getLogger(__name__)


class GroundTruthLabeler:
    """Generates ground truth delay labels based on realistic causal factors"""
    
    # Base delay by distance (minutes per km)
    BASE_DELAY_PER_KM = 2.0
    
    # Traffic multipliers
    TRAFFIC_MULTIPLIERS = {
        "Low": 1.0,
        "Medium": 1.4,
        "High": 2.0
    }
    
    # Weather multipliers
    WEATHER_MULTIPLIERS = {
        "Clear": 1.0,
        "Rain": 1.3,
        "Fog": 1.4,
        "Snow": 1.8
    }
    
    # Time of day multipliers (rush hour effects)
    def __init__(self, seed: int = None):
        """Initialize labeler with optional random seed"""
        if seed is not None:
            np.random.seed(seed)
    
    def compute_delay(
        self,
        distance_km: float,
        traffic_level: str,
        weather: str,
        time_of_day: int,
        ambulance_availability: int
    ) -> Tuple[float, str]:
        """
        Compute realistic delay based on causal factors.
        
        Args:
            distance_km: Distance to destination in kilometers
            traffic_level: "Low", "Medium", or "High"
            weather: "Clear", "Rain", "Fog", or "Snow"
            time_of_day: Hour of day (0-23)
            ambulance_availability: Number of available ambulances nearby
        
        Returns:
            Tuple of (delay_minutes, risk_category)
        """
        # Base delay from distance
        base_delay = distance_km * self.BASE_DELAY_PER_KM
        
        # Apply traffic multiplier
        traffic_mult = self.TRAFFIC_MULTIPLIERS.get(traffic_level, 1.0)
        
        # Apply weather multiplier
        weather_mult = self.WEATHER_MULTIPLIERS.get(weather, 1.0)
        
        # Time of day multiplier (rush hours)
        time_mult = self._get_time_multiplier(time_of_day)
        
        # Ambulance availability factor (fewer ambulances = longer wait)
        if ambulance_availability == 0:
            availability_mult = 2.5
        elif ambulance_availability == 1:
            availability_mult = 1.5
        elif ambulance_availability == 2:
            availability_mult = 1.2
        else:
            availability_mult = 1.0
        
        # Calculate total delay
        delay = base_delay * traffic_mult * weather_mult * time_mult * availability_mult
        
        # Add some realistic noise (±10%)
        noise = np.random.normal(1.0, 0.1)
        delay = delay * noise
        
        # Ensure minimum delay of 3 minutes
        delay = max(3.0, delay)
        
        # Determine risk category
        risk_category = self._categorize_risk(delay)
        
        return round(delay, 2), risk_category
    
    def _get_time_multiplier(self, hour: int) -> float:
        """Get time-based multiplier for rush hour effects"""
        # Morning rush: 7-9am
        if 7 <= hour <= 9:
            return 1.4
        # Evening rush: 5-7pm
        elif 17 <= hour <= 19:
            return 1.5
        # Late night: 11pm-5am (less traffic but slower response)
        elif hour >= 23 or hour <= 5:
            return 1.1
        # Normal hours
        else:
            return 1.0
    
    def _categorize_risk(self, delay: float) -> str:
        """Categorize delay into risk levels"""
        if delay < 8:
            return "Low"
        elif delay < 15:
            return "Medium"
        elif delay < 25:
            return "High"
        else:
            return "Severe"

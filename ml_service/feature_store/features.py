"""
Feature Definitions
All feature computation functions and registration
"""
from datetime import datetime
import numpy as np
from typing import Any
import logging

logger = logging.getLogger(__name__)


def register_features(registry):
    """Register all features with the registry"""
    
    # ========== TEMPORAL FEATURES ==========
    
    def hour_of_day(timestamp: datetime, **kwargs) -> int:
        """Extract hour of day (0-23)"""
        return timestamp.hour
    
    def day_of_week(timestamp: datetime, **kwargs) -> int:
        """Extract day of week (0=Monday, 6=Sunday)"""
        return timestamp.weekday()
    
    def month(timestamp: datetime, **kwargs) -> int:
        """Extract month (1-12)"""
        return timestamp.month
    
    def is_weekend(timestamp: datetime, **kwargs) -> bool:
        """Check if weekend"""
        return timestamp.weekday() >= 5
    
    def is_holiday(timestamp: datetime, **kwargs) -> bool:
        """Check if holiday (simplified - major US holidays)"""
        # Simplified: just check for major holidays
        month, day = timestamp.month, timestamp.day
        holidays = [(1, 1), (7, 4), (12, 25)]  # New Year, July 4th, Christmas
        return (month, day) in holidays
    
    # Register temporal features
    registry.register_feature(
        "hour_of_day", hour_of_day, ["timestamp"], "int",
        "Hour of day (0-23)", category="temporal"
    )
    registry.register_feature(
        "day_of_week", day_of_week, ["timestamp"], "int",
        "Day of week (0=Monday, 6=Sunday)", category="temporal"
    )
    registry.register_feature(
        "month", month, ["timestamp"], "int",
        "Month (1-12)", category="temporal"
    )
    registry.register_feature(
        "is_weekend", is_weekend, ["timestamp"], "bool",
        "Whether it's weekend", category="temporal"
    )
    registry.register_feature(
        "is_holiday", is_holiday, ["timestamp"], "bool",
        "Whether it's a holiday", category="temporal"
    )
    
    # ========== GEOGRAPHIC FEATURES ==========
    
    def distance_to_nearest_hospital(location_lat: float, location_lng: float, 
                                     nearest_hospital_lat: float = None, 
                                     nearest_hospital_lng: float = None, **kwargs) -> float:
        """Calculate distance to nearest hospital in km"""
        if nearest_hospital_lat is None or nearest_hospital_lng is None:
            # Default to a reasonable distance if not provided
            return 5.0
        
        # Haversine formula (simplified)
        lat_diff = abs(location_lat - nearest_hospital_lat)
        lng_diff = abs(location_lng - nearest_hospital_lng)
        distance = np.sqrt(lat_diff**2 + lng_diff**2) * 111  # Rough km conversion
        return round(distance, 2)
    
    def area_type(location_lat: float, location_lng: float, **kwargs) -> str:
        """Determine area type (urban/suburban/rural) - simplified"""
        # Simplified: would normally use population density data
        # For now, use a simple heuristic
        return kwargs.get("area_type", "urban")
    
    def population_density(location_lat: float, location_lng: float, **kwargs) -> float:
        """Estimate population density - simplified"""
        # Simplified: would normally use census data
        return kwargs.get("population_density", 1000.0)
    
    registry.register_feature(
        "distance_to_nearest_hospital_km", distance_to_nearest_hospital,
        ["location_lat", "location_lng"], "float",
        "Distance to nearest hospital in km", category="geographic"
    )
    registry.register_feature(
        "area_type", area_type,
        ["location_lat", "location_lng"], "string",
        "Area type (urban/suburban/rural)", category="geographic"
    )
    registry.register_feature(
        "population_density", population_density,
        ["location_lat", "location_lng"], "float",
        "Population density (people per sq km)", category="geographic"
    )
    
    # ========== CONTEXTUAL FEATURES ==========
    
    def traffic_level(traffic_level: str = None, **kwargs) -> str:
        """Current traffic level"""
        return traffic_level or "Medium"
    
    def traffic_severity_score(traffic_level: str = None, **kwargs) -> float:
        """Traffic severity score (0-1)"""
        scores = {"Low": 0.2, "Medium": 0.5, "High": 0.9}
        return scores.get(traffic_level, 0.5)
    
    def weather(weather: str = None, **kwargs) -> str:
        """Current weather condition"""
        return weather or "Clear"
    
    def temperature(temperature: float = None, **kwargs) -> float:
        """Current temperature in Celsius"""
        return temperature if temperature is not None else 20.0
    
    def available_ambulances_nearby(available_ambulances_nearby: int = None, **kwargs) -> int:
        """Number of available ambulances nearby"""
        return available_ambulances_nearby if available_ambulances_nearby is not None else 3
    
    registry.register_feature(
        "traffic_level", traffic_level, [], "string",
        "Current traffic level (Low/Medium/High)", category="contextual"
    )
    registry.register_feature(
        "traffic_severity_score", traffic_severity_score, ["traffic_level"], "float",
        "Traffic severity score (0-1)", category="contextual"
    )
    registry.register_feature(
        "weather", weather, [], "string",
        "Current weather condition", category="contextual"
    )
    registry.register_feature(
        "temperature", temperature, [], "float",
        "Current temperature in Celsius", category="contextual"
    )
    registry.register_feature(
        "available_ambulances_nearby", available_ambulances_nearby, [], "int",
        "Number of available ambulances nearby", category="contextual"
    )
    
    # ========== HISTORICAL AGGREGATION FEATURES ==========
    
    def avg_delay_last_7days_area(location_lat: float = None, location_lng: float = None, **kwargs) -> float:
        """Average delay in this area over last 7 days"""
        # Simplified: would query historical data
        return kwargs.get("avg_delay_last_7days_area", 10.0)
    
    def hospital_utilization_rate_24h(hospital_id: str = None, **kwargs) -> float:
        """Hospital utilization rate over last 24 hours"""
        # Simplified: would query hospital capacity data
        return kwargs.get("hospital_utilization_rate_24h", 0.75)
    
    registry.register_feature(
        "avg_delay_last_7days_area", avg_delay_last_7days_area,
        ["location_lat", "location_lng"], "float",
        "Average delay in area over last 7 days (minutes)", category="historical"
    )
    registry.register_feature(
        "hospital_utilization_rate_24h", hospital_utilization_rate_24h,
        ["hospital_id"], "float",
        "Hospital utilization rate over last 24 hours (0-1)", category="historical"
    )
    
    # ========== DERIVED FEATURES ==========
    
    def traffic_adjusted_distance(distance_to_nearest_hospital_km: float = None,
                                  traffic_severity_score: float = None, **kwargs) -> float:
        """Distance adjusted for traffic"""
        if distance_to_nearest_hospital_km is None or traffic_severity_score is None:
            return 5.0
        return round(distance_to_nearest_hospital_km * (1 + traffic_severity_score), 2)
    
    def weather_adjusted_delay(hour_of_day: int = None, weather: str = None, **kwargs) -> float:
        """Base delay adjusted for weather"""
        weather_multipliers = {"Clear": 1.0, "Rain": 1.3, "Fog": 1.4, "Snow": 1.8}
        base_delay = 5.0  # Base 5 minutes
        multiplier = weather_multipliers.get(weather, 1.0)
        return round(base_delay * multiplier, 2)
    
    registry.register_feature(
        "traffic_adjusted_distance", traffic_adjusted_distance,
        ["distance_to_nearest_hospital_km", "traffic_severity_score"], "float",
        "Distance adjusted for traffic conditions", category="derived"
    )
    registry.register_feature(
        "weather_adjusted_delay", weather_adjusted_delay,
        ["hour_of_day", "weather"], "float",
        "Base delay adjusted for weather", category="derived"
    )
    
    logger.info(f"Registered {len(registry.list_features())} features")

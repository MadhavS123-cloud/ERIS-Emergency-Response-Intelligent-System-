"""
Database utilities for ML Service
Provides connection and query functions for PostgreSQL database
"""
import psycopg2
from psycopg2.extras import RealDictCursor
from psycopg2.pool import SimpleConnectionPool
import logging
from typing import List, Dict, Any, Optional
from ml_service.config import Config
import math

logger = logging.getLogger(__name__)

# Connection pool for efficient database queries
_connection_pool: Optional[SimpleConnectionPool] = None


def get_connection_pool() -> SimpleConnectionPool:
    """Get or create database connection pool"""
    global _connection_pool
    
    if _connection_pool is None:
        try:
            _connection_pool = SimpleConnectionPool(
                minconn=1,
                maxconn=10,
                dsn=Config.DATABASE_URL
            )
            logger.info("Database connection pool created")
        except Exception as e:
            logger.error(f"Failed to create connection pool: {e}")
            raise
    
    return _connection_pool


def get_db_connection():
    """Get a database connection from the pool"""
    pool = get_connection_pool()
    return pool.getconn()


def release_db_connection(conn):
    """Release a database connection back to the pool"""
    pool = get_connection_pool()
    pool.putconn(conn)


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate the great circle distance between two points on Earth
    using the Haversine formula.
    
    Args:
        lat1, lon1: Latitude and longitude of first point in degrees
        lat2, lon2: Latitude and longitude of second point in degrees
    
    Returns:
        Distance in kilometers
    """
    R = 6371  # Earth radius in kilometers
    
    # Convert to radians
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    delta_lat = math.radians(lat2 - lat1)
    delta_lon = math.radians(lon2 - lon1)
    
    # Haversine formula
    a = (math.sin(delta_lat / 2) ** 2 +
         math.cos(lat1_rad) * math.cos(lat2_rad) *
         math.sin(delta_lon / 2) ** 2)
    c = 2 * math.asin(math.sqrt(a))
    
    return R * c


def query_hospitals_from_database() -> List[Dict[str, Any]]:
    """
    Query all hospitals from the database with valid GPS coordinates.
    
    Returns:
        List of hospital records with id, name, location, and capacity data
    """
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # Query hospitals with valid coordinates
        cursor.execute("""
            SELECT 
                id,
                name,
                address,
                "locationLat",
                "locationLng",
                "icuBedsAvailable",
                "generalBedsAvailable",
                "ventilatorCount",
                specialization
            FROM "Hospital"
            WHERE "locationLat" IS NOT NULL 
              AND "locationLng" IS NOT NULL
              AND "locationLat" BETWEEN -90 AND 90
              AND "locationLng" BETWEEN -180 AND 180
            ORDER BY name
        """)
        
        hospitals = cursor.fetchall()
        cursor.close()
        
        logger.info(f"Retrieved {len(hospitals)} hospitals from database")
        return [dict(h) for h in hospitals]
        
    except Exception as e:
        logger.error(f"Error querying hospitals from database: {e}")
        return []
    finally:
        if conn:
            release_db_connection(conn)


def rank_hospitals_by_criteria(
    hospitals: List[Dict[str, Any]],
    patient_lat: float,
    patient_lng: float,
    emergency_type: str,
    severity: str
) -> List[Dict[str, Any]]:
    """
    Rank hospitals based on distance, capacity, and specialization.
    
    Args:
        hospitals: List of hospital records from database
        patient_lat: Patient latitude
        patient_lng: Patient longitude
        emergency_type: Type of emergency (e.g., "cardiac_arrest")
        severity: Severity level (e.g., "Critical", "High", "Medium")
    
    Returns:
        List of hospitals with computed scores and rankings
    """
    ranked_hospitals = []
    
    for hospital in hospitals:
        # Calculate distance
        distance_km = haversine_distance(
            patient_lat,
            patient_lng,
            hospital['locationLat'],
            hospital['locationLng']
        )
        
        # Calculate score based on multiple factors
        score = 0.0
        reasons = []
        
        # Distance factor (closer is better) - 40% weight
        # Normalize distance: 0-10km = 1.0, 10-20km = 0.5, >20km = 0.1
        if distance_km <= 10:
            distance_score = 1.0 - (distance_km / 20)
            reasons.append(f"Close proximity ({distance_km:.1f} km)")
        elif distance_km <= 20:
            distance_score = 0.5 - ((distance_km - 10) / 40)
            reasons.append(f"Moderate distance ({distance_km:.1f} km)")
        else:
            distance_score = 0.1
            reasons.append(f"Distant location ({distance_km:.1f} km)")
        
        score += distance_score * 0.4
        
        # Capacity factor - 30% weight
        icu_beds = hospital.get('icuBedsAvailable', 0) or 0
        general_beds = hospital.get('generalBedsAvailable', 0) or 0
        total_beds = icu_beds + general_beds
        
        if severity in ['Critical', 'High'] and icu_beds > 0:
            capacity_score = min(icu_beds / 10, 1.0)  # Normalize to max 10 ICU beds
            reasons.append(f"{icu_beds} ICU beds available")
        elif total_beds > 0:
            capacity_score = min(total_beds / 20, 1.0)  # Normalize to max 20 total beds
            reasons.append(f"{total_beds} beds available")
        else:
            capacity_score = 0.1
            reasons.append("Limited bed availability")
        
        score += capacity_score * 0.3
        
        # Specialization factor - 30% weight
        specialization = hospital.get('specialization', '')
        has_specialization = False
        
        if specialization:
            # Check if specialization matches emergency type
            emergency_keywords = {
                'cardiac': ['cardiac', 'cardiology', 'heart'],
                'trauma': ['trauma', 'emergency', 'surgery'],
                'stroke': ['stroke', 'neurology', 'neuro'],
                'respiratory': ['respiratory', 'pulmonary', 'lung']
            }
            
            for emergency_key, keywords in emergency_keywords.items():
                if emergency_key in emergency_type.lower():
                    if any(keyword in specialization.lower() for keyword in keywords):
                        has_specialization = True
                        reasons.append(f"Specialized in {specialization}")
                        break
        
        specialization_score = 1.0 if has_specialization else 0.5
        score += specialization_score * 0.3
        
        # Estimate travel time (rough estimate: 40 km/h average speed)
        estimated_travel_time_mins = int((distance_km / 40) * 60)
        
        ranked_hospitals.append({
            'hospital_id': hospital['id'],
            'hospital_name': hospital['name'],
            'score': round(score, 2),
            'distance_km': round(distance_km, 2),
            'estimated_travel_time_mins': estimated_travel_time_mins,
            'icu_beds_available': icu_beds,
            'general_beds_available': general_beds,
            'has_specialization': has_specialization,
            'specialization': specialization or 'General',
            'reasons': reasons
        })
    
    # Sort by score (descending)
    ranked_hospitals.sort(key=lambda x: x['score'], reverse=True)
    
    return ranked_hospitals


def close_connection_pool():
    """Close the database connection pool"""
    global _connection_pool
    
    if _connection_pool:
        _connection_pool.closeall()
        _connection_pool = None
        logger.info("Database connection pool closed")

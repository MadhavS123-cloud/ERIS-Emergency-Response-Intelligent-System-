"""
Quality monitoring API endpoints
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from datetime import datetime
import logging

from ml_service.quality.monitor import DataQualityMonitor

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/quality", tags=["quality"])


class QualityCheckConfig(BaseModel):
    """Configuration for quality checks"""
    completeness: Optional[List[Dict[str, Any]]] = Field(
        default=[],
        description="Completeness checks configuration"
    )
    drift: Optional[List[Dict[str, Any]]] = Field(
        default=[],
        description="Distribution drift checks configuration"
    )
    consistency: Optional[List[Dict[str, Any]]] = Field(
        default=[],
        description="Consistency validation checks configuration"
    )
    outliers: Optional[List[Dict[str, Any]]] = Field(
        default=[],
        description="Outlier detection checks configuration"
    )
    freshness: Optional[List[Dict[str, Any]]] = Field(
        default=[],
        description="Data freshness checks configuration"
    )


class QualityCheckResponse(BaseModel):
    """Response from quality checks"""
    metrics: List[Dict[str, Any]]
    alerts: List[Dict[str, Any]]
    summary: Dict[str, Any]


@router.post("/check", response_model=QualityCheckResponse)
async def run_quality_checks(config: QualityCheckConfig):
    """
    Run comprehensive data quality checks
    
    Example request:
    ```json
    {
        "completeness": [
            {
                "table": "requests",
                "columns": ["location_lat", "location_lng", "emergency_type"]
            }
        ],
        "drift": [
            {
                "table": "requests",
                "column": "distance_km",
                "baseline_days": 30,
                "recent_days": 7
            }
        ],
        "consistency": [
            {
                "table": "requests",
                "validations": [
                    {"type": "non_negative", "column": "distance_km"},
                    {"type": "enum", "column": "status", "rule": {"values": ["PENDING", "ACCEPTED", "COMPLETED"]}}
                ]
            }
        ],
        "outliers": [
            {
                "table": "requests",
                "column": "distance_km",
                "method": "zscore"
            }
        ],
        "freshness": [
            {
                "table": "requests",
                "timestamp_column": "created_at"
            }
        ]
    }
    ```
    """
    try:
        monitor = DataQualityMonitor()
        results = monitor.run_quality_checks(config.dict())
        
        return QualityCheckResponse(**results)
        
    except Exception as e:
        logger.error(f"Error running quality checks: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/metrics/recent")
async def get_recent_metrics(
    metric_name: Optional[str] = None,
    hours: int = 24
):
    """
    Get recent quality metrics from database
    
    Args:
        metric_name: Filter by specific metric name (optional)
        hours: Number of hours to look back (default: 24)
    """
    try:
        from sqlalchemy import create_engine, text
        from ml_service.config import Config
        import pandas as pd
        from datetime import timedelta
        
        engine = create_engine(Config.DATABASE_URL)
        
        cutoff_time = datetime.now() - timedelta(hours=hours)
        
        if metric_name:
            query = text("""
                SELECT *
                FROM data_quality_metrics
                WHERE metric_name = :metric_name
                AND measured_at >= :cutoff_time
                ORDER BY measured_at DESC
            """)
            params = {'metric_name': metric_name, 'cutoff_time': cutoff_time}
        else:
            query = text("""
                SELECT *
                FROM data_quality_metrics
                WHERE measured_at >= :cutoff_time
                ORDER BY measured_at DESC
            """)
            params = {'cutoff_time': cutoff_time}
        
        df = pd.read_sql(query, engine, params=params)
        
        metrics = df.to_dict('records')
        
        return {
            'metrics': metrics,
            'count': len(metrics),
            'time_range_hours': hours
        }
        
    except Exception as e:
        logger.error(f"Error fetching recent metrics: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/metrics/trends")
async def get_metric_trends(
    metric_name: str,
    days: int = 7
):
    """
    Get historical trends for a specific metric
    
    Args:
        metric_name: Name of the metric to get trends for
        days: Number of days to look back (default: 7)
    """
    try:
        from sqlalchemy import create_engine, text
        from ml_service.config import Config
        import pandas as pd
        from datetime import timedelta
        
        engine = create_engine(Config.DATABASE_URL)
        
        cutoff_time = datetime.now() - timedelta(days=days)
        
        query = text("""
            SELECT measured_at, metric_value, status, threshold_value
            FROM data_quality_metrics
            WHERE metric_name = :metric_name
            AND measured_at >= :cutoff_time
            ORDER BY measured_at ASC
        """)
        
        df = pd.read_sql(
            query,
            engine,
            params={'metric_name': metric_name, 'cutoff_time': cutoff_time}
        )
        
        if len(df) == 0:
            return {
                'metric_name': metric_name,
                'trends': [],
                'summary': {
                    'count': 0,
                    'message': 'No data found for this metric'
                }
            }
        
        trends = df.to_dict('records')
        
        # Calculate summary statistics
        summary = {
            'count': len(df),
            'avg_value': float(df['metric_value'].mean()) if 'metric_value' in df.columns else None,
            'min_value': float(df['metric_value'].min()) if 'metric_value' in df.columns else None,
            'max_value': float(df['metric_value'].max()) if 'metric_value' in df.columns else None,
            'status_distribution': df['status'].value_counts().to_dict() if 'status' in df.columns else {}
        }
        
        return {
            'metric_name': metric_name,
            'trends': trends,
            'summary': summary,
            'time_range_days': days
        }
        
    except Exception as e:
        logger.error(f"Error fetching metric trends: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/alerts/active")
async def get_active_alerts():
    """
    Get currently active quality alerts
    
    This endpoint runs a quick quality check and returns any active alerts
    """
    try:
        # Define default quality checks for common tables
        default_config = {
            'completeness': [
                {
                    'table': 'requests',
                    'columns': ['location_lat', 'location_lng', 'emergency_type', 'status']
                }
            ],
            'freshness': [
                {
                    'table': 'requests',
                    'timestamp_column': 'created_at'
                }
            ]
        }
        
        monitor = DataQualityMonitor()
        results = monitor.run_quality_checks(default_config)
        
        return {
            'alerts': results['alerts'],
            'alert_count': len(results['alerts']),
            'summary': results['summary']
        }
        
    except Exception as e:
        logger.error(f"Error fetching active alerts: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/health")
async def quality_monitoring_health():
    """Health check for quality monitoring service"""
    try:
        from sqlalchemy import create_engine, text
        from ml_service.config import Config
        
        engine = create_engine(Config.DATABASE_URL)
        
        # Test database connection
        with engine.connect() as conn:
            result = conn.execute(text("SELECT 1"))
            result.fetchone()
        
        return {
            'status': 'healthy',
            'database': 'connected',
            'timestamp': datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return {
            'status': 'unhealthy',
            'error': str(e),
            'timestamp': datetime.now().isoformat()
        }

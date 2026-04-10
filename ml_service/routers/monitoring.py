"""
Monitoring API Router
Endpoints for performance metrics, cache stats, and queue stats
"""
from fastapi import APIRouter
from typing import Dict, Any
import logging

from ml_service.utils.metrics import get_performance_monitor
from ml_service.utils.cache import get_model_cache, get_feature_cache
from ml_service.utils.queue import get_request_queue

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/monitoring", tags=["Monitoring"])


@router.get("/metrics")
async def get_metrics() -> Dict[str, Any]:
    """
    Get all performance metrics.
    
    Returns latency percentiles, throughput, and error rates.
    """
    monitor = get_performance_monitor()
    return monitor.get_all_metrics()


@router.get("/metrics/summary")
async def get_metrics_summary() -> Dict[str, Any]:
    """
    Get summary of key performance metrics.
    
    Returns high-level overview of system performance.
    """
    monitor = get_performance_monitor()
    return monitor.get_summary()


@router.get("/metrics/sla")
async def check_sla_compliance() -> Dict[str, Any]:
    """
    Check SLA compliance for latency requirements.
    
    Requirements:
    - Delay prediction: <200ms for 95% of requests
    - All predictions: <500ms for 95% of requests
    - Feature serving: <100ms average
    
    Returns compliance status for each requirement.
    """
    monitor = get_performance_monitor()
    return monitor.check_sla_compliance()


@router.get("/cache/stats")
async def get_cache_stats() -> Dict[str, Any]:
    """
    Get cache statistics.
    
    Returns hit rates and cache sizes for model and feature caches.
    """
    model_cache = get_model_cache()
    feature_cache = get_feature_cache()
    
    return {
        "model_cache": model_cache.get_stats(),
        "feature_cache": feature_cache.get_stats()
    }


@router.post("/cache/clear")
async def clear_caches() -> Dict[str, str]:
    """
    Clear all caches.
    
    Use this to force reload of models and recomputation of features.
    """
    model_cache = get_model_cache()
    feature_cache = get_feature_cache()
    
    model_cache.clear()
    feature_cache.clear()
    
    logger.info("All caches cleared via API")
    
    return {"status": "success", "message": "All caches cleared"}


@router.get("/queue/stats")
async def get_queue_stats() -> Dict[str, Any]:
    """
    Get request queue statistics.
    
    Returns queue size, processing count, and throughput metrics.
    """
    queue = get_request_queue()
    return queue.get_stats()


@router.get("/health/detailed")
async def detailed_health_check() -> Dict[str, Any]:
    """
    Detailed health check with performance metrics.
    
    Returns overall system health including SLA compliance.
    """
    monitor = get_performance_monitor()
    model_cache = get_model_cache()
    feature_cache = get_feature_cache()
    queue = get_request_queue()
    
    sla_compliance = monitor.check_sla_compliance()
    cache_stats = {
        "model_cache": model_cache.get_stats(),
        "feature_cache": feature_cache.get_stats()
    }
    queue_stats = queue.get_stats()
    
    # Determine overall health
    health_status = "healthy"
    issues = []
    
    # Check SLA compliance
    if not sla_compliance["all_compliant"]:
        health_status = "degraded"
        if not sla_compliance["delay_prediction_200ms"]:
            issues.append("Delay prediction latency exceeds 200ms (p95)")
        if not sla_compliance["all_predictions_500ms"]:
            issues.append("Prediction latency exceeds 500ms (p95)")
        if not sla_compliance["feature_serving_100ms"]:
            issues.append("Feature serving latency exceeds 100ms (avg)")
    
    # Check cache hit rates
    if cache_stats["feature_cache"]["hit_rate_pct"] < 80:
        health_status = "degraded"
        issues.append(f"Feature cache hit rate low: {cache_stats['feature_cache']['hit_rate_pct']}%")
    
    # Check queue
    if queue_stats["queue_size"] > queue_stats["max_queue_size"] * 0.8:
        health_status = "degraded"
        issues.append(f"Queue nearly full: {queue_stats['queue_size']}/{queue_stats['max_queue_size']}")
    
    if queue_stats["timeout_rate_pct"] > 5:
        health_status = "degraded"
        issues.append(f"High timeout rate: {queue_stats['timeout_rate_pct']}%")
    
    # Check error rate
    summary = monitor.get_summary()
    if summary["error_rate_pct"] > 5:
        health_status = "unhealthy"
        issues.append(f"High error rate: {summary['error_rate_pct']}%")
    
    return {
        "status": health_status,
        "issues": issues,
        "sla_compliance": sla_compliance,
        "cache_stats": cache_stats,
        "queue_stats": queue_stats,
        "performance_summary": summary
    }

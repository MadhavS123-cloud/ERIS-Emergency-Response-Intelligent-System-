"""
Performance Metrics Collection
Tracks latency, throughput, and other performance metrics
"""
import time
import logging
from typing import Dict, Any, Optional, List
from dataclasses import dataclass, field
from datetime import datetime
from collections import deque
from functools import wraps
import statistics

logger = logging.getLogger(__name__)


@dataclass
class LatencyMetrics:
    """Latency metrics with percentiles"""
    count: int = 0
    total_ms: float = 0.0
    min_ms: float = float('inf')
    max_ms: float = 0.0
    p50_ms: float = 0.0
    p95_ms: float = 0.0
    p99_ms: float = 0.0
    recent_latencies: deque = field(default_factory=lambda: deque(maxlen=1000))
    
    def record(self, latency_ms: float):
        """Record a latency measurement"""
        self.count += 1
        self.total_ms += latency_ms
        self.min_ms = min(self.min_ms, latency_ms)
        self.max_ms = max(self.max_ms, latency_ms)
        self.recent_latencies.append(latency_ms)
        
        # Update percentiles
        if len(self.recent_latencies) > 0:
            sorted_latencies = sorted(self.recent_latencies)
            n = len(sorted_latencies)
            self.p50_ms = sorted_latencies[int(n * 0.50)]
            self.p95_ms = sorted_latencies[int(n * 0.95)]
            self.p99_ms = sorted_latencies[int(n * 0.99)]
    
    def get_avg_ms(self) -> float:
        """Get average latency"""
        return self.total_ms / self.count if self.count > 0 else 0.0
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        return {
            "count": self.count,
            "avg_ms": round(self.get_avg_ms(), 2),
            "min_ms": round(self.min_ms, 2) if self.min_ms != float('inf') else 0.0,
            "max_ms": round(self.max_ms, 2),
            "p50_ms": round(self.p50_ms, 2),
            "p95_ms": round(self.p95_ms, 2),
            "p99_ms": round(self.p99_ms, 2)
        }


@dataclass
class ThroughputMetrics:
    """Throughput metrics (requests per second)"""
    total_requests: int = 0
    start_time: float = field(default_factory=time.time)
    recent_timestamps: deque = field(default_factory=lambda: deque(maxlen=1000))
    
    def record(self):
        """Record a request"""
        self.total_requests += 1
        self.recent_timestamps.append(time.time())
    
    def get_requests_per_second(self) -> float:
        """Get current requests per second (based on recent requests)"""
        if len(self.recent_timestamps) < 2:
            return 0.0
        
        time_span = self.recent_timestamps[-1] - self.recent_timestamps[0]
        if time_span == 0:
            return 0.0
        
        return len(self.recent_timestamps) / time_span
    
    def get_total_requests_per_second(self) -> float:
        """Get overall requests per second since start"""
        elapsed = time.time() - self.start_time
        if elapsed == 0:
            return 0.0
        
        return self.total_requests / elapsed
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        return {
            "total_requests": self.total_requests,
            "requests_per_second": round(self.get_requests_per_second(), 2),
            "total_requests_per_second": round(self.get_total_requests_per_second(), 2),
            "uptime_seconds": round(time.time() - self.start_time, 2)
        }


class PerformanceMonitor:
    """
    Performance monitoring system.
    Tracks latency percentiles and throughput for ML service operations.
    """
    
    def __init__(self):
        """Initialize performance monitor"""
        self._latency_metrics: Dict[str, LatencyMetrics] = {}
        self._throughput_metrics: Dict[str, ThroughputMetrics] = {}
        self._error_counts: Dict[str, int] = {}
        logger.info("PerformanceMonitor initialized")
    
    def record_latency(self, operation: str, latency_ms: float):
        """
        Record latency for an operation.
        
        Args:
            operation: Operation name (e.g., "predict_delay", "compute_features")
            latency_ms: Latency in milliseconds
        """
        if operation not in self._latency_metrics:
            self._latency_metrics[operation] = LatencyMetrics()
        
        self._latency_metrics[operation].record(latency_ms)
        
        # Log warning if latency exceeds thresholds
        if "predict" in operation and latency_ms > 500:
            logger.warning(f"{operation} latency {latency_ms:.1f}ms exceeds 500ms threshold")
        elif "feature" in operation and latency_ms > 100:
            logger.warning(f"{operation} latency {latency_ms:.1f}ms exceeds 100ms threshold")
    
    def record_request(self, operation: str):
        """
        Record a request for throughput tracking.
        
        Args:
            operation: Operation name
        """
        if operation not in self._throughput_metrics:
            self._throughput_metrics[operation] = ThroughputMetrics()
        
        self._throughput_metrics[operation].record()
    
    def record_error(self, operation: str):
        """
        Record an error for an operation.
        
        Args:
            operation: Operation name
        """
        if operation not in self._error_counts:
            self._error_counts[operation] = 0
        
        self._error_counts[operation] += 1
    
    def get_latency_metrics(self, operation: str) -> Optional[Dict[str, Any]]:
        """
        Get latency metrics for an operation.
        
        Args:
            operation: Operation name
        
        Returns:
            Latency metrics dictionary or None
        """
        if operation in self._latency_metrics:
            return self._latency_metrics[operation].to_dict()
        return None
    
    def get_throughput_metrics(self, operation: str) -> Optional[Dict[str, Any]]:
        """
        Get throughput metrics for an operation.
        
        Args:
            operation: Operation name
        
        Returns:
            Throughput metrics dictionary or None
        """
        if operation in self._throughput_metrics:
            return self._throughput_metrics[operation].to_dict()
        return None
    
    def get_all_metrics(self) -> Dict[str, Any]:
        """Get all metrics"""
        metrics = {
            "latency": {},
            "throughput": {},
            "errors": self._error_counts.copy()
        }
        
        for operation, latency in self._latency_metrics.items():
            metrics["latency"][operation] = latency.to_dict()
        
        for operation, throughput in self._throughput_metrics.items():
            metrics["throughput"][operation] = throughput.to_dict()
        
        return metrics
    
    def get_summary(self) -> Dict[str, Any]:
        """Get summary of key metrics"""
        all_metrics = self.get_all_metrics()
        
        # Calculate overall statistics
        total_requests = sum(
            m["total_requests"] 
            for m in all_metrics["throughput"].values()
        )
        
        total_errors = sum(all_metrics["errors"].values())
        error_rate = (total_errors / total_requests * 100) if total_requests > 0 else 0.0
        
        # Get prediction latencies
        delay_latency = all_metrics["latency"].get("predict_delay", {})
        feature_latency = all_metrics["latency"].get("compute_features", {})
        
        return {
            "total_requests": total_requests,
            "total_errors": total_errors,
            "error_rate_pct": round(error_rate, 2),
            "delay_prediction_latency": delay_latency,
            "feature_computation_latency": feature_latency,
            "operations": list(self._latency_metrics.keys())
        }
    
    def check_sla_compliance(self) -> Dict[str, Any]:
        """
        Check SLA compliance for latency requirements.
        
        Requirements:
        - Delay prediction: <200ms for 95% of requests
        - All predictions: <500ms for 95% of requests
        - Feature serving: <100ms
        
        Returns:
            SLA compliance status
        """
        compliance = {
            "delay_prediction_200ms": False,
            "all_predictions_500ms": False,
            "feature_serving_100ms": False,
            "details": {}
        }
        
        # Check delay prediction <200ms
        if "predict_delay" in self._latency_metrics:
            delay_metrics = self._latency_metrics["predict_delay"]
            compliance["delay_prediction_200ms"] = delay_metrics.p95_ms < 200
            compliance["details"]["predict_delay_p95"] = round(delay_metrics.p95_ms, 2)
        
        # Check all predictions <500ms
        prediction_ops = [op for op in self._latency_metrics.keys() if "predict" in op]
        if prediction_ops:
            max_p95 = max(
                self._latency_metrics[op].p95_ms 
                for op in prediction_ops
            )
            compliance["all_predictions_500ms"] = max_p95 < 500
            compliance["details"]["max_prediction_p95"] = round(max_p95, 2)
        
        # Check feature serving <100ms
        if "compute_features" in self._latency_metrics:
            feature_metrics = self._latency_metrics["compute_features"]
            compliance["feature_serving_100ms"] = feature_metrics.get_avg_ms() < 100
            compliance["details"]["compute_features_avg"] = round(feature_metrics.get_avg_ms(), 2)
        
        compliance["all_compliant"] = all([
            compliance["delay_prediction_200ms"],
            compliance["all_predictions_500ms"],
            compliance["feature_serving_100ms"]
        ])
        
        return compliance
    
    def reset(self):
        """Reset all metrics"""
        self._latency_metrics.clear()
        self._throughput_metrics.clear()
        self._error_counts.clear()
        logger.info("Performance metrics reset")


# Global monitor instance
_performance_monitor = None


def get_performance_monitor() -> PerformanceMonitor:
    """Get global performance monitor instance"""
    global _performance_monitor
    if _performance_monitor is None:
        _performance_monitor = PerformanceMonitor()
    return _performance_monitor


def track_performance(operation: str):
    """
    Decorator to track performance of a function.
    
    Args:
        operation: Operation name for metrics
    
    Example:
        @track_performance("predict_delay")
        async def predict_delay(request):
            # ... prediction logic ...
            return result
    """
    def decorator(func):
        @wraps(func)
        async def async_wrapper(*args, **kwargs):
            monitor = get_performance_monitor()
            monitor.record_request(operation)
            
            start_time = time.time()
            try:
                result = await func(*args, **kwargs)
                latency_ms = (time.time() - start_time) * 1000
                monitor.record_latency(operation, latency_ms)
                return result
            except Exception as e:
                monitor.record_error(operation)
                raise
        
        @wraps(func)
        def sync_wrapper(*args, **kwargs):
            monitor = get_performance_monitor()
            monitor.record_request(operation)
            
            start_time = time.time()
            try:
                result = func(*args, **kwargs)
                latency_ms = (time.time() - start_time) * 1000
                monitor.record_latency(operation, latency_ms)
                return result
            except Exception as e:
                monitor.record_error(operation)
                raise
        
        # Return appropriate wrapper based on function type
        import asyncio
        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        else:
            return sync_wrapper
    
    return decorator

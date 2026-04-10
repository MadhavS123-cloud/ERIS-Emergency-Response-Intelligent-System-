"""
Tests for Performance Optimizations (Task 14)
Tests caching, queuing, and monitoring functionality
"""
import pytest
import asyncio
import time
from datetime import datetime

from ml_service.utils.cache import ModelCache, FeatureCache, get_model_cache, get_feature_cache
from ml_service.utils.queue import RequestQueue, Priority, determine_priority
from ml_service.utils.metrics import PerformanceMonitor, get_performance_monitor


class TestModelCache:
    """Test model caching functionality"""
    
    def test_cache_set_and_get(self):
        """Test basic cache set and get operations"""
        cache = ModelCache(default_ttl=60)
        
        # Create a mock model
        model = {"type": "test_model", "version": "1.0"}
        
        # Store in cache
        cache.set("test_model", model)
        
        # Retrieve from cache
        cached_model = cache.get("test_model")
        
        assert cached_model is not None
        assert cached_model == model
    
    def test_cache_miss(self):
        """Test cache miss returns None"""
        cache = ModelCache(default_ttl=60)
        
        result = cache.get("nonexistent_model")
        
        assert result is None
    
    def test_cache_expiration(self):
        """Test cache entries expire after TTL"""
        cache = ModelCache(default_ttl=1)  # 1 second TTL
        
        model = {"type": "test_model"}
        cache.set("test_model", model)
        
        # Should be in cache immediately
        assert cache.get("test_model") is not None
        
        # Wait for expiration
        time.sleep(1.1)
        
        # Should be expired
        assert cache.get("test_model") is None
    
    def test_cache_stats(self):
        """Test cache statistics tracking"""
        cache = ModelCache(default_ttl=60)
        
        model = {"type": "test_model"}
        cache.set("test_model", model)
        
        # Generate hits and misses
        cache.get("test_model")  # Hit
        cache.get("test_model")  # Hit
        cache.get("nonexistent")  # Miss
        
        stats = cache.get_stats()
        
        assert stats["hits"] == 2
        assert stats["misses"] == 1
        assert stats["total_requests"] == 3
        assert stats["hit_rate_pct"] == pytest.approx(66.67, rel=0.1)
        assert stats["cached_models"] == 1


class TestFeatureCache:
    """Test feature caching functionality"""
    
    def test_feature_cache_set_and_get(self):
        """Test basic feature cache operations"""
        cache = FeatureCache(default_ttl=60)
        
        request_data = {"location_lat": 40.7128, "location_lng": -74.0060}
        context_data = {"traffic_level": "High", "weather": "Clear"}
        features = {"hour_of_day": 14, "distance_km": 5.0}
        
        # Store in cache
        cache.set(request_data, context_data, features)
        
        # Retrieve from cache
        cached_features = cache.get(request_data, context_data)
        
        assert cached_features is not None
        assert cached_features == features
    
    def test_feature_cache_key_consistency(self):
        """Test that same data produces same cache key"""
        cache = FeatureCache(default_ttl=60)
        
        request_data = {"location_lat": 40.7128, "location_lng": -74.0060}
        context_data = {"traffic_level": "High"}
        features = {"hour_of_day": 14}
        
        cache.set(request_data, context_data, features)
        
        # Same data should hit cache
        cached = cache.get(request_data, context_data)
        assert cached == features
        
        # Different data should miss cache
        different_request = {"location_lat": 40.8, "location_lng": -74.0}
        cached = cache.get(different_request, context_data)
        assert cached is None
    
    def test_feature_cache_expiration(self):
        """Test feature cache expiration"""
        cache = FeatureCache(default_ttl=1)  # 1 second TTL
        
        request_data = {"location_lat": 40.7128}
        context_data = {}
        features = {"hour_of_day": 14}
        
        cache.set(request_data, context_data, features)
        
        # Should be in cache immediately
        assert cache.get(request_data, context_data) is not None
        
        # Wait for expiration
        time.sleep(1.1)
        
        # Should be expired
        assert cache.get(request_data, context_data) is None


class TestRequestQueue:
    """Test request queue with priority handling"""
    
    @pytest.mark.asyncio
    async def test_queue_basic_processing(self):
        """Test basic request queuing and processing"""
        queue = RequestQueue(max_queue_size=10, max_concurrent=2, queue_timeout=5.0)
        
        async def handler(data):
            await asyncio.sleep(0.1)
            return {"result": data["value"] * 2}
        
        result = await queue.enqueue(
            request_id="test-1",
            request_data={"value": 5},
            priority=Priority.MEDIUM,
            handler=handler
        )
        
        assert result["result"] == 10
    
    @pytest.mark.asyncio
    async def test_queue_priority_ordering(self):
        """Test that higher priority requests are processed first"""
        queue = RequestQueue(max_queue_size=10, max_concurrent=1, queue_timeout=5.0)
        
        results = []
        
        async def handler(data):
            await asyncio.sleep(0.05)
            results.append(data["id"])
            return {"id": data["id"]}
        
        # Queue requests with different priorities
        tasks = [
            queue.enqueue("req-1", {"id": 1}, Priority.LOW, handler),
            queue.enqueue("req-2", {"id": 2}, Priority.CRITICAL, handler),
            queue.enqueue("req-3", {"id": 3}, Priority.HIGH, handler),
            queue.enqueue("req-4", {"id": 4}, Priority.MEDIUM, handler),
        ]
        
        await asyncio.gather(*tasks)
        
        # Critical should be processed first, then high, medium, low
        assert results[0] == 2  # CRITICAL
        assert results[1] == 3  # HIGH
        assert results[2] == 4  # MEDIUM
        assert results[3] == 1  # LOW
    
    @pytest.mark.asyncio
    async def test_queue_timeout(self):
        """Test that requests timeout if not processed in time"""
        queue = RequestQueue(max_queue_size=10, max_concurrent=1, queue_timeout=0.5)
        
        async def slow_handler(data):
            await asyncio.sleep(2.0)  # Longer than timeout
            return {"result": "done"}
        
        # First request will start processing
        task1 = asyncio.create_task(
            queue.enqueue("req-1", {"id": 1}, Priority.MEDIUM, slow_handler)
        )
        
        # Second request will timeout waiting in queue
        await asyncio.sleep(0.1)  # Let first request start
        
        with pytest.raises(asyncio.TimeoutError):
            await queue.enqueue("req-2", {"id": 2}, Priority.MEDIUM, slow_handler)
        
        # Cancel first task
        task1.cancel()
        try:
            await task1
        except asyncio.CancelledError:
            pass
    
    def test_priority_determination(self):
        """Test automatic priority determination from request data"""
        # Critical emergencies
        assert determine_priority({"emergency_type": "cardiac arrest"}) == Priority.CRITICAL
        assert determine_priority({"emergency_type": "stroke"}) == Priority.CRITICAL
        
        # High priority
        assert determine_priority({"emergency_type": "cardiac"}) == Priority.HIGH
        assert determine_priority({"emergency_type": "trauma"}) == Priority.HIGH
        
        # Medium priority (default)
        assert determine_priority({"emergency_type": "other"}) == Priority.MEDIUM
        assert determine_priority({}) == Priority.MEDIUM
        
        # Explicit priority
        assert determine_priority({"priority": "CRITICAL"}) == Priority.CRITICAL


class TestPerformanceMonitor:
    """Test performance monitoring functionality"""
    
    def test_latency_recording(self):
        """Test latency metric recording"""
        monitor = PerformanceMonitor()
        
        # Record some latencies
        monitor.record_latency("test_operation", 100.0)
        monitor.record_latency("test_operation", 150.0)
        monitor.record_latency("test_operation", 200.0)
        
        metrics = monitor.get_latency_metrics("test_operation")
        
        assert metrics is not None
        assert metrics["count"] == 3
        assert metrics["avg_ms"] == pytest.approx(150.0, rel=0.1)
        assert metrics["min_ms"] == 100.0
        assert metrics["max_ms"] == 200.0
    
    def test_throughput_recording(self):
        """Test throughput metric recording"""
        monitor = PerformanceMonitor()
        
        # Record some requests
        for _ in range(10):
            monitor.record_request("test_operation")
        
        metrics = monitor.get_throughput_metrics("test_operation")
        
        assert metrics is not None
        assert metrics["total_requests"] == 10
    
    def test_error_recording(self):
        """Test error recording"""
        monitor = PerformanceMonitor()
        
        # Record some errors
        monitor.record_error("test_operation")
        monitor.record_error("test_operation")
        
        all_metrics = monitor.get_all_metrics()
        
        assert all_metrics["errors"]["test_operation"] == 2
    
    def test_sla_compliance_checking(self):
        """Test SLA compliance checking"""
        monitor = PerformanceMonitor()
        
        # Record latencies that meet SLA
        for _ in range(100):
            monitor.record_latency("predict_delay", 150.0)  # <200ms
        
        for _ in range(100):
            monitor.record_latency("compute_features", 80.0)  # <100ms
        
        compliance = monitor.check_sla_compliance()
        
        assert compliance["delay_prediction_200ms"] is True
        assert compliance["feature_serving_100ms"] is True
    
    def test_sla_violation_detection(self):
        """Test SLA violation detection"""
        monitor = PerformanceMonitor()
        
        # Record latencies that violate SLA
        for _ in range(100):
            monitor.record_latency("predict_delay", 250.0)  # >200ms
        
        compliance = monitor.check_sla_compliance()
        
        assert compliance["delay_prediction_200ms"] is False
        assert compliance["all_compliant"] is False


class TestIntegration:
    """Integration tests for performance optimizations"""
    
    def test_global_cache_instances(self):
        """Test that global cache instances work correctly"""
        model_cache = get_model_cache()
        feature_cache = get_feature_cache()
        
        assert model_cache is not None
        assert feature_cache is not None
        
        # Should return same instance
        assert get_model_cache() is model_cache
        assert get_feature_cache() is feature_cache
    
    def test_global_monitor_instance(self):
        """Test that global monitor instance works correctly"""
        monitor = get_performance_monitor()
        
        assert monitor is not None
        
        # Should return same instance
        assert get_performance_monitor() is monitor


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

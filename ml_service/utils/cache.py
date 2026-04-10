"""
Advanced Caching System for ML Service
Implements model caching and feature caching with TTL
"""
import time
import hashlib
import json
import logging
from typing import Any, Optional, Dict, Callable
from datetime import datetime, timedelta
from functools import wraps

logger = logging.getLogger(__name__)


class CacheEntry:
    """Cache entry with TTL support"""
    
    def __init__(self, value: Any, ttl: int):
        """
        Initialize cache entry.
        
        Args:
            value: Cached value
            ttl: Time to live in seconds
        """
        self.value = value
        self.created_at = time.time()
        self.ttl = ttl
    
    def is_expired(self) -> bool:
        """Check if cache entry has expired"""
        return time.time() - self.created_at > self.ttl
    
    def get_age(self) -> float:
        """Get age of cache entry in seconds"""
        return time.time() - self.created_at


class ModelCache:
    """
    Model caching system with TTL.
    Caches loaded ML models to avoid repeated loading from disk.
    """
    
    def __init__(self, default_ttl: int = 3600):
        """
        Initialize model cache.
        
        Args:
            default_ttl: Default time to live in seconds (default 1 hour)
        """
        self._cache: Dict[str, CacheEntry] = {}
        self.default_ttl = default_ttl
        self._hits = 0
        self._misses = 0
        logger.info(f"ModelCache initialized with TTL={default_ttl}s")
    
    def get(self, model_name: str) -> Optional[Any]:
        """
        Get model from cache.
        
        Args:
            model_name: Name of the model
        
        Returns:
            Cached model or None if not found/expired
        """
        if model_name in self._cache:
            entry = self._cache[model_name]
            
            if entry.is_expired():
                logger.info(f"Model cache expired for '{model_name}' (age: {entry.get_age():.1f}s)")
                del self._cache[model_name]
                self._misses += 1
                return None
            
            self._hits += 1
            logger.debug(f"Model cache hit for '{model_name}' (age: {entry.get_age():.1f}s)")
            return entry.value
        
        self._misses += 1
        logger.debug(f"Model cache miss for '{model_name}'")
        return None
    
    def set(self, model_name: str, model: Any, ttl: Optional[int] = None):
        """
        Store model in cache.
        
        Args:
            model_name: Name of the model
            model: Model object to cache
            ttl: Time to live in seconds (uses default if None)
        """
        ttl = ttl if ttl is not None else self.default_ttl
        self._cache[model_name] = CacheEntry(model, ttl)
        logger.info(f"Model cached: '{model_name}' with TTL={ttl}s")
    
    def invalidate(self, model_name: str):
        """
        Invalidate cached model.
        
        Args:
            model_name: Name of the model to invalidate
        """
        if model_name in self._cache:
            del self._cache[model_name]
            logger.info(f"Model cache invalidated for '{model_name}'")
    
    def clear(self):
        """Clear all cached models"""
        count = len(self._cache)
        self._cache.clear()
        logger.info(f"Model cache cleared ({count} entries removed)")
    
    def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics"""
        total = self._hits + self._misses
        hit_rate = (self._hits / total * 100) if total > 0 else 0
        
        return {
            "hits": self._hits,
            "misses": self._misses,
            "total_requests": total,
            "hit_rate_pct": round(hit_rate, 2),
            "cached_models": len(self._cache),
            "model_names": list(self._cache.keys())
        }


class FeatureCache:
    """
    Feature caching system with TTL.
    Caches computed features to avoid redundant computation.
    """
    
    def __init__(self, default_ttl: int = 300):
        """
        Initialize feature cache.
        
        Args:
            default_ttl: Default time to live in seconds (default 5 minutes)
        """
        self._cache: Dict[str, CacheEntry] = {}
        self.default_ttl = default_ttl
        self._hits = 0
        self._misses = 0
        logger.info(f"FeatureCache initialized with TTL={default_ttl}s")
    
    def _compute_key(self, request_data: Dict, context_data: Dict) -> str:
        """
        Compute cache key from request and context data.
        
        Args:
            request_data: Request data dictionary
            context_data: Context data dictionary
        
        Returns:
            Cache key string
        """
        # Combine and sort for consistent hashing
        combined = {**request_data, **context_data}
        
        # Remove timestamp for caching (features should be similar for nearby times)
        if "timestamp" in combined:
            # Round timestamp to nearest 5 minutes for caching
            ts = combined["timestamp"]
            if isinstance(ts, datetime):
                rounded = ts.replace(minute=(ts.minute // 5) * 5, second=0, microsecond=0)
                combined["timestamp"] = rounded.isoformat()
        
        # Create deterministic JSON string
        json_str = json.dumps(combined, sort_keys=True, default=str)
        
        # Hash for compact key
        return hashlib.md5(json_str.encode()).hexdigest()
    
    def get(self, request_data: Dict, context_data: Dict) -> Optional[Dict]:
        """
        Get features from cache.
        
        Args:
            request_data: Request data dictionary
            context_data: Context data dictionary
        
        Returns:
            Cached features or None if not found/expired
        """
        key = self._compute_key(request_data, context_data)
        
        if key in self._cache:
            entry = self._cache[key]
            
            if entry.is_expired():
                logger.debug(f"Feature cache expired (age: {entry.get_age():.1f}s)")
                del self._cache[key]
                self._misses += 1
                return None
            
            self._hits += 1
            logger.debug(f"Feature cache hit (age: {entry.get_age():.1f}s)")
            return entry.value
        
        self._misses += 1
        logger.debug("Feature cache miss")
        return None
    
    def set(self, request_data: Dict, context_data: Dict, features: Dict, ttl: Optional[int] = None):
        """
        Store features in cache.
        
        Args:
            request_data: Request data dictionary
            context_data: Context data dictionary
            features: Computed features to cache
            ttl: Time to live in seconds (uses default if None)
        """
        key = self._compute_key(request_data, context_data)
        ttl = ttl if ttl is not None else self.default_ttl
        self._cache[key] = CacheEntry(features, ttl)
        logger.debug(f"Features cached with TTL={ttl}s")
    
    def clear(self):
        """Clear all cached features"""
        count = len(self._cache)
        self._cache.clear()
        logger.info(f"Feature cache cleared ({count} entries removed)")
    
    def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics"""
        total = self._hits + self._misses
        hit_rate = (self._hits / total * 100) if total > 0 else 0
        
        return {
            "hits": self._hits,
            "misses": self._misses,
            "total_requests": total,
            "hit_rate_pct": round(hit_rate, 2),
            "cached_entries": len(self._cache)
        }


# Global cache instances
_model_cache = None
_feature_cache = None


def get_model_cache() -> ModelCache:
    """Get global model cache instance"""
    global _model_cache
    if _model_cache is None:
        from ml_service.config import Config
        _model_cache = ModelCache(default_ttl=Config.MODEL_CACHE_TTL)
    return _model_cache


def get_feature_cache() -> FeatureCache:
    """Get global feature cache instance"""
    global _feature_cache
    if _feature_cache is None:
        _feature_cache = FeatureCache(default_ttl=300)  # 5 minutes
    return _feature_cache


def cached_model(model_name: str, ttl: Optional[int] = None):
    """
    Decorator for caching model loading.
    
    Args:
        model_name: Name of the model
        ttl: Time to live in seconds (optional)
    
    Example:
        @cached_model("delay_predictor", ttl=3600)
        def load_delay_predictor():
            return DelayPredictor()
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs):
            cache = get_model_cache()
            
            # Try to get from cache
            model = cache.get(model_name)
            if model is not None:
                return model
            
            # Load model
            logger.info(f"Loading model '{model_name}'...")
            start_time = time.time()
            model = func(*args, **kwargs)
            load_time = time.time() - start_time
            logger.info(f"Model '{model_name}' loaded in {load_time:.3f}s")
            
            # Cache model
            cache.set(model_name, model, ttl)
            
            return model
        
        return wrapper
    return decorator


def cached_features(ttl: Optional[int] = None):
    """
    Decorator for caching feature computation.
    
    Args:
        ttl: Time to live in seconds (optional)
    
    Example:
        @cached_features(ttl=300)
        def compute_features(request_data, context_data):
            # ... compute features ...
            return features
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(request_data: Dict, context_data: Dict = None, *args, **kwargs):
            context_data = context_data or {}
            cache = get_feature_cache()
            
            # Try to get from cache
            features = cache.get(request_data, context_data)
            if features is not None:
                return features
            
            # Compute features
            features = func(request_data, context_data, *args, **kwargs)
            
            # Cache features
            cache.set(request_data, context_data, features, ttl)
            
            return features
        
        return wrapper
    return decorator

"""
Feature Store
Centralized feature management with online (Redis) and offline (Parquet) storage
"""
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Tuple
from pathlib import Path
import json
import logging

from ml_service.feature_store.registry import FeatureRegistry
from ml_service.utils.redis_client import RedisClient
from ml_service.utils.cache import get_feature_cache
from ml_service.config import Config

logger = logging.getLogger(__name__)


class FeatureStore:
    """Central feature management system with online and offline storage"""
    
    def __init__(self, redis_client=None, offline_path: str = None):
        """
        Initialize Feature Store.
        
        Args:
            redis_client: Redis client (uses default if None)
            offline_path: Path for offline feature storage (uses config if None)
        """
        self.registry = FeatureRegistry()
        self.offline_path = Path(offline_path) if offline_path else Config.FEATURE_STORE_OFFLINE_PATH
        self.offline_path.mkdir(parents=True, exist_ok=True)
        
        # Initialize Redis (optional for online serving)
        try:
            self.redis = redis_client or RedisClient.get_client()
            self.redis_available = True
            logger.info("Feature Store initialized with Redis")
        except Exception as e:
            logger.warning(f"Redis not available: {e}. Online features disabled.")
            self.redis = None
            self.redis_available = False
        
        # Register all features
        self._register_all_features()
        
        logger.info(f"Feature Store initialized with {len(self.registry.list_features())} features")
    
    def compute_features(
        self,
        request_data: Dict[str, Any],
        context_data: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """
        Compute all features for a request with caching.
        
        Args:
            request_data: Emergency request details (location, timestamp, emergency_type, etc.)
            context_data: Contextual data (traffic, weather, ambulance availability, etc.)
        
        Returns:
            Dictionary of computed features
        """
        context_data = context_data or {}
        
        # Try to get from cache
        cache = get_feature_cache()
        cached_features = cache.get(request_data, context_data)
        if cached_features is not None:
            logger.debug("Features retrieved from cache")
            return cached_features
        
        # Compute features
        combined_data = {**request_data, **context_data}
        
        features = {}
        
        # Compute features by category
        for category in ["temporal", "geographic", "contextual", "historical", "derived"]:
            category_features = self.registry.list_features(category=category)
            
            for feature_name in category_features:
                try:
                    value = self.registry.compute_feature(feature_name, **combined_data)
                    features[feature_name] = value
                except Exception as e:
                    logger.warning(f"Failed to compute feature '{feature_name}': {e}")
                    features[feature_name] = None
        
        # Cache the computed features
        cache.set(request_data, context_data, features)
        logger.debug("Features computed and cached")
        
        return features
    
    def get_online_features(
        self,
        feature_names: List[str],
        entity_id: str
    ) -> Dict[str, Any]:
        """
        Retrieve features from online store (Redis).
        
        Args:
            feature_names: List of feature names to retrieve
            entity_id: Entity identifier (e.g., request_id)
        
        Returns:
            Dictionary of feature values
        """
        if not self.redis_available:
            logger.warning("Redis not available, cannot retrieve online features")
            return {}
        
        features = {}
        
        for feature_name in feature_names:
            key = f"features:online:request:{entity_id}:{feature_name}"
            try:
                value = self.redis.get(key)
                if value is not None:
                    # Try to parse as JSON, fallback to string
                    try:
                        features[feature_name] = json.loads(value)
                    except:
                        features[feature_name] = value
            except Exception as e:
                logger.warning(f"Error retrieving feature '{feature_name}': {e}")
        
        return features
    
    def set_online_features(
        self,
        entity_id: str,
        features: Dict[str, Any],
        ttl: int = 3600
    ) -> None:
        """
        Store features in online store (Redis).
        
        Args:
            entity_id: Entity identifier
            features: Dictionary of feature values
            ttl: Time to live in seconds (default 1 hour)
        """
        if not self.redis_available:
            return
        
        for feature_name, value in features.items():
            key = f"features:online:request:{entity_id}:{feature_name}"
            try:
                # Serialize value
                if isinstance(value, (dict, list)):
                    value_str = json.dumps(value)
                else:
                    value_str = str(value)
                
                self.redis.setex(key, ttl, value_str)
            except Exception as e:
                logger.warning(f"Error storing feature '{feature_name}': {e}")
        
        # Store metadata
        metadata_key = f"features:online:request:{entity_id}:_metadata"
        metadata = {
            "timestamp": datetime.now().isoformat(),
            "version": "v1"
        }
        self.redis.setex(metadata_key, ttl, json.dumps(metadata))
    
    def get_offline_features(
        self,
        feature_names: List[str],
        entity_ids: List[str],
        timestamp_range: Optional[Tuple[datetime, datetime]] = None
    ) -> pd.DataFrame:
        """
        Retrieve features from offline store for training.
        
        Args:
            feature_names: List of feature names
            entity_ids: List of entity identifiers
            timestamp_range: Optional (start, end) datetime range
        
        Returns:
            DataFrame with features
        """
        # Look for parquet files in offline storage
        parquet_files = list(self.offline_path.glob("*.parquet"))
        
        if not parquet_files:
            logger.warning("No offline feature files found")
            return pd.DataFrame()
        
        # Read and combine parquet files
        dfs = []
        for file_path in parquet_files:
            try:
                df = pd.read_parquet(file_path)
                dfs.append(df)
            except Exception as e:
                logger.warning(f"Error reading {file_path}: {e}")
        
        if not dfs:
            return pd.DataFrame()
        
        combined_df = pd.concat(dfs, ignore_index=True)
        
        # Filter by entity_ids
        if "entity_id" in combined_df.columns:
            combined_df = combined_df[combined_df["entity_id"].isin(entity_ids)]
        
        # Filter by timestamp range
        if timestamp_range and "timestamp" in combined_df.columns:
            start, end = timestamp_range
            combined_df = combined_df[
                (combined_df["timestamp"] >= start) &
                (combined_df["timestamp"] <= end)
            ]
        
        # Select requested features
        available_features = [f for f in feature_names if f in combined_df.columns]
        if available_features:
            return combined_df[["entity_id", "timestamp"] + available_features]
        
        return pd.DataFrame()
    
    def materialize_features(
        self,
        feature_group: str,
        start_date: datetime,
        end_date: datetime
    ) -> str:
        """
        Compute and store features for a date range (offline storage).
        
        Args:
            feature_group: Name of feature group
            start_date: Start date
            end_date: End date
        
        Returns:
            Path to materialized features file
        """
        logger.info(f"Materializing features for {feature_group} from {start_date} to {end_date}")
        
        # This would typically query historical data and compute features
        # For now, return a placeholder
        output_path = self.offline_path / f"{feature_group}_{start_date.date()}_{end_date.date()}.parquet"
        
        logger.info(f"Features materialized to {output_path}")
        return str(output_path)
    
    def _register_all_features(self):
        """Register all feature definitions"""
        # Import feature definitions
        from ml_service.feature_store import features
        features.register_features(self.registry)

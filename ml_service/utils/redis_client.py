"""
Redis client for Feature Store
"""
import redis
import logging
from typing import Optional
from ml_service.config import Config

logger = logging.getLogger(__name__)


class RedisClient:
    """Redis client wrapper for feature store"""
    
    _instance: Optional[redis.Redis] = None
    
    @classmethod
    def get_client(cls) -> redis.Redis:
        """Get or create Redis client (singleton)"""
        if cls._instance is None:
            try:
                cls._instance = redis.Redis(
                    host=Config.REDIS_HOST,
                    port=Config.REDIS_PORT,
                    db=Config.REDIS_DB,
                    password=Config.REDIS_PASSWORD if Config.REDIS_PASSWORD else None,
                    decode_responses=True,
                    socket_connect_timeout=5,
                    socket_timeout=5
                )
                # Test connection
                cls._instance.ping()
                logger.info("Redis connection established")
            except redis.ConnectionError as e:
                logger.error(f"Failed to connect to Redis: {e}")
                cls._instance = None
                raise
        
        return cls._instance
    
    @classmethod
    def is_connected(cls) -> bool:
        """Check if Redis is connected"""
        try:
            if cls._instance:
                cls._instance.ping()
                return True
        except redis.ConnectionError:
            pass
        return False
    
    @classmethod
    def close(cls):
        """Close Redis connection"""
        if cls._instance:
            cls._instance.close()
            cls._instance = None
            logger.info("Redis connection closed")

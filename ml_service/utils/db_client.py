"""
Database client for ML Service
"""
import psycopg2
from psycopg2.extras import RealDictCursor
import logging
from typing import Optional, List, Dict, Any
from contextlib import contextmanager
from ml_service.config import Config

logger = logging.getLogger(__name__)


class DatabaseClient:
    """PostgreSQL database client"""
    
    @staticmethod
    @contextmanager
    def get_connection():
        """Get database connection context manager"""
        conn = None
        try:
            conn = psycopg2.connect(Config.DATABASE_URL)
            yield conn
            conn.commit()
        except Exception as e:
            if conn:
                conn.rollback()
            logger.error(f"Database error: {e}")
            raise
        finally:
            if conn:
                conn.close()
    
    @staticmethod
    def execute_query(query: str, params: Optional[tuple] = None) -> List[Dict[str, Any]]:
        """Execute a SELECT query and return results"""
        with DatabaseClient.get_connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cursor:
                cursor.execute(query, params)
                return [dict(row) for row in cursor.fetchall()]
    
    @staticmethod
    def execute_insert(query: str, params: Optional[tuple] = None) -> Optional[str]:
        """Execute an INSERT query and return the inserted ID"""
        with DatabaseClient.get_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute(query, params)
                result = cursor.fetchone()
                return result[0] if result else None
    
    @staticmethod
    def execute_update(query: str, params: Optional[tuple] = None) -> int:
        """Execute an UPDATE/DELETE query and return affected rows"""
        with DatabaseClient.get_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute(query, params)
                return cursor.rowcount

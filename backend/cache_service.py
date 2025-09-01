"""
Cache service for PMO Portfolio API with Redis fallback to disk cache.
Provides intelligent caching for expensive Databricks queries.
"""
import hashlib
import json
import logging
import os
from datetime import datetime, timedelta
from typing import Any, Optional, Dict

try:
    import redis
    REDIS_AVAILABLE = True
except ImportError:
    REDIS_AVAILABLE = False

import diskcache as dc

logger = logging.getLogger(__name__)


class CacheService:
    """
    Intelligent caching service that uses Redis if available, 
    falls back to disk cache, with configurable TTL.
    """
    
    def __init__(self, cache_dir: str = "cache", default_ttl: int = 300):
        self.default_ttl = default_ttl  # 5 minutes default
        self.cache_dir = cache_dir
        
        # Try to connect to Redis first
        self.redis_client = None
        if REDIS_AVAILABLE:
            try:
                self.redis_client = redis.Redis(
                    host='localhost', 
                    port=6379, 
                    db=0, 
                    decode_responses=True,
                    socket_timeout=2,
                    socket_connect_timeout=2
                )
                # Test connection
                self.redis_client.ping()
                logger.info("✅ Redis cache connected successfully")
            except Exception as e:
                logger.warning(f"⚠️ Redis not available: {e}. Falling back to disk cache.")
                self.redis_client = None
        
        # Always initialize disk cache as fallback
        os.makedirs(cache_dir, exist_ok=True)
        self.disk_cache = dc.Cache(cache_dir, size_limit=500_000_000)  # 500MB limit
        logger.info(f"✅ Disk cache initialized at {cache_dir}")
    
    def _generate_key(self, query: str, params: Dict = None) -> str:
        """Generate a consistent cache key from query and parameters."""
        key_data = f"{query}_{params or {}}"
        return f"pmo_query_{hashlib.md5(key_data.encode()).hexdigest()}"
    
    def get(self, query: str, params: Dict = None) -> Optional[Any]:
        """Get cached result for a query."""
        cache_key = self._generate_key(query, params)
        
        # Try Redis first
        if self.redis_client:
            try:
                cached = self.redis_client.get(cache_key)
                if cached:
                    logger.info(f"🚀 Redis cache HIT for key: {cache_key[:20]}...")
                    return json.loads(cached)
            except Exception as e:
                logger.warning(f"Redis get error: {e}")
        
        # Fallback to disk cache
        try:
            cached = self.disk_cache.get(cache_key)
            if cached:
                logger.info(f"💾 Disk cache HIT for key: {cache_key[:20]}...")
                return cached
        except Exception as e:
            logger.warning(f"Disk cache get error: {e}")
        
        logger.info(f"❌ Cache MISS for key: {cache_key[:20]}...")
        return None
    
    def set(self, query: str, data: Any, ttl: int = None, params: Dict = None) -> bool:
        """Store result in cache with TTL."""
        cache_key = self._generate_key(query, params)
        ttl = ttl or self.default_ttl
        
        success = False
        
        # Try Redis first
        if self.redis_client:
            try:
                self.redis_client.setex(
                    cache_key, 
                    ttl, 
                    json.dumps(data, default=str)  # Handle datetime serialization
                )
                logger.info(f"✅ Redis cache SET for key: {cache_key[:20]}... (TTL: {ttl}s)")
                success = True
            except Exception as e:
                logger.warning(f"Redis set error: {e}")
        
        # Always store in disk cache as backup
        try:
            expire_time = datetime.now() + timedelta(seconds=ttl)
            self.disk_cache.set(cache_key, data, expire=expire_time)
            logger.info(f"✅ Disk cache SET for key: {cache_key[:20]}... (TTL: {ttl}s)")
            success = True
        except Exception as e:
            logger.warning(f"Disk cache set error: {e}")
        
        return success
    
    def clear_cache(self, pattern: str = None) -> bool:
        """Clear cache entries matching pattern."""
        try:
            if self.redis_client and pattern:
                keys = self.redis_client.keys(f"*{pattern}*")
                if keys:
                    self.redis_client.delete(*keys)
                    logger.info(f"🗑️ Cleared {len(keys)} Redis cache entries")
            
            # Clear disk cache (pattern not supported, clear all)
            if not pattern:
                self.disk_cache.clear()
                logger.info("🗑️ Cleared disk cache")
            
            return True
        except Exception as e:
            logger.error(f"Cache clear error: {e}")
            return False
    
    def get_cache_stats(self) -> Dict:
        """Get cache statistics."""
        stats = {
            "redis_available": self.redis_client is not None,
            "disk_cache_size": len(self.disk_cache),
        }
        
        if self.redis_client:
            try:
                info = self.redis_client.info()
                stats["redis_keys"] = info.get("db0", {}).get("keys", 0)
                stats["redis_memory"] = info.get("used_memory_human", "N/A")
            except Exception:
                stats["redis_keys"] = "Error"
        
        return stats


# Global cache instance
cache_service = CacheService(
    cache_dir="cache", 
    default_ttl=300  # 5 minutes for development, increase for production
)

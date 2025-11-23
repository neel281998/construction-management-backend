// Simple in-memory cache middleware for frequently accessed endpoints
// Note: For production with multiple instances, use Redis instead

const cache = new Map();
const DEFAULT_TTL = 60 * 1000; // 60 seconds default

/**
 * Cache middleware factory
 * @param {number} ttl - Time to live in milliseconds
 * @param {Function} keyGenerator - Optional function to generate cache key from request
 */
function cacheMiddleware(ttl = DEFAULT_TTL, keyGenerator = null) {
  return (req, res, next) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Skip cache for authenticated endpoints that depend on user context
    // unless they explicitly opt-in
    const skipCachePaths = ['/api/auth', '/api/users/my-permissions'];
    if (skipCachePaths.some(path => req.path.startsWith(path))) {
      return next();
    }

    // Generate cache key
    const cacheKey = keyGenerator 
      ? keyGenerator(req)
      : `${req.originalUrl || req.url}`;

    // Check cache
    const cached = cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      // Set cache headers
      res.setHeader('X-Cache', 'HIT');
      return res.json(cached.data);
    }

    // Store original json method
    const originalJson = res.json.bind(res);

    // Override json method to cache the response
    res.json = function(data) {
      // Only cache successful responses
      if (res.statusCode >= 200 && res.statusCode < 300) {
        cache.set(cacheKey, {
          data,
          expiresAt: Date.now() + ttl
        });

        // Set cache headers
        res.setHeader('X-Cache', 'MISS');
      }

      // Call original json method
      return originalJson(data);
    };

    next();
  };
}

/**
 * Clear cache for a specific key pattern
 */
function clearCache(keyPattern) {
  if (typeof keyPattern === 'string') {
    // Simple string match
    for (const key of cache.keys()) {
      if (key.includes(keyPattern)) {
        cache.delete(key);
      }
    }
  } else if (keyPattern instanceof RegExp) {
    // Regex match
    for (const key of cache.keys()) {
      if (keyPattern.test(key)) {
        cache.delete(key);
      }
    }
  }
}

/**
 * Clear all cache
 */
function clearAllCache() {
  cache.clear();
}

/**
 * Get cache stats
 */
function getCacheStats() {
  const now = Date.now();
  let validEntries = 0;
  let expiredEntries = 0;

  for (const entry of cache.values()) {
    if (entry.expiresAt > now) {
      validEntries++;
    } else {
      expiredEntries++;
    }
  }

  return {
    totalEntries: cache.size,
    validEntries,
    expiredEntries
  };
}

// Cleanup expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of cache.entries()) {
    if (entry.expiresAt <= now) {
      cache.delete(key);
    }
  }
}, 5 * 60 * 1000);

module.exports = {
  cacheMiddleware,
  clearCache,
  clearAllCache,
  getCacheStats
};










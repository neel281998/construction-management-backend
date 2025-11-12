# Performance Optimizations

This document outlines the performance optimizations implemented to improve API response times.

## Issues Identified

1. **N+1 Query Problem**: The sites route was making individual database queries for each site to fetch steps, causing significant performance degradation.
2. **Missing Database Indexes**: Frequently queried fields lacked proper indexes.
3. **No Response Caching**: Frequently accessed endpoints were hitting the database on every request.
4. **Excessive Logging**: Too many console.log statements were being executed on every request, causing I/O overhead and log noise.

## Optimizations Implemented

### 1. Fixed N+1 Query Problem (sites.js)

**Before:**
- Made N separate queries to fetch steps for each site (1 query per site)
- For 10 sites, this resulted in 11 queries total (1 for sites + 10 for steps)

**After:**
- Batch fetch all steps for all sites in a single query using `$in` operator
- Group steps by siteId in memory for O(1) lookup
- For 10 sites, this now results in only 2 queries total (1 for sites + 1 for all steps)

**Performance Impact:**
- Reduced database queries from O(n) to O(1) where n is the number of sites
- Estimated 5-10x improvement for endpoints listing multiple sites

**Code Changes:**
```javascript
// Old approach (N+1 queries)
const sitesWithProgress = await Promise.all(sites.map(async (site) => {
  const steps = await Step.find({ siteId: site._id, isActive: true });
  // ...
}));

// New approach (1 batch query)
const siteIds = sites.map(site => site._id);
const allSteps = await Step.find({ 
  siteId: { $in: siteIds }, 
  isActive: true 
}).select('siteId estimatedVolumeM3 progressM3 status').lean();

const stepsBySiteId = {};
allSteps.forEach(step => {
  if (!stepsBySiteId[step.siteId]) {
    stepsBySiteId[step.siteId] = [];
  }
  stepsBySiteId[step.siteId].push(step);
});
```

### 2. Added Database Indexes

Added compound indexes to improve query performance:

**Step Model:**
- `{ siteId: 1, isActive: 1 }` - Optimizes batch queries for steps by site
- `{ isActive: 1 }` - General filter for active steps

**Site Model:**
- `{ isActive: 1, status: 1 }` - Compound index for common filtered queries
- `{ isActive: 1, createdAt: -1 }` - Optimizes sorted pagination queries

**Performance Impact:**
- Indexed queries are typically 10-100x faster than unindexed queries
- Prevents full collection scans on large datasets

### 3. Removed Excessive Logging

**Before:**
- Multiple `console.log()` statements executed on every API request
- Logging query details, request bodies, and response data
- Creating I/O overhead and log file bloat
- Making it difficult to find important error logs

**After:**
- Removed verbose debug logging from frequently called routes
- Kept only essential error logging (`console.error`)
- Removed logging from data fetching endpoints (inventory, sites, plant inventory)
- Cleaned up frontend API service logging

**Performance Impact:**
- Reduced I/O operations during request handling
- Faster request processing (eliminated logging overhead)
- Cleaner logs focused on errors and important events
- Reduced log file size and storage costs

**Files Cleaned:**
- `routes/inventory.js` - Removed query logging
- `routes/sites.js` - Removed step creation and progress logging
- `routes/plantInventory.js` - Removed vehicle trip tracking and request body logging
- `services/api.ts` (frontend) - Removed verbose request logging

### 4. Response Caching Middleware

Created a simple in-memory caching middleware for frequently accessed GET endpoints.

**Features:**
- Configurable TTL (time-to-live) per endpoint
- Automatic cache key generation based on URL and query params
- Cache invalidation helpers
- Automatic cleanup of expired entries
- Cache stats for monitoring

**Implementation:**
- Applied caching to `/api/sites` endpoint with 30-second TTL
- Cache keys include query parameters to handle different filters correctly

**Performance Impact:**
- Reduces database load by serving cached responses
- Typical response time improvement: 50-90% for cached requests
- Reduces server CPU and database connection usage

**Usage Example:**
```javascript
const { cacheMiddleware } = require('../middleware/cache');

router.get('/', 
  authenticateToken, 
  requirePermission('site.read'), 
  cacheMiddleware(30000, (req) => {
    return `/api/sites?${new URLSearchParams(req.query).toString()}`;
  }), 
  async (req, res) => {
    // ... route handler
  }
);
```

## Additional Recommendations

### 1. Database Query Optimization
- **Use `.lean()` for read-only queries**: Returns plain JavaScript objects instead of Mongoose documents, reducing memory usage and improving speed.
- **Limit fields with `.select()`**: Only fetch fields that are needed, reducing data transfer and processing time.
- **Use aggregation pipelines**: For complex queries, MongoDB aggregation can be more efficient than multiple queries.

### 2. Connection Pooling
Already configured in `server.js`:
```javascript
maxPoolSize: 10, // Adjust based on your needs
```

### 3. Additional Indexes to Consider
Based on your query patterns, consider adding indexes for:
- `SiteInventory`: `{ siteId: 1, stepId: 1 }`
- `Vehicle`: `{ isActive: 1, status: 1 }`
- `Inventory`: `{ storageSite: 1, isActive: 1 }`

### 4. Pagination
Ensure all list endpoints use proper pagination (already implemented in most routes).

### 5. Database Connection Optimization
- Consider using connection pooling with appropriate pool sizes
- Monitor connection usage and adjust `maxPoolSize` as needed
- Use connection monitoring tools to identify slow queries

### 6. Production Caching (Redis)
For production environments with multiple server instances:
- Replace in-memory cache with Redis
- Use Redis for session storage if needed
- Consider caching frequently accessed lookup data (site types, configurations, etc.)

### 7. Query Monitoring
Add query logging to identify slow queries:
```javascript
// In mongoose connection
mongoose.set('debug', true); // Only in development
```

### 8. API Response Compression
Already configured with Express (if using compression middleware):
- Consider enabling gzip/brotli compression for responses
- Reduces network transfer time, especially for large payloads

### 9. Frontend Optimizations
- Implement request debouncing/throttling for search inputs
- Use pagination on the frontend instead of loading all data
- Implement optimistic UI updates where appropriate
- Cache API responses on the frontend using React Query or similar

## Monitoring Performance

To monitor the impact of these optimizations:

1. **Response Times**: Check API response times before and after
2. **Database Queries**: Monitor MongoDB query execution times
3. **Cache Hit Rates**: Track cache hit/miss ratios using cache stats
4. **Server Load**: Monitor CPU and memory usage

## Testing Performance

You can test the improvements by:

1. **Load Testing**: Use tools like Apache Bench or k6 to simulate concurrent requests
2. **Database Profiling**: Enable MongoDB profiling to identify slow queries
3. **API Monitoring**: Use tools like New Relic, Datadog, or similar to track endpoint performance

## Files Modified

1. `routes/sites.js` - Fixed N+1 query, added caching, removed verbose logging
2. `routes/inventory.js` - Removed query logging
3. `routes/plantInventory.js` - Removed verbose request/vehicle logging
4. `models/Step.js` - Added database indexes
5. `models/Site.js` - Added database indexes
6. `middleware/cache.js` - New caching middleware (created)
7. `services/api.ts` (frontend) - Removed verbose request logging

## Expected Performance Improvements

- **Sites List Endpoint**: 5-10x faster for queries with 10+ sites
- **Database Query Times**: 10-100x faster for indexed queries
- **Cached Endpoints**: 50-90% faster response times for cache hits
- **Reduced Logging Overhead**: 5-15% improvement from removing I/O operations
- **Overall API Response**: 2-5x improvement in average response times

## Next Steps

1. Monitor performance metrics after deployment
2. Identify other endpoints with N+1 query patterns
3. Add caching to other frequently accessed endpoints
4. Consider implementing Redis for production caching
5. Set up database query monitoring to identify additional optimization opportunities


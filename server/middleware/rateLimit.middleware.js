/**
 * Factory for creating independent, bounded rate-limit middleware instances.
 * Each instance maintains its own private Map of buckets to prevent counter collision (AUDIT-012),
 * with automatic pruning of expired entries to prevent unbounded memory growth (AUDIT-009).
 */
const rateLimit = ({
  windowMs = 60 * 1000,
  max = 20,
  message = 'Too many requests. Please try again later.',
  name = 'rate-limit',
  maxBuckets = 5000,
} = {}) => {
  // Private to this middleware instance — ensures policy isolation across routes
  const buckets = new Map();

  const pruneExpired = (now) => {
    for (const [key, bucket] of buckets.entries()) {
      if (bucket.resetAt <= now) {
        buckets.delete(key);
      }
    }
  };

  const getClientKey = (req) => {
    const userId = req.user?.id || req.user?._id?.toString();
    if (userId) return `u:${userId}`;
    return `ip:${req.ip || 'unknown'}`;
  };

  const middleware = (req, res, next) => {
    const now = Date.now();
    const key = getClientKey(req);

    // Opportunistic pruning if map reaches capacity threshold
    if (buckets.size >= maxBuckets) {
      pruneExpired(now);
      // Hard cap: if still at capacity (e.g. active flood of unique keys), evict oldest key
      if (buckets.size >= maxBuckets) {
        const oldestKey = buckets.keys().next().value;
        if (oldestKey) buckets.delete(oldestKey);
      }
    }

    const bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    bucket.count += 1;

    if (bucket.count > max) {
      const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
      if (typeof res.set === 'function') {
        res.set('Retry-After', String(retryAfter));
      } else if (typeof res.setHeader === 'function') {
        res.setHeader('Retry-After', String(retryAfter));
      }
      return res.status(429).json({
        success: false,
        message,
      });
    }

    next();
  };

  // Expose store for test introspection
  middleware.getBucketCount = () => buckets.size;
  middleware.clear = () => buckets.clear();

  return middleware;
};

module.exports = rateLimit;


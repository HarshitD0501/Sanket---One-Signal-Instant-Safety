const buckets = new Map();

const getClientKey = (req) => {
  const userId = req.user?._id?.toString();
  return userId || req.ip || req.headers['x-forwarded-for'] || 'unknown';
};

const rateLimit = ({
  windowMs = 60 * 1000,
  max = 20,
  message = 'Too many requests. Please try again later.',
} = {}) => {
  return (req, res, next) => {
    const now = Date.now();
    const key = getClientKey(req);
    const bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    bucket.count += 1;

    if (bucket.count > max) {
      const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
      res.set('Retry-After', String(retryAfter));
      return res.status(429).json({
        success: false,
        message,
      });
    }

    next();
  };
};

module.exports = rateLimit;

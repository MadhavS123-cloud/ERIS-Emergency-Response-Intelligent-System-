import { getRedis } from '../config/redis.js';
import logger from '../utils/logger.js';

/**
 * Custom rate limiter for emergency requests that flags instead of blocking
 * Max 2 requests per 10 minutes per IP / DeviceId.
 */
export const emergencyRateLimiter = async (req, res, next) => {
  try {
    const redis = getRedis();
    
    // Fallback to IP if deviceId is not available
    const identifier = req.headers['x-device-id'] || req.body?.deviceId || req.ip;
    
    if (!identifier) {
      req.isSuspicious = true;
      req.suspiciousReason = 'No trackable identifier (IP or Device ID)';
      return next();
    }

    const key = `rate_limit:emergency:${identifier}`;
    
    // Increment the counter for this identifier
    const requests = await redis.incr(key);
    
    // If it's the first request, set the expiry to 10 minutes (600 seconds)
    if (requests === 1) {
      await redis.expire(key, 600);
    }
    
    // If more than 2 requests in the 10-minute window
    if (requests > 2) {
      req.isSuspicious = true;
      req.suspiciousReason = `Rate limit exceeded: ${requests} requests in 10 minutes`;
      logger.warn(`Suspicious activity detected: ${req.suspiciousReason} for identifier ${identifier}`);
    } else {
      req.isSuspicious = false;
    }
    
    next();
  } catch (error) {
    // On Redis error, fail open to ensure emergencies aren't blocked, but log thickly
    logger.error(`Emergency Rate Limiter Error: ${error.message}`);
    req.isSuspicious = false; // or true if we want to be paranoid when redis fails
    next();
  }
};

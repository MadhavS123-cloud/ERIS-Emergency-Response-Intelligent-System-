import IORedis from 'ioredis';
import logger from '../utils/logger.js';
import env from './env.js';

let redisConnection = null;

/**
 * Initialize Redis connection. Call once during server startup.
 * @returns {IORedis} The Redis connection instance
 */
const initRedis = () => {
  redisConnection = new IORedis({
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    maxRetriesPerRequest: null,
  });

  redisConnection.on('connect', () => {
    logger.info('Redis connected successfully');
  });

  redisConnection.on('error', (err) => {
    logger.error('Redis connection error', err.message);
  });

  return redisConnection;
};

/**
 * Get the active Redis connection.
 * @returns {IORedis} The Redis connection instance
 */
const getRedis = () => {
  if (!redisConnection) {
    throw new Error('Redis not initialized! Call initRedis() first.');
  }
  return redisConnection;
};

export { initRedis, getRedis };

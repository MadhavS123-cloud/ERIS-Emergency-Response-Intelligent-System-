import { PrismaClient } from '@prisma/client';
import logger from '../utils/logger.js';

const prismaLogLevels = ['warn', 'error'];

if (process.env.PRISMA_LOG_QUERIES === 'true') {
  prismaLogLevels.unshift('query', 'info');
}

const prisma = new PrismaClient({
  log: prismaLogLevels,
});

// Retry configuration for Neon database (handles sleep/wake cycles)
const MAX_RETRIES = 5;
const INITIAL_RETRY_DELAY = 1000; // 1 second

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const connectWithRetry = async (retryCount = 0) => {
  try {
    await prisma.$connect();
    logger.info('Database connected successfully');
    return true;
  } catch (error) {
    const isConnectionError = error.message?.includes('Can\'t reach database server') || 
                              error.message?.includes('Connection timed out') ||
                              error.code === 'P1001' ||
                              error.code === 'P1002';
    
    if (isConnectionError && retryCount < MAX_RETRIES) {
      const delay = INITIAL_RETRY_DELAY * Math.pow(2, retryCount); // Exponential backoff
      logger.warn(`Database connection failed (attempt ${retryCount + 1}/${MAX_RETRIES}). Retrying in ${delay}ms...`);
      logger.warn(`Error: ${error.message}`);
      
      await sleep(delay);
      return connectWithRetry(retryCount + 1);
    }
    
    logger.error('Database connection failed after all retries', error);
    throw error;
  }
};

const connectDB = async () => {
  return connectWithRetry(0);
};

// Keep-alive ping to prevent Neon from sleeping during active sessions
const startKeepAlive = () => {
  const KEEP_ALIVE_INTERVAL = 5 * 60 * 1000; // 5 minutes
  
  setInterval(async () => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      logger.debug('Database keep-alive ping successful');
    } catch (error) {
      logger.warn('Keep-alive ping failed:', error.message);
    }
  }, KEEP_ALIVE_INTERVAL);
};

export { prisma, connectDB, startKeepAlive };

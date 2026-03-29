import { PrismaClient } from '@prisma/client';
import logger from '../utils/logger.js';

const prismaLogLevels = ['warn', 'error'];

if (process.env.PRISMA_LOG_QUERIES === 'true') {
  prismaLogLevels.unshift('query', 'info');
}

const prisma = new PrismaClient({
  log: prismaLogLevels,
});

const connectDB = async () => {
  try {
    await prisma.$connect();
    logger.info('Database connected successfully');
  } catch (error) {
    logger.error('Database connection failed', error);
    throw error;
  }
};

export { prisma, connectDB };

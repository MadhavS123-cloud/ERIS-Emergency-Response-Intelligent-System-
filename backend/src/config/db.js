const { PrismaClient } = require('@prisma/client');
const logger = require('../utils/logger');

const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

const connectDB = async () => {
  try {
    await prisma.$connect();
    logger.info('Database connected successfully');
  } catch (error) {
    logger.error('Database connection failed', error);
    process.exit(1);
  }
};

module.exports = { prisma, connectDB };

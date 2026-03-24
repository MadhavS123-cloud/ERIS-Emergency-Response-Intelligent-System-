const { Queue, Worker } = require('bullmq');
const IORedis = require('ioredis');
const logger = require('../utils/logger');

const connection = new IORedis({
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: process.env.REDIS_PORT || 6379,
  maxRetriesPerRequest: null
});

// Create Queue
const emergencyQueue = new Queue('emergencyQueue', { connection });

// Add Job to Queue
const addEmergencyRequestToQueue = async (requestData) => {
  try {
    const job = await emergencyQueue.add('process_emergency', requestData, {
      priority: 1, // High priority
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000
      }
    });
    logger.info(`Emergency request added to queue: ${job.id}`);
    return job;
  } catch (error) {
    logger.error('Failed to add job to queue', error);
    throw error;
  }
};

// Worker to process jobs
const emergencyWorker = new Worker(
  'emergencyQueue',
  async (job) => {
    logger.info(`Processing job ${job.id}`);
    
    // Placeholder business logic for processing an emergency
    // In actual implementation, find nearby ambulances, notify them, etc.
    const requestData = job.data;
    
    // Simulate processing
    await new Promise((resolve) => setTimeout(resolve, 2000));
    
    logger.info(`Successfully processed job ${job.id} for patient ${requestData.patientId}`);
  },
  { connection }
);

emergencyWorker.on('completed', (job) => {
  logger.info(`Job ${job.id} has completed!`);
});

emergencyWorker.on('failed', (job, err) => {
  logger.error(`Job ${job.id} has failed with ${err.message}`);
});

module.exports = {
  addEmergencyRequestToQueue,
  emergencyQueue
};

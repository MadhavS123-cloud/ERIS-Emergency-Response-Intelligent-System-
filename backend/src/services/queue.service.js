import { Queue, Worker } from 'bullmq';
import logger from '../utils/logger.js';

let emergencyQueue = null;
let emergencyWorker = null;

/**
 * Initialize the BullMQ queue and worker.
 * Call once during server startup AFTER Redis is initialized.
 * @param {import('ioredis').default} connection - The IORedis connection instance
 */
const initQueue = (connection) => {
  // Create Queue
  emergencyQueue = new Queue('emergencyQueue', { connection });

  // Worker to process jobs
  emergencyWorker = new Worker(
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

  logger.info('Queue service initialized');
};

/**
 * Add an emergency request to the processing queue.
 * @param {Object} requestData - The emergency request data
 * @returns {Promise<import('bullmq').Job>}
 */
const addEmergencyRequestToQueue = async (requestData) => {
  if (!emergencyQueue) {
    throw new Error('Queue not initialized! Call initQueue() first.');
  }

  try {
    const job = await emergencyQueue.add('process_emergency', requestData, {
      priority: 1, // High priority
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
    });
    logger.info(`Emergency request added to queue: ${job.id}`);
    return job;
  } catch (error) {
    logger.error('Failed to add job to queue', error);
    throw error;
  }
};

export { initQueue, addEmergencyRequestToQueue };

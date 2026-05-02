import { Queue, Worker } from 'bullmq';
import logger from '../utils/logger.js';
import { getRouteDetails, getWeather } from './externalApi.service.js';
import MLService from './ml.service.js';
import { prisma } from '../config/db.js';
import { getIO } from './socket.service.js';

let emergencyQueue = null;
let emergencyWorker = null;

/**
 * Initialize the BullMQ queue and worker.
 * Call once during server startup AFTER Redis is initialized.
 * @param {import('ioredis').default} connection - The IORedis connection instance
 */
export const initQueue = (connection) => {
  // Create Queue
  emergencyQueue = new Queue('emergencyQueue', { connection });

  // Worker to process jobs
  emergencyWorker = new Worker(
    'emergencyQueue',
    async (job) => {
      logger.info(`Processing job ${job.id}`);
      const requestData = job.data;
      
      try {
        // Find nearest hospital to use as destination for route calculation
        const hospitals = await prisma.hospital.findMany();
        let destLat = requestData.locationLat;
        let destLng = requestData.locationLng;

        if (hospitals.length > 0) {
          // Pick the geographically nearest hospital
          const nearest = hospitals
            .filter(h => h.locationLat && h.locationLng)
            .sort((a, b) => {
              const distA = Math.hypot(a.locationLat - requestData.locationLat, a.locationLng - requestData.locationLng);
              const distB = Math.hypot(b.locationLat - requestData.locationLat, b.locationLng - requestData.locationLng);
              return distA - distB;
            })[0];
          if (nearest) {
            destLat = nearest.locationLat;
            destLng = nearest.locationLng;
          }
        }

        // 1. Fetch External APIs Context
        const route = await getRouteDetails(requestData.locationLat, requestData.locationLng, destLat, destLng);
        const weatherInfo = await getWeather(requestData.locationLat, requestData.locationLng);
        
        const now = new Date();
        const mlPayload = {
          distance_km: route.distance_km,
          time_of_day: now.getHours(),
          day_of_week: now.getDay(), // 0=Sun, 6=Sat
          traffic_level: route.traffic_level,
          weather: weatherInfo.weather,
          area_type: 'Urban', // Defaulting for MVP
          driver_response_time_mins: 2.0, // Default for new requests
          available_ambulances_nearby: await prisma.ambulance.count({ where: { isAvailable: true } })
        };

        logger.info(`ML Payload constructed for job ${job.id}`, mlPayload);

        // 2. Query ML Service
        const prediction = await MLService.predictDelay(mlPayload)
          || MLService.buildHeuristicDelayPrediction(mlPayload);

        // 3. Update Database with ML Context
        const updateData = {
          distanceKm: route.distance_km,
          trafficLevel: route.traffic_level,
          weather: weatherInfo.weather,
          mlDelayRisk: prediction?.delay_risk || prediction?.risk_category || 'Medium',
          mlExpectedDelay: prediction?.expected_delay_minutes || prediction?.delay_minutes || null,
          mlReasons: JSON.stringify(prediction?.all_reasons || prediction?.explanation || []),
          mlSuggestedActions: JSON.stringify(
            prediction?.recommended_actions
            || [prediction?.main_cause, prediction?.suggested_action].filter(Boolean)
          )
        };
        
        await prisma.request.update({
          where: { id: requestData.id },
          data: updateData
        });
        
        // 4. Broadcast Real-Time System Intelligence Update
        const io = getIO();
        io.emit('admin_dashboard_update', {
          id: requestData.id,
          patientId: requestData.patientId,
          mlContext: prediction || {},
          routeContext: route
        });

      } catch (error) {
        logger.error(`Error during ML or API inference for job ${job.id}: ${error.message}`);
      }

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
export const addEmergencyRequestToQueue = async (requestData) => {
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

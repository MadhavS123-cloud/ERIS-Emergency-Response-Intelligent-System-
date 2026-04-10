import axios from 'axios';
import logger from '../utils/logger.js';
import env from '../config/env.js';

const ML_URL = env.ML_SERVICE_URL || 'http://localhost:8000';
const ML_TIMEOUT = 5000; // 5 second timeout

class MLService {
  /**
   * Request delay inference from FastAPI ML Service.
   * @param {Object} payload 
   * @returns {Promise<Object|null>}
   */
  static async predictDelay(payload) {
    try {
      logger.info('Calling ML service for delay prediction');
      const response = await axios.post(`${ML_URL}/api/ml/predict/delay`, payload, {
        timeout: ML_TIMEOUT
      });
      logger.info('ML delay prediction received successfully');
      return response.data;
    } catch (error) {
      logger.error('Error calling ML service for delay prediction', { message: error.message });
      return null;
    }
  }

  /**
   * Request severity classification from ML Service.
   * @param {Object} payload - { emergency_type, patient_age, vital_signs, location_type }
   * @returns {Promise<Object|null>}
   */
  static async predictSeverity(payload) {
    try {
      logger.info('Calling ML service for severity prediction');
      const response = await axios.post(`${ML_URL}/api/ml/predict/severity`, payload, {
        timeout: ML_TIMEOUT
      });
      logger.info('ML severity prediction received successfully');
      return response.data;
    } catch (error) {
      logger.error('Error calling ML service for severity prediction', { message: error.message });
      return null;
    }
  }

  /**
   * Request hospital recommendations from ML Service.
   * @param {Object} payload - { patient_location, emergency_type, severity, current_time }
   * @returns {Promise<Object|null>}
   */
  static async recommendHospital(payload) {
    try {
      logger.info('Calling ML service for hospital recommendation');
      const response = await axios.post(`${ML_URL}/api/ml/recommend/hospital`, payload, {
        timeout: ML_TIMEOUT
      });
      logger.info('ML hospital recommendation received successfully');
      return response.data;
    } catch (error) {
      logger.error('Error calling ML service for hospital recommendation', { message: error.message });
      return null;
    }
  }

  /**
   * Compute features for a request.
   * @param {Object} payload - { request_id, location_lat, location_lng, emergency_type, timestamp }
   * @returns {Promise<Object|null>}
   */
  static async computeFeatures(payload) {
    try {
      logger.info('Calling ML service to compute features');
      const response = await axios.post(`${ML_URL}/api/features/compute`, payload, {
        timeout: ML_TIMEOUT
      });
      logger.info('ML features computed successfully');
      return response.data;
    } catch (error) {
      logger.error('Error calling ML service for feature computation', { message: error.message });
      return null;
    }
  }

  /**
   * Get demand forecasts from ML Service.
   * @param {Object} params - { forecast_horizon, granularity, region }
   * @returns {Promise<Object|null>}
   */
  static async getDemandForecast(params = {}) {
    try {
      logger.info('Calling ML service for demand forecast');
      const queryParams = new URLSearchParams({
        forecast_horizon: params.forecast_horizon || 24,
        granularity: params.granularity || 'hourly',
        region: params.region || 'all'
      });
      const response = await axios.get(`${ML_URL}/api/ml/forecast/demand?${queryParams}`, {
        timeout: ML_TIMEOUT
      });
      logger.info('ML demand forecast received successfully');
      return response.data;
    } catch (error) {
      logger.error('Error calling ML service for demand forecast', { message: error.message });
      return null;
    }
  }

  /**
   * Get resource allocation recommendations from ML Service.
   * @param {Object} payload - { current_fleet, predicted_demand, hospital_capacities, optimization_horizon_hours }
   * @returns {Promise<Object|null>}
   */
  static async getResourceRecommendations(payload) {
    try {
      logger.info('Calling ML service for resource allocation recommendations');
      const response = await axios.post(`${ML_URL}/api/ml/allocate/resources`, payload, {
        timeout: ML_TIMEOUT
      });
      logger.info('ML resource recommendations received successfully');
      return response.data;
    } catch (error) {
      logger.error('Error calling ML service for resource recommendations', { message: error.message });
      return null;
    }
  }

  /**
   * Get pattern analysis from ML Service.
   * @param {Object} payload - { analysis_type, time_range, metrics }
   * @returns {Promise<Object|null>}
   */
  static async analyzePatterns(payload) {
    try {
      logger.info('Calling ML service for pattern analysis');
      const response = await axios.post(`${ML_URL}/api/ml/analyze/patterns`, payload, {
        timeout: ML_TIMEOUT
      });
      logger.info('ML pattern analysis received successfully');
      return response.data;
    } catch (error) {
      logger.error('Error calling ML service for pattern analysis', { message: error.message });
      return null;
    }
  }

  /**
   * Store ML prediction in database.
   * @param {Object} predictionData - { request_id, model_name, model_version, prediction_type, prediction_value, features_used, explanation, confidence_score, latency_ms }
   * @returns {Promise<Object|null>}
   */
  static async storePrediction(predictionData) {
    try {
      const { prisma } = await import('../config/db.js');
      const prediction = await prisma.mLPrediction.create({
        data: {
          requestId: predictionData.request_id,
          modelName: predictionData.model_name,
          modelVersion: predictionData.model_version,
          predictionType: predictionData.prediction_type,
          predictionValue: predictionData.prediction_value,
          featuresUsed: predictionData.features_used,
          explanation: predictionData.explanation,
          confidenceScore: predictionData.confidence_score,
          latencyMs: predictionData.latency_ms
        }
      });
      return prediction;
    } catch (error) {
      logger.error('Error storing ML prediction', { message: error.message });
      return null;
    }
  }

  /**
   * Check if ML service is available.
   * @returns {Promise<boolean>}
   */
  static async isAvailable() {
    try {
      const response = await axios.get(`${ML_URL}/health`, {
        timeout: 2000
      });
      return response.status === 200;
    } catch (error) {
      logger.warn('ML service is not available', { message: error.message });
      return false;
    }
  }
}

export default MLService;

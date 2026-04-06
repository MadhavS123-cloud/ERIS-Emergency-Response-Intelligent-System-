import axios from 'axios';
import logger from '../utils/logger.js';
import env from '../config/env.js';

class MLService {
  /**
   * Request delay inference from FastAPI ML Service.
   * @param {Object} payload 
   * @returns {Promise<Object>}
   */
  static async predictDelay(payload) {
    try {
      logger.info('Calling ML service for delay prediction');
      const ML_URL = env.ML_SERVICE_URL || 'http://localhost:8000';
      const response = await axios.post(`${ML_URL}/predict`, payload);
      logger.info('ML prediction received successfully');
      return response.data;
    } catch (error) {
      logger.error('Error calling ML service', { message: error.message });
      // Depending on requirements, we can throw here or return a fallback mechanism
      return null;
    }
  }
}

export default MLService;

import axios from 'axios';
import logger from '../utils/logger.js';
import env from '../config/env.js';

class MLService {
  /**
   * Calls the external FastAPI endpoint to predict the best ambulance
   * @param {Object} emergencyData - Details of the emergency (location, severity, etc.)
   * @returns {Promise<Object>} The ML prediction result
   */
  static async predictBestAmbulance(emergencyData) {
    try {
      logger.info('Calling ML service to predict best ambulance');
      
      // Placeholder: actual endpoint URL depends on the FastAPI backend
      const response = await axios.post(`${env.ML_SERVICE_URL}/predict/ambulance`, emergencyData);
      
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

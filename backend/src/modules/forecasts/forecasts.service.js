import MLService from '../../services/ml.service.js';
import logger from '../../utils/logger.js';

class ForecastsService {
  async getDemandForecast(params) {
    try {
      const forecast = await MLService.getDemandForecast(params);
      
      if (!forecast) {
        // Fallback: return empty forecast with error indicator
        logger.warn('ML service unavailable, returning fallback forecast');
        return {
          forecasts: [],
          model_version: 'unavailable',
          generated_at: new Date().toISOString(),
          error: 'ML service unavailable'
        };
      }

      return forecast;
    } catch (error) {
      logger.error('Error getting demand forecast', { message: error.message });
      throw Object.assign(new Error('Failed to retrieve demand forecast'), { statusCode: 500 });
    }
  }
}

export default new ForecastsService();

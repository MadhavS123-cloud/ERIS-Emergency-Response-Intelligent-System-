import MLService from '../../services/ml.service.js';
import logger from '../../utils/logger.js';

class PatternsService {
  async getAnomalies(params) {
    try {
      const { start_date, end_date, metrics } = params;

      // Default to last 7 days if not specified
      const endDate = end_date || new Date().toISOString().split('T')[0];
      const startDate = start_date || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const payload = {
        analysis_type: 'anomaly_detection',
        time_range: {
          start: startDate,
          end: endDate
        },
        metrics: metrics || ['request_volume', 'response_time', 'hospital_utilization']
      };

      const analysis = await MLService.analyzePatterns(payload);

      if (!analysis) {
        logger.warn('ML service unavailable, returning empty anomalies');
        return {
          anomalies: [],
          error: 'ML service unavailable'
        };
      }

      return {
        anomalies: analysis.anomalies || [],
        time_range: payload.time_range
      };
    } catch (error) {
      logger.error('Error getting anomalies', { message: error.message });
      throw Object.assign(new Error('Failed to retrieve anomalies'), { statusCode: 500 });
    }
  }

  async getTrends(params) {
    try {
      const { start_date, end_date } = params;

      // Default to last 30 days if not specified
      const endDate = end_date || new Date().toISOString().split('T')[0];
      const startDate = start_date || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const payload = {
        analysis_type: 'pattern_recognition',
        time_range: {
          start: startDate,
          end: endDate
        },
        metrics: ['request_volume', 'response_time', 'emergency_type_distribution']
      };

      const analysis = await MLService.analyzePatterns(payload);

      if (!analysis) {
        logger.warn('ML service unavailable, returning empty trends');
        return {
          patterns: [],
          error: 'ML service unavailable'
        };
      }

      return {
        patterns: analysis.patterns || [],
        time_range: payload.time_range
      };
    } catch (error) {
      logger.error('Error getting trends', { message: error.message });
      throw Object.assign(new Error('Failed to retrieve trends'), { statusCode: 500 });
    }
  }
}

export default new PatternsService();

import patternsService from './patterns.service.js';
import APIResponse from '../../utils/response.js';

class PatternsController {
  async getAnomalies(req, res, next) {
    try {
      const { start_date, end_date, metrics } = req.query;
      const anomalies = await patternsService.getAnomalies({
        start_date,
        end_date,
        metrics: metrics ? metrics.split(',') : ['request_volume', 'response_time', 'hospital_utilization']
      });
      return APIResponse.success(res, anomalies, 'Anomalies retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async getTrends(req, res, next) {
    try {
      const { start_date, end_date } = req.query;
      const trends = await patternsService.getTrends({
        start_date,
        end_date
      });
      return APIResponse.success(res, trends, 'Trends retrieved successfully');
    } catch (error) {
      next(error);
    }
  }
}

export default new PatternsController();

import forecastsService from './forecasts.service.js';
import APIResponse from '../../utils/response.js';

class ForecastsController {
  async getDemandForecast(req, res, next) {
    try {
      const { forecast_horizon, granularity, region } = req.query;
      const forecast = await forecastsService.getDemandForecast({
        forecast_horizon: forecast_horizon ? parseInt(forecast_horizon) : 24,
        granularity: granularity || 'hourly',
        region: region || 'all'
      });
      return APIResponse.success(res, forecast, 'Demand forecast retrieved successfully');
    } catch (error) {
      next(error);
    }
  }
}

export default new ForecastsController();

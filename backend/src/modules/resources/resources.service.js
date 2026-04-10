import MLService from '../../services/ml.service.js';
import ambulanceRepository from '../ambulance/ambulance.repository.js';
import hospitalRepository from '../hospital/hospital.repository.js';
import logger from '../../utils/logger.js';

class ResourcesService {
  async getResourceRecommendations(actor) {
    try {
      // Gather current fleet data
      let ambulances = [];
      if (actor?.role === 'HOSPITAL' && actor.hospitalId) {
        ambulances = await ambulanceRepository.findAmbulancesByHospitalId(actor.hospitalId);
      } else {
        ambulances = await ambulanceRepository.findAllAmbulances();
      }

      // Gather hospital capacity data
      const hospitals = await hospitalRepository.findAllHospitals();

      // Get demand forecast for context
      const demandForecast = await MLService.getDemandForecast({
        forecast_horizon: 6,
        granularity: 'hourly',
        region: 'all'
      });

      // Prepare payload for ML service
      const payload = {
        current_fleet: ambulances.map(amb => ({
          ambulance_id: amb.id,
          location_lat: amb.locationLat,
          location_lng: amb.locationLng,
          is_available: amb.isAvailable,
          hospital_id: amb.hospitalId
        })),
        predicted_demand: demandForecast?.forecasts || [],
        hospital_capacities: hospitals.map(hosp => ({
          hospital_id: hosp.id,
          location_lat: hosp.locationLat,
          location_lng: hosp.locationLng,
          icu_beds_available: hosp.icuBeds || 0,
          general_beds_available: hosp.generalBeds || 0
        })),
        optimization_horizon_hours: 4
      };

      const recommendations = await MLService.getResourceRecommendations(payload);

      if (!recommendations) {
        logger.warn('ML service unavailable, returning empty recommendations');
        return {
          recommendations: [],
          expected_impact: {
            avg_response_time_reduction_mins: 0,
            coverage_improvement_pct: 0
          },
          error: 'ML service unavailable'
        };
      }

      return recommendations;
    } catch (error) {
      logger.error('Error getting resource recommendations', { message: error.message });
      throw Object.assign(new Error('Failed to retrieve resource recommendations'), { statusCode: 500 });
    }
  }
}

export default new ResourcesService();

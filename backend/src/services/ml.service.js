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
      logger.warn('ML Service unreachable. Using intelligent heuristic routing fallback.', { message: error.message });
      try {
        const { prisma } = await import('../config/db.js');
        const { calculateDistance } = await import('../utils/distance.js');
        
        const hospitals = await prisma.hospital.findMany({ include: { ambulances: true } });
        const eligible = hospitals.filter(h => 
          typeof h.locationLat === 'number' && 
          typeof h.locationLng === 'number' && 
          h.ambulances && h.ambulances.some(a => a.isAvailable === true)
        );

        if (eligible.length === 0) return null;

        const type = (payload.emergency_type || "").toLowerCase();

        // ── Capability Tier Definitions ──────────────────────────────────────
        // Tier 1: Full-service hospitals with surgical/trauma capabilities
        const TIER1_KEYWORDS = [
          'hospital', 'multispeciality', 'multi speciality', 'multispecialty',
          'multi specialty', 'institute', 'medical center', 'medical centre',
          'apollo', 'manipal', 'fortis', 'narayana', 'aster', 'columbia',
          'sakra', 'bgs', 'victoria', 'bowring', 'lady curzon', 'kims',
          'nimhans', 'general hospital', 'district hospital', 'government hospital',
          'trauma center', 'emergency care', 'care hospital', 'rainbow',
          'cloudnine', 'motherhood', 'sparsh', 'sathya sai', 'medanta',
          'mazumdar shaw', 'vydehi', 'brookfield', 'yashomati', 'lions'
        ];

        // Tier 2: Small clinics, specialty-only, wellness, dental, eye-only, etc.
        const TIER2_EXCLUSION_KEYWORDS = [
          'clinic', 'dental', 'eye care', 'eye hospital', 'optical',
          'homoeo', 'homeopathy', 'ayurvedic', 'ayurveda', 'wellness',
          'physiotherapy', 'nursing home', 'diagnostic', 'pathology',
          'lab', 'pharmacy', 'skin care', 'hair clinic', 'cosmetic',
          'beauty', 'sleep clinic', 'batra'
        ];

        // Emergency types that REQUIRE Tier-1 surgical/trauma facilities
        const CRITICAL_EMERGENCY_KEYWORDS = [
          'bleeding', 'hemorrhage', 'cardiac', 'heart', 'stroke', 'trauma',
          'accident', 'burn', 'fire', 'choking', 'unconscious', 'fainting',
          'seizure', 'convulsion', 'poisoning', 'overdose', 'anaphylaxis',
          'allergic reaction', 'respiratory', 'breathing'
        ];

        const isCriticalEmergency = CRITICAL_EMERGENCY_KEYWORDS.some(kw => type.includes(kw));

        const isTier1Capable = (hospitalName) => {
          const n = hospitalName.toLowerCase();
          // If the name contains any exclusion keyword, it's NOT Tier-1
          if (TIER2_EXCLUSION_KEYWORDS.some(kw => n.includes(kw))) return false;
          // If it matches a Tier-1 keyword, it IS Tier-1
          return TIER1_KEYWORDS.some(kw => n.includes(kw));
        };

        // For critical emergencies, ONLY route to Tier-1 capable hospitals
        const candidatePool = isCriticalEmergency
          ? eligible.filter(h => isTier1Capable(h.name))
          : eligible;

        // Safety fallback: if no Tier-1 nearby, open to all (better than nothing)
        const finalPool = candidatePool.length > 0 ? candidatePool : eligible;

        if (isCriticalEmergency) {
          logger.info(`Critical emergency detected. Filtered to ${finalPool.length} Tier-1 hospitals from ${eligible.length} total.`);
        }

        const scoredHospitals = finalPool.map(h => {
          let score = 0;
          const name = h.name.toLowerCase();
          const dist = calculateDistance(payload.patient_location.lat, payload.patient_location.lng, h.locationLat, h.locationLng);
          
          // Stronger distance penalty ensures nearby wins all else equal
          score -= dist * 3;

          // Specialty-match bonuses
          if ((type.includes('cardiac') || type.includes('heart')) && (name.includes('heart') || name.includes('cardio') || name.includes('sathya sai') || name.includes('narayana') || name.includes('fortis'))) score += 20;
          if ((type.includes('bleeding') || type.includes('hemorrhage') || type.includes('trauma') || type.includes('accident')) && (name.includes('trauma') || name.includes('apollo') || name.includes('manipal') || name.includes('victoria') || name.includes('bowring') || name.includes('general'))) score += 18;
          if ((type.includes('stroke') || type.includes('neuro') || type.includes('seizure') || type.includes('convulsion')) && (name.includes('neuro') || name.includes('brain') || name.includes('nimhans') || name.includes('speciality'))) score += 18;
          if ((type.includes('burn') || type.includes('fire')) && (name.includes('burn') || name.includes('victoria') || name.includes('government'))) score += 22;
          if ((type.includes('pediatric') || type.includes('child') || type.includes('infant')) && (name.includes('children') || name.includes('pediatric') || name.includes('rainbow'))) score += 20;
          if ((type.includes('maternity') || type.includes('pregnancy') || type.includes('labor')) && (name.includes('women') || name.includes('maternity') || name.includes('cloudnine') || name.includes('motherhood'))) score += 20;
          if ((type.includes('eye') || type.includes('vision')) && (name.includes('eye') || name.includes('nethra') || name.includes('vision') || name.includes('sankara'))) score += 25;

          // General bonus for Tier-1 hospitals
          if (isTier1Capable(h.name)) score += 5;

          return { hospital: h, score, dist };
        }).sort((a, b) => b.score - a.score);

        const best = scoredHospitals[0].hospital;
        logger.info(`Heuristic selected "${best.name}" (dist: ${scoredHospitals[0].dist.toFixed(2)}km, score: ${scoredHospitals[0].score.toFixed(2)}) for "${payload.emergency_type}" [critical=${isCriticalEmergency}]`);
        
        return {
           hospital: {
               recommendations: [{
                   hospital_id: best.id,
                   hospital_name: best.name,
                   score: scoredHospitals[0].score
               }]
           }
        };
      } catch (innerErr) {
         logger.error('Heuristic fallback completely failed', { message: innerErr.message });
         return null;
      }
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

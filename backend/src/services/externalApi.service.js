import axios from 'axios';
import logger from '../utils/logger.js';

const MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || 'MOCK_MAPS_KEY';
const WEATHER_API_KEY = process.env.WEATHER_API_KEY || 'MOCK_WEATHER_KEY';

/**
 * Fetch route details from Google Maps API (Distance Matrix API).
 * @param {number} originLat
 * @param {number} originLng
 * @param {number} destLat
 * @param {number} destLng
 * @returns {Promise<{distance_km: number, traffic_level: string, duration_mins: number}>}
 */
export const getRouteDetails = async (originLat, originLng, destLat, destLng) => {
  // Return mocked values if no real keys
  if (MAPS_API_KEY.includes('MOCK_')) {
    logger.warn('Using MOCKED Google Maps API.');
    // Approximate distance
    const dist = Math.sqrt(Math.pow(destLat - originLat, 2) + Math.pow(destLng - originLng, 2)) * 111;
    let traffic = 'Low';
    if (dist > 15) traffic = 'High';
    else if (dist > 5) traffic = 'Medium';
    
    return {
      distance_km: Number(Math.max(1, dist).toFixed(1)),
      traffic_level: traffic,
      duration_mins: Number(Math.max(2, dist * 2).toFixed(1))
    };
  }

  try {
    const origin = `${originLat},${originLng}`;
    const destination = `${destLat},${destLng}`;
    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origin}&destinations=${destination}&departure_time=now&key=${MAPS_API_KEY}`;
    
    const response = await axios.get(url);
    if (response.data.status === 'OK' && response.data.rows[0].elements[0].status === 'OK') {
      const element = response.data.rows[0].elements[0];
      const distanceMsg = element.distance.value; // in meters
      const durationMsg = element.duration.value; // in seconds
      const durationInTrafficMsg = element.duration_in_traffic ? element.duration_in_traffic.value : durationMsg;

      const distance_km = Number((distanceMsg / 1000).toFixed(1));
      
      // Calculate traffic level by comparing normal time vs traffic time
      let traffic_level = 'Low';
      const delayRatio = durationInTrafficMsg / durationMsg;
      if (delayRatio > 1.4) traffic_level = 'High';
      else if (delayRatio > 1.15) traffic_level = 'Medium';

      return {
        distance_km,
        traffic_level,
        duration_mins: Number((durationInTrafficMsg / 60).toFixed(1))
      };
    }
    throw new Error('Invalid response from Google Maps API');
  } catch (error) {
    logger.error(`Google Maps API error: ${error.message}`);
    // Fallback on error
    return { distance_km: 10.0, traffic_level: 'Medium', duration_mins: 20.0 };
  }
};

/**
 * Fetch current weather from OpenWeatherMap.
 * @param {number} lat
 * @param {number} lng
 * @returns {Promise<{weather: string}>}
 */
export const getWeather = async (lat, lng) => {
  if (WEATHER_API_KEY.includes('MOCK_')) {
    logger.warn('Using MOCKED Weather API.');
    const conditions = ['Clear', 'Rain', 'Fog', 'Snow'];
    const mockCondition = conditions[Math.floor(Math.random() * conditions.length)];
    return { weather: mockCondition };
  }

  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&appid=${WEATHER_API_KEY}`;
    const response = await axios.get(url);
    const mainCondition = response.data.weather[0].main;
    
    // Map to our dataset's known values ['Clear', 'Rain', 'Fog', 'Snow']
    let weather = 'Clear';
    if (['Rain', 'Drizzle', 'Thunderstorm'].includes(mainCondition)) weather = 'Rain';
    if (['Snow'].includes(mainCondition)) weather = 'Snow';
    if (['Mist', 'Haze', 'Dust', 'Fog', 'Smoke'].includes(mainCondition)) weather = 'Fog';

    return { weather };
  } catch (error) {
    logger.error(`Weather API error: ${error.message}`);
    return { weather: 'Clear' };
  }
};

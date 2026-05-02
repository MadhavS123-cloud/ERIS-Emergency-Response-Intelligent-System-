import axios from 'axios';
import logger from '../utils/logger.js';

const MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || 'MOCK_MAPS_KEY';
const WEATHER_API_KEY = process.env.WEATHER_API_KEY || 'MOCK_WEATHER_KEY';
const OSRM_ROUTE_URL = 'https://router.project-osrm.org/route/v1/driving';
const OPEN_METEO_URL = 'https://api.open-meteo.com/v1/forecast';

const deriveTrafficLevel = (distanceKm, durationMins) => {
  if (!distanceKm || !durationMins || durationMins <= 0) return 'Medium';
  const avgSpeedKmh = (distanceKm / durationMins) * 60;
  if (avgSpeedKmh < 18) return 'High';
  if (avgSpeedKmh < 32) return 'Medium';
  return 'Low';
};

const mapOpenMeteoWeatherCode = (code) => {
  if ([45, 48].includes(code)) return 'Fog';
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'Snow';
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99].includes(code)) return 'Rain';
  return 'Clear';
};

/**
 * Fetch route details from Google Maps API (Distance Matrix API).
 * @param {number} originLat
 * @param {number} originLng
 * @param {number} destLat
 * @param {number} destLng
 * @returns {Promise<{distance_km: number, traffic_level: string, duration_mins: number}>}
 */
export const getRouteDetails = async (originLat, originLng, destLat, destLng) => {
  // Use public routing first when no paid key is configured
  if (MAPS_API_KEY.includes('MOCK_')) {
    try {
      const routeUrl = `${OSRM_ROUTE_URL}/${originLng},${originLat};${destLng},${destLat}?overview=false`;
      const response = await axios.get(routeUrl, { timeout: 5000 });
      const route = response.data?.routes?.[0];

      if (route) {
        const distance_km = Number((route.distance / 1000).toFixed(1));
        const duration_mins = Number((route.duration / 60).toFixed(1));
        return {
          distance_km,
          traffic_level: deriveTrafficLevel(distance_km, duration_mins),
          duration_mins
        };
      }
    } catch (error) {
      logger.warn(`OSRM routing fallback failed: ${error.message}`);
    }

    logger.warn('Falling back to heuristic route approximation.');
    const dist = Math.sqrt(Math.pow(destLat - originLat, 2) + Math.pow(destLng - originLng, 2)) * 111;
    const durationMins = Number(Math.max(3, dist * 2.2).toFixed(1));

    return {
      distance_km: Number(Math.max(1, dist).toFixed(1)),
      traffic_level: deriveTrafficLevel(dist, durationMins),
      duration_mins: durationMins
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
    try {
      const response = await axios.get(OPEN_METEO_URL, {
        params: {
          latitude: lat,
          longitude: lng,
          current: 'weather_code',
          timezone: 'auto',
          forecast_days: 1
        },
        timeout: 5000
      });

      const weatherCode = response.data?.current?.weather_code;
      if (typeof weatherCode === 'number') {
        return { weather: mapOpenMeteoWeatherCode(weatherCode) };
      }
    } catch (error) {
      logger.warn(`Open-Meteo weather fallback failed: ${error.message}`);
    }

    logger.warn('Falling back to deterministic clear weather approximation.');
    return { weather: 'Clear' };
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

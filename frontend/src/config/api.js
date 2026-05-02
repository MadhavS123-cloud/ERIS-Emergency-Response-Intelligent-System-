// Production backend on Render
const PRODUCTION_API_URL = 'https://eris-emergency-response-intelligent.onrender.com/api/v1';

// Use environment variable, or auto-detect based on hostname
const API_BASE_URL = import.meta.env.VITE_API_URL || 
  (window.location.hostname === 'localhost' ? '/api/v1' : PRODUCTION_API_URL);

// API Configuration
export const API_CONFIG = {
  // Longer timeout for Render cold starts (free tier takes 30-60s to wake up)
  TIMEOUT: 60000, // 60 seconds
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 2000, // 2 seconds between retries
  // Health check endpoint
  HEALTH_CHECK_URL: API_BASE_URL.replace('/api/v1', '/health')
};

export default API_BASE_URL;

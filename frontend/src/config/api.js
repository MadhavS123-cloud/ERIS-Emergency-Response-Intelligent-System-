// Production backend on Render
const PRODUCTION_API_URL = 'https://eris-emergency-response-intelligent.onrender.com/api/v1';

// Use environment variable, or auto-detect based on hostname
const API_BASE_URL = import.meta.env.VITE_API_URL || 
  (window.location.hostname === 'localhost' ? '/api/v1' : PRODUCTION_API_URL);

export default API_BASE_URL;

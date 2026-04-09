/**
 * TomTom Maps Configuration for ERIS
 * 
 * Provides centralized tile URL builders for TomTom Map tiles and Traffic overlays.
 * All map components should import from this file instead of hardcoding tile URLs.
 * 
 * Usage:
 *   import { getTomTomTileUrl, getTrafficFlowUrl, getTrafficIncidentUrl, TOMTOM_ATTRIBUTION } from '../config/tomtom';
 */

const TOMTOM_API_KEY = import.meta.env.VITE_TOMTOM_API_KEY || '';

/**
 * Base map tile URL (raster)
 */
export const getTomTomTileUrl = (style = 'main') => {
  if (!TOMTOM_API_KEY) {
    // Fallback to OSM if key is missing
    return style === 'night' 
      ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
      : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
  }
  return `https://{s}.api.tomtom.com/map/1/tile/basic/${style}/{z}/{x}/{y}.png?key=${TOMTOM_API_KEY}`;
};

/**
 * Traffic flow overlay tile URL (raster)
 */
export const getTrafficFlowUrl = () => {
  if (!TOMTOM_API_KEY) return null;
  return `https://{s}.api.tomtom.com/traffic/map/4/tile/flow/relative0/{z}/{x}/{y}.png?key=${TOMTOM_API_KEY}`;
};

/**
 * Traffic incident overlay tile URL (raster)
 */
export const getTrafficIncidentUrl = () => {
  if (!TOMTOM_API_KEY) return null;
  return `https://{s}.api.tomtom.com/traffic/map/4/tile/incidents/s1/{z}/{x}/{y}.png?key=${TOMTOM_API_KEY}`;
};

/** Standard attribution string */
export const TOMTOM_ATTRIBUTION = TOMTOM_API_KEY 
  ? '&copy; <a href="https://www.tomtom.com" target="_blank">TomTom</a>'
  : '&copy; OpenStreetMap contributors';

/**
 * Helper: Add TomTom base + traffic layers to a Leaflet map instance
 */
export const addTomTomLayers = (map, style = 'main', showTraffic = true, showIncidents = false) => {
  if (!window.L || !map) return;

  if (!TOMTOM_API_KEY) {
    console.warn("⚠️ TomTom API Key missing (VITE_TOMTOM_API_KEY). Falling back to OpenStreetMap.");
  }

  // Base map tiles
  window.L.tileLayer(getTomTomTileUrl(style), {
    attribution: TOMTOM_ATTRIBUTION,
    maxZoom: 22,
    subdomains: ['a', 'b', 'c', 'd'],
    tileSize: 256,
  }).addTo(map);

  // Traffic flow overlay
  const flowUrl = getTrafficFlowUrl();
  if (showTraffic && flowUrl) {
    window.L.tileLayer(flowUrl, {
      maxZoom: 22,
      subdomains: ['a', 'b', 'c', 'd'],
      tileSize: 256,
      opacity: 0.7,
      zIndex: 10,
    }).addTo(map);
  }

  // Traffic incidents overlay
  const incidentUrl = getTrafficIncidentUrl();
  if (showIncidents && incidentUrl) {
    window.L.tileLayer(incidentUrl, {
      maxZoom: 22,
      subdomains: ['a', 'b', 'c', 'd'],
      tileSize: 256,
      opacity: 0.8,
      zIndex: 11,
    }).addTo(map);
  }
};

export default { getTomTomTileUrl, getTrafficFlowUrl, getTrafficIncidentUrl, addTomTomLayers, TOMTOM_ATTRIBUTION };

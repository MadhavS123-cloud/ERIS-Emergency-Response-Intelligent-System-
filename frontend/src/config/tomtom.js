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
 * @param {'main'|'night'} style - 'main' for light theme, 'night' for dark theme
 */
export const getTomTomTileUrl = (style = 'main') =>
  `https://api.tomtom.com/map/1/tile/basic/${style}/{z}/{x}/{y}.png?key=${TOMTOM_API_KEY}&tileSize=256`;

/**
 * Traffic flow overlay tile URL (raster)
 * Shows real-time traffic speed relative to free-flow (green/yellow/red)
 */
export const getTrafficFlowUrl = () =>
  `https://api.tomtom.com/traffic/map/4/tile/flow/relative0/{z}/{x}/{y}.png?key=${TOMTOM_API_KEY}&tileSize=256`;

/**
 * Traffic incident overlay tile URL (raster)
 * Shows accidents, road closures, construction, etc.
 */
export const getTrafficIncidentUrl = () =>
  `https://api.tomtom.com/traffic/map/4/tile/incidents/s1/{z}/{x}/{y}.png?key=${TOMTOM_API_KEY}&tileSize=256`;

/** Standard attribution string for TomTom maps */
export const TOMTOM_ATTRIBUTION = '&copy; <a href="https://www.tomtom.com" target="_blank">TomTom</a>';

/**
 * Helper: Add TomTom base + traffic layers to a Leaflet map instance
 * @param {L.Map} map - The Leaflet map instance
 * @param {'main'|'night'} style - Map style
 * @param {boolean} showTraffic - Whether to add traffic flow overlay
 * @param {boolean} showIncidents - Whether to add traffic incidents overlay
 */
export const addTomTomLayers = (map, style = 'main', showTraffic = true, showIncidents = false) => {
  if (!window.L || !map) return;

  // Base map tiles
  window.L.tileLayer(getTomTomTileUrl(style), {
    attribution: TOMTOM_ATTRIBUTION,
    maxZoom: 22,
    tileSize: 256,
  }).addTo(map);

  // Traffic flow overlay
  if (showTraffic && TOMTOM_API_KEY) {
    window.L.tileLayer(getTrafficFlowUrl(), {
      maxZoom: 22,
      tileSize: 256,
      opacity: 0.7,
      zIndex: 10,
    }).addTo(map);
  }

  // Traffic incidents overlay
  if (showIncidents && TOMTOM_API_KEY) {
    window.L.tileLayer(getTrafficIncidentUrl(), {
      maxZoom: 22,
      tileSize: 256,
      opacity: 0.8,
      zIndex: 11,
    }).addTo(map);
  }
};

export default { getTomTomTileUrl, getTrafficFlowUrl, getTrafficIncidentUrl, addTomTomLayers, TOMTOM_ATTRIBUTION };

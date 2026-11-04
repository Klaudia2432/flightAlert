import '../config.js';

const {
  CONFIG,
  SETTINGS_KEY
} = globalThis.FLIGHT_ALERT_CONFIG;

// Validate the user-selected detection radius.
export function validateRadius(radius) {
  const value = Number(radius);

  if (!Number.isInteger(value) || value < 1 || value > 20) {
    throw new Error('Detection radius must be between 1 and 20 miles');
  }

  return value;
}

// Validate the user-selected home coordinates.
export function validateHome(home) {
  if (!home || typeof home !== 'object') {
    throw new Error('Home location is required');
  }

  const lat = Number(home.lat);
  const lon = Number(home.lon);

  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    throw new Error('Latitude must be between -90 and 90');
  }

  if (!Number.isFinite(lon) || lon < -180 || lon > 180) {
    throw new Error('Longitude must be between -180 and 180');
  }

  return { lat, lon };
}

// Load saved settings or use defaults.
export async function getSettings() {
  const stored = await chrome.storage.local.get(SETTINGS_KEY);

  const savedSettings = stored[SETTINGS_KEY] || {};
  const radiusMiles = savedSettings.radiusMiles;

  return {
    radiusMiles: radiusMiles == null
      ? CONFIG.radiusMiles
      : validateRadius(radiusMiles),
    home: savedSettings.home == null
      ? null
      : validateHome(savedSettings.home),
    predictionHorizonMinutes: CONFIG.predictionHorizonMinutes
  };
}

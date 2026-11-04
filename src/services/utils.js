import '../config.js';

const {
  MIN_MANUAL_INTERVAL_MS
} = globalThis.FLIGHT_ALERT_CONFIG;

// Return the current UTC day for daily API budget tracking.
export function utcDayKey(now = Date.now()) {
  return new Date(now).toISOString().slice(0, 10);
}

// Create a consistent response for background monitoring statuses.
export function statusResult(message, extras = {}) {
  return {
    plane: null,
    predictions: [],
    checkedAt: Date.now(),
    ...extras,
    ...(message ? { statusMessage: message } : {})
  };
}

// Calculate when the next manual refresh is available.
export function getManualRefreshAvailableAt(lastFetchAt) {
  return lastFetchAt > 0
    ? lastFetchAt + MIN_MANUAL_INTERVAL_MS
    : 0;
}

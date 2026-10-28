// Flight Alert configuration and local storage keys.
globalThis.FLIGHT_ALERT_CONFIG = (() => {
  const CONFIG = {
    radiusMiles: 2,
    maxDistanceMiles: 120,
    predictionHorizonMinutes: 20,
    alertMinMinutes: 10,
    alertMaxMinutes: 20,
    pollMinutes: 6,
    staleAfterSeconds: 90,
    manualRefreshIntervalMs: 60 * 1000,
    alertCooldownMs: 45 * 60 * 1000,
    maxDailyCredits: 300,
    maxHeadingChangeDegrees: 20
  };

  const ALARM_NAME = 'flight-alert-check';
  const LOCATION_ALARM_NAME = 'flight-alert-location-check';
  const ALERTS_KEY = 'notifiedAircraft';
  const RATE_LIMIT_KEY = 'rateLimitedUntil';
  const CACHE_KEY = 'lastFlightResult';
  const AIRCRAFT_CACHE_KEY = 'lastAircraftStates';
  const NEXT_FETCH_KEY = 'nextAllowedFetchAt';
  const BUDGET_KEY = 'dailyApiBudget';
  const SETTINGS_KEY = 'flightAlertSettings';
  const DEFAULT_RETRY_SECONDS = 15 * 60;
  const FETCH_INTERVAL_MS = CONFIG.pollMinutes * 60 * 1000;
  const LAST_FETCH_KEY = 'lastOpenSkyFetchAt';
  const MIN_MANUAL_INTERVAL_MS = CONFIG.manualRefreshIntervalMs;

  return {
    CONFIG, ALARM_NAME, LOCATION_ALARM_NAME, ALERTS_KEY, RATE_LIMIT_KEY,
    CACHE_KEY, AIRCRAFT_CACHE_KEY, NEXT_FETCH_KEY, BUDGET_KEY, SETTINGS_KEY,
    DEFAULT_RETRY_SECONDS, FETCH_INTERVAL_MS, LAST_FETCH_KEY,
    MIN_MANUAL_INTERVAL_MS
  };
})();

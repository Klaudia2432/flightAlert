import '../config.js';
import { fetchNearbyAircraft } from './opensky.js';
import { sendPassNotification } from './notifications.js';
import { statusResult } from './utils.js';

const {
  CONFIG,
  ALARM_NAME,
  LOCATION_ALARM_NAME,
  NEXT_FETCH_KEY,
  RATE_LIMIT_KEY
} = globalThis.FLIGHT_ALERT_CONFIG;

// Check aircraft and send notifications for eligible predictions.
export async function checkFlights() {
  const result = await fetchNearbyAircraft();

  if (
    result.requiresSetup ||
    result.rateLimited ||
    result.budgetLimited ||
    result.error ||
    result.cached
  ) {
    return;
  }

  for (const plane of result.predictions) {
    // Alert for predicted passes within 20 minutes.
    // Also warn of passes detected fewer than 10 minutes away.
    if (
      plane.etaMinutes > 0 &&
      plane.etaMinutes <= CONFIG.alertMaxMinutes
    ) {
      await sendPassNotification(plane);
    }
  }
}

// Run the aircraft check safely without crashing the background worker.
export async function runCheckSafely() {
  try {
    await checkFlights();
  } catch (error) {
    console.error(
      'Flight Alert check failed:',
      error
    );

    await chrome.storage.local.set({
      latestFlightStatus: statusResult(null, {
        error: error.message || 'Unknown API error'
      })
    });
  }
}

// Check the new location as soon as the existing API limits allow.
export async function scheduleLocationCheck() {
  const stored = await chrome.storage.local.get([
    NEXT_FETCH_KEY,
    RATE_LIMIT_KEY
  ]);

  const nextFetchAt = Number(stored[NEXT_FETCH_KEY]) || 0;
  const rateLimitedUntil = Number(stored[RATE_LIMIT_KEY]) || 0;
  const allowedAt = Math.max(nextFetchAt, rateLimitedUntil);

  await chrome.alarms.clear(LOCATION_ALARM_NAME);

  if (allowedAt <= Date.now()) {
    void runCheckSafely();
    return;
  }

  await chrome.alarms.create(LOCATION_ALARM_NAME, {
    when: allowedAt
  });
}

// Ensure the automatic monitoring alarm is configured.
export async function ensureAlarm() {
  const alarm = await chrome.alarms.get(ALARM_NAME);

  if (
    !alarm ||
    alarm.periodInMinutes !== CONFIG.pollMinutes
  ) {
    await chrome.alarms.create(ALARM_NAME, {
      periodInMinutes: CONFIG.pollMinutes
    });
  }
}

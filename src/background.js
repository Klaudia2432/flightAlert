
const HOME = { lat: 55.7776, lon: -4.0536 };

const CONFIG = {
  radiusMiles: 2,
  maxDistanceMiles: 120,
  predictionHorizonMinutes: 20,
  alertMinMinutes: 10,
  alertMaxMinutes: 20,
  pollMinutes: 6,
  staleAfterSeconds: 90,
  alertCooldownMs: 45 * 60 * 1000,
  maxDailyCredits: 300,
  maxHeadingChangeDegrees: 20
};

const ALARM_NAME = 'flight-alert-check';
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
const MIN_MANUAL_INTERVAL_MS = 60 * 1000;

let activeFetch = null;
const aircraftHistory = new Map();

const radians = degrees => degrees * Math.PI / 180;

function distanceKm(lat1, lon1, lat2, lon2) {
  const dLat = radians(lat2 - lat1);
  const dLon = radians(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(radians(lat1)) * Math.cos(radians(lat2)) *
    Math.sin(dLon / 2) ** 2;

  return 6371 * 2 * Math.atan2(
    Math.sqrt(a),
    Math.sqrt(Math.max(0, 1 - a))
  );
}

function getBoundingBox(lat, lon, radiusMiles) {
  const latOffset = radiusMiles / 69;
  const lonOffset = radiusMiles /
    (69 * Math.max(0.01, Math.cos(radians(lat))));

  return {
    lamin: Math.max(-90, lat - latOffset),
    lomin: Math.max(-180, lon - lonOffset),
    lamax: Math.min(90, lat + latOffset),
    lomax: Math.min(180, lon + lonOffset)
  };
}

function localCoordinates(lat, lon) {
  return {
    north: radians(lat - HOME.lat) * 6371,
    east: radians(lon - HOME.lon) * 6371 *
      Math.cos(radians(HOME.lat))
  };
}

function headingDifference(a, b) {
  return Math.abs(((a - b + 540) % 360) - 180);
}

// Convert a compass bearing into one of eight directions.
function getCompassDirection(degrees) {
  const directions = [
    'N', 'NE', 'E', 'SE',
    'S', 'SW', 'W', 'NW'
  ];

  const normalized = ((degrees % 360) + 360) % 360;
  const index = Math.round(normalized / 45) % 8;

  return directions[index];
}

// Validate the user-selected detection radius.
function validateRadius(radius) {
  const value = Number(radius);

  if (!Number.isInteger(value) || value < 1 || value > 20) {
    throw new Error('Detection radius must be between 1 and 20 miles');
  }

  return value;
}

// Load saved settings or use defaults.
async function getSettings() {
  const stored = await chrome.storage.local.get(SETTINGS_KEY);

  const radiusMiles = stored[SETTINGS_KEY]?.radiusMiles;

  return {
    radiusMiles: radiusMiles == null
      ? CONFIG.radiusMiles
      : validateRadius(radiusMiles),
    predictionHorizonMinutes: CONFIG.predictionHorizonMinutes
  };
}

// Calculate when the next manual refresh is available.
function getManualRefreshAvailableAt(lastFetchAt) {
  return lastFetchAt > 0
    ? lastFetchAt + MIN_MANUAL_INTERVAL_MS
    : 0;
}

function predictPass(plane, nowSeconds, settings) {
  const [
    icao24,
    rawCallsign,
    ,
    timePosition,
    lastContact,
    lon,
    lat,
    altitudeM,
    onGround,
    speedMps,
    track
  ] = plane;

  if (
    !icao24 ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lon) ||
    !Number.isFinite(speedMps) ||
    speedMps <= 0 ||
    !Number.isFinite(track) ||
    onGround === true ||
    !Number.isFinite(timePosition)
  ) {
    return null;
  }

  const ageSeconds = nowSeconds - timePosition;

  if (
    ageSeconds < -30 ||
    ageSeconds > CONFIG.staleAfterSeconds
  ) {
    return null;
  }

  const currentDistanceMiles =
    distanceKm(HOME.lat, HOME.lon, lat, lon) * 0.621371;

    // Calculate the direction of the aircraft relative to home.
    const position = localCoordinates(lat, lon);

    const bearingFromHome =
    (Math.atan2(position.east, position.north) * 180 / Math.PI + 360) % 360;

    const approachingFrom = getCompassDirection(bearingFromHome);

  if (currentDistanceMiles > CONFIG.maxDistanceMiles) {
    return null;
  }

  const callsign = rawCallsign?.trim() || icao24;
  const heading = radians(track);

  const eastVelocity = speedMps * Math.sin(heading);
  const northVelocity = speedMps * Math.cos(heading);

  // Bring the reported position forward to the present time.
  const effectiveAge = Math.max(0, ageSeconds);

  const eastNow =
    position.east + eastVelocity * effectiveAge / 1000;

  const northNow =
    position.north + northVelocity * effectiveAge / 1000;

  const speedSquared =
    eastVelocity ** 2 + northVelocity ** 2;

  if (speedSquared < 1) {
    return null;
  }

  // The dot product yields seconds to closest approach.
  const etaSeconds = -1000 *
    (eastNow * eastVelocity + northNow * northVelocity) /
    speedSquared;

  const etaMinutes = etaSeconds / 60;

  if (
    etaMinutes <= 0 ||
    etaMinutes > CONFIG.predictionHorizonMinutes
  ) {
    return null;
  }

  const closestEast =
    eastNow + eastVelocity * etaSeconds / 1000;

  const closestNorth =
    northNow + northVelocity * etaSeconds / 1000;

  const closestDistanceMiles =
    Math.hypot(closestEast, closestNorth) * 0.621371;

  if (closestDistanceMiles > settings.radiusMiles) {
    return null;
  }

  const previous = aircraftHistory.get(icao24);
  let headingChangeDegrees = null;

  if (
    previous &&
    timePosition > previous.timePosition &&
    timePosition - previous.timePosition <= 20 * 60
  ) {
    headingChangeDegrees =
      headingDifference(track, previous.track);
  }

  // A recent substantial turn makes long predictions unreliable.
  if (
    headingChangeDegrees !== null &&
    headingChangeDegrees > CONFIG.maxHeadingChangeDegrees &&
    etaMinutes > 5
  ) {
    return null;
  }

  return {
    icao24,
    callsign,
    altitudeM: Number.isFinite(altitudeM)
      ? altitudeM
      : null,
    speedMps,
    track,
    distanceMiles: currentDistanceMiles,
    closestDistanceMiles,
    etaMinutes,
    lastContact,
    timePosition,
    positionAgeSeconds: ageSeconds,
    headingChangeDegrees,
    approachingFrom,
    flyingTowards: getCompassDirection(track)
  };
}

function updateHistory(states, nowSeconds) {
  for (const plane of states) {
    const [
      icao24,
      ,
      ,
      timePosition,
      ,
      lon,
      lat,
      ,
      ,
      ,
      track
    ] = plane;

    if (
      !icao24 ||
      !Number.isFinite(timePosition) ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lon) ||
      !Number.isFinite(track)
    ) {
      continue;
    }

    const previous = aircraftHistory.get(icao24);

    if (
      !previous ||
      timePosition > previous.timePosition
    ) {
      aircraftHistory.set(icao24, {
        timePosition,
        track
      });
    }
  }

  for (const [id, value] of aircraftHistory) {
    if (nowSeconds - value.timePosition > 30 * 60) {
      aircraftHistory.delete(id);
    }
  }
}

function utcDayKey(now = Date.now()) {
  return new Date(now).toISOString().slice(0, 10);
}

function statusResult(message, extras = {}) {
  return {
    plane: null,
    predictions: [],
    checkedAt: Date.now(),
    ...extras,
    ...(message ? { statusMessage: message } : {})
  };
}

async function getRateLimitStatus() {
  const stored = await chrome.storage.local.get(RATE_LIMIT_KEY);

  const until = Number(stored[RATE_LIMIT_KEY]) || 0;

  if (until <= Date.now()) {
    return null;
  }

  return statusResult('OpenSky rate limit active', {
    rateLimited: true,
    rateLimitedUntil: until,
    retryAfterSeconds: Math.ceil(
      (until - Date.now()) / 1000
    )
  });
}

async function saveRateLimit(response) {
  const raw = response.headers.get(
    'X-Rate-Limit-Retry-After-Seconds'
  );

  const parsed = Number(raw);

  const seconds =
    raw !== null &&
    Number.isFinite(parsed) &&
    parsed > 0
      ? Math.ceil(parsed)
      : DEFAULT_RETRY_SECONDS;

  const until = Date.now() + seconds * 1000;

  await chrome.storage.local.set({
    [RATE_LIMIT_KEY]: until
  });

  return statusResult('OpenSky rate limit active', {
    rateLimited: true,
    rateLimitedUntil: until,
    retryAfterSeconds: seconds
  });
}

// Recalculate predictions from recently cached aircraft positions.
async function recalculateCachedPredictions(settings) {
  const now = Date.now();

  const stored = await chrome.storage.local.get([
    AIRCRAFT_CACHE_KEY,
    CACHE_KEY,
    NEXT_FETCH_KEY,
    LAST_FETCH_KEY
  ]);

  const snapshot = stored[AIRCRAFT_CACHE_KEY];
  const fetchedAt = Number(snapshot?.fetchedAt);

  if (
    !snapshot ||
    !Array.isArray(snapshot.states) ||
    !Number.isFinite(fetchedAt) ||
    fetchedAt <= 0 ||
    fetchedAt > now ||
    now - fetchedAt > CONFIG.staleAfterSeconds * 1000
  ) {
    await chrome.storage.local.remove(CACHE_KEY);
    return null;
  }

  const nowSeconds = now / 1000;

  const predictions = snapshot.states
    .map(plane => predictPass(plane, nowSeconds, settings))
    .filter(Boolean)
    .sort((a, b) => a.etaMinutes - b.etaMinutes);

  const previousResult = stored[CACHE_KEY] || {};

  const nextAllowedFetchAt =
    Number(stored[NEXT_FETCH_KEY]) || 0;

  const lastFetchAt =
    Number(stored[LAST_FETCH_KEY]) ||
    (nextAllowedFetchAt > 0
      ? nextAllowedFetchAt - FETCH_INTERVAL_MS
      : 0);

  const result = {
    plane: predictions[0] || null,
    predictions,
    checkedAt: now,
    settings,
    budgetUsed: previousResult.budgetUsed,
    budgetLimit: CONFIG.maxDailyCredits,
    nextAllowedFetchAt,
    manualRefreshAvailableAt:
      getManualRefreshAvailableAt(lastFetchAt),
    cached: true
  };

  await chrome.storage.local.set({
    [CACHE_KEY]: result,
    latestFlightStatus: result
  });

  return result;
}

async function fetchNearbyAircraft(forceRefresh = false) {
  if (activeFetch) {
    return activeFetch;
  }

  activeFetch = (async () => {
    const settings = await getSettings();
    const rateLimit = await getRateLimitStatus();

    if (rateLimit) {
      return rateLimit;
    }

    const now = Date.now();

    const stored = await chrome.storage.local.get([
      CACHE_KEY,
      NEXT_FETCH_KEY,
      BUDGET_KEY,
      LAST_FETCH_KEY
    ]);

    const nextAllowedFetchAt =
      Number(stored[NEXT_FETCH_KEY]) || 0;

    // Allow manual updates once per minute.
    const lastFetchAt =
      Number(stored[LAST_FETCH_KEY]) ||
      (nextAllowedFetchAt > 0
        ? nextAllowedFetchAt - FETCH_INTERVAL_MS
        : 0);

    const manualRefreshAvailableAt =
      getManualRefreshAvailableAt(lastFetchAt);

    const canForceRefresh =
      forceRefresh &&
      now >= manualRefreshAvailableAt;

    const budget =
      stored[BUDGET_KEY]?.day === utcDayKey(now)
        ? stored[BUDGET_KEY]
        : { day: utcDayKey(now), credits: 0 };

    // Reuse cached data unless a manual refresh is allowed.
    if (now < nextAllowedFetchAt && !canForceRefresh) {
      const cached = stored[CACHE_KEY];

      if (
        cached &&
        cached.checkedAt &&
        cached.checkedAt <= now
      ) {
        const elapsedMinutes =
          (now - cached.checkedAt) / 60000;

        const predictions = (cached.predictions || [])
          .map(plane => ({
            ...plane,
            etaMinutes: plane.etaMinutes - elapsedMinutes
          }))
          .filter(plane => plane.etaMinutes > 0);

        return {
          ...cached,
          predictions,
          plane: predictions[0] || null,
          cached: true,
          nextAllowedFetchAt,
          manualRefreshAvailableAt,
          settings
        };
      }

      return statusResult('Next API check is scheduled', {
        cached: true,
        nextAllowedFetchAt,
        manualRefreshAvailableAt,
        settings
      });
    }

    // Dynamically calculate the geographic search area.
    const bounds = getBoundingBox(
      HOME.lat,
      HOME.lon,
      CONFIG.maxDistanceMiles
    );

    const area =
      (bounds.lamax - bounds.lamin) *
      (bounds.lomax - bounds.lomin);

    const requestCredits =
      area <= 25 ? 1 :
      area <= 100 ? 2 :
      area <= 400 ? 3 : 4;

    // Protect the locally allocated daily API budget.
    if (
      budget.credits + requestCredits >
      CONFIG.maxDailyCredits
    ) {
      return statusResult('Local daily API budget reached', {
        budgetLimited: true,
        budgetUsed: budget.credits,
        budgetLimit: CONFIG.maxDailyCredits,
        manualRefreshAvailableAt
      });
    }

    // Reserve a request slot before contacting OpenSky.
    await chrome.storage.local.set({
      [NEXT_FETCH_KEY]: now + FETCH_INTERVAL_MS,
      [LAST_FETCH_KEY]: now,
      [BUDGET_KEY]: {
        day: budget.day,
        credits: budget.credits + requestCredits
      }
    });

    const url = new URL(
      'https://opensky-network.org/api/states/all'
    );

    url.search = new URLSearchParams(bounds).toString();

    const response = await fetch(url, {
      headers: {
        Accept: 'application/json'
      },
      signal: AbortSignal.timeout(15000)
    });

    if (response.status === 429) {
      return await saveRateLimit(response);
    }

    if (!response.ok) {
      throw new Error(`OpenSky HTTP ${response.status}`);
    }

    const data = await response.json();

    if (
      data.states != null &&
      !Array.isArray(data.states)
    ) {
      throw new Error(
        'OpenSky returned an invalid states array'
      );
    }

    const nowSeconds = Date.now() / 1000;
    const states = data.states || [];

    const predictions = states
      .map(plane => predictPass(plane, nowSeconds, settings))
      .filter(Boolean)
      .sort((a, b) => a.etaMinutes - b.etaMinutes);

    updateHistory(states, nowSeconds);

    const result = {
      plane: predictions[0] || null,
      predictions,
      checkedAt: Date.now(),
      settings,
      budgetUsed: budget.credits + requestCredits,
      budgetLimit: CONFIG.maxDailyCredits,
      nextAllowedFetchAt: now + FETCH_INTERVAL_MS,
      manualRefreshAvailableAt:
        getManualRefreshAvailableAt(now)
    };

    // Save aircraft positions for recalculating predictions.
    await chrome.storage.local.set({
      [AIRCRAFT_CACHE_KEY]: {
        states,
        fetchedAt: result.checkedAt
      },
      [CACHE_KEY]: result,
      latestFlightStatus: result
    });

    console.log('Flight Alert:', result);

    return result;
  })();

  try {
    return await activeFetch;
  } finally {
    activeFetch = null;
  }
}

async function sendPassNotification(plane) {
  const now = Date.now();

  const stored =
    await chrome.storage.local.get(ALERTS_KEY);

  const alerts = stored[ALERTS_KEY] || {};

  // Remove expired notification cooldowns.
  for (const [id, timestamp] of Object.entries(alerts)) {
    if (now - timestamp > CONFIG.alertCooldownMs) {
      delete alerts[id];
    }
  }

  if (alerts[plane.icao24]) {
    return;
  }

  const eta = Math.max(
    1,
    Math.ceil(plane.etaMinutes)
  );

  const altitudeText = plane.altitudeM == null
    ? 'Altitude unavailable'
    : `${Math.round(
        plane.altitudeM * 3.28084
      ).toLocaleString()} ft`;

  const message =
    `${plane.callsign} may pass within ` +
    `${plane.closestDistanceMiles.toFixed(1)} miles ` +
    `in about ${eta} min. ` +
    `Altitude: ${altitudeText}.`;

  try {
    await chrome.notifications.create(
      `flight-${plane.icao24}`,
      {
        type: 'basic',
        iconUrl: 'icon.png',
        title: 'Aircraft may pass near your home',
        message,
        priority: 2
      }
    );

    alerts[plane.icao24] = now;

    await chrome.storage.local.set({
      [ALERTS_KEY]: alerts
    });
  } catch (error) {
    console.error('Notification failed:', error);
  }
}

async function checkFlights() {
  const result = await fetchNearbyAircraft();

  if (
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

async function runCheckSafely() {
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

async function ensureAlarm() {
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

chrome.runtime.onInstalled.addListener(() => {
  void ensureAlarm();
  void runCheckSafely();
});

chrome.runtime.onStartup.addListener(() => {
  void ensureAlarm();
  void runCheckSafely();
});

chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === ALARM_NAME) {
    void runCheckSafely();
  }
});

chrome.runtime.onMessage.addListener(
  (request, sender, sendResponse) => {

    // Return the current detection settings.
    if (request.type === 'GET_SETTINGS') {
      getSettings()
        .then(sendResponse)
        .catch(error => {
          sendResponse({ error: error.message });
        });

      return true;
    }

    // Save the radius and recalculate cached predictions.
    if (request.type === 'SAVE_SETTINGS') {
      (async () => {
        const radiusMiles = validateRadius(
          request.settings?.radiusMiles
        );

        if (activeFetch) {
          try {
            await activeFetch;
          } catch (error) {
            console.warn(
              'Previous flight request failed:',
              error
            );
          }
        }

        await chrome.storage.local.set({
          [SETTINGS_KEY]: { radiusMiles }
        });

        const settings = await getSettings();

        await recalculateCachedPredictions(settings);

        sendResponse({
          success: true,
          settings
        });
      })().catch(error => {
        sendResponse({ error: error.message });
      });

      return true;
    }

    if (request.type !== 'GET_FLIGHT') {
      return;
    }

    fetchNearbyAircraft(request.forceRefresh === true)
      .then(sendResponse)
      .catch(error => {
        console.error(
          'Popup aircraft request failed:',
          error
        );

        sendResponse(
          statusResult(null, {
            error:
              error.message ||
              'OpenSky request failed'
          })
        );
      });

    return true;
  }
);

void ensureAlarm();

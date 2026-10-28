
 // Load configuration before starting the background service worker.
importScripts('config.js');

// Restrict local storage access to trusted extension contexts.
chrome.storage.local.setAccessLevel({
  accessLevel: 'TRUSTED_CONTEXTS'
}).catch(error => {
  console.error('Unable to restrict local storage access:', error);
});

const {
  CONFIG, ALARM_NAME, LOCATION_ALARM_NAME, ALERTS_KEY, RATE_LIMIT_KEY,
  CACHE_KEY, AIRCRAFT_CACHE_KEY, NEXT_FETCH_KEY, BUDGET_KEY, SETTINGS_KEY,
  DEFAULT_RETRY_SECONDS, FETCH_INTERVAL_MS, LAST_FETCH_KEY,
  MIN_MANUAL_INTERVAL_MS
} = globalThis.FLIGHT_ALERT_CONFIG;

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

function localCoordinates(lat, lon, home) {
  return {
    north: radians(lat - home.lat) * 6371,
    east: radians(lon - home.lon) * 6371 *
      Math.cos(radians(home.lat))
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

// Validate the user-selected home coordinates.
function validateHome(home) {
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
async function getSettings() {
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
    distanceKm(
      settings.home.lat,
      settings.home.lon,
      lat,
      lon
    ) * 0.621371;

  // Calculate the direction of the aircraft relative to home.
  const position = localCoordinates(lat, lon, settings.home);

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

  // Calculate the approach direction from the estimated current position.
  const bearingFromHome =
    (Math.atan2(eastNow, northNow) * 180 / Math.PI + 360) % 360;

  const approachingFrom = getCompassDirection(bearingFromHome);

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

    // Do not monitor aircraft until the user configures a home location.
    if (!settings.home) {
      return statusResult('Home location setup required', {
        requiresSetup: true,
        settings
      });
    }

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

        // Exclude predictions based on stale aircraft positions.
        let stalePredictionsCount = 0;

        const predictions = (cached.predictions || [])
          .map(plane => ({
            ...plane,
            etaMinutes: plane.etaMinutes - elapsedMinutes
          }))
          .filter(plane => {
            const positionAgeSeconds =
              (now / 1000) - Number(plane.timePosition);

            const isStale =
              !Number.isFinite(positionAgeSeconds) ||
              positionAgeSeconds > CONFIG.staleAfterSeconds;

            if (isStale) {
              stalePredictionsCount++;
            }

            return (
              plane.etaMinutes > 0 &&
              Number.isFinite(positionAgeSeconds) &&
              positionAgeSeconds >= -30 &&
              positionAgeSeconds <= CONFIG.staleAfterSeconds
            );
          });

        return {
          ...cached,
          predictions,
          plane: predictions[0] || null,
          staleData:
            predictions.length === 0 && stalePredictionsCount > 0,
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
      settings.home.lat,
      settings.home.lon,
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

    console.log('Flight Alert: Aircraft data updated successfully.');

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

// Check the new location as soon as the existing API limits allow.
async function scheduleLocationCheck() {
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
  if (
    alarm.name === ALARM_NAME ||
    alarm.name === LOCATION_ALARM_NAME
  ) {
    void runCheckSafely();
  }
});

chrome.runtime.onMessage.addListener(
  (request, sender, sendResponse) => {

    // Accept messages only from this extension.
    if (sender.id !== chrome.runtime.id) {
      return false;
    }

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
        const currentSettings = await getSettings();

        const radiusMiles = request.settings?.radiusMiles == null
          ? currentSettings.radiusMiles
          : validateRadius(request.settings.radiusMiles);

        const home = request.settings?.home == null
          ? currentSettings.home
          : validateHome(request.settings.home);

        if (!home) {
          throw new Error('Please configure your home location first');
        }

        const homeChanged =
          !currentSettings.home ||
          home.lat !== currentSettings.home.lat ||
          home.lon !== currentSettings.home.lon;

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
          [SETTINGS_KEY]: { radiusMiles, home }
        });

        const settings = await getSettings();

        if (homeChanged) {
          // Clear aircraft data belonging to the previous location.
          await chrome.storage.local.remove([
            CACHE_KEY,
            AIRCRAFT_CACHE_KEY,
            'latestFlightStatus',
            ALERTS_KEY
          ]);

          aircraftHistory.clear();
          await scheduleLocationCheck();
        } else {
          await recalculateCachedPredictions(settings);
        }

        sendResponse({
          success: true,
          settings,
          homeChanged
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

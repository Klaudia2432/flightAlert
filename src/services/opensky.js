import '../config.js';
import { getBoundingBoxes, getRequestCredits } from './geography.js';
import { getSettings } from './settings.js';
import { predictPass, updateHistory } from './prediction.js';
import { getRateLimitStatus, saveRateLimit } from './rate-limit.js';
import { utcDayKey, statusResult, getManualRefreshAvailableAt } from './utils.js';

const {
  CONFIG, CACHE_KEY, AIRCRAFT_CACHE_KEY, NEXT_FETCH_KEY,
  BUDGET_KEY, FETCH_INTERVAL_MS, LAST_FETCH_KEY
} = globalThis.FLIGHT_ALERT_CONFIG;

let activeFetch = null;

// Let settings changes wait for a pending request before clearing old location data.
export function getActiveFetch() {
  return activeFetch;
}

// Recalculate predictions from recently cached aircraft positions.
export async function recalculateCachedPredictions(settings) {
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

export async function fetchNearbyAircraft(forceRefresh = false) {
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
    const boundsList = getBoundingBoxes(
      settings.home.lat,
      settings.home.lon,
      CONFIG.maxDistanceMiles
    );

    // Reserve the combined cost before making any OpenSky requests.
    const requestCredits = boundsList.reduce(
      (total, bounds) => total + getRequestCredits(bounds),
      0
    );

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

    const statesByAircraft = new Map();

    // Search each box separately when the area crosses the date line.
    for (const bounds of boundsList) {
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

      for (const plane of data.states || []) {
        const icao24 = plane?.[0];

        if (!icao24) {
          continue;
        }

        const previous = statesByAircraft.get(icao24);

        if (
          !previous ||
          (plane[3] || 0) > (previous[3] || 0)
        ) {
          statesByAircraft.set(icao24, plane);
        }
      }
    }

    const nowSeconds = Date.now() / 1000;
    const states = [...statesByAircraft.values()];

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

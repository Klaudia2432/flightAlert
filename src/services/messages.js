import '../config.js';
import { getSettings, validateRadius, validateHome } from './settings.js';
import { getActiveFetch, recalculateCachedPredictions, fetchNearbyAircraft } from './opensky.js';
import { clearAircraftHistory } from './prediction.js';
import { scheduleLocationCheck } from './scheduler.js';
import { statusResult } from './utils.js';

const { SETTINGS_KEY, CACHE_KEY, AIRCRAFT_CACHE_KEY, ALERTS_KEY } = globalThis.FLIGHT_ALERT_CONFIG;

export function registerMessageHandler() {
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

        const activeFetch = getActiveFetch();
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

          clearAircraftHistory();
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
}

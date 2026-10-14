const HOME = {
  lat: 55.7776,
  lon: -4.0536
};

const CONFIG = {
  radiusMiles: 10,
  maxDistanceMiles: 20,
  predictionHorizonMinutes: 30,
  alertMinMinutes: 10,
  alertMaxMinutes: 20,
  pollMinutes: 1,
  staleAfterSeconds: 120,
  alertCooldownMs: 45 * 60 * 1000,
  highAltitudeThresholdFt: 30000
};

const ALARM_NAME = "flight-alert-check";
const ALERTS_KEY = "notifiedAircraft";

let activeFetch = null;


const aircraftHistory = new Map();

function recordAircraftMovement(plane) {
  const icao24 = plane[0];
  const lat = plane[6];
  const lon = plane[5];
  const lastContact = plane[4];

  if (
    !icao24 ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lon)
  ) {
    return null;
  }

  const previous = aircraftHistory.get(icao24);

  console.log("Movement history:", {
    callsign: plane[1]?.trim() || icao24,
    previous,
    currentLastContact: lastContact
  });

  const current = {
    lat,
    lon,
    lastContact,
    distanceMiles:
      distanceKm(HOME.lat, HOME.lon, lat, lon) * 0.621371
  };

  aircraftHistory.set(icao24, current);

  if (
    !previous ||
    !Number.isFinite(previous.lastContact) ||
    !Number.isFinite(lastContact) ||
    lastContact <= previous.lastContact
  ) {
    return null;
  }

  const elapsedSeconds = lastContact - previous.lastContact;

  if (elapsedSeconds < 5 || elapsedSeconds > 180) {
    return null;
  }

  const distanceChangeMiles =
    current.distanceMiles - previous.distanceMiles;

  return {
    distanceChangeMiles,
    gettingCloser: distanceChangeMiles < -0.05,
    movingAway: distanceChangeMiles > 0.05
  };
}


function radians(degrees) {
  return degrees * Math.PI / 180;
}

function distanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = radians(lat2 - lat1);
  const dLon = radians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(radians(lat1)) *
      Math.cos(radians(lat2)) *
      Math.sin(dLon / 2) ** 2;

  return 2 * R * Math.atan2(
    Math.sqrt(a),
    Math.sqrt(Math.max(0, 1 - a))
  );
}

function predictPass(plane) {
  // OpenSky state vector:
  // [0] ICAO24
  // [1] Callsign
  // [4] Last contact (Unix seconds)
  // [5] Longitude
  // [6] Latitude
  // [7] Barometric altitude (metres)
  // [8] On ground
  // [9] Velocity (metres/second)
  // [10] True track (degrees)

  const lon = plane[5];
  const lat = plane[6];
  const altitude = plane[7];
  const onGround = plane[8];
  const velocity = plane[9];
  const track = plane[10];
  const lastContact = plane[4];

  const callsign = plane[1]?.trim() || plane[0] || "Unknown";

  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lon)
  ) {
    console.log("Skipping aircraft without position:", callsign);
    return null;
  }

  const currentDistanceKm = distanceKm(
    HOME.lat,
    HOME.lon,
    lat,
    lon
  );

  const currentDistanceMiles = currentDistanceKm * 0.621371;
  const movement = recordAircraftMovement(plane);

  // Log aircraft within the search radius before other filters.
  if (currentDistanceMiles <= CONFIG.maxDistanceMiles) {
    console.log("Aircraft candidate:", {
      callsign,
      distanceMiles: currentDistanceMiles.toFixed(1),
      track,
      speedMps: velocity,
      altitudeM: altitude
    });
  }

  if (currentDistanceMiles > CONFIG.maxDistanceMiles) {
    return null;
  }

  if (onGround === true) {
    console.log("Skipping aircraft on ground:", callsign);
    return null;
  }

  if (
    !Number.isFinite(velocity) ||
    velocity <= 0 ||
    !Number.isFinite(track)
  ) {
    console.log("Skipping aircraft without usable speed/track:", callsign);
    return null;
  }

  if (Number.isFinite(lastContact)) {
    const ageSeconds = Date.now() / 1000 - lastContact;

    if (
      ageSeconds < -30 ||
      ageSeconds > CONFIG.staleAfterSeconds
    ) {
      console.log("Skipping stale aircraft:", callsign, ageSeconds);
      return null;
    }
  }

  // Local east/north coordinates relative to home, in kilometres.
  const northKm = radians(lat - HOME.lat) * 6371;

  const eastKm =
    radians(lon - HOME.lon) *
    6371 *
    Math.cos(radians(HOME.lat));

  // Project ground velocity using track.
  const speedKmh = velocity * 3.6;
  const heading = radians(track);

  const eastVelocity = speedKmh * Math.sin(heading);
  const northVelocity = speedKmh * Math.cos(heading);

  const speedSquared =
    eastVelocity ** 2 + northVelocity ** 2;

  if (speedSquared < 1) {
    return null;
  }

  // Time of closest approach in hours.
  const timeHours = -(
    eastKm * eastVelocity +
    northKm * northVelocity
  ) / speedSquared;

  const etaMinutes = timeHours * 60;

  if (
    etaMinutes < 0 ||
    etaMinutes > CONFIG.predictionHorizonMinutes
  ) {
    console.log("No future pass in prediction window:", {
      callsign,
      etaMinutes: etaMinutes.toFixed(1)
    });
    return null;
  }

  const closestEast = eastKm + eastVelocity * timeHours;
  const closestNorth = northKm + northVelocity * timeHours;

  const closestDistanceKm = Math.hypot(
    closestEast,
    closestNorth
  );

  const closestDistanceMiles = closestDistanceKm * 0.621371;

  if (closestDistanceMiles > CONFIG.radiusMiles) {
    console.log("Projected path misses home radius:", {
      callsign,
      closestDistanceMiles: closestDistanceMiles.toFixed(2),
      etaMinutes: etaMinutes.toFixed(1)
    });
    return null;
  }


  const prediction = {
   icao24: plane[0],
   callsign,
   altitudeM: Number.isFinite(altitude) ? altitude : null,
   speedMps: velocity,
   track,
   distanceMiles: currentDistanceMiles,
   closestDistanceMiles,
   etaMinutes,
   lastContact,
   movement
  };

  console.log("Aircraft movement:", callsign, movement);
  console.log("PREDICTED PASS:", prediction);

  return prediction;
}

async function fetchNearbyAircraft() {
  if (activeFetch) {
    return activeFetch;
  }

  activeFetch = (async () => {
    const url = new URL(
      "https://opensky-network.org/api/states/all"
    );

    url.search = new URLSearchParams({
      lamin: "55.3",
      lomin: "-4.8",
      lamax: "56.2",
      lomax: "-3.2"
    }).toString();

    const response = await fetch(url, {
      headers: {
        Accept: "application/json"
      },
      signal: AbortSignal.timeout(15000)
    });

    if (!response.ok) {
      throw new Error(`OpenSky HTTP ${response.status}`);
    }

    const data = await response.json();

    if (data.states == null) {
      console.log("OpenSky returned no aircraft states.");

      return {
        plane: null,
        predictions: [],
        checkedAt: Date.now()
      };
    }

    if (!Array.isArray(data.states)) {
      throw new Error("OpenSky returned an invalid states array.");
    }

    console.log("Aircraft returned by OpenSky:", data.states.length);

    const predictions = data.states
      .map(predictPass)
      .filter(Boolean)
      .sort((a, b) => a.etaMinutes - b.etaMinutes);

    console.log("Predicted passes:", predictions);

    return {
      plane: predictions[0] || null,
      predictions,
      checkedAt: Date.now()
    };
  })();

  try {
    return await activeFetch;
  } finally {
    activeFetch = null;
  }
}


async function sendPassNotification(plane) {
  const now = Date.now();

  const stored = await chrome.storage.local.get(ALERTS_KEY);
  const alerts = stored[ALERTS_KEY] || {};

  // Remove expired cooldown entries.
  for (const [id, timestamp] of Object.entries(alerts)) {
    if (now - timestamp > CONFIG.alertCooldownMs) {
      delete alerts[id];
    }
  }

  // Avoid repeatedly alerting for the same aircraft.
  if (alerts[plane.icao24]) {
    await chrome.storage.local.set({
      [ALERTS_KEY]: alerts
    });
    console.log("Alert skipped: cooldown active", plane.callsign);
    return;
  }

  const altitudeFt = plane.altitudeM == null
    ? null
    : Math.round(plane.altitudeM * 3.28084);

  const title = "Aircraft may pass near your home";

  const eta = Math.max(1, Math.ceil(plane.etaMinutes));

  const distance = Number(plane.closestDistanceMiles);
  const distanceText = Number.isFinite(distance)
    ? `${distance.toFixed(1)} miles`
    : `${CONFIG.radiusMiles} miles`;

  const altitudeText = altitudeFt === null
    ? "Altitude unavailable"
    : `${altitudeFt.toLocaleString()} ft`;

  const callsign = plane.callsign || "Unknown aircraft";

  const message =
    `${callsign} may pass within ${distanceText} in about ` +
    `${eta} min. Altitude: ${altitudeText}.`;

  try {
    await chrome.notifications.create(
      `flight-${plane.icao24}`,
      {
        type: "basic",
        iconUrl: "icon.png",
        title,
        message,
        priority: 2
      }
    );

    // Start the cooldown after the notification succeeds.
    alerts[plane.icao24] = now;
    await chrome.storage.local.set({
      [ALERTS_KEY]: alerts
    });

    console.log("Notification sent for:", callsign, title);
  } catch (error) {
    console.error("Notification failed:", callsign, error);
  }
}


async function checkFlights() {
  const result = await fetchNearbyAircraft();

  for (const plane of result.predictions) {
    const eta = Number(plane.etaMinutes);

    if (!Number.isFinite(eta)) {
      console.log("Skipping aircraft: invalid ETA", plane.callsign);
      continue;
    }

    if (
      eta <= CONFIG.alertMaxMinutes &&
      eta > 0
    ) {
      console.log(
        "Aircraft is within alert horizon:",
        plane.callsign,
        "ETA:",
        eta
      );

      await sendPassNotification(plane);
    } else {
      console.log(
        "No notification yet:",
        plane.callsign,
        "ETA:",
        eta
      );
    }
  }
}


async function runCheckSafely() {
  try {
    await checkFlights();
  } catch (error) {
    console.error("Flight Alert check failed:", error);

    await chrome.storage.local.set({
      latestFlightStatus: {
        plane: null,
        checkedAt: Date.now(),
        error: error.message || "Unknown API error"
      }
    });
  }
}

async function ensureAlarm() {
  const alarm = await chrome.alarms.get(ALARM_NAME);

  if (!alarm) {
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

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) {
    void runCheckSafely();
  }
});

chrome.runtime.onMessage.addListener(
  (request, sender, sendResponse) => {
    if (request.type === "GET_FLIGHT") {
      fetchNearbyAircraft()
        .then(async (result) => {
          await chrome.storage.local.set({
            latestFlightStatus: {
              plane: result.plane,
              checkedAt: result.checkedAt,
              error: null
            }
          });

          sendResponse(result);
        })
        .catch((error) => {
          console.error("Popup aircraft request failed:", error);

          sendResponse({
            plane: null,
            predictions: [],
            checkedAt: Date.now(),
            error: error.message || "OpenSky request failed"
          });
        });

      return true;
    }
  }
);

void ensureAlarm();

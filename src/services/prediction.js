import '../config.js';
import { radians, distanceKm, localCoordinates, headingDifference, getCompassDirection } from './geography.js';

const { CONFIG } = globalThis.FLIGHT_ALERT_CONFIG;
const aircraftHistory = new Map();

export function predictPass(plane, nowSeconds, settings) {
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

export function updateHistory(states, nowSeconds) {
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

// Clear heading history when the configured home location changes.
export function clearAircraftHistory() {
  aircraftHistory.clear();
}

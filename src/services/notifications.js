import '../config.js';

const { CONFIG, ALERTS_KEY } = globalThis.FLIGHT_ALERT_CONFIG;

// Send a desktop notification when an aircraft is predicted to pass nearby.
export async function sendPassNotification(plane) {
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

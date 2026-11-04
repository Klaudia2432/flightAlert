import { elements } from "./elements.js";
import { state } from "./state.js";
import { formatTime } from "./utils.js";
import {
  clearRateLimitTimer,
  clearPositionAgeTimer,
  clearManualRefreshTimer,
  startPositionAgeTimer,
  startManualRefreshTimer,
  displayRateLimit,
  displayBudgetLimit
} from "./timers.js";

const { CONFIG } = globalThis.FLIGHT_ALERT_CONFIG;

function addMetric(label, value) {
  const row = document.createElement("div");
  row.className = "metric";

  const labelElement = document.createElement("span");
  labelElement.textContent = label;

  const valueElement = document.createElement("span");
  valueElement.className = "value";
  valueElement.textContent = value;

  row.append(labelElement, valueElement);
  elements.aircraft.details.appendChild(row);
}

export function render(data) {
  clearRateLimitTimer();
  clearPositionAgeTimer();
  clearManualRefreshTimer();

  elements.aircraft.details.replaceChildren();
  elements.aircraft.error.textContent = "";
  elements.aircraft.statusDescription.textContent = "";

  state.refresh.blockedByRateLimit = false;
  state.refresh.blockedByBudget = false;

  elements.aircraft.refreshButton.disabled = false;
  elements.aircraft.refreshButton.textContent = "Check for aircraft";

  // Show first-run setup until a home location has been saved.
  if (data?.requiresSetup) {
    elements.aircraft.header.textContent = "Set up your home location";
    elements.aircraft.statusDescription.textContent =
      "Open Settings to detect your current location or " +
      "enter coordinates manually to start monitoring aircraft.";
    elements.aircraft.updated.textContent =
      "Flight monitoring has not started yet.";
    elements.aircraft.refreshButton.disabled = true;
    elements.aircraft.refreshButton.textContent = "Set home location first";
    return;
  }

  // Handle API and connection errors.
  if (!data || data.error) {
    elements.aircraft.header.textContent =
      "Flight data temporarily unavailable";

    elements.aircraft.statusDescription.textContent =
      "Unable to retrieve aircraft information from OpenSky. " +
      "Your settings are safe, and Flight Alert will try again " +
      "during the next scheduled check.";

    elements.aircraft.updated.textContent =
      "Check your internet connection or try again later.";

    if (data?.error) {
      console.error("Flight Alert:", data.error);
    }

    startManualRefreshTimer(state.refresh.manualAvailableAt);
    return;
  }

  state.refresh.manualAvailableAt =
    Number(data.manualRefreshAvailableAt) ||
    state.refresh.manualAvailableAt;

  // Handle OpenSky HTTP 429 rate limit.
  if (data.rateLimited) {
    const retryAfterSeconds =
      Number(data.retryAfterSeconds) || 0;

    const rateLimitedUntil =
      Number(data.rateLimitedUntil) ||
      Date.now() + retryAfterSeconds * 1000;

    displayRateLimit(rateLimitedUntil);
    return;
  }

  // Handle locally allocated daily API budget.
  if (data.budgetLimited) {
    displayBudgetLimit(data);
    return;
  }

  startManualRefreshTimer(state.refresh.manualAvailableAt);

  if (data.statusMessage) {
    elements.aircraft.header.textContent = "Waiting for flight updates";

    elements.aircraft.statusDescription.textContent =
      "Flight Alert will check for nearby aircraft automatically.";

    const manualRefreshSeconds =
      CONFIG.manualRefreshIntervalMs / 1000;

    elements.aircraft.updated.textContent = data.nextAllowedFetchAt
      ? `Next automatic update available around ${
          formatTime(data.nextAllowedFetchAt)
        }. Click 'Check for aircraft' to refresh faster. ` +
        `Manual refresh is available every ${
          manualRefreshSeconds
        } seconds.`
      : "Waiting for new flight information.";

    return;
  }

  // Handle outdated aircraft positions.
  if (data.staleData) {
    elements.aircraft.header.textContent =
      "Waiting for fresh aircraft data";

    elements.aircraft.statusDescription.textContent =
      "Previously detected aircraft positions are outdated. " +
      "Flight Alert will automatically check for new aircraft data.";

    elements.aircraft.updated.textContent = data.nextAllowedFetchAt
      ? `Next automatic update around ${
          formatTime(data.nextAllowedFetchAt)
        }.`
      : "Waiting for fresh flight information.";

    return;
  }

  // Handle no predicted aircraft.
  if (!data.plane) {
    elements.aircraft.header.textContent = "No aircraft approaching";

    const radius = data.settings?.radiusMiles ??
      Number(elements.settings.radiusSlider.value);

    elements.aircraft.statusDescription.textContent =
      `No aircraft is currently predicted to fly within ` +
      `${radius} ${radius === 1 ? "mile" : "miles"} ` +
      `of your home. Monitoring continues automatically.`;

    if (data.checkedAt) {
      elements.aircraft.updated.textContent =
        `Last checked at ${formatTime(data.checkedAt)}`;
    } else {
      elements.aircraft.updated.textContent =
        "Waiting for flight information.";
    }

    return;
  }

  const plane = data.plane;

  elements.aircraft.header.textContent =
    plane.callsign || "Unknown aircraft";

  elements.aircraft.statusDescription.textContent =
    "Aircraft predicted to pass near your home.";

  const eta = Number(plane.etaMinutes);
  const distance = Number(plane.distanceMiles);
  const closestDistance = Number(plane.closestDistanceMiles);
  const speed = Number(plane.speedMps);
  const track = Number(plane.track);

  const altitude =
    plane.altitudeM == null
      ? NaN
      : Number(plane.altitudeM);

  // Estimated time until closest approach.
  addMetric(
    "Estimated closest approach",
    Number.isFinite(eta)
      ? `${Math.ceil(eta)} min`
      : "Unavailable"
  );

  // Current aircraft distance.
  addMetric(
    "Last known distance",
    Number.isFinite(distance)
      ? `${distance.toFixed(1)} mi`
      : "Unavailable"
  );

  // Predicted closest distance.
  addMetric(
    "Predicted closest distance",
    Number.isFinite(closestDistance)
      ? `${closestDistance.toFixed(2)} mi`
      : "Unavailable"
  );

  // Altitude (metres to feet).
  addMetric(
    "Altitude",
    Number.isFinite(altitude)
      ? `${Math.round(
          altitude * 3.28084
        ).toLocaleString()} ft`
      : "Unavailable"
  );

  // Ground speed (metres/second to knots).
  addMetric(
    "Ground speed",
    Number.isFinite(speed)
      ? `${Math.round(speed * 1.94384)} kts`
      : "Unavailable"
  );

  // True track.
  addMetric(
    "Track",
    Number.isFinite(track)
      ? `${Math.round(track)}°`
      : "Unavailable"
  );

  // Aircraft direction relative to home.
  addMetric(
    "Approaching from",
    plane.approachingFrom || "Unavailable"
  );

  // Aircraft direction of travel.
  addMetric(
    "Flying towards",
    plane.flyingTowards || "Unavailable"
  );

  // Position age from OpenSky.
  if (plane.positionAgeSeconds != null) {
    const positionAge = Number(plane.positionAgeSeconds);

    if (Number.isFinite(positionAge)) {
      addMetric("Last Position Update", "Calculating...");

      const metricValue = elements.aircraft.details.lastElementChild
        .querySelector(".value");

      metricValue.id = "position-age-value";

      startPositionAgeTimer(plane, data.checkedAt);
    }
  }

  // Aircraft heading change.
  if (plane.headingChangeDegrees != null) {
    const headingChange = Number(plane.headingChangeDegrees);

    if (Number.isFinite(headingChange)) {
      addMetric(
        "Heading change",
        `${headingChange.toFixed(1)}°`
      );
    }
  }

  const checkedAt = Number(data.checkedAt);

  elements.aircraft.updated.textContent =
    Number.isFinite(checkedAt) && checkedAt > 0
      ? `Last updated at ${formatTime(checkedAt)}`
      : "Flight information available";

  if (data.cached) {
    elements.aircraft.updated.textContent +=
      " · Previously received data";
  }
}

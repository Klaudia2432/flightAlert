import { elements } from "./elements.js";
import { state } from "./state.js";
import { formatCountdown } from "./utils.js";

const { CONFIG } = globalThis.FLIGHT_ALERT_CONFIG;

export function clearPositionAgeTimer() {
  if (state.timers.positionAge !== null) {
    clearInterval(state.timers.positionAge);
    state.timers.positionAge = null;
  }
}

export function startPositionAgeTimer(plane, checkedAt) {
  clearPositionAgeTimer();

  const initialAge = Number(plane.positionAgeSeconds);
  const timestamp = Number(checkedAt);

  if (
    plane.positionAgeSeconds == null ||
    !Number.isFinite(initialAge) ||
    !Number.isFinite(timestamp) ||
    timestamp <= 0
  ) {
    return;
  }

  const positionUpdatedAt =
    timestamp - Math.max(0, initialAge) * 1000;

  const valueElement = document.getElementById(
    "position-age-value"
  );

  if (!valueElement) {
    return;
  }

  function updateAge() {
    const seconds = Math.max(
      0,
      Math.floor((Date.now() - positionUpdatedAt) / 1000)
    );

    if (seconds < 60) {
      valueElement.textContent = `${seconds} sec ago`;
    } else {
      const minutes = Math.floor(seconds / 60);
      valueElement.textContent = `${minutes} min ago`;
    }

    // Hide aircraft predictions when position data becomes stale.
    if (seconds > CONFIG.staleAfterSeconds) {
      clearPositionAgeTimer();

      elements.aircraft.header.textContent = "Waiting for fresh aircraft data";

      elements.aircraft.statusDescription.textContent =
        "Previously detected aircraft positions are outdated. " +
        "Flight Alert will check again automatically.";

      elements.aircraft.details.replaceChildren();

      elements.aircraft.updated.textContent =
        "Aircraft position is outdated. Waiting for fresh data.";

      return;
    }
  }

  updateAge();

  if (
    Date.now() - positionUpdatedAt <=
    CONFIG.staleAfterSeconds * 1000
  ) {
    state.timers.positionAge = setInterval(updateAge, 1000);
  }
}

export function clearRateLimitTimer() {
  if (state.timers.rateLimit !== null) {
    clearInterval(state.timers.rateLimit);
    state.timers.rateLimit = null;
  }
}

export function clearManualRefreshTimer() {
  if (state.timers.manualRefresh !== null) {
    clearInterval(state.timers.manualRefresh);
    state.timers.manualRefresh = null;
  }
}

// Show the remaining manual refresh cooldown.
export function startManualRefreshTimer(availableAt) {
  clearManualRefreshTimer();

  state.refresh.manualAvailableAt = Number(availableAt) || 0;

  function updateCountdown() {
    if (
      state.refresh.inProgress ||
      state.refresh.blockedByRateLimit ||
      state.refresh.blockedByBudget
    ) {
      return;
    }

    const remainingSeconds = Math.max(
      0,
      Math.ceil(
        (state.refresh.manualAvailableAt - Date.now()) / 1000
      )
    );

    if (remainingSeconds === 0) {
      clearManualRefreshTimer();

      elements.aircraft.refreshButton.disabled = false;
      elements.aircraft.refreshButton.textContent = "Check for aircraft";
      return;
    }

    elements.aircraft.refreshButton.disabled = true;
    elements.aircraft.refreshButton.textContent =
      `Refresh in ${formatCountdown(remainingSeconds)}`;
  }

  updateCountdown();

  if (state.refresh.manualAvailableAt > Date.now()) {
    state.timers.manualRefresh = setInterval(updateCountdown, 1000);
  }
}

export function displayRateLimit(rateLimitedUntil) {
  clearRateLimitTimer();
  clearManualRefreshTimer();

  state.refresh.blockedByRateLimit = true;

  elements.aircraft.header.textContent = "Flight updates temporarily paused";
  elements.aircraft.statusDescription.textContent =
    "Flight information is temporarily unavailable.";
  elements.aircraft.details.replaceChildren();

  function updateCountdown() {
    const remainingSeconds = Math.max(
      0,
      Math.ceil((rateLimitedUntil - Date.now()) / 1000)
    );

    if (remainingSeconds === 0) {
      clearRateLimitTimer();

      state.refresh.blockedByRateLimit = false;

      elements.aircraft.header.textContent = "Ready to check flights";
      elements.aircraft.statusDescription.textContent =
        "Flight updates are available again.";

      elements.aircraft.updated.textContent =
        "You can check for nearby aircraft now.";

      startManualRefreshTimer(state.refresh.manualAvailableAt);
      return;
    }

    const countdown = formatCountdown(remainingSeconds);

    elements.aircraft.updated.textContent =
      `Updates available again in ${countdown}.`;

    elements.aircraft.refreshButton.disabled = true;
    elements.aircraft.refreshButton.textContent = `Try again in ${countdown}`;
  }

  updateCountdown();

  if (rateLimitedUntil > Date.now()) {
    state.timers.rateLimit = setInterval(updateCountdown, 1000);
  }
}

export function displayBudgetLimit(data) {
  clearManualRefreshTimer();

  state.refresh.blockedByBudget = true;

  elements.aircraft.header.textContent = "Flight updates unavailable for now";

  elements.aircraft.statusDescription.textContent =
    "We've reached today's flight data allowance.";

  elements.aircraft.updated.textContent =
    "Flight monitoring will resume after the daily allowance resets.";

  elements.aircraft.refreshButton.disabled = true;
  elements.aircraft.refreshButton.textContent = "Updates temporarily unavailable";
}

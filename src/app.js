const { CONFIG } = globalThis.FLIGHT_ALERT_CONFIG;

const header = document.getElementById("page-header");
const details = document.getElementById("details");
const errorElement = document.getElementById("error");
const updated = document.getElementById("updated");
const refreshButton = document.getElementById("refresh");
const statusDescription = document.getElementById("status-description");

const radiusSlider = document.getElementById("detection-radius");
const radiusValue = document.getElementById("radius-value");
const settingsStatus = document.getElementById("settings-status");

const homeLatitude = document.getElementById("home-latitude");
const homeLongitude = document.getElementById("home-longitude");
const saveHomeButton = document.getElementById("save-home");

let rateLimitTimer = null;
let positionAgeTimer = null;
let manualRefreshTimer = null;
let settingsSaving = false;
let isRefreshing = false;
let manualRefreshAvailableAt = 0;
let refreshBlockedByRateLimit = false;
let refreshBlockedByBudget = false;

function clearPositionAgeTimer() {
  if (positionAgeTimer !== null) {
    clearInterval(positionAgeTimer);
    positionAgeTimer = null;
  }
}

function startPositionAgeTimer(plane, checkedAt) {
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

      header.textContent = "Waiting for fresh aircraft data";

      statusDescription.textContent =
        "Previously detected aircraft positions are outdated. " +
        "Flight Alert will check again automatically.";

      details.replaceChildren();

      updated.textContent =
        "Aircraft position is outdated. Waiting for fresh data.";

      return;
    }
  }

  updateAge();

  if (
    Date.now() - positionUpdatedAt <=
    CONFIG.staleAfterSeconds * 1000
  ) {
      positionAgeTimer = setInterval(updateAge, 1000);
    }
}

function addMetric(label, value) {
  const row = document.createElement("div");
  row.className = "metric";

  const labelElement = document.createElement("span");
  labelElement.textContent = label;

  const valueElement = document.createElement("span");
  valueElement.className = "value";
  valueElement.textContent = value;

  row.append(labelElement, valueElement);
  details.appendChild(row);
}

function clearRateLimitTimer() {
  if (rateLimitTimer !== null) {
    clearInterval(rateLimitTimer);
    rateLimitTimer = null;
  }
}

function clearManualRefreshTimer() {
  if (manualRefreshTimer !== null) {
    clearInterval(manualRefreshTimer);
    manualRefreshTimer = null;
  }
}

// Show the remaining manual refresh cooldown.
function startManualRefreshTimer(availableAt) {
  clearManualRefreshTimer();

  manualRefreshAvailableAt = Number(availableAt) || 0;

  function updateCountdown() {
    if (
      isRefreshing ||
      refreshBlockedByRateLimit ||
      refreshBlockedByBudget
    ) {
      return;
    }

    const remainingSeconds = Math.max(
      0,
      Math.ceil(
        (manualRefreshAvailableAt - Date.now()) / 1000
      )
    );

    if (remainingSeconds === 0) {
      clearManualRefreshTimer();

      refreshButton.disabled = false;
      refreshButton.textContent = "Check for aircraft";
      return;
    }

    refreshButton.disabled = true;
    refreshButton.textContent =
      `Refresh in ${formatCountdown(remainingSeconds)}`;
  }

  updateCountdown();

  if (manualRefreshAvailableAt > Date.now()) {
    manualRefreshTimer = setInterval(updateCountdown, 1000);
  }
}

function formatCountdown(totalSeconds) {
  const seconds = Math.max(0, Math.ceil(totalSeconds));

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  if (hours > 0) {
    return (
      `${hours}:${String(minutes).padStart(2, "0")}:` +
      `${String(remainingSeconds).padStart(2, "0")}`
    );
  }

  return (
    `${minutes}:${String(remainingSeconds).padStart(2, "0")}`
  );
}

function formatTime(timestamp) {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function displayRateLimit(rateLimitedUntil) {
  clearRateLimitTimer();
  clearManualRefreshTimer();

  refreshBlockedByRateLimit = true;

  header.textContent = "Flight updates temporarily paused";
  statusDescription.textContent =
    "Flight information is temporarily unavailable.";
  details.replaceChildren();

  function updateCountdown() {
    const remainingSeconds = Math.max(
      0,
      Math.ceil((rateLimitedUntil - Date.now()) / 1000)
    );

    if (remainingSeconds === 0) {
      clearRateLimitTimer();

      refreshBlockedByRateLimit = false;

      header.textContent = "Ready to check flights";
      statusDescription.textContent =
        "Flight updates are available again.";

      updated.textContent =
        "You can check for nearby aircraft now.";

      startManualRefreshTimer(manualRefreshAvailableAt);
      return;
    }

    const countdown = formatCountdown(remainingSeconds);

    updated.textContent =
      `Updates available again in ${countdown}.`;

    refreshButton.disabled = true;
    refreshButton.textContent = `Try again in ${countdown}`;
  }

  updateCountdown();

  if (rateLimitedUntil > Date.now()) {
    rateLimitTimer = setInterval(updateCountdown, 1000);
  }
}

function displayBudgetLimit(data) {
  clearManualRefreshTimer();

  refreshBlockedByBudget = true;

  header.textContent = "Flight updates unavailable for now";

  statusDescription.textContent =
    "We've reached today's flight data allowance.";

  updated.textContent =
    "Flight monitoring will resume after the daily allowance resets.";

  refreshButton.disabled = true;
  refreshButton.textContent = "Updates temporarily unavailable";
}

function render(data) {
  clearRateLimitTimer();
  clearPositionAgeTimer();
  clearManualRefreshTimer();

  details.replaceChildren();
  errorElement.textContent = "";
  statusDescription.textContent = "";

  refreshBlockedByRateLimit = false;
  refreshBlockedByBudget = false;

  refreshButton.disabled = false;
  refreshButton.textContent = "Check for aircraft";

  // Show first-run setup until a home location has been saved.
  if (data?.requiresSetup) {
    header.textContent = "Set your home location to get started";
    statusDescription.textContent =
      "Enter your latitude and longitude below, then click Save location.";
    updated.textContent = "Flight monitoring has not started yet.";
    refreshButton.disabled = true;
    refreshButton.textContent = "Set home location first";
    return;
  }

  // Handle API and connection errors.
  if (!data || data.error) {
    header.textContent = "Unable to check flights";

    statusDescription.textContent =
      "Something went wrong while checking for nearby aircraft.";

    updated.textContent =
      "Please try again later.";

    if (data?.error) {
      console.error("Flight Alert:", data.error);
    }

    startManualRefreshTimer(manualRefreshAvailableAt);
    return;
  }

  manualRefreshAvailableAt =
    Number(data.manualRefreshAvailableAt) ||
    manualRefreshAvailableAt;

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

  startManualRefreshTimer(manualRefreshAvailableAt);

  if (data.statusMessage) {
  header.textContent = "Waiting for flight updates";

  statusDescription.textContent =
    "Flight Alert will check for nearby aircraft automatically.";

  const manualRefreshSeconds =
    CONFIG.manualRefreshIntervalMs / 1000;

  updated.textContent = data.nextAllowedFetchAt
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
    header.textContent = "Waiting for fresh aircraft data";

    statusDescription.textContent =
      "Previously detected aircraft positions are outdated. " +
      "Flight Alert will check again automatically.";

    updated.textContent = data.nextAllowedFetchAt
      ? `Next automatic update around ${
          formatTime(data.nextAllowedFetchAt)
        }.`
      : "Waiting for fresh flight information.";

    return;
  }

  // Handle no predicted aircraft.
  if (!data.plane) {
    header.textContent = "No aircraft approaching";

    const radius = data.settings?.radiusMiles ??
      Number(radiusSlider.value);

    statusDescription.textContent =
      `No aircraft is currently predicted to fly within ` +
      `${radius} ${radius === 1 ? "mile" : "miles"} ` +
      `of your home.`;

    if (data.checkedAt) {
      updated.textContent =
        `Last updated at ${formatTime(data.checkedAt)}`;
    } else {
      updated.textContent = "Waiting for flight information.";
    }

    return;
  }

  const plane = data.plane;

  header.textContent =
    plane.callsign || "Unknown aircraft";

  statusDescription.textContent =
    "Aircraft predicted to pass near your home.";

  const eta = Number(plane.etaMinutes);
  const distance = Number(plane.distanceMiles);

  const closestDistance =
    Number(plane.closestDistanceMiles);

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
    const positionAge = Number(
      plane.positionAgeSeconds
    );

    if (Number.isFinite(positionAge)) {
      addMetric("Last Position Update", "Calculating...");

      const metricValue = details.lastElementChild
        .querySelector(".value");

      metricValue.id = "position-age-value";

      startPositionAgeTimer(plane, data.checkedAt);
    }
  }

  // Aircraft heading change.
  if (plane.headingChangeDegrees != null) {
    const headingChange =
      Number(plane.headingChangeDegrees);

    if (Number.isFinite(headingChange)) {
      addMetric(
        "Heading change",
        `${headingChange.toFixed(1)}°`
      );
    }
  }

  const checkedAt = Number(data.checkedAt);

  updated.textContent =
    Number.isFinite(checkedAt) && checkedAt > 0
      ? `Last updated at ${formatTime(checkedAt)}`
      : "Flight information available";

  if (data.cached) {
    updated.textContent += " · Previously received data";
  }
}

// Update the displayed detection radius.
function updateRadiusLabel(radius) {
  const value = Number(radius);

  radiusValue.textContent =
    `${value} ${value === 1 ? "mile" : "miles"}`;
}

// Load the previously saved detection settings.
function loadSettings() {
  chrome.runtime.sendMessage(
    { type: "GET_SETTINGS" },
    (response) => {
      const runtimeError = chrome.runtime.lastError;

      if (runtimeError || response?.error || !response) {
        settingsStatus.textContent =
          "Unable to load your preferences.";
        return;
      }

      if (settingsSaving) {
        return;
      }

      const settings = response.settings || response;

      radiusSlider.value = settings.radiusMiles;
      updateRadiusLabel(settings.radiusMiles);

      if (settings.home) {
        homeLatitude.value = settings.home.lat;
        homeLongitude.value = settings.home.lon;
      } else {
        homeLatitude.value = "";
        homeLongitude.value = "";
        render({ requiresSetup: true });
      }
    }
  );
}

// Save the detection radius when the slider changes.
function saveSettings() {
  if (settingsSaving) {
    return;
  }

  const radiusMiles = Number(radiusSlider.value);

  settingsSaving = true;
  radiusSlider.disabled = true;
  settingsStatus.textContent = "Saving your preference...";

  chrome.runtime.sendMessage(
    {
      type: "SAVE_SETTINGS",
      settings: { radiusMiles }
    },
    (response) => {
      const runtimeError = chrome.runtime.lastError;

      settingsSaving = false;
      radiusSlider.disabled = false;

      if (runtimeError || !response?.success) {
        settingsStatus.textContent =
          "Unable to save your preference.";

        console.error(
          "Unable to save settings:",
          runtimeError?.message || response?.error
        );

        loadSettings();
        return;
      }

      radiusSlider.value = response.settings.radiusMiles;
      updateRadiusLabel(response.settings.radiusMiles);

      settingsStatus.textContent =
        "Preference saved. Flight predictions updated.";

      refresh();
    }
  );
}

// Save the user-selected home location.
function saveHomeLocation() {
  if (settingsSaving) {
    return;
  }

  const latitudeText = homeLatitude.value.trim();
  const longitudeText = homeLongitude.value.trim();

  if (!latitudeText || !longitudeText) {
    settingsStatus.textContent = "Please enter both coordinates.";
    return;
  }

  const lat = Number(latitudeText);
  const lon = Number(longitudeText);

  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    settingsStatus.textContent =
      "Latitude must be between -90 and 90.";
    return;
  }

  if (!Number.isFinite(lon) || lon < -180 || lon > 180) {
    settingsStatus.textContent =
      "Longitude must be between -180 and 180.";
    return;
  }

  settingsSaving = true;
  saveHomeButton.disabled = true;
  radiusSlider.disabled = true;
  settingsStatus.textContent = "Saving home location...";

  chrome.runtime.sendMessage(
    {
      type: "SAVE_SETTINGS",
      settings: { home: { lat, lon } }
    },
    (response) => {
      const runtimeError = chrome.runtime.lastError;

      settingsSaving = false;
      saveHomeButton.disabled = false;
      radiusSlider.disabled = false;

      if (runtimeError || !response?.success) {
        settingsStatus.textContent =
          "Unable to save your home location.";

        console.error(
          "Unable to save home location:",
          runtimeError?.message || response?.error
        );

        loadSettings();
        return;
      }

      homeLatitude.value = response.settings.home.lat;
      homeLongitude.value = response.settings.home.lon;

      settingsStatus.textContent = response.homeChanged
        ? "Home location updated. Waiting for fresh aircraft data."
        : "Home location saved.";

      refresh();
    }
  );
}

function refresh(forceRefresh = false) {
  if (isRefreshing || (forceRefresh && refreshButton.disabled)) {
    return;
  }

  isRefreshing = true;

  clearRateLimitTimer();
  clearPositionAgeTimer();
  clearManualRefreshTimer();

  refreshButton.disabled = true;
  refreshButton.textContent = "Checking...";

  header.textContent = "Checking for aircraft...";
  statusDescription.textContent = "";
  errorElement.textContent = "";
  details.replaceChildren();

  chrome.runtime.sendMessage(
    {
      type: "GET_FLIGHT",
      forceRefresh
    },
    (data) => {
      const runtimeError = chrome.runtime.lastError;

      isRefreshing = false;

      if (runtimeError) {
        render({
          error: runtimeError.message
        });
        return;
      }

      console.log("Flight Alert: Flight information received.");
      render(data);
    }
  );
}

refreshButton.addEventListener("click", () => {
  refresh(true);
});

radiusSlider.addEventListener("input", () => {
  updateRadiusLabel(radiusSlider.value);
});

radiusSlider.addEventListener("change", saveSettings);
saveHomeButton.addEventListener("click", saveHomeLocation);

// Update the popup when background monitoring receives new flight data.
function handleFlightStatusChange(changes, areaName) {
  if (
    areaName !== "local" ||
    !changes.latestFlightStatus ||
    isRefreshing ||
    settingsSaving
  ) {
    return;
  }

  const data = changes.latestFlightStatus.newValue;

  if (data) {
    render(data);
  }
}

chrome.storage.onChanged.addListener(handleFlightStatusChange);

window.addEventListener("pagehide", () => {
  chrome.storage.onChanged.removeListener(handleFlightStatusChange);

  clearRateLimitTimer();
  clearPositionAgeTimer();
  clearManualRefreshTimer();
});

loadSettings();
refresh();

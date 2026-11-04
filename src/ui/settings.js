import { elements } from "./elements.js";
import { state } from "./state.js";
import { render } from "./aircraft.js";
import { refresh } from "./refresh.js";
import { switchTab } from "./tabs.js";

// Update the displayed detection radius.
export function updateRadiusLabel(radius) {
  const value = Number(radius);

  elements.settings.radiusValue.textContent =
    `${value} ${value === 1 ? "mile" : "miles"}`;
}

// Load the previously saved detection settings.
export function loadSettings() {
  chrome.runtime.sendMessage(
    { type: "GET_SETTINGS" },
    (response) => {
      const runtimeError = chrome.runtime.lastError;

      if (runtimeError || response?.error || !response) {
        elements.settings.status.textContent =
          "Unable to load your preferences.";
        return;
      }

      if (state.settings.saving) {
        return;
      }

      const settings = response.settings || response;

      elements.settings.radiusSlider.value = settings.radiusMiles;
      updateRadiusLabel(settings.radiusMiles);

      if (settings.home) {
        elements.settings.latitude.value = settings.home.lat;
        elements.settings.longitude.value = settings.home.lon;
        elements.settings.latitude.dataset.locationConfigured = "true";
      } else {
        delete elements.settings.latitude.dataset.locationConfigured;
        elements.settings.latitude.value = "";
        elements.settings.longitude.value = "";
        render({ requiresSetup: true });

        // Open settings automatically on first launch.
        switchTab("settings");
      }
    }
  );
}

// Save the detection radius when the slider changes.
export function saveSettings() {
  if (state.settings.saving) {
    return;
  }

  const radiusMiles = Number(elements.settings.radiusSlider.value);

  state.settings.saving = true;
  elements.settings.radiusSlider.disabled = true;
  elements.settings.status.textContent = "Saving your preference...";

  chrome.runtime.sendMessage(
    {
      type: "SAVE_SETTINGS",
      settings: { radiusMiles }
    },
    (response) => {
      const runtimeError = chrome.runtime.lastError;

      state.settings.saving = false;
      elements.settings.radiusSlider.disabled = false;

      if (runtimeError || !response?.success) {
        elements.settings.status.textContent =
          "Unable to save your preference.";

        console.error(
          "Unable to save settings:",
          runtimeError?.message || response?.error
        );

        loadSettings();
        return;
      }

      elements.settings.radiusSlider.value = response.settings.radiusMiles;
      updateRadiusLabel(response.settings.radiusMiles);

      elements.settings.status.textContent =
        "Preference saved. Flight predictions updated.";

      refresh();
    }
  );
}

// Save the user-selected home location.
export function saveHomeLocation() {
  if (state.settings.saving) {
    return;
  }

  const latitudeText = elements.settings.latitude.value.trim();
  const longitudeText = elements.settings.longitude.value.trim();

  if (!latitudeText || !longitudeText) {
    elements.settings.status.textContent = "Please enter both coordinates.";
    return;
  }

  const lat = Number(latitudeText);
  const lon = Number(longitudeText);

  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    elements.settings.status.textContent =
      "Latitude must be between -90 and 90.";
    return;
  }

  if (!Number.isFinite(lon) || lon < -180 || lon > 180) {
    elements.settings.status.textContent =
      "Longitude must be between -180 and 180.";
    return;
  }

  // Remember whether the user is completing their initial setup.
  const isFirstLocationSetup =
    !elements.settings.latitude.dataset.locationConfigured;

  state.settings.saving = true;
  elements.settings.saveButton.disabled = true;
  elements.settings.radiusSlider.disabled = true;
  elements.settings.status.textContent = "Saving home location...";

  chrome.runtime.sendMessage(
    {
      type: "SAVE_SETTINGS",
      settings: { home: { lat, lon } }
    },
    (response) => {
      const runtimeError = chrome.runtime.lastError;

      state.settings.saving = false;
      elements.settings.saveButton.disabled = false;
      elements.settings.radiusSlider.disabled = false;

      if (runtimeError || !response?.success) {
        elements.settings.status.textContent =
          "Unable to save your home location.";

        console.error(
          "Unable to save home location:",
          runtimeError?.message || response?.error
        );

        loadSettings();
        return;
      }

      elements.settings.latitude.value = response.settings.home.lat;
      elements.settings.longitude.value = response.settings.home.lon;
      elements.settings.latitude.dataset.locationConfigured = "true";

      elements.settings.status.textContent = response.homeChanged
        ? "Home location updated. Waiting for fresh aircraft data."
        : "Home location saved.";

      // Switch to Aircraft only after the first successful location setup.
      if (isFirstLocationSetup) {
        switchTab("aircraft");
      }

      refresh();
    }
  );
}

// Detect and save the user's current location.
export function detectCurrentLocation() {
  if (state.settings.saving) {
    return;
  }

  if (!navigator.geolocation) {
    elements.settings.status.textContent =
      "Geolocation is not supported by your browser.";
    return;
  }

  elements.settings.detectButton.disabled = true;
  elements.settings.detectButton.textContent = "Detecting location...";
  elements.settings.status.textContent =
    "Getting your current location...";

  navigator.geolocation.getCurrentPosition(
    position => {
      const { latitude, longitude, accuracy } = position.coords;

      elements.settings.latitude.value = latitude.toFixed(6);
      elements.settings.longitude.value = longitude.toFixed(6);

      // Store the estimated accuracy of the detected location in miles.
      state.settings.detectedLocationAccuracyMiles = accuracy / 1609.344;
      updateLocationAccuracy();

      elements.settings.detectButton.disabled = false;
      elements.settings.detectButton.textContent = "Use my current location";

      // Save the detected coordinates using the existing settings flow.
      saveHomeLocation();
    },
    error => {
      elements.settings.detectButton.disabled = false;
      elements.settings.detectButton.textContent = "Use my current location";

      // Clear location accuracy if location detection fails.
      state.settings.detectedLocationAccuracyMiles = null;
      updateLocationAccuracy();

      switch (error.code) {
        case 1:
          elements.settings.status.textContent =
            "Location access was denied. Enter coordinates manually.";
          break;

        case 2:
          elements.settings.status.textContent =
            "Unable to determine your current location.";
          break;

        case 3:
          elements.settings.status.textContent =
            "Location detection timed out. Please try again.";
          break;

        default:
          elements.settings.status.textContent =
            "An error occurred while detecting your location.";
      }
    },
    {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0
    }
  );
}

// Display location accuracy and warn when it exceeds the detection radius.
export function updateLocationAccuracy() {
  if (state.settings.detectedLocationAccuracyMiles === null) {
    elements.settings.accuracy.textContent = "";
    elements.settings.accuracy.classList.remove("accuracy-warning");
    return;
  }

  const radiusMiles = Number(elements.settings.radiusSlider.value);
  const accuracyMiles = state.settings.detectedLocationAccuracyMiles;

  if (accuracyMiles > radiusMiles) {
    elements.settings.accuracy.textContent =
      `⚠️ Location accuracy (±${accuracyMiles.toFixed(2)} mi) ` +
      `exceeds your detection radius (${radiusMiles} mi). ` +
      `Consider entering your coordinates manually.`;

    elements.settings.accuracy.classList.add("accuracy-warning");
  } else {
    elements.settings.accuracy.textContent =
      `Estimated location accuracy: ±${accuracyMiles.toFixed(2)} mi`;

    elements.settings.accuracy.classList.remove("accuracy-warning");
  }
}

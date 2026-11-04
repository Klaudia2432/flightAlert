import { elements } from "./ui/elements.js";
import { state } from "./ui/state.js";
import { refresh } from "./ui/refresh.js";
import { render } from "./ui/aircraft.js";

import {
  loadSettings,
  saveSettings,
  saveHomeLocation,
  detectCurrentLocation,
  updateRadiusLabel,
  updateLocationAccuracy
} from "./ui/settings.js";

import { switchTab } from "./ui/tabs.js";

import {
  clearRateLimitTimer,
  clearPositionAgeTimer,
  clearManualRefreshTimer
} from "./ui/timers.js";

// Refresh aircraft information when requested by the user.
elements.aircraft.refreshButton.addEventListener("click", () => {
  refresh(true);
});

// Update the detection radius label while moving the slider.
elements.settings.radiusSlider.addEventListener("input", () => {
  updateRadiusLabel(elements.settings.radiusSlider.value);
  updateLocationAccuracy();
});

// Save the detection radius after the user finishes adjusting it.
elements.settings.radiusSlider.addEventListener("change", saveSettings);

// Home location controls.
elements.settings.saveButton.addEventListener("click", saveHomeLocation);
elements.settings.detectButton.addEventListener("click", detectCurrentLocation);

// Switch between Aircraft and Settings tabs.
elements.tabs.aircraftButton.addEventListener("click", () => {
  switchTab("aircraft");
});

elements.tabs.settingsButton.addEventListener("click", () => {
  switchTab("settings");
});

// Clear detected accuracy when coordinates are edited manually.
elements.settings.latitude.addEventListener("input", () => {
  state.settings.detectedLocationAccuracyMiles = null;
  updateLocationAccuracy();
});

elements.settings.longitude.addEventListener("input", () => {
  state.settings.detectedLocationAccuracyMiles = null;
  updateLocationAccuracy();
});

// Update the popup when background monitoring receives new flight data.
function handleFlightStatusChange(changes, areaName) {
  if (
    areaName !== "local" ||
    !changes.latestFlightStatus ||
    state.refresh.inProgress ||
    state.settings.saving
  ) {
    return;
  }

  const data = changes.latestFlightStatus.newValue;

  if (data) {
    render(data);
  }
}

chrome.storage.onChanged.addListener(handleFlightStatusChange);

// Clean up listeners and timers when the popup closes.
window.addEventListener("pagehide", () => {
  chrome.storage.onChanged.removeListener(handleFlightStatusChange);

  clearRateLimitTimer();
  clearPositionAgeTimer();
  clearManualRefreshTimer();
});

// Initialise the popup.
loadSettings();
refresh();

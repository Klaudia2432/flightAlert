// Group popup elements by responsibility.
export const elements = {
  aircraft: {
    header: document.getElementById("page-header"),
    details: document.getElementById("details"),
    error: document.getElementById("error"),
    updated: document.getElementById("updated"),
    refreshButton: document.getElementById("refresh"),
    statusDescription: document.getElementById("status-description")
  },

  settings: {
    radiusSlider: document.getElementById("detection-radius"),
    radiusValue: document.getElementById("radius-value"),
    status: document.getElementById("settings-status"),
    latitude: document.getElementById("home-latitude"),
    longitude: document.getElementById("home-longitude"),
    saveButton: document.getElementById("save-home"),
    detectButton: document.getElementById("detect-location"),
    accuracy: document.getElementById("location-accuracy")
  },

  tabs: {
    aircraftButton: document.getElementById("aircraft-tab"),
    settingsButton: document.getElementById("settings-tab"),
    aircraftPanel: document.getElementById("aircraft-panel"),
    settingsPanel: document.getElementById("settings-panel")
  }
};

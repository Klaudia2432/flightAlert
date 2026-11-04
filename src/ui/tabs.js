import { elements } from "./elements.js";

// Switch between aircraft information and user settings.
export function switchTab(tab) {
  const showAircraft = tab === "aircraft";

  elements.tabs.aircraftPanel.hidden = !showAircraft;
  elements.tabs.settingsPanel.hidden = showAircraft;

  elements.tabs.aircraftButton.classList.toggle("active", showAircraft);
  elements.tabs.settingsButton.classList.toggle("active", !showAircraft);

  elements.tabs.aircraftButton.setAttribute(
    "aria-selected",
    String(showAircraft)
  );

  elements.tabs.settingsButton.setAttribute(
    "aria-selected",
    String(!showAircraft)
  );
}

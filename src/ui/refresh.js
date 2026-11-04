import { elements } from "./elements.js";
import { state } from "./state.js";
import { render } from "./aircraft.js";
import {
  clearRateLimitTimer,
  clearPositionAgeTimer,
  clearManualRefreshTimer
} from "./timers.js";

// Request aircraft information from the background service worker.
export function refresh(forceRefresh = false) {
  if (
    state.refresh.inProgress ||
    (forceRefresh && elements.aircraft.refreshButton.disabled)
  ) {
    return;
  }

  state.refresh.inProgress = true;

  clearRateLimitTimer();
  clearPositionAgeTimer();
  clearManualRefreshTimer();

  elements.aircraft.refreshButton.disabled = true;
  elements.aircraft.refreshButton.textContent = "Checking...";

  elements.aircraft.header.textContent = "Checking for aircraft...";
  elements.aircraft.statusDescription.textContent = "";
  elements.aircraft.error.textContent = "";
  elements.aircraft.details.replaceChildren();

  chrome.runtime.sendMessage(
    {
      type: "GET_FLIGHT",
      forceRefresh
    },
    (data) => {
      const runtimeError = chrome.runtime.lastError;

      state.refresh.inProgress = false;

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

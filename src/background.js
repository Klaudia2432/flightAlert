// Load configuration before starting the background service worker.
import './config.js';

import { ensureAlarm, runCheckSafely } from './services/scheduler.js';
import { registerMessageHandler } from './services/messages.js';

const {
  ALARM_NAME,
  LOCATION_ALARM_NAME
} = globalThis.FLIGHT_ALERT_CONFIG;

// Restrict local storage access to trusted extension contexts.
chrome.storage.local.setAccessLevel({
  accessLevel: 'TRUSTED_CONTEXTS'
}).catch(error => {
  console.error('Unable to restrict local storage access:', error);
});

// Register background event listeners.
chrome.runtime.onInstalled.addListener(() => {
  void ensureAlarm();
  void runCheckSafely();
});

chrome.runtime.onStartup.addListener(() => {
  void ensureAlarm();
  void runCheckSafely();
});

chrome.alarms.onAlarm.addListener(alarm => {
  if (
    alarm.name === ALARM_NAME ||
    alarm.name === LOCATION_ALARM_NAME
  ) {
    void runCheckSafely();
  }
});

// Handle messages from the popup.
registerMessageHandler();

// Ensure the recurring monitoring alarm exists.
void ensureAlarm();
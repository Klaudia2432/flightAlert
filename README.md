# ✈️ Flight Alert

**Flight Alert** is a free, open-source Chrome extension that monitors nearby aircraft and notifies you when a flight is predicted to pass close to your chosen location.

It uses aircraft position data from the [OpenSky Network](https://opensky-network.org/) to estimate flight paths, calculate closest approaches and send desktop notifications.

No account, subscription or personal API key is required for the current implementation.

> **Beta software:** Flight predictions are estimates based on available aircraft data. Flight Alert is not a real-time aircraft tracking or aviation safety tool.

## Features

- **Aircraft proximity alerts** — Receive notifications when an aircraft is predicted to pass near your selected location.
- **Custom home location** — Configure latitude and longitude during first-time setup.
- **Adjustable detection radius** — Choose between 1 and 20 miles.
- **Flight predictions** — View estimated closest approach, distance, altitude, speed and heading.
- **Aircraft directions** — See which compass direction an aircraft is approaching from and where it is heading.
- **Automatic monitoring** — Check for nearby aircraft approximately every 6 minutes.
- **Manual refresh** — Request updated flight data, subject to a 60-second cooldown.
- **Live popup updates** — Automatically display newly received aircraft information while the popup is open.
- **Stale-data protection** — Hide outdated aircraft positions after 90 seconds.
- **API usage protection** — Local request budgeting, caching and rate-limit handling.
- **Notification cooldown** — Prevent repeated notifications for the same aircraft within 45 minutes.

## Installation

Flight Alert is currently distributed as a development/beta extension.

1. Download the project from GitHub using **Code → Download ZIP**, or download a ZIP from the Releases page.
2. Extract the archive to a folder on your computer.
3. Open Google Chrome and navigate to `chrome://extensions`.
4. Enable **Developer mode** in the top-right corner.
5. Click **Load unpacked**.
6. Select the extracted folder containing `manifest.json`.
7. Pin Flight Alert to your Chrome toolbar.

Flight Alert is now installed.

### Updating

For manually installed versions, download the updated files and replace the existing extension files. Then open `chrome://extensions` and click **Reload**.

## Getting started

When you first open Flight Alert, you'll be asked to configure your location.

1. Enter your **latitude** and **longitude**.
2. Click **Save location**.
3. Set your preferred detection radius between 1 and 20 miles.
4. Flight Alert will begin monitoring aircraft near your chosen location.

You can change your location and detection radius at any time.

Changing your location clears cached flight predictions from the previous location.

### Finding your coordinates

You can obtain coordinates from a map service such as Google Maps by selecting a location and copying its latitude and longitude.

Valid coordinate ranges:

- Latitude: -90 to +90
- Longitude: -180 to +180

## How it works

Flight Alert periodically requests aircraft positions from the OpenSky Network.

For each aircraft, the extension:

1. Checks whether the reported position is sufficiently recent.
2. Calculates its position relative to your selected home location.
3. Estimates its current position using reported speed and heading.
4. Predicts the time and distance of its closest approach.
5. Checks whether the predicted flight path passes within your configured detection radius.
6. Sends a notification when an eligible approaching aircraft is detected.

The default prediction horizon is 20 minutes.

Flight Alert uses a simplified straight-line prediction. Aircraft can turn, change speed or altitude, so actual flight paths may differ.

## Configuration

Flight Alert stores configuration constants in `config.js`.

| Setting | Default | Description |
|---|---|---|
| `radiusMiles` | 2 | Default detection radius in miles |
| `maxDistanceMiles` | 120 | Maximum search distance |
| `predictionHorizonMinutes` | 20 | Maximum prediction horizon |
| `pollMinutes` | 6 | Automatic monitoring interval |
| `staleAfterSeconds` | 90 | Maximum aircraft position age |
| `manualRefreshIntervalMs` | 60000 | Minimum interval between manual API refreshes |
| `alertCooldownMs` | 2700000 | Notification cooldown per aircraft |
| `maxDailyCredits` | 300 | Locally configured API usage budget |
| `maxHeadingChangeDegrees` | 20 | Heading-change threshold used by prediction filtering |

**Note:** The local daily credit budget is an application-side estimate, not a guarantee of available OpenSky API quota.

## Project structure

```text
flight-alert/
├── manifest.json      # Chrome extension manifest
├── config.js          # Shared configuration and storage keys
├── background.js      # Aircraft monitoring and notifications
├── app.js             # Popup functionality
├── index.html         # Popup HTML structure
├── styles.css         # Popup styles
└── icon.png           # Extension and notification icon
```

Additional icon sizes may be included under `icons/`.

## Privacy

Flight Alert is designed to minimise personal data collection.

- Your selected home coordinates and preferences are stored locally using `chrome.storage.local`.
- No Flight Alert account is required.
- The extension does not use analytics or advertising trackers in the current implementation.
- Flight Alert does not operate its own backend service.
- Aircraft data is retrieved directly from OpenSky Network.

**Important:** OpenSky receives the geographical bounding box requested by your browser. This reveals the approximate area being monitored.

Browser storage is not encrypted by Flight Alert. Other software with access to your browser profile may be able to inspect locally stored data.

Flight Alert also stores temporary aircraft data, notification history and API cooldown information locally.

## Permissions

Flight Alert requests the following Chrome extension permissions:

| Permission | Purpose |
|---|---|
| `notifications` | Display aircraft proximity alerts |
| `alarms` | Schedule automatic background monitoring |
| `storage` | Save preferences, cached aircraft data and notification history |
| `https://opensky-network.org/*` | Retrieve aircraft position data from OpenSky |

No permission to read browsing history or website content is requested.

## Data source

Aircraft information is provided by the [OpenSky Network](https://opensky-network.org/).

Data availability and accuracy depend on OpenSky coverage, aircraft broadcasts and API availability.

Flight Alert is an independent community project and is not affiliated with or endorsed by OpenSky Network.

**Public distribution is subject to confirming compliance with OpenSky's API terms and any applicable permission requirements.**

## Known limitations

- Aircraft predictions assume approximately straight-line travel based on the latest reported heading and speed.
- Position data can be delayed or temporarily unavailable.
- Aircraft without adequate tracking data may not be detected.
- Automatic checks are scheduled approximately every 6 minutes, so alerts may not arrive at an exact predicted time.
- Monitoring depends on Chrome being able to run the extension's background service worker.
- Geographic searches near the poles or international date line may require further improvements.
- Anonymous OpenSky API access may be limited or unavailable.

## Contributing

Contributions, bug reports and feature suggestions are welcome!

You can contribute by opening an issue, proposing improvements or submitting a pull request.

For significant changes, consider opening an issue first to discuss the approach.


## Disclaimer

Flight Alert is provided for informational and recreational purposes only.

Predicted aircraft positions, distances and arrival times may be inaccurate. Do not rely on this extension for aviation navigation, safety-critical decisions or emergency purposes.

# ✈️ Flight Alert

**Flight Alert** is a free, non-commercial Chrome extension that monitors nearby aircraft and notifies you when a flight is predicted to pass close to your chosen location.

It uses aircraft position data from the [OpenSky Network](https://opensky-network.org/) to estimate flight paths, calculate closest approaches and send desktop notifications.

No Flight Alert account, subscription or personal API key is required.

**Latest release:** v1.0.0

> **Disclaimer:** Flight predictions are estimates based on available aircraft data. Flight Alert is intended for recreational use and is not an aviation safety or navigation tool.

## ✨ Features

- **Aircraft proximity alerts** — Receive desktop notifications when aircraft are predicted to pass near your configured location.
- **Automatic monitoring** — Check for nearby aircraft approximately every 6 minutes.
- **Manual refresh** — Request fresh aircraft information with a 60-second cooldown.
- **Adjustable detection radius** — Choose between 1 and 20 miles.
- **Home location setup** — Automatically detect your current location or enter coordinates manually.
- **Location accuracy warnings** — See estimated geolocation accuracy and receive warnings when it exceeds your detection radius.
- **Aircraft predictions** — View estimated closest approach, current distance and predicted minimum distance.
- **Flight information** — Display aircraft callsign, altitude, ground speed and heading.
- **Compass directions** — See where aircraft are approaching from and flying towards.
- **Tabbed interface** — Separate Aircraft and Settings views.
- **Automatic popup updates** — Display newly received aircraft information while the popup is open.
- **Stale-data protection** — Avoid showing predictions based on outdated aircraft positions.
- **API protection** — Request caching, rate-limit handling and local daily API credit budgeting.
- **Notification cooldown** — Prevent repeated notifications for the same aircraft within 45 minutes.
- **Geographical coverage** — Support search areas crossing the international date line and extending to polar regions.

## 📦 Installation

Flight Alert is distributed through GitHub Releases and is not currently available on the Chrome Web Store.

### 1. Download

1. Open the repository's **Releases** page.
2. Select the latest release.
3. Under **Assets**, download **Source code (zip)**.
4. Extract the ZIP archive to a permanent folder on your computer.

### 2. Install in Google Chrome

1. Open Google Chrome.
2. Navigate to `chrome://extensions`.
3. Enable **Developer mode** in the top-right corner.
4. Click **Load unpacked**.
5. Open the extracted Flight Alert folder.
6. Select the **`src`** directory containing `manifest.json`.
7. Confirm the selection.

**Important:** Select the `src` directory, not the repository's root directory.

### 3. Pin Flight Alert

1. Click the Extensions icon (puzzle piece) in Chrome's toolbar.
2. Find **Flight Alert**.
3. Click the pin icon.

Flight Alert is now installed and ready to configure.

### Updating

Manually installed extensions do not receive automatic updates through the Chrome Web Store.

To update Flight Alert:

1. Download the latest release from GitHub.
2. Extract the updated source files.
3. Replace the files in your existing installation directory.
4. Open `chrome://extensions`.
5. Find Flight Alert and click **Reload**.

Keep the extension installed from the same directory to avoid unnecessary changes to its extension identity and stored preferences.

## 🚀 Getting Started

### Configure your home location

On first launch, Flight Alert automatically opens the **Settings** tab.

Choose one of two methods:

**Automatic location detection**

1. Click **Use my current location**.
2. Allow location access if prompted.
3. Flight Alert retrieves and saves your coordinates.
4. Review the estimated location accuracy displayed in miles.

**Manual location setup**

1. Enter your latitude and longitude.
2. Click **Save location**.

Valid coordinate ranges:

- Latitude: -90 to +90
- Longitude: -180 to +180

After successfully saving your home location for the first time, Flight Alert automatically switches to the **Aircraft** tab.

### Configure detection radius

Open Settings and adjust the detection radius slider between **1 and 20 miles**.

The radius represents the maximum predicted horizontal distance of an aircraft's closest approach to your selected location.

Changing the radius updates predictions using recently cached aircraft data when available.

### Monitor aircraft

Open the Aircraft tab to view the currently selected approaching aircraft.

Available information includes:

| Information | Description |
|---|---|
| Callsign | Aircraft identification |
| Estimated closest approach | Estimated time until the aircraft passes closest |
| Last known distance | Distance based on the latest reported position |
| Predicted closest distance | Estimated minimum distance |
| Altitude | Aircraft altitude in feet |
| Ground speed | Aircraft speed in knots |
| Track | Direction of travel in degrees |
| Approaching from | Compass direction relative to your location |
| Flying towards | Aircraft travel direction |
| Last Position Update | Age of the most recent position report |
| Heading change | Recent heading change, when available |

You can also click **Check for aircraft** to request updated information when manual refresh is available.

## ⚙️ How It Works

Flight Alert periodically retrieves aircraft positions from OpenSky's `/api/states/all` endpoint using geographically restricted requests.

For each aircraft, the extension:

1. Validates its position and tracking information.
2. Calculates the aircraft's distance and direction relative to your configured location.
3. Accounts for the age of its last reported position.
4. Estimates movement using the reported ground speed and heading.
5. Calculates the predicted time and distance of closest approach.
6. Determines whether the aircraft will pass within the configured detection radius.
7. Sends a notification when an eligible approaching aircraft is detected during background monitoring.

The default prediction horizon is **20 minutes**.

Flight Alert assumes approximately straight-line movement. Aircraft may change speed, heading or altitude, so actual trajectories can differ from predictions.

### Geographical calculations

Flight Alert includes additional support for unusual geographic search conditions:

- **International date line:** Search areas crossing ±180° longitude are split into valid OpenSky bounding-box requests.
- **Polar regions:** Search areas reaching a pole use the full longitude range.
- **Distance calculations:** Great-circle distances are used for geographic positioning.
- **Duplicate aircraft:** Aircraft returned by multiple bounding-box requests are deduplicated.
- **Request budgeting:** The estimated credit cost is calculated across all required requests.

These calculations have been tested with simulated geographic coordinates. Extreme polar flight trajectories and real multi-request scenarios require additional validation.

### API protection

Flight Alert includes safeguards to reduce unnecessary OpenSky requests:

- Automatic monitoring runs approximately every 6 minutes.
- Manual refresh is limited to once per 60 seconds.
- Recently retrieved aircraft positions can be reused.
- HTTP 429 responses trigger a rate-limit cooldown.
- A locally configured daily credit budget prevents requests beyond the application's estimated allowance.

The local budget is not a guarantee of OpenSky API availability or account quota.

## 🏗️ Project Structure

Flight Alert uses a modular architecture separating the user interface from background monitoring and flight prediction functionality.

```text
FlightAlert/
├── .gitignore
├── README.md
└── src/
    ├── services/
    │   ├── geography.js
    │   ├── messages.js
    │   ├── notifications.js
    │   ├── opensky.js
    │   ├── prediction.js
    │   ├── rate-limit.js
    │   ├── scheduler.js
    │   ├── settings.js
    │   └── utils.js
    │
    ├── styles/
    │   ├── styles.css
    │   └── variables.css
    │
    ├── ui/
    │   ├── aircraft.js
    │   ├── elements.js
    │   ├── refresh.js
    │   ├── settings.js
    │   ├── state.js
    │   ├── tabs.js
    │   ├── timers.js
    │   └── utils.js
    │
    ├── app.js
    ├── background.js
    ├── config.js
    ├── icon.png
    ├── index.html
    ├── logo.png
    └── manifest.json
```

The `.idea/` directory is a local development environment directory and is not intended to be included in the published extension.

### Application entry points

| File | Responsibility |
|---|---|
| `app.js` | Initialises the popup and connects UI event listeners |
| `background.js` | Initialises the background service worker and registers Chrome events |
| `config.js` | Shared application configuration and storage keys |
| `index.html` | Popup HTML structure |
| `manifest.json` | Chrome extension configuration and permissions |

### UI modules — `src/ui/`

| Module | Responsibility |
|---|---|
| `aircraft.js` | Render aircraft information and status messages |
| `elements.js` | Shared references to HTML elements |
| `refresh.js` | Request aircraft information from the background worker |
| `settings.js` | Location setup, radius preferences and accuracy warnings |
| `state.js` | Shared popup state |
| `tabs.js` | Aircraft and Settings navigation |
| `timers.js` | Position age, refresh and rate-limit countdowns |
| `utils.js` | Time and countdown formatting |

### Background services — `src/services/`

| Module | Responsibility |
|---|---|
| `geography.js` | Distances, coordinates, bearings and bounding boxes |
| `messages.js` | Communication between the popup and background worker |
| `notifications.js` | Desktop notifications and cooldown tracking |
| `opensky.js` | OpenSky requests, caching and API budgeting |
| `prediction.js` | Aircraft trajectory predictions and heading history |
| `rate-limit.js` | API rate-limit handling |
| `scheduler.js` | Background checks and Chrome alarms |
| `settings.js` | Settings retrieval and validation |
| `utils.js` | Shared background formatting and status helpers |

### Styling — `src/styles/`

- `styles.css` — Popup layout, component appearance and interaction states.
- `variables.css` — Shared colours, dimensions and styling variables.

## 🔧 Configuration

Application configuration is stored in `src/config.js`.

| Setting | Default | Description |
|---|---|---|
| `radiusMiles` | 2 | Default detection radius |
| `maxDistanceMiles` | 120 | Maximum aircraft search distance |
| `predictionHorizonMinutes` | 20 | Prediction horizon |
| `pollMinutes` | 6 | Automatic monitoring interval in minutes |
| `staleAfterSeconds` | 90 | Maximum accepted aircraft position age |
| `manualRefreshIntervalMs` | 60000 | Manual refresh interval in milliseconds |
| `alertCooldownMs` | 2700000 | Notification cooldown per aircraft |
| `maxDailyCredits` | 300 | Local daily API budget |
| `maxHeadingChangeDegrees` | 20 | Heading-change threshold for prediction filtering |

Detection radius and home location can be changed directly through the Settings tab.

## 🔒 Privacy

Flight Alert is designed to minimise personal data collection.

- Your configured home coordinates and preferences are stored locally using `chrome.storage.local`.
- Automatic location detection is initiated only when you click **Use my current location**.
- No Flight Alert account is required.
- No analytics or advertising trackers are included in the current implementation.
- Flight Alert does not operate its own backend server.
- Aircraft position information is retrieved directly from OpenSky.
- Saved aircraft information, notification history and API cooldowns are stored locally.

**Important:** Flight Alert sends geographic bounding boxes to OpenSky when requesting aircraft information. These reveal the approximate geographical area being monitored.

Automatic geolocation may also use location services provided by your browser or operating system.

Local extension data is not independently encrypted by Flight Alert.

## 🔐 Permissions

Flight Alert requests the following Chrome extension permissions:

| Permission | Purpose |
|---|---|
| `notifications` | Display aircraft proximity notifications |
| `alarms` | Schedule automatic monitoring |
| `storage` | Save settings, cached aircraft information and notification history |
| `geolocation` | Detect your location when requested |
| `https://opensky-network.org/*` | Retrieve aircraft positions from OpenSky |

Flight Alert does not request permission to read browsing history or website content.

## 📡 Data Source

Aircraft position information is provided by the [OpenSky Network](https://opensky-network.org/).

Data availability and accuracy depend on OpenSky coverage, aircraft broadcasts and API availability.

Flight Alert is an independent hobby project and is not affiliated with or endorsed by the OpenSky Network.

Use of OpenSky data remains subject to the applicable API terms, policies and rate limits.

## ⚠️ Known Limitations

- Aircraft predictions assume approximately straight-line movement.
- Position information can be delayed or temporarily unavailable.
- Not all aircraft broadcast suitable tracking information.
- Flight paths may change after a prediction is calculated.
- Automatic monitoring depends on Chrome's background service-worker execution.
- API limitations may temporarily interrupt aircraft updates.
- Notifications may not arrive at the exact predicted time.
- Real aircraft-triggered notifications and cooldown behaviour require further testing.
- Extreme polar flight predictions have not been fully validated.

## 🛠️ Troubleshooting

### The extension does not load

Make sure Developer mode is enabled and you selected the `src` directory containing `manifest.json`.

Check `chrome://extensions` for reported errors.

### Location detection fails

Check Chrome and operating-system location permissions. You can always enter your coordinates manually.

### No aircraft are displayed

Verify your configured location and detection radius. You can manually refresh when the cooldown permits, but no aircraft may currently match your prediction criteria.

### Notifications are not appearing

Ensure notifications are enabled for Chrome in your operating system. Aircraft notifications also require an eligible prediction from a background check.

### OpenSky data is unavailable

OpenSky may temporarily rate-limit requests or experience availability issues. Flight Alert will resume monitoring when permitted by its safeguards.

## 🤝 Contributing

Bug reports, feature suggestions and feedback are welcome through GitHub Issues.

For significant code changes, consider opening an issue first to discuss the proposed improvement.

## 📄 Disclaimer

Flight Alert is provided for informational and recreational purposes only.

Predicted aircraft positions, distances and arrival times may be inaccurate.

Do not rely on Flight Alert for aviation navigation, safety-critical decisions or emergency purposes.
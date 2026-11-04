# ✈️ Flight Alert

**Flight Alert** is a free Chrome extension that monitors nearby aircraft and notifies you when a flight is predicted to pass close to your chosen location.

It uses aircraft position data from the [OpenSky Network](https://opensky-network.org/) to estimate flight paths, calculate closest approaches and send desktop notifications.

No account, subscription or personal API key is required for the current implementation.

> **Beta software:** Flight predictions are estimates based on available aircraft data. Flight Alert is not a real-time aircraft tracking or aviation safety tool.

## Features

- **Aircraft proximity alerts** — Receive notifications when aircraft are predicted to pass near your selected location.
- **Automatic location detection** — Use your current location with one click.
- **Location accuracy** — View the estimated accuracy of your detected location in miles.
- **Manual location setup** — Enter latitude and longitude yourself.
- **Adjustable detection radius** — Choose between 1 and 20 miles.
- **Flight predictions** — View estimated closest approach, distance, altitude, speed and heading.
- **Aircraft directions** — See where aircraft are approaching from and flying towards.
- **Automatic monitoring** — Check for nearby aircraft approximately every 6 minutes.
- **Manual refresh** — Request new flight data with a 60-second cooldown.
- **Live popup updates** — Display newly received aircraft information automatically.
- **Stale-data protection** — Hide outdated aircraft positions after 90 seconds.
- **API usage protection** — Local request budgeting, caching and rate-limit handling.
- **Notification cooldown** — Prevent repeated notifications for the same aircraft within 45 minutes.

## Installation

Flight Alert is currently distributed through GitHub for testing.

1. Download a ZIP file from the project's **GitHub Releases** page.
2. Extract the ZIP into a folder on your computer.
3. Open Google Chrome and navigate to `chrome://extensions`.
4. Enable **Developer mode** in the top-right corner.
5. Click **Load unpacked**.
6. Select the extracted folder containing `manifest.json`.
7. Pin Flight Alert to your Chrome toolbar.

Flight Alert is now installed.

### Updating

To update a manually installed version:

1. Download the latest release from GitHub.
2. Extract the files.
3. Replace the existing extension files in the **same folder**.
4. Open `chrome://extensions`.
5. Click **Reload** on Flight Alert.

Keeping the same extension folder helps preserve the installation. Your saved settings should remain available when the extension identity is unchanged.

## Getting Started

When you open Flight Alert for the first time, you will be asked to configure a home location.

### Option 1: Automatic Location Detection

1. Click **Use my current location**.
2. Allow location access if required.
3. Flight Alert automatically retrieves your coordinates.
4. Your detected coordinates are saved as your home location.
5. The estimated location accuracy is displayed in miles.

For example:

```text
Latitude: 51.507500
Longitude: -0.12773216

Estimated location accuracy: ±0.02 mi
```

These coordinates are illustrative.

**Important:** Automatic location detection may be less accurate on desktop computers. The accuracy value is an estimate, not a guarantee of the exact location.

### Option 2: Manual Location Setup

1. Enter your latitude.
2. Enter your longitude.
3. Click **Save location**.

You can find coordinates using a map service such as Google Maps.

Valid coordinate ranges:

- Latitude: -90 to +90
- Longitude: -180 to +180

### Detection Radius

Use the slider to select a detection radius between **1 and 20 miles**.

For example:

- **1 mile** — Aircraft predicted to pass very close to your location.
- **5 miles** — Aircraft predicted to pass within a wider area.
- **20 miles** — Aircraft predicted to pass within a larger surrounding area.

You can change your location and detection radius at any time.

Changing your home location clears cached flight predictions associated with the previous location.

## How It Works

Flight Alert periodically requests aircraft position data from OpenSky Network.

For each aircraft, the extension:

1. Checks whether the reported position is sufficiently recent.
2. Calculates its position relative to your selected home location.
3. Estimates its current position using reported speed and heading.
4. Predicts the time and distance of its closest approach.
5. Checks whether the predicted flight path passes within your detection radius.
6. Sends a notification when an eligible approaching aircraft is detected.

The default prediction horizon is **20 minutes**.

Flight Alert uses simplified straight-line predictions. Aircraft can turn, change speed or altitude, so actual flight paths may differ from the estimated paths.

## Flight Information

When an aircraft is predicted to pass nearby, the popup can display:

| Information | Description |
|---|---|
| Aircraft callsign | Aircraft identification |
| Estimated closest approach | Estimated time until the aircraft's closest approach |
| Last known distance | Distance from your location at the latest reported position |
| Predicted closest distance | Estimated minimum distance from your location |
| Altitude | Aircraft altitude in feet |
| Ground speed | Aircraft speed in knots |
| Track | Direction of travel in degrees |
| Approaching from | Compass direction of the aircraft relative to your location |
| Flying towards | Compass direction of aircraft travel |
| Last Position Update | Age of the latest aircraft position |
| Heading change | Recent change in aircraft heading, when available |

## Configuration

Flight Alert stores its shared configuration in `config.js`.

| Setting | Default | Description |
|---|---|---|
| `radiusMiles` | 2 | Default detection radius |
| `maxDistanceMiles` | 120 | Maximum aircraft search distance |
| `predictionHorizonMinutes` | 20 | Maximum prediction horizon |
| `alertMinMinutes` | 10 | Configured alert threshold |
| `alertMaxMinutes` | 20 | Maximum notification prediction window |
| `pollMinutes` | 6 | Automatic monitoring interval |
| `staleAfterSeconds` | 90 | Maximum accepted aircraft position age |
| `manualRefreshIntervalMs` | 60000 | Minimum interval between manual API refreshes |
| `alertCooldownMs` | 2700000 | Notification cooldown per aircraft |
| `maxDailyCredits` | 300 | Local daily API budget |
| `maxHeadingChangeDegrees` | 20 | Heading-change threshold for prediction filtering |

The application estimates API credit consumption locally. This does not guarantee that OpenSky will allow the same number of requests.

## Project Structure

```text
flight-alert/
├── manifest.json      # Chrome extension manifest
├── config.js          # Shared configuration and storage keys
├── background.js      # Aircraft monitoring and notifications
├── app.js             # Popup functionality
├── index.html         # Popup HTML structure
├── styles.css         # Popup styles
├── icon.png           # Extension and notification icon
└── README.md          # Project documentation
```

Additional icon sizes may be included under `icons/`.

## Privacy

Flight Alert is designed to minimise personal data collection.

- Your selected home coordinates and preferences are stored locally using `chrome.storage.local`.
- Automatic location detection runs when you click **Use my current location**.
- The accuracy estimate is provided by your browser's Geolocation API.
- No Flight Alert account is required.
- The current implementation does not contain analytics or advertising trackers.
- Flight Alert does not operate its own backend server.
- Aircraft position data is retrieved directly from OpenSky Network.
- Local storage access is restricted to trusted extension contexts.

### Location Data

Your chosen coordinates remain in your browser's extension storage.

However, Flight Alert sends a geographic bounding box to OpenSky when requesting nearby aircraft data. This reveals the approximate area being monitored.

Your browser or operating system may also use external location services when detecting your current position.

Flight Alert does not encrypt its locally stored coordinates. Software with access to your browser profile may be able to inspect them.

## Permissions

Flight Alert requests the following Chrome extension permissions:

| Permission | Purpose |
|---|---|
| `notifications` | Display aircraft proximity alerts |
| `alarms` | Schedule automatic background monitoring |
| `storage` | Save settings, cached aircraft data and notification history |
| `geolocation` | Automatically detect your current location when requested |
| `https://opensky-network.org/*` | Retrieve aircraft position data from OpenSky |

Flight Alert does not request permission to read your browsing history or website content.

## Data Source

Aircraft information is provided by the [OpenSky Network](https://opensky-network.org/).

Data availability and accuracy depend on OpenSky coverage, aircraft broadcasts and API availability.

Flight Alert is an independent project and is not affiliated with or endorsed by OpenSky Network.

Public distribution and automated API usage are subject to OpenSky's applicable terms and permission requirements.

## Known Limitations

- Aircraft predictions assume approximately straight-line travel.
- Aircraft may change direction, speed or altitude.
- Position data can be delayed or unavailable.
- Aircraft without adequate tracking data may not be detected.
- Automatic checks run approximately every 6 minutes, so notifications may not arrive at the exact predicted time.
- Monitoring depends on Chrome being able to run the extension's background service worker.
- Geographic searches near the poles or international date line may require improvements.
- Desktop location detection may be inaccurate.
- Anonymous OpenSky API access may be limited or unavailable.

## Contributing

Bug reports, suggestions and contributions are welcome.

You can contribute by:

- Opening a GitHub issue.
- Reporting bugs or unexpected behaviour.
- Suggesting new features.
- Submitting a pull request.

For significant changes, consider opening an issue first to discuss your proposed approach.

## Disclaimer

Flight Alert is provided for informational and recreational purposes only.

Predicted aircraft positions, distances and arrival times may be inaccurate.

Do not rely on this extension for aviation navigation, safety-critical decisions or emergency purposes.

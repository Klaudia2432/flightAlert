# ✈️ Flight Alert

**Flight Alert** is a free, non-commercial Chrome extension that monitors nearby aircraft and notifies you when a flight is predicted to pass close to your chosen location.

The extension uses aircraft position data from the [OpenSky Network](https://opensky-network.org/) to estimate flight paths, calculate closest approaches and send desktop notifications.

No account, subscription or personal API key is required for the current implementation.

> **Beta software:** Flight predictions are estimates based on available aircraft data. Flight Alert is not a real-time aircraft tracking or aviation safety tool.

## Features

- **Aircraft proximity alerts** — Receive desktop notifications when aircraft are predicted to pass near your location.
- **Tabbed interface** — Separate Aircraft and Settings tabs for easier navigation.
- **Automatic location detection** — Detect your current location with one click.
- **Manual location setup** — Enter latitude and longitude yourself.
- **Location accuracy** — Display the estimated accuracy of your detected location in miles.
- **Accuracy warnings** — Warn when location accuracy exceeds your selected detection radius.
- **Adjustable detection radius** — Choose between 1 and 20 miles.
- **Flight predictions** — View estimated closest approach, distance, altitude, speed and heading.
- **Aircraft directions** — See where aircraft are approaching from and flying towards.
- **Automatic monitoring** — Check for nearby aircraft approximately every 6 minutes.
- **Manual refresh** — Request new flight data with a 60-second cooldown.
- **Live popup updates** — Automatically display newly received aircraft information.
- **Stale-data protection** — Hide outdated aircraft positions after 90 seconds.
- **Improved status messages** — Clear information when no aircraft are approaching or flight data is unavailable.
- **API usage protection** — Local credit budgeting, caching and rate-limit handling.
- **Notification cooldown** — Prevent repeated notifications for the same aircraft within 45 minutes.
- **International date line support** — Handle aircraft predictions across the ±180° longitude boundary.
- **Polar-region search support** — Support geographical searches extending to the North or South Pole.

## Installation

Flight Alert is currently distributed through GitHub for personal, non-commercial beta testing.

You do not need to install it from the Chrome Web Store.

### 1. Download Flight Alert

1. Open the Flight Alert GitHub repository.
2. Click the green **Code** button.
3. Select **Download ZIP**.
4. Extract the downloaded archive to a folder on your computer.

The extracted project should contain:

```text
FlightAlert-main/
├── .gitignore
├── README.md
└── src/
    ├── app.js
    ├── background.js
    ├── config.js
    ├── icon.png
    ├── index.html
    ├── manifest.json
    └── styles.css
```

### 2. Load the Extension into Chrome

1. Open **Google Chrome**.
2. Enter `chrome://extensions` in the address bar.
3. Enable **Developer mode** using the toggle in the top-right corner.
4. Click **Load unpacked**.
5. Navigate to the extracted Flight Alert folder.
6. Open the **`src`** folder.
7. Click **Select Folder** (Windows) or **Open** (macOS).

**Important:** Select the `src` folder containing `manifest.json`, not the repository's root folder.

Chrome should now load Flight Alert.

### 3. Pin Flight Alert

1. Click the Extensions icon (puzzle piece) in Chrome's toolbar.
2. Find **Flight Alert**.
3. Click the pin icon next to it.

You can now open Flight Alert directly from your Chrome toolbar.

### 4. Configure Your Home Location

On first launch, Flight Alert automatically opens the **Settings** tab.

Choose one of the following methods:

**Automatic location detection**

1. Click **Use my current location**.
2. Allow location access if required.
3. Flight Alert automatically retrieves your coordinates.
4. Your coordinates are saved as your home location.
5. The estimated location accuracy is displayed in miles.

**Manual location setup**

1. Enter your latitude and longitude.
2. Click **Save location**.

After your first successful location setup, Flight Alert automatically switches to the **Aircraft** tab.

### 5. Start Monitoring

Flight Alert will begin monitoring aircraft around your configured location.

You can:

- Open the **Aircraft** tab to view nearby flight predictions.
- Click **Check for aircraft** to manually request updated data.
- Open **Settings** to change your location or detection radius.

Monitoring runs automatically while Chrome can execute the extension's background service worker.

## Updating Flight Alert

Because Flight Alert is installed manually, updates are not automatically delivered through the Chrome Web Store.

To update:

1. Download the latest repository ZIP from GitHub.
2. Extract it.
3. Replace the existing extension files in the same installation folder.
4. Open `chrome://extensions`.
5. Find Flight Alert and click **Reload**.

Keep the same extension installation path to help preserve the extension's identity and saved settings.

## Uninstalling

1. Open `chrome://extensions`.
2. Find Flight Alert.
3. Click **Remove**.
4. Confirm the removal.

Chrome will remove the extension and its associated local storage.

## Using Flight Alert

### Aircraft Tab

The Aircraft tab displays information about the aircraft currently predicted to pass closest to your selected location.

Available information includes:

| Information | Description |
|---|---|
| Aircraft callsign | Aircraft identification |
| Estimated closest approach | Estimated time until closest approach |
| Last known distance | Distance from your location at the latest reported position |
| Predicted closest distance | Estimated minimum distance from your location |
| Altitude | Aircraft altitude in feet |
| Ground speed | Aircraft speed in knots |
| Track | Direction of travel in degrees |
| Approaching from | Compass direction relative to your location |
| Flying towards | Compass direction of aircraft travel |
| Last Position Update | Age of the latest reported aircraft position |
| Heading change | Recent heading change, when available |

The tab also displays the last update time and manual refresh availability.

### Settings Tab

The Settings tab allows you to:

- Automatically detect your current location.
- Enter your coordinates manually.
- View estimated location accuracy.
- Receive warnings about inaccurate location detection.
- Change your detection radius between 1 and 20 miles.

Changing your home location clears cached aircraft predictions associated with the previous location.

### Detection Radius

You can select a radius between **1 and 20 miles**.

For example:

- **1 mile** — Aircraft predicted to pass very close to your location.
- **5 miles** — Aircraft predicted to pass within a wider surrounding area.
- **20 miles** — Aircraft predicted to pass within a larger monitoring area.

The detection radius measures the aircraft's predicted closest horizontal distance from your selected location.

### Location Accuracy

When you use automatic location detection, Chrome provides an estimated accuracy measurement.

Flight Alert converts this measurement to miles.

**Example coordinates (London, UK):**

```text
Latitude: 51.507500
Longitude: -0.12773216

Estimated location accuracy: ±0.02 mi
```

These coordinates are illustrative and do not represent the developer's home location.

If the estimated location accuracy exceeds your detection radius, Flight Alert displays a warning.

For example:

```text
⚠️ Location accuracy (±5.00 mi) exceeds your detection
radius (4 mi). Consider entering your coordinates manually.
```

Automatic location detection may be less accurate on desktop computers. The accuracy value is an estimate, not a guarantee.

### Aircraft Status Messages

Flight Alert provides several status messages:

| Status | Meaning |
|---|---|
| No aircraft approaching | No aircraft currently matches the prediction criteria |
| Waiting for fresh aircraft data | Previously received aircraft positions are outdated |
| Flight data temporarily unavailable | Aircraft information could not be retrieved |
| Set up your home location | A location must be configured before monitoring starts |
| Flight updates temporarily paused | OpenSky rate limiting is active |
| Flight updates unavailable for now | The locally configured daily API budget has been reached |

Flight Alert continues scheduled monitoring when permitted by its API limits.

## How It Works

Flight Alert periodically retrieves aircraft position data from the OpenSky Network REST API.

For each aircraft, the extension:

1. Checks whether the aircraft has a sufficiently recent position.
2. Calculates its location relative to your selected home coordinates.
3. Estimates its current position using speed and heading.
4. Predicts its time and distance of closest approach.
5. Determines whether its predicted trajectory passes within your detection radius.
6. Sends a desktop notification when an eligible aircraft is detected.

The default prediction horizon is **20 minutes**.

Flight Alert uses simplified straight-line flight predictions. Actual flight paths may differ because aircraft can change speed, heading or altitude.

### Geographic Calculations

Flight Alert supports geographical searches near the international date line and polar regions.

- **International date line:** Search areas crossing ±180° longitude are divided into valid bounding boxes.
- **Polar regions:** Search areas extending to a pole cover the full longitude range.
- **Distance calculations:** Great-circle distance is used for geographical positioning.
- **Duplicate handling:** Aircraft returned from overlapping search areas are merged.
- **API credits:** Estimated credit usage is calculated for the combined requests.

These geographical calculations have been tested using simulated coordinates and aircraft data.

Extreme polar flight trajectories and real multi-request API behaviour have not been fully validated.

## Configuration

Shared application configuration is stored in `src/config.js`.

| Setting | Default | Description |
|---|---|---|
| `radiusMiles` | 2 | Default detection radius |
| `maxDistanceMiles` | 120 | Maximum aircraft search distance |
| `predictionHorizonMinutes` | 20 | Maximum prediction horizon |
| `alertMinMinutes` | 10 | Configured alert threshold |
| `alertMaxMinutes` | 20 | Maximum notification prediction window |
| `pollMinutes` | 6 | Automatic monitoring interval |
| `staleAfterSeconds` | 90 | Maximum accepted aircraft position age |
| `manualRefreshIntervalMs` | 60000 | Manual API refresh interval in milliseconds |
| `alertCooldownMs` | 2700000 | Notification cooldown per aircraft |
| `maxDailyCredits` | 300 | Locally configured daily API budget |
| `maxHeadingChangeDegrees` | 20 | Heading-change threshold used for prediction filtering |

The local daily API budget is an application-side safeguard and does not guarantee the availability of OpenSky API credits.

## Project Structure

```text
FlightAlert/
├── .gitignore
├── README.md
└── src/
    ├── manifest.json      # Chrome extension manifest
    ├── config.js          # Shared configuration and storage keys
    ├── background.js      # Aircraft monitoring and notifications
    ├── app.js             # Popup functionality
    ├── index.html         # Popup interface and tabs
    ├── styles.css         # Popup styles
    └── icon.png           # Extension and notification icon
```

## Privacy

Flight Alert is designed to minimise personal data collection.

- Home coordinates and preferences are stored locally using `chrome.storage.local`.
- Automatic location detection is initiated when you click **Use my current location**.
- Location accuracy is provided by your browser's Geolocation API.
- No Flight Alert account is required.
- The current implementation contains no analytics or advertising trackers.
- Flight Alert does not operate its own backend server.
- Aircraft information is retrieved directly from OpenSky.
- Local storage access is restricted to trusted extension contexts.

### Location Data

Your home coordinates are stored in your browser's extension storage.

Flight Alert sends a geographical bounding box to OpenSky when requesting aircraft positions. This reveals the approximate geographical area being monitored.

Automatic location detection may also involve external location services used by your browser or operating system.

Flight Alert does not encrypt locally stored coordinates. Software with access to your browser profile may be able to inspect them.

## Permissions

Flight Alert requests the following Chrome extension permissions:

| Permission | Purpose |
|---|---|
| `notifications` | Display aircraft proximity notifications |
| `alarms` | Schedule automatic background monitoring |
| `storage` | Save preferences, aircraft data and notification history |
| `geolocation` | Detect your current location when requested |
| `https://opensky-network.org/*` | Retrieve aircraft position data from OpenSky |

Flight Alert does not request permission to read browsing history or website content.

## Data Source and API Usage

Aircraft information is provided by the [OpenSky Network](https://opensky-network.org/).

Flight Alert uses the `/api/states/all` endpoint with geographically restricted requests.

OpenSky's hobbyist-use guidance permits purely personal, non-commercial API use within applicable credit limits, subject to its conditions.

Flight Alert is an independent project and is not affiliated with or endorsed by the OpenSky Network.

Users must comply with the applicable [OpenSky API documentation](https://openskynetwork.github.io/opensky-api/index.html) and terms of use.

## Known Limitations

- Aircraft predictions assume approximately straight-line movement.
- Aircraft may change heading, speed or altitude.
- Aircraft position data can be delayed or unavailable.
- Aircraft without suitable tracking data may not be detected.
- Notifications depend on the timing of background checks and incoming aircraft data.
- Automatic monitoring depends on Chrome being able to run the background service worker.
- Desktop geolocation accuracy can vary significantly.
- Anonymous OpenSky API access may be limited or temporarily unavailable.
- International date line and polar-region calculations have been tested with simulated data, but extreme polar trajectories require further validation.
- Real multi-request OpenSky API behaviour has not been fully tested.

## Troubleshooting

### Extension does not load

- Make sure **Developer mode** is enabled.
- Select the `src` folder containing `manifest.json`.
- Confirm all extension files are present.
- Check `chrome://extensions` for reported errors.

### Location detection does not work

- Check Chrome's location permissions.
- Check your operating system's location services.
- Make sure Flight Alert has the `geolocation` permission.
- Alternatively, enter your coordinates manually.

### No aircraft are displayed

- Verify that your home location is configured.
- Check your detection radius.
- Wait for the next scheduled aircraft update.
- Try **Check for aircraft** when manual refresh is available.
- Remember that not every aircraft has suitable position data or a predicted path within your radius.

### Notifications are not appearing

- Ensure Chrome notifications are allowed by your operating system.
- Check that Chrome is running.
- Verify that Flight Alert is enabled.
- Check that eligible aircraft are being detected.
- Remember that the same aircraft has a 45-minute notification cooldown.

### OpenSky data is unavailable

OpenSky may temporarily restrict requests or experience availability issues.

Flight Alert respects API rate limits and maintains a local request budget.

Wait until updates become available again.

## Contributing

Bug reports, suggestions and contributions are welcome.

You can contribute by:

- Opening a GitHub issue.
- Reporting unexpected behaviour.
- Suggesting improvements.
- Submitting a pull request.

For significant changes, consider opening an issue first to discuss the approach.

## Disclaimer

Flight Alert is provided for informational and recreational purposes only.

Predicted aircraft positions, distances and arrival times may be inaccurate.

Do not rely on this extension for aviation navigation, safety-critical decisions or emergency purposes.

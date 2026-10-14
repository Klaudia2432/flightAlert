
const header = document.getElementById("page-header");
const details = document.getElementById("details");
const errorElement = document.getElementById("error");
const updated = document.getElementById("updated");
const refreshButton = document.getElementById("refresh");

function addMetric(label, value) {
  const row = document.createElement("div");
  row.className = "metric";

  const labelElement = document.createElement("span");
  labelElement.textContent = label;

  const valueElement = document.createElement("span");
  valueElement.className = "value";
  valueElement.textContent = value;

  row.append(labelElement, valueElement);
  details.appendChild(row);
}

function render(data) {
  details.replaceChildren();
  errorElement.textContent = "";

  if (data?.error) {
    header.textContent = "Unable to retrieve flights";
    errorElement.textContent = data.error;
    updated.textContent = "Check your connection or API access.";
    return;
  }

  if (!data?.plane) {
    header.textContent = "No predicted passes found";

    const radius = data?.settings?.radiusMiles ?? 3;
    const minutes = data?.settings?.predictionHorizonMinutes ?? 30;

    updated.textContent =
      `No aircraft is predicted to pass within ${radius} ` +
      `${radius === 1 ? "mile" : "miles"} in the next ${minutes} minutes.`;

    return;
}

  const plane = data.plane;

  header.textContent = plane.callsign || "Unknown aircraft";

  const eta = Number(plane.etaMinutes);
  const distance = Number(plane.distanceMiles);
  const closestDistance = Number(plane.closestDistanceMiles);
  const speed = Number(plane.speedMps);
  const track = Number(plane.track);
  const altitude = plane.altitudeM == null
    ? NaN
    : Number(plane.altitudeM);

  addMetric(
    "Estimated closest approach",
    Number.isFinite(eta) ? `${Math.ceil(eta)} min` : "Unavailable"
  );

  addMetric(
    "Current distance",
    Number.isFinite(distance) ? `${distance.toFixed(1)} mi` : "Unavailable"
  );

  addMetric(
    "Predicted closest distance",
    Number.isFinite(closestDistance)
      ? `${closestDistance.toFixed(2)} mi`
      : "Unavailable"
  );

  addMetric(
    "Altitude",
    Number.isFinite(altitude)
      ? `${Math.round(altitude * 3.28084).toLocaleString()} ft`
      : "Unavailable"
  );

  addMetric(
    "Ground speed",
    Number.isFinite(speed)
      ? `${Math.round(speed * 1.94384)} kts`
      : "Unavailable"
  );

  addMetric(
    "Track",
    Number.isFinite(track) ? `${Math.round(track)}°` : "Unavailable"
  );

  updated.textContent =
    `Data checked: ${new Date(
      data.checkedAt || Date.now()
    ).toLocaleTimeString()}`;
}

function refresh() {
  refreshButton.disabled = true;
  header.textContent = "Checking OpenSky...";
  errorElement.textContent = "";
  details.replaceChildren();

  chrome.runtime.sendMessage(
    { type: "GET_FLIGHT" },
    (data) => {
      refreshButton.disabled = false;

      if (chrome.runtime.lastError) {
        render({ error: chrome.runtime.lastError.message });
        return;
      }

      console.log("Flight Alert response:", data);
      render(data);
    }
  );
}

refreshButton.addEventListener("click", refresh);
refresh();

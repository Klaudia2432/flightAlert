let pageHeader = document.getElementById("page-header");

chrome.runtime.sendMessage({ type: "GET_FLIGHT" }, (data) => {
  console.log("RESPONSE:", data);

  if (!data || !data.plane) {
    pageHeader.innerText = "No flights nearby";
    return;
  }

  const plane = data.plane;
  const distance = data.distance ? data.distance * 0.621371 : 0;

  const callsign = plane[1]?.trim() || "Unknown";

  const altitudeFeet = plane[7] ? plane[7] * 3.28084 : 0;
  const speedKnots = plane[9] ? plane[9] * 1.94384 : 0;

  pageHeader.innerText =
    `${callsign}
    Distance: ${distance.toFixed(2)} mi
    Alt: ${altitudeFeet.toFixed(0)} ft
    Speed: ${speedKnots.toFixed(0)} kts`;
});
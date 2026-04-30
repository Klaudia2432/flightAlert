async function fetchNearbyAircraft() {
    
    const url =
    "https://opensky-network.org/api/states/all?lamin=51.0&lomin=-1.5&lamax=52.0&lomax=0.5";

    const res = await fetch(url);
    const data = await res.json();
    console.log("OPEN SKY RAW:", data);
    const toRadians = degrees => degrees * (Math.PI / 180);

    let lat1 = toRadians(51.4700);
    let lon1 = toRadians(-0.4543);
    
    let closestPlane = null;
    let shortestDistance = 200000;

    let planes = data.states;

    if(!planes || planes.length === 0) {
        return null;
    }
    
    for(const plane of planes) {
        if (plane[5] == null || plane[6] == null) continue;
        if (plane[8] !== true) continue;

        let lat2 = toRadians(plane[6]);
        let lon2 = toRadians(plane[5]);

        let dLat = lat2 - lat1;
        let dLon = lon2 - lon1;

        let a = (Math.sin(dLat / 2) * Math.sin(dLat / 2)) + Math.cos(lat1) * Math.cos(lat2) * (Math.sin(dLon / 2) * Math.sin(dLon / 2));
        let c = 2 * Math.atan2(Math.sqrt(a),Math.sqrt(1 - a));
        c *= 6371;

        if(c<shortestDistance) {
            shortestDistance = c;
            closestPlane = plane;
        }
    }
    
    return {
        plane: closestPlane,
        distance: shortestDistance
    }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "GET_FLIGHT") {
    fetchNearbyAircraft().then(sendResponse);
    return true; // keeps async channel open
  }
});
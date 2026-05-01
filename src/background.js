async function fetchNearbyAircraft() {
    
    const url =
    "https://opensky-network.org/api/states/all?lamin=55.3&lomin=-4.8&lamax=56.2&lomax=-3.2";

    const res = await fetch(url);
    const data = await res.json();
    console.log("OPEN SKY RAW:", data);
    const toRadians = degrees => degrees * (Math.PI / 180);

    let lat1 = toRadians(55.7776);
    let lon1 = toRadians(-4.0536);
    
    let closestPlane = null;
    let shortestDistance = 200000;

    let planes = data.states;

    if(!planes || planes.length === 0) {
        return null;
    }
    
    for(const plane of planes) {
        if (plane[5] == null || plane[6] == null) continue;
        if (plane[8] === true) continue;
        if (plane[7] == null || plane[7] < 1000) continue;
        if (plane[9] == null || plane[9] < 50) continue;

        let lat2 = toRadians(plane[6]);
        let lon2 = toRadians(plane[5]);

        let dLat = lat2 - lat1;
        let dLon = lon2 - lon1;

        let a = (Math.sin(dLat / 2) * Math.sin(dLat / 2)) + Math.cos(lat1) * Math.cos(lat2) * (Math.sin(dLon / 2) * Math.sin(dLon / 2));
        let c = 2 * Math.atan2(Math.sqrt(a),Math.sqrt(1 - a));
        c *= 6371;
        if (c > 50) continue;

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
    return true;
  }
});
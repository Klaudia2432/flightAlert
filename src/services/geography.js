export const radians = degrees => degrees * Math.PI / 180;

export function distanceKm(lat1, lon1, lat2, lon2) {
  const dLat = radians(lat2 - lat1);
  const dLon = radians(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(radians(lat1)) * Math.cos(radians(lat2)) *
    Math.sin(dLon / 2) ** 2;

  return 6371 * 2 * Math.atan2(
    Math.sqrt(a),
    Math.sqrt(Math.max(0, 1 - a))
  );
}

// Normalize longitude differences across the international date line.
export function longitudeDifference(fromLon, toLon) {
  return ((toLon - fromLon + 540) % 360) - 180;
}

// Return one or two valid OpenSky bounding boxes for a circular search area.
export function getBoundingBoxes(lat, lon, radiusMiles) {
  const angularRadius = radiusMiles / 3958.7613;
  const latOffset = angularRadius * 180 / Math.PI;
  const lamin = Math.max(-90, lat - latOffset);
  const lamax = Math.min(90, lat + latOffset);

  // A search area touching a pole spans all longitudes.
  if (lamin <= -90 || lamax >= 90) {
    return [{ lamin, lomin: -180, lamax, lomax: 180 }];
  }

  const lonOffset = Math.asin(Math.min(
    1,
    Math.sin(angularRadius) / Math.cos(radians(lat))
  )) * 180 / Math.PI;

  // Represent the centre in [-180, 180) for consistent splitting.
  const centreLon = ((lon + 180) % 360 + 360) % 360 - 180;
  const left = centreLon - lonOffset;
  const right = centreLon + lonOffset;

  if (left < -180) {
    return [
      { lamin, lomin: left + 360, lamax, lomax: 180 },
      { lamin, lomin: -180, lamax, lomax: right }
    ];
  }

  if (right > 180) {
    return [
      { lamin, lomin: left, lamax, lomax: 180 },
      { lamin, lomin: -180, lamax, lomax: right - 360 }
    ];
  }

  return [{ lamin, lomin: left, lamax, lomax: right }];
}

// Calculate local north/east offsets using great-circle distance and bearing.
export function localCoordinates(lat, lon, home) {
  const lat1 = radians(home.lat);
  const lat2 = radians(lat);
  const deltaLon = radians(longitudeDifference(home.lon, lon));
  const bearing = Math.atan2(
    Math.sin(deltaLon) * Math.cos(lat2),
    Math.cos(lat1) * Math.sin(lat2) -
      Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLon)
  );
  const distance = distanceKm(home.lat, home.lon, lat, lon);

  return {
    north: distance * Math.cos(bearing),
    east: distance * Math.sin(bearing)
  };
}

// Estimate the OpenSky credit cost of one bounding-box request.
export function getRequestCredits(bounds) {
  const area = (bounds.lamax - bounds.lamin) *
    (bounds.lomax - bounds.lomin);

  return area <= 25 ? 1 :
    area <= 100 ? 2 :
    area <= 400 ? 3 : 4;
}

export function headingDifference(a, b) {
  return Math.abs(((a - b + 540) % 360) - 180);
}

// Convert a compass bearing into one of eight directions.
export function getCompassDirection(degrees) {
  const directions = [
    'N', 'NE', 'E', 'SE',
    'S', 'SW', 'W', 'NW'
  ];

  const normalized = ((degrees % 360) + 360) % 360;
  const index = Math.round(normalized / 45) % 8;

  return directions[index];
}

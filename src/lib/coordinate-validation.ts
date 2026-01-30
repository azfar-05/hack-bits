// Coordinate validation and debugging utilities

export interface Coordinate {
  latitude: number;
  longitude: number;
}

export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp?: number;
  source?: 'GPS' | 'NETWORK' | 'IP' | 'UNKNOWN';
}

/**
 * Validates if coordinates are within valid ranges
 */
export function isValidCoordinate(lat: number, lng: number): boolean {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180 &&
    !isNaN(lat) &&
    !isNaN(lng)
  );
}

/**
 * Validates coordinate object
 */
export function isValidCoordinateObject(coord: Coordinate): boolean {
  return isValidCoordinate(coord.latitude, coord.longitude);
}

/**
 * Formats coordinates to specified precision
 */
export function formatCoordinate(coord: number, precision: number = 6): number {
  return parseFloat(coord.toFixed(precision));
}

/**
 * Formats coordinate object
 */
export function formatCoordinates(
  coord: Coordinate,
  precision: number = 6
): Coordinate {
  return {
    latitude: formatCoordinate(coord.latitude, precision),
    longitude: formatCoordinate(coord.longitude, precision),
  };
}

/**
 * Debugs coordinate data and logs detailed information
 */
export function debugCoordinate(
  coord: GeolocationPosition,
  context: string = 'Coordinate Debug'
): LocationData {
  const locationData: LocationData = {
    latitude: coord.coords.latitude,
    longitude: coord.coords.longitude,
    accuracy: coord.coords.accuracy,
    timestamp: coord.timestamp,
    source: coord.coords.accuracy && coord.coords.accuracy < 100 ? 'GPS' : 'NETWORK',
  };

  console.group(`📍 ${context}`);
  console.log('Raw Position:', coord);
  console.log('Formatted Coordinates:', {
    latitude: locationData.latitude.toFixed(6),
    longitude: locationData.longitude.toFixed(6),
  });
  console.log('Accuracy:', `${locationData.accuracy?.toFixed(0) || 'Unknown'} meters`);
  console.log('Source:', locationData.source);
  console.log('Timestamp:', new Date(locationData.timestamp || Date.now()).toLocaleString());
  console.log('Valid:', isValidCoordinate(locationData.latitude, locationData.longitude));
  
  if (!isValidCoordinate(locationData.latitude, locationData.longitude)) {
    console.error('❌ INVALID COORDINATES DETECTED');
    console.error('Latitude range: [-90, 90], Longitude range: [-180, 180]');
  }
  
  console.groupEnd();

  return locationData;
}

/**
 * Checks if coordinates appear to be IP-based (less accurate)
 */
export function isIpBasedLocation(accuracy?: number): boolean {
  // IP-based locations typically have accuracy > 1000 meters
  return !accuracy || accuracy > 1000;
}

/**
 * Calculates distance between two coordinates using Haversine formula
 */
export function calculateDistance(
  coord1: Coordinate,
  coord2: Coordinate
): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (coord2.latitude - coord1.latitude) * Math.PI / 180;
  const dLon = (coord2.longitude - coord1.longitude) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(coord1.latitude * Math.PI / 180) * Math.cos(coord2.latitude * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; // Distance in kilometers
}

/**
 * Sanitizes coordinate data for storage/transmission
 */
export function sanitizeCoordinateData(data: any): Coordinate | null {
  try {
    if (!data || typeof data !== 'object') return null;
    
    const lat = Number(data.latitude);
    const lng = Number(data.longitude);
    
    if (!isValidCoordinate(lat, lng)) return null;
    
    return {
      latitude: formatCoordinate(lat, 6),
      longitude: formatCoordinate(lng, 6),
    };
  } catch (error) {
    console.error('Error sanitizing coordinate data:', error);
    return null;
  }
}
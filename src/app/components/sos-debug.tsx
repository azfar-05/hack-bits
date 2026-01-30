"use client";

import { useState } from "react";

export function LocationDebugger() {
  const [locationData, setLocationData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const testLocation = async () => {
    if (!navigator.geolocation) {
      setError("Geolocation not supported");
      return;
    }

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0, // Don't use cached position
        });
      });

      const { latitude, longitude } = position.coords;
      
      setLocationData({
        captured: {
          latitude,
          longitude,
          accuracy: position.coords.accuracy,
          timestamp: new Date(position.timestamp).toISOString()
        },
        formatted: {
          latLng: [latitude, longitude],
          latLngString: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
          googleMaps: `https://www.google.com/maps?q=${latitude},${longitude}`
        }
      });
      
      setError(null);
    } catch (err) {
      setError(`Location error: ${err}`);
      console.error("Geolocation error:", err);
    }
  };

  return (
    <div className="fixed bottom-4 left-4 bg-white p-4 rounded-lg shadow-lg z-50 max-w-md">
      <h3 className="font-bold mb-2">Location Debugger</h3>
      
      <button 
        onClick={testLocation}
        className="bg-blue-500 text-white px-3 py-1 rounded text-sm mb-3"
      >
        Test Location
      </button>

      {error && (
        <div className="text-red-600 text-sm mb-2">{error}</div>
      )}

      {locationData && (
        <div className="text-xs space-y-1">
          <div><strong>Raw Coords:</strong></div>
          <div>Lat: {locationData.captured.latitude}</div>
          <div>Lng: {locationData.captured.longitude}</div>
          <div>Accuracy: {locationData.captured.accuracy}m</div>
          
          <div className="mt-2"><strong>Formatted:</strong></div>
          <div>[{locationData.formatted.latLng.join(', ')}]</div>
          
          <div className="mt-2">
            <a 
              href={locationData.formatted.googleMaps} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-600 underline"
            >
              View on Google Maps
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
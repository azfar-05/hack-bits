"use client";

import { useState } from "react";

export default function TestLocationPage() {
  const [status, setStatus] = useState<string>("idle");
  const [location, setLocation] = useState<any>(null);
  const [error, setError] = useState<string>("");
  const [permissionStatus, setPermissionStatus] = useState<string>("unknown");

  const checkPermission = async () => {
    try {
      const result = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
      setPermissionStatus(result.state);
      result.addEventListener('change', () => {
        setPermissionStatus(result.state);
      });
    } catch (err) {
      setPermissionStatus("Unable to check (browser may not support)");
    }
  };

  const testGeolocation = () => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser");
      return;
    }

    setStatus("requesting");
    setError("");
    setLocation(null);

    console.log("🔍 Starting geolocation test...");
    const startTime = Date.now();

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const endTime = Date.now();
        const timeTaken = ((endTime - startTime) / 1000).toFixed(2);
        
        console.log("✅ Location obtained in " + timeTaken + " seconds");
        console.log("Full position object:", position);
        
        setStatus("success");
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          altitude: position.coords.altitude,
          altitudeAccuracy: position.coords.altitudeAccuracy,
          heading: position.coords.heading,
          speed: position.coords.speed,
          timestamp: new Date(position.timestamp).toLocaleString(),
          timeTaken: timeTaken + " seconds",
        });
      },
      (err) => {
        const endTime = Date.now();
        const timeTaken = ((endTime - startTime) / 1000).toFixed(2);
        
        console.error("❌ Geolocation error after " + timeTaken + " seconds:", err);
        
        setStatus("error");
        let errorMessage = `Error Code: ${err.code}\n`;
        
        switch(err.code) {
          case err.PERMISSION_DENIED:
            errorMessage += "PERMISSION_DENIED: User denied the request for Geolocation.";
            break;
          case err.POSITION_UNAVAILABLE:
            errorMessage += "POSITION_UNAVAILABLE: Location information is unavailable.";
            break;
          case err.TIMEOUT:
            errorMessage += "TIMEOUT: The request to get user location timed out.";
            break;
          default:
            errorMessage += "UNKNOWN_ERROR: An unknown error occurred.";
        }
        
        errorMessage += `\n\nMessage: ${err.message}`;
        errorMessage += `\nTime taken: ${timeTaken} seconds`;
        
        setError(errorMessage);
      },
      {
        enableHighAccuracy: true,
        timeout: 30000,
        maximumAge: 0,
      }
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Geolocation Test Page</h1>
        
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Browser Information</h2>
          <div className="space-y-2 text-sm">
            <p><strong>User Agent:</strong> {navigator.userAgent}</p>
            <p><strong>Geolocation Support:</strong> {navigator.geolocation ? "✅ Yes" : "❌ No"}</p>
            <p><strong>HTTPS:</strong> {window.location.protocol === 'https:' ? "✅ Yes" : "⚠️ No (required for geolocation)"}</p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Permission Status</h2>
          <button
            onClick={checkPermission}
            className="mb-4 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            Check Permission
          </button>
          <p className="text-sm">
            <strong>Status:</strong> <span className={`font-mono ${
              permissionStatus === 'granted' ? 'text-green-600' :
              permissionStatus === 'denied' ? 'text-red-600' :
              permissionStatus === 'prompt' ? 'text-yellow-600' :
              'text-gray-600'
            }`}>{permissionStatus}</span>
          </p>
          {permissionStatus === 'denied' && (
            <p className="mt-2 text-sm text-red-600">
              ⚠️ Location permission is denied. You need to reset this in your browser settings.
            </p>
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Test Geolocation</h2>
          
          <button
            onClick={testGeolocation}
            disabled={status === "requesting"}
            className={`px-6 py-3 rounded font-medium ${
              status === "requesting"
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-green-500 hover:bg-green-600 text-white"
            }`}
          >
            {status === "requesting" ? "🔍 Getting Location..." : "Get Location"}
          </button>

          {status === "requesting" && (
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded">
              <p className="text-blue-700">
                <strong>⏳ Waiting for location...</strong>
                <br />
                <span className="text-sm">
                  This may take up to 30 seconds for GPS lock.
                  <br />
                  For best results: Go outside with clear sky view.
                </span>
              </p>
            </div>
          )}

          {status === "success" && location && (
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded">
              <h3 className="font-semibold text-green-800 mb-2">✅ Success!</h3>
              <div className="space-y-1 text-sm font-mono">
                <p><strong>Latitude:</strong> {location.latitude}</p>
                <p><strong>Longitude:</strong> {location.longitude}</p>
                <p><strong>Accuracy:</strong> {location.accuracy?.toFixed(2)} meters</p>
                <p><strong>Altitude:</strong> {location.altitude ?? "N/A"}</p>
                <p><strong>Speed:</strong> {location.speed ?? "N/A"}</p>
                <p><strong>Heading:</strong> {location.heading ?? "N/A"}</p>
                <p><strong>Timestamp:</strong> {location.timestamp}</p>
                <p><strong>Time Taken:</strong> {location.timeTaken}</p>
                <p className={`mt-2 ${location.accuracy > 100 ? 'text-orange-600' : 'text-green-600'}`}>
                  <strong>Source Estimate:</strong> {
                    location.accuracy < 50 ? "🛰️ GPS (High Accuracy)" :
                    location.accuracy < 100 ? "📡 GPS/Cell Tower" :
                    location.accuracy < 1000 ? "📱 Cell Tower" :
                    "🌐 IP-based (Low Accuracy)"
                  }
                </p>
              </div>
            </div>
          )}

          {status === "error" && error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded">
              <h3 className="font-semibold text-red-800 mb-2">❌ Error</h3>
              <pre className="text-sm text-red-700 whitespace-pre-wrap">{error}</pre>
              
              <div className="mt-4 space-y-2 text-sm">
                <p className="font-semibold">Troubleshooting tips:</p>
                <ul className="list-disc ml-5 space-y-1">
                  <li>Check if location services are enabled on your device</li>
                  <li>Make sure you're using HTTPS (not HTTP)</li>
                  <li>Check browser location permissions in settings</li>
                  <li>Try going outside for better GPS signal</li>
                  <li>Some browsers block location on localhost - try using 127.0.0.1 or deploy to a server</li>
                  <li>Clear browser cache and reload</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Settings Used</h2>
          <pre className="bg-gray-100 p-4 rounded text-sm overflow-x-auto">
{`{
  enableHighAccuracy: true,  // Use GPS instead of WiFi/IP
  timeout: 30000,            // 30 second timeout
  maximumAge: 0              // Force fresh location (no cache)
}`}
          </pre>
        </div>
      </div>
    </div>
  );
}

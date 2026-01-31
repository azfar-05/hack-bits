"use client";

import { useEffect, useRef, useState } from "react";

interface AlertLocationPickerProps {
  latitude: number | null;
  longitude: number | null;
  radiusKm: number;
  onLocationChange: (lat: number, lng: number) => void;
  onRadiusChange: (radius: number) => void;
}

// Dynamic import for Leaflet (only runs on client)
let L: any = null;

export default function AlertLocationPicker({
  latitude,
  longitude,
  radiusKm,
  onLocationChange,
  onRadiusChange,
}: AlertLocationPickerProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const circleRef = useRef<any>(null);
  const [mapReady, setMapReady] = useState(false);
  const [manualLat, setManualLat] = useState(latitude?.toString() || "");
  const [manualLng, setManualLng] = useState(longitude?.toString() || "");
  const [inputMode, setInputMode] = useState<"map" | "manual">("map");

  // Initialize map
  useEffect(() => {
    if (typeof window === "undefined") return;

    const initMap = async () => {
      if (!L) {
        L = (await import("leaflet")).default;

        // Fix for default marker icons in webpack
        delete (L.Icon.Default.prototype as any)._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl:
            "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
          iconUrl:
            "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
          shadowUrl:
            "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
        });
      }

      if (!mapRef.current || mapInstanceRef.current) return;

      // Default center for Karnataka or use provided location
      const defaultCenter =
        latitude && longitude
          ? { lat: latitude, lng: longitude }
          : { lat: 15.3173, lng: 75.7139 };

      // Create map
      mapInstanceRef.current = L.map(mapRef.current).setView(
        [defaultCenter.lat, defaultCenter.lng],
        latitude && longitude ? 10 : 7
      );

      // Add OpenStreetMap tiles
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(mapInstanceRef.current);

      // Add click handler for location selection
      mapInstanceRef.current.on("click", (e: any) => {
        const { lat, lng } = e.latlng;
        onLocationChange(lat, lng);
        setManualLat(lat.toFixed(6));
        setManualLng(lng.toFixed(6));
      });

      // If we have initial coordinates, add marker and circle
      if (latitude && longitude) {
        updateMarkerAndCircle(latitude, longitude, radiusKm);
      }

      setMapReady(true);
    };

    initMap();

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update marker and circle when coordinates or radius change
  const updateMarkerAndCircle = (lat: number, lng: number, radius: number) => {
    if (!mapInstanceRef.current || !L) return;

    // Remove existing marker and circle
    if (markerRef.current) {
      markerRef.current.remove();
    }
    if (circleRef.current) {
      circleRef.current.remove();
    }

    // Create custom icon for alert epicenter
    const alertIcon = L.divIcon({
      className: "custom-marker",
      html: `
        <div class="flex items-center justify-center w-10 h-10 rounded-full bg-red-600 border-3 border-white shadow-lg">
          <span class="text-white text-xl">!</span>
        </div>
      `,
      iconSize: [40, 40],
      iconAnchor: [20, 20],
    });

    // Add marker at epicenter
    markerRef.current = L.marker([lat, lng], { icon: alertIcon }).addTo(
      mapInstanceRef.current
    );

    // Add circle for affected area
    circleRef.current = L.circle([lat, lng], {
      radius: radius * 1000, // Convert km to meters
      color: "#dc2626",
      fillColor: "#ef4444",
      fillOpacity: 0.2,
      weight: 2,
    }).addTo(mapInstanceRef.current);

    // Center map on the location and fit the circle
    mapInstanceRef.current.setView([lat, lng], getZoomForRadius(radius));
  };

  // Get appropriate zoom level for radius
  const getZoomForRadius = (radiusKm: number): number => {
    if (radiusKm <= 5) return 12;
    if (radiusKm <= 10) return 11;
    if (radiusKm <= 15) return 10;
    if (radiusKm <= 20) return 9;
    return 8;
  };

  // Update when coordinates change
  useEffect(() => {
    if (mapReady && latitude && longitude) {
      updateMarkerAndCircle(latitude, longitude, radiusKm);
    }
  }, [latitude, longitude, radiusKm, mapReady]);

  // Handle manual coordinate input
  const handleManualSubmit = () => {
    const lat = parseFloat(manualLat);
    const lng = parseFloat(manualLng);

    if (isNaN(lat) || isNaN(lng)) {
      alert("Please enter valid coordinates");
      return;
    }

    if (lat < -90 || lat > 90) {
      alert("Latitude must be between -90 and 90");
      return;
    }

    if (lng < -180 || lng > 180) {
      alert("Longitude must be between -180 and 180");
      return;
    }

    onLocationChange(lat, lng);
  };

  // Use current location
  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude: lat, longitude: lng } = position.coords;
        onLocationChange(lat, lng);
        setManualLat(lat.toFixed(6));
        setManualLng(lng.toFixed(6));
      },
      (error) => {
        alert(`Error getting location: ${error.message}`);
      },
      { enableHighAccuracy: true }
    );
  };

  return (
    <div className="space-y-4">
      {/* Leaflet CSS */}
      <link
        rel="stylesheet"
        href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css"
      />
      <style>{`
        .custom-marker {
          background: transparent !important;
          border: none !important;
        }
      `}</style>

      {/* Radius Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Impact Radius
        </label>
        <select
          value={radiusKm}
          onChange={(e) => onRadiusChange(parseInt(e.target.value))}
          className="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
        >
          <option value={5}>5 km</option>
          <option value={10}>10 km</option>
          <option value={15}>15 km</option>
          <option value={20}>20 km</option>
          <option value={30}>30 km</option>
        </select>
      </div>

      {/* Input Mode Toggle */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setInputMode("map")}
          className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
            inputMode === "map"
              ? "bg-red-600 text-white"
              : "bg-gray-200 text-gray-700 hover:bg-gray-300"
          }`}
        >
          Click on Map
        </button>
        <button
          type="button"
          onClick={() => setInputMode("manual")}
          className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
            inputMode === "manual"
              ? "bg-red-600 text-white"
              : "bg-gray-200 text-gray-700 hover:bg-gray-300"
          }`}
        >
          Enter Coordinates
        </button>
      </div>

      {/* Map View */}
      <div className={inputMode === "map" ? "block" : "hidden"}>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm text-gray-600">
            Click on the map to select alert location
          </p>
          <button
            type="button"
            onClick={handleUseCurrentLocation}
            className="text-sm text-red-600 hover:text-red-700 font-medium"
          >
            Use My Location
          </button>
        </div>
        <div
          ref={mapRef}
          className="h-64 w-full rounded-lg border border-gray-300 bg-gray-100"
        />
      </div>

      {/* Manual Coordinate Input */}
      <div className={inputMode === "manual" ? "block" : "hidden"}>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Latitude
            </label>
            <input
              type="number"
              step="any"
              value={manualLat}
              onChange={(e) => setManualLat(e.target.value)}
              placeholder="e.g., 15.3173"
              className="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Longitude
            </label>
            <input
              type="number"
              step="any"
              value={manualLng}
              onChange={(e) => setManualLng(e.target.value)}
              placeholder="e.g., 75.7139"
              className="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
            />
          </div>
        </div>
        <button
          type="button"
          onClick={handleManualSubmit}
          className="mt-3 w-full rounded-md bg-gray-600 px-4 py-2 text-sm text-white font-medium hover:bg-gray-700 transition-colors"
        >
          Set Location
        </button>
      </div>

      {/* Selected Location Display */}
      {latitude && longitude && (
        <div className="rounded-md bg-green-50 border border-green-200 p-3">
          <div className="flex items-center gap-2 mb-1">
            <svg
              className="h-5 w-5 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            <span className="font-medium text-green-800">Location Selected</span>
          </div>
          <p className="text-sm text-green-700">
            Coordinates: {latitude.toFixed(6)}, {longitude.toFixed(6)}
          </p>
          <p className="text-sm text-green-700">
            Estimated affected radius: {radiusKm} km
          </p>
        </div>
      )}
    </div>
  );
}

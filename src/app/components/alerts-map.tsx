"use client";

import { useEffect, useRef, useState } from "react";

interface Alert {
  id: string;
  title: string;
  message: string;
  disasterType: string;
  latitude: number;
  longitude: number;
  radiusKm: number;
  createdAt: Date;
  distance?: number;
  isInAffectedZone?: boolean;
}

interface AlertsMapProps {
  alerts: Alert[];
  userLocation?: { latitude: number; longitude: number } | null;
  className?: string;
}

// Dynamic import for Leaflet (only runs on client)
let L: any = null;

const disasterColors: Record<string, { color: string; fillColor: string }> = {
  FLOOD: { color: "#1d4ed8", fillColor: "#3b82f6" },
  EARTHQUAKE: { color: "#c2410c", fillColor: "#f97316" },
  FIRE: { color: "#b91c1c", fillColor: "#ef4444" },
};

export default function AlertsMap({
  alerts,
  userLocation,
  className = "",
}: AlertsMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const [mapReady, setMapReady] = useState(false);

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

      // Default center - Karnataka or user location if available
      const defaultCenter = userLocation
        ? { lat: userLocation.latitude, lng: userLocation.longitude }
        : { lat: 15.3173, lng: 75.7139 };

      // Create map
      mapInstanceRef.current = L.map(mapRef.current).setView(
        [defaultCenter.lat, defaultCenter.lng],
        userLocation ? 10 : 7
      );

      // Add OpenStreetMap tiles
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(mapInstanceRef.current);

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

  // Update markers when alerts or user location changes
  useEffect(() => {
    if (!mapInstanceRef.current || !L || !mapReady) return;

    // Clear existing markers
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    // Add user location marker
    if (userLocation) {
      const userIcon = L.divIcon({
        className: "custom-marker",
        html: `
          <div class="flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 border-3 border-white shadow-lg">
            <span class="text-white text-xs font-bold">You</span>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const userMarker = L.marker(
        [userLocation.latitude, userLocation.longitude],
        { icon: userIcon }
      ).addTo(mapInstanceRef.current);

      userMarker.bindPopup(`
        <div class="p-2">
          <strong>Your Location</strong>
          <p class="text-sm text-gray-600">
            ${userLocation.latitude.toFixed(4)}, ${userLocation.longitude.toFixed(4)}
          </p>
        </div>
      `);

      markersRef.current.push(userMarker);
    }

    // Add alert markers and circles
    alerts.forEach((alert) => {
      const colors = disasterColors[alert.disasterType] || {
        color: "#6b7280",
        fillColor: "#9ca3af",
      };

      // Add circle for affected area
      const circle = L.circle([alert.latitude, alert.longitude], {
        radius: alert.radiusKm * 1000, // Convert km to meters
        color: colors.color,
        fillColor: colors.fillColor,
        fillOpacity: 0.2,
        weight: 2,
      }).addTo(mapInstanceRef.current);

      markersRef.current.push(circle);

      // Add marker at epicenter
      const alertIcon = L.divIcon({
        className: "custom-marker",
        html: `
          <div class="flex items-center justify-center w-10 h-10 rounded-full ${
            alert.isInAffectedZone ? "bg-red-600 animate-pulse" : "bg-orange-500"
          } border-3 border-white shadow-lg">
            <span class="text-white text-xl">!</span>
          </div>
        `,
        iconSize: [40, 40],
        iconAnchor: [20, 20],
      });

      const marker = L.marker([alert.latitude, alert.longitude], {
        icon: alertIcon,
      }).addTo(mapInstanceRef.current);

      marker.bindPopup(`
        <div class="p-3 min-w-[200px]">
          <div class="flex items-center gap-2 mb-2">
            <span class="px-2 py-1 rounded-full text-xs font-medium" style="background-color: ${colors.fillColor}20; color: ${colors.color}">
              ${alert.disasterType}
            </span>
            ${
              alert.isInAffectedZone
                ? '<span class="px-2 py-1 rounded-full text-xs font-bold bg-red-600 text-white">AFFECTED</span>'
                : ""
            }
          </div>
          <h3 class="font-bold text-lg">${alert.title}</h3>
          <p class="text-sm text-gray-600 mt-1">${alert.message}</p>
          <div class="mt-2 pt-2 border-t border-gray-200 text-xs text-gray-500">
            <p>Affected radius: ${alert.radiusKm} km</p>
            ${alert.distance !== undefined ? `<p>Distance from you: ${alert.distance.toFixed(1)} km</p>` : ""}
            <p>Created: ${new Date(alert.createdAt).toLocaleString()}</p>
          </div>
        </div>
      `);

      markersRef.current.push(marker);
    });

    // Fit map to show all alerts if there are any
    if (alerts.length > 0) {
      const bounds = L.latLngBounds(
        alerts.map((a) => [a.latitude, a.longitude])
      );
      if (userLocation) {
        bounds.extend([userLocation.latitude, userLocation.longitude]);
      }
      mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [alerts, userLocation, mapReady]);

  return (
    <div className={`relative ${className}`}>
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
        .leaflet-popup-content-wrapper {
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }
      `}</style>

      <div
        ref={mapRef}
        className="h-full w-full min-h-[300px] rounded-lg bg-gray-100"
      />

      {/* Map Legend */}
      <div className="absolute top-3 right-3 bg-white rounded-lg shadow-lg p-3 z-[1000] text-xs">
        <h4 className="font-semibold text-gray-900 mb-2">Legend</h4>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-600"></div>
            <span>Your Location</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500 opacity-50"></div>
            <span>Flood Zone</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-orange-500 opacity-50"></div>
            <span>Earthquake Zone</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500 opacity-50"></div>
            <span>Fire Zone</span>
          </div>
        </div>
      </div>
    </div>
  );
}

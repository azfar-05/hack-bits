"use client";

import { useEffect, useRef } from "react";

interface MapMarker {
  lat: number;
  lng: number;
  type: "user" | "volunteer";
  label?: string;
}

interface RescueMapProps {
  markers: MapMarker[];
  center?: { lat: number; lng: number };
  zoom?: number;
}

// Dynamic import for Leaflet (only runs on client)
let L: any = null;

export default function RescueMap({ markers, center, zoom = 13 }: RescueMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

  useEffect(() => {
    // Only run on client
    if (typeof window === "undefined") return;

    // Dynamically import Leaflet
    const initMap = async () => {
      if (!L) {
        L = (await import("leaflet")).default;
        
        // Fix for default marker icons in webpack
        delete (L.Icon.Default.prototype as any)._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
          iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
          shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
        });
      }

      if (!mapRef.current || mapInstanceRef.current) return;

      // Default center (can be overridden)
      const defaultCenter = center || { lat: 12.9716, lng: 77.5946 }; // Bangalore

      // Create map
      mapInstanceRef.current = L.map(mapRef.current).setView(
        [defaultCenter.lat, defaultCenter.lng],
        zoom
      );

      // Add OpenStreetMap tiles
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(mapInstanceRef.current);
    };

    initMap();

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update markers when they change
  useEffect(() => {
    if (!mapInstanceRef.current || !L) return;

    // Clear existing markers
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    // Add new markers
    markers.forEach((m) => {
      if (!m.lat || !m.lng) return;

      // Create custom icon based on type
      const icon = L.divIcon({
        className: "custom-marker",
        html: `
          <div class="flex items-center justify-center w-8 h-8 rounded-full ${
            m.type === "user"
              ? "bg-red-500 border-2 border-white shadow-lg"
              : "bg-blue-500 border-2 border-white shadow-lg"
          }">
            <span class="text-white text-xs font-bold">
              ${m.type === "user" ? "!" : "V"}
            </span>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const marker = L.marker([m.lat, m.lng], { icon }).addTo(mapInstanceRef.current);

      if (m.label) {
        marker.bindPopup(`
          <div class="text-sm">
            <strong>${m.type === "user" ? "User in Danger" : "Volunteer"}</strong>
            <br/>
            ${m.label}
          </div>
        `);
      }

      markersRef.current.push(marker);
    });

    // Fit bounds to show all markers
    if (markers.length > 0) {
      const validMarkers = markers.filter((m) => m.lat && m.lng);
      if (validMarkers.length > 0) {
        const bounds = L.latLngBounds(validMarkers.map((m) => [m.lat, m.lng]));
        mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
      }
    }

    // Draw line between user and volunteer if both exist
    const userMarker = markers.find((m) => m.type === "user");
    const volunteerMarker = markers.find((m) => m.type === "volunteer");

    if (userMarker && volunteerMarker && userMarker.lat && volunteerMarker.lat) {
      const polyline = L.polyline(
        [
          [userMarker.lat, userMarker.lng],
          [volunteerMarker.lat, volunteerMarker.lng],
        ],
        {
          color: "#6366f1",
          weight: 3,
          opacity: 0.7,
          dashArray: "10, 10",
        }
      ).addTo(mapInstanceRef.current);

      markersRef.current.push(polyline);
    }
  }, [markers]);

  return (
    <>
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
      <div ref={mapRef} className="h-full w-full min-h-[300px] rounded-lg" />
    </>
  );
}

/**
 * Calculate distance between two coordinates using Haversine formula
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

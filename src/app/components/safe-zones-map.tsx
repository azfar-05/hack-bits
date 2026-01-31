"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "~/trpc/react";

interface SafeZone {
  id: string;
  name: string;
  type: "SHELTER" | "CAMP" | "HOSPITAL";
  latitude: number;
  longitude: number;
  capacity?: number | null;
  creator: {
    role: string;
  };
}

interface SafeZonesMapProps {
  center?: { lat: number; lng: number };
  zoom?: number;
  className?: string;
  userLocation?: { latitude: number; longitude: number } | null;
  showUserLocation?: boolean;
}

// Dynamic import for Leaflet (only runs on client)
let L: any = null;

export function SafeZonesMap({ 
  center = { lat: 12.9716, lng: 74.5946 }, // Default to Mangalore
  zoom = 10, 
  className = "",
  userLocation,
  showUserLocation = true
}: SafeZonesMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const [mapReady, setMapReady] = useState(false);

  // Fetch safe zones data
  const safeZonesQuery = api.safeZone.getPublic.useQuery(undefined, {
    refetchInterval: 60000, // Refresh every minute
  });

  // Initialize map
  useEffect(() => {
    const initMap = async () => {
      if (typeof window === "undefined" || !mapRef.current) return;

      try {
        // Dynamic import of Leaflet
        L = (await import("leaflet")).default;

        // Fix for default markers
        delete (L.Icon.Default.prototype as any)._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
          iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
          shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
        });

        // Create map
        const map = L.map(mapRef.current).setView([center.lat, center.lng], zoom);

        // Add tile layer
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          maxZoom: 19,
        }).addTo(map);

        mapInstanceRef.current = map;
        setMapReady(true);

        console.log("🗺️ Safe zones map initialized");
      } catch (error) {
        console.error("Failed to initialize map:", error);
      }
    };

    initMap();

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [center.lat, center.lng, zoom]);

  // Update markers when data changes
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || !L) return;

    // Clear existing markers
    markersRef.current.forEach(marker => {
      mapInstanceRef.current.removeLayer(marker);
    });
    markersRef.current = [];

    const markers: any[] = [];

    // Add user location marker
    if (showUserLocation && userLocation) {
      const userIcon = L.divIcon({
        html: `<div style="background: #3b82f6; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
        className: 'custom-div-icon',
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      });

      const userMarker = L.marker([userLocation.latitude, userLocation.longitude], { icon: userIcon })
        .bindPopup(`
          <div class="p-2">
            <h3 class="font-semibold text-blue-600">📍 Your Location</h3>
            <p class="text-sm text-gray-600">Current position</p>
          </div>
        `)
        .addTo(mapInstanceRef.current);

      markers.push(userMarker);
    }

    // Add safe zone markers
    if (safeZonesQuery.data) {
      safeZonesQuery.data.forEach((zone: SafeZone) => {
        const { icon, color } = getSafeZoneIcon(zone.type);
        
        const safeZoneIcon = L.divIcon({
          html: `<div style="background: ${color}; width: 30px; height: 30px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; font-size: 16px;">${icon}</div>`,
          className: 'custom-div-icon',
          iconSize: [30, 30],
          iconAnchor: [15, 15]
        });

        const distance = userLocation ? 
          calculateDistance(userLocation.latitude, userLocation.longitude, zone.latitude, zone.longitude) : 
          null;

        const marker = L.marker([zone.latitude, zone.longitude], { icon: safeZoneIcon })
          .bindPopup(`
            <div class="p-3 min-w-[200px]">
              <h3 class="font-semibold text-gray-900 mb-2">${icon} ${zone.name}</h3>
              <div class="space-y-1 text-sm">
                <p><span class="font-medium">Type:</span> ${zone.type.toLowerCase().replace('_', ' ')}</p>
                ${zone.capacity ? `<p><span class="font-medium">Capacity:</span> ${zone.capacity} people</p>` : ''}
                <p><span class="font-medium">Verified by:</span> ${zone.creator.role}</p>
                ${distance ? `<p><span class="font-medium">Distance:</span> ${distance.toFixed(1)} km away</p>` : ''}
              </div>
              <div class="mt-2 pt-2 border-t border-gray-200">
                <button 
                  onclick="window.open('https://www.google.com/maps/dir/?api=1&destination=${zone.latitude},${zone.longitude}', '_blank')"
                  class="text-blue-600 hover:text-blue-800 text-sm font-medium"
                >
                  Get Directions →
                </button>
              </div>
            </div>
          `)
          .addTo(mapInstanceRef.current);

        markers.push(marker);
      });
    }

    markersRef.current = markers;

    // Auto-fit map to show all markers if there are any
    if (markers.length > 1) {
      const group = new L.featureGroup(markers);
      mapInstanceRef.current.fitBounds(group.getBounds().pad(0.1));
    }

  }, [mapReady, safeZonesQuery.data, userLocation, showUserLocation]);

  const getSafeZoneIcon = (type: string) => {
    switch (type) {
      case 'SHELTER':
        return { icon: '🏠', color: '#10b981' }; // Green
      case 'CAMP':
        return { icon: '⛺', color: '#f59e0b' }; // Orange
      case 'HOSPITAL':
        return { icon: '🏥', color: '#ef4444' }; // Red
      default:
        return { icon: '🏢', color: '#6b7280' }; // Gray
    }
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  return (
    <div className={`relative ${className}`}>
      <div ref={mapRef} className="w-full h-full rounded-lg" />
      
      {/* Loading overlay */}
      {safeZonesQuery.isLoading && (
        <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center rounded-lg">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
            <p className="text-sm text-gray-600">Loading safe zones...</p>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="absolute top-4 right-4 bg-white rounded-lg shadow-lg p-3 z-[1000]">
        <h4 className="font-semibold text-gray-900 mb-2 text-sm">Safe Zones</h4>
        <div className="space-y-1 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center text-xs">🏠</div>
            <span>Shelters</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-orange-500 flex items-center justify-center text-xs">⛺</div>
            <span>Camps</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-red-500 flex items-center justify-center text-xs">🏥</div>
            <span>Hospitals</span>
          </div>
          {showUserLocation && userLocation && (
            <div className="flex items-center gap-2 pt-1 border-t border-gray-200">
              <div className="w-4 h-4 rounded-full bg-blue-500"></div>
              <span>Your Location</span>
            </div>
          )}
        </div>
        
        {safeZonesQuery.data && (
          <div className="mt-2 pt-2 border-t border-gray-200 text-xs text-gray-600">
            {safeZonesQuery.data.length} safe zones available
          </div>
        )}
      </div>
    </div>
  );
}

// Helper function to calculate distance
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}
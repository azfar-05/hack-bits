"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "~/trpc/react";

interface MapMarker {
  lat: number;
  lng: number;
  type: "user_danger" | "volunteer" | "shelter" | "camp" | "hospital" | "high_risk" | "medium_risk" | "low_risk";
  label?: string;
  data?: any;
}

interface AuthorityCommandMapProps {
  center?: { lat: number; lng: number };
  zoom?: number;
  className?: string;
}

// Dynamic import for Leaflet (only runs on client)
let L: any = null;

export default function AuthorityCommandMap({ 
  center, 
  zoom = 7, 
  className = "" 
}: AuthorityCommandMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const [mapReady, setMapReady] = useState(false);

  // Fetch all data needed for authority view
  const dangerZonesQuery = api.dangerZone.getAll.useQuery(undefined, {
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const safeZonesQuery = api.safeZone.getAll.useQuery(undefined, {
    refetchInterval: 60000, // Refresh every minute
  });

  const allRescueRequestsQuery = api.rescue.getAllRequests.useQuery(undefined, {
    refetchInterval: 15000, // Refresh every 15 seconds
  });

  const volunteersQuery = api.volunteer.getAllWithLocations.useQuery(undefined, {
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const resourceNodesQuery = api.resourceNode.getAll.useQuery(undefined, {
    refetchInterval: 60000, // Refresh every minute
  });

  // Initialize map
  useEffect(() => {
    if (typeof window === "undefined") return;

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

      // Default center for Karnataka
      const defaultCenter = center || { lat: 15.3173, lng: 75.7139 };

      // Create map
      mapInstanceRef.current = L.map(mapRef.current).setView(
        [defaultCenter.lat, defaultCenter.lng],
        zoom
      );

      // Add OpenStreetMap tiles
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
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
  }, [center, zoom]);

  // Update markers when data changes
  useEffect(() => {
    if (!mapInstanceRef.current || !L || !mapReady) return;

    // Clear existing markers
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    const markers: MapMarker[] = [];

    // Add danger zones as colored rectangles
    if (dangerZonesQuery.data) {
      dangerZonesQuery.data.forEach((zone) => {
        const ZONE_SIZE = 0.01;
        const bounds = [
          [zone.zoneLat, zone.zoneLng],
          [zone.zoneLat + ZONE_SIZE, zone.zoneLng + ZONE_SIZE],
        ] as [[number, number], [number, number]];

        const color = zone.riskLevel === "HIGH" ? "#dc2626" : 
                     zone.riskLevel === "MEDIUM" ? "#d97706" : "#16a34a";

        const rectangle = L.rectangle(bounds, {
          color: color,
          fillColor: color,
          fillOpacity: 0.4,
          weight: 2,
          opacity: 0.8,
        }).addTo(mapInstanceRef.current);

        rectangle.bindPopup(`
          <div class="p-3 min-w-[200px]">
            <div class="flex items-center gap-2 mb-2">
              <div class="w-4 h-4 rounded-full" style="background-color: ${color}"></div>
              <strong class="text-lg">${zone.riskLevel} Risk Zone</strong>
            </div>
            <div class="space-y-1 text-sm">
              <div class="flex justify-between">
                <span>Risk Score:</span>
                <strong>${zone.score}</strong>
              </div>
              <div class="flex justify-between">
                <span>Recent SOS:</span>
                <strong class="text-red-600">${zone.sosCount}</strong>
              </div>
              <div class="flex justify-between">
                <span>Pending Help:</span>
                <strong class="text-orange-600">${zone.unknownUsers}</strong>
              </div>
              <div class="flex justify-between">
                <span>Trend:</span>
                <strong class="${zone.growthRate > 0 ? 'text-red-600' : zone.growthRate < 0 ? 'text-green-600' : 'text-gray-600'}">
                  ${zone.growthRate > 0 ? `↗ +${zone.growthRate}` : zone.growthRate < 0 ? `↘ ${zone.growthRate}` : '→ 0'}
                </strong>
              </div>
            </div>
          </div>
        `);

        markersRef.current.push(rectangle);
      });
    }

    // Add safe zones
    if (safeZonesQuery.data) {
      safeZonesQuery.data.forEach((safeZone) => {
        const emoji = safeZone.type === "SHELTER" ? "🏕" : 
                     safeZone.type === "CAMP" ? "⛺" : "🏥";

        const icon = L.divIcon({
          className: "custom-marker",
          html: `
            <div class="flex items-center justify-center w-10 h-10 rounded-full bg-green-500 border-3 border-white shadow-lg">
              <span class="text-lg">${emoji}</span>
            </div>
          `,
          iconSize: [40, 40],
          iconAnchor: [20, 20],
        });

        const marker = L.marker([safeZone.latitude, safeZone.longitude], { icon })
          .addTo(mapInstanceRef.current);

        marker.bindPopup(`
          <div class="p-3 min-w-[200px]">
            <div class="flex items-center gap-2 mb-2">
              <span class="text-2xl">${emoji}</span>
              <strong class="text-lg">${safeZone.name}</strong>
            </div>
            <div class="space-y-1 text-sm">
              <div class="flex justify-between">
                <span>Type:</span>
                <strong>${safeZone.type}</strong>
              </div>
              ${safeZone.capacity ? `
                <div class="flex justify-between">
                  <span>Capacity:</span>
                  <strong class="text-blue-600">${safeZone.capacity} people</strong>
                </div>
              ` : ''}
              <div class="flex justify-between">
                <span>Created by:</span>
                <strong>${safeZone.creator.name || safeZone.creator.email}</strong>
              </div>
              <div class="flex justify-between">
                <span>Role:</span>
                <span class="px-2 py-1 rounded-full text-xs ${safeZone.creator.role === 'AUTHORITY' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}">${safeZone.creator.role}</span>
              </div>
              <div class="text-xs text-gray-500 mt-2 pt-2 border-t">
                Created: ${new Date(safeZone.createdAt).toLocaleDateString('en-IN')}
              </div>
            </div>
          </div>
        `);

        markersRef.current.push(marker);
      });
    }

    // Add active rescue requests (users in danger)
    if (allRescueRequestsQuery.data) {
      const activeRequests = allRescueRequestsQuery.data.filter(req => 
        req.latitude && req.longitude && 
        ["PENDING", "ASSIGNED", "IN_PROGRESS", "NO_VOLUNTEER"].includes(req.status)
      );

      activeRequests.forEach((request) => {
        const statusColor = request.status === "NO_VOLUNTEER" ? "bg-red-600" :
                           request.status === "PENDING" ? "bg-yellow-500" :
                           request.status === "ASSIGNED" ? "bg-blue-500" :
                           "bg-purple-500";

        const icon = L.divIcon({
          className: "custom-marker",
          html: `
            <div class="flex items-center justify-center w-8 h-8 rounded-full ${statusColor} border-2 border-white shadow-lg animate-pulse">
              <span class="text-white text-xs font-bold">!</span>
            </div>
          `,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });

        const marker = L.marker([request.latitude!, request.longitude!], { icon })
          .addTo(mapInstanceRef.current);

        marker.bindPopup(`
          <div class="p-3 min-w-[200px]">
            <div class="flex items-center gap-2 mb-2">
              <div class="w-4 h-4 rounded-full ${statusColor.replace('bg-', 'bg-')} animate-pulse"></div>
              <strong class="text-lg">SOS Request</strong>
            </div>
            <div class="space-y-1 text-sm">
              <div class="flex justify-between">
                <span>Status:</span>
                <strong class="${request.status === 'NO_VOLUNTEER' ? 'text-red-600' : 
                                request.status === 'PENDING' ? 'text-yellow-600' :
                                request.status === 'ASSIGNED' ? 'text-blue-600' : 'text-purple-600'}">${request.status}</strong>
              </div>
              <div class="flex justify-between">
                <span>User:</span>
                <strong>${request.user.name || request.user.email}</strong>
              </div>
              <div class="mb-2">
                <span class="text-gray-600">Message:</span>
                <p class="font-medium">${request.message || 'Emergency help needed'}</p>
              </div>
              ${request.volunteer ? `
                <div class="flex justify-between">
                  <span>Volunteer:</span>
                  <strong class="text-green-600">${request.volunteer.name || request.volunteer.email}</strong>
                </div>
              ` : ''}
              <div class="text-xs text-gray-500 mt-2 pt-2 border-t">
                Created: ${new Date(request.createdAt).toLocaleString('en-IN')}
              </div>
            </div>
          </div>
        `);

        markersRef.current.push(marker);
      });
    }

    // Add volunteers with their locations
    if (volunteersQuery.data) {
      const activeVolunteers = volunteersQuery.data.filter(vol => 
        vol.latitude && vol.longitude && vol.available
      );

      activeVolunteers.forEach((volunteer) => {
        const isBusy = volunteer.activeAssignments > 0;
        const statusColor = isBusy ? "bg-orange-500" : "bg-blue-500";

        const icon = L.divIcon({
          className: "custom-marker",
          html: `
            <div class="flex items-center justify-center w-8 h-8 rounded-full ${statusColor} border-2 border-white shadow-lg">
              <span class="text-white text-xs font-bold">V</span>
            </div>
          `,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });

        const marker = L.marker([volunteer.latitude!, volunteer.longitude!], { icon })
          .addTo(mapInstanceRef.current);

        marker.bindPopup(`
          <div class="p-3 min-w-[200px]">
            <div class="flex items-center gap-2 mb-2">
              <div class="w-4 h-4 rounded-full ${statusColor.replace('bg-', 'bg-')}"></div>
              <strong class="text-lg">Volunteer</strong>
            </div>
            <div class="space-y-1 text-sm">
              <div class="flex justify-between">
                <span>Name:</span>
                <strong>${volunteer.name || volunteer.email}</strong>
              </div>
              <div class="flex justify-between">
                <span>Status:</span>
                <strong class="${isBusy ? 'text-orange-600' : 'text-green-600'}">${isBusy ? 'Busy' : 'Available'}</strong>
              </div>
              <div class="flex justify-between">
                <span>Active Rescues:</span>
                <strong>${volunteer.activeAssignments}</strong>
              </div>
              ${volunteer.lastUpdated ? `
                <div class="text-xs text-gray-500 mt-2 pt-2 border-t">
                  Last seen: ${new Date(volunteer.lastUpdated).toLocaleString('en-IN')}
                </div>
              ` : ''}
            </div>
          </div>
        `);

        markersRef.current.push(marker);
      });
    }

    // Add resource nodes
    if (resourceNodesQuery.data) {
      resourceNodesQuery.data.forEach((resource) => {
        const emoji = resource.resourceType === "BOAT" ? "🚤" :
                     resource.resourceType === "GENERATOR" ? "⚡" :
                     resource.resourceType === "WATER" ? "💧" :
                     resource.resourceType === "FOOD" ? "🍞" :
                     resource.resourceType === "MEDICAL" ? "🏥" : "📦";

        const icon = L.divIcon({
          className: "custom-marker",
          html: `
            <div class="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-500 border-2 border-white shadow-lg">
              <span class="text-white text-xs">${emoji}</span>
            </div>
          `,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });

        const marker = L.marker([resource.latitude, resource.longitude], { icon })
          .addTo(mapInstanceRef.current);

        marker.bindPopup(`
          <div class="p-3 min-w-[200px]">
            <div class="flex items-center gap-2 mb-2">
              <span class="text-2xl">${emoji}</span>
              <strong class="text-lg">${resource.name}</strong>
            </div>
            <div class="space-y-1 text-sm">
              <div class="flex justify-between">
                <span>Type:</span>
                <strong>${resource.resourceType}</strong>
              </div>
              <div class="flex justify-between">
                <span>Quantity:</span>
                <strong class="text-blue-600">${resource.quantity}</strong>
              </div>
              <div class="flex justify-between">
                <span>Shared by:</span>
                <strong>${resource.creator.name || resource.creator.email}</strong>
              </div>
              <div class="flex justify-between">
                <span>Type:</span>
                <span class="px-2 py-1 rounded-full text-xs ${resource.createdBy === 'AUTHORITY' ? 'bg-red-100 text-red-800' : 
                  resource.createdBy === 'BUSINESS' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}">${resource.createdBy}</span>
              </div>
              ${resource.contactInfo ? `
                <div class="mt-2 pt-2 border-t">
                  <span class="text-gray-600">Contact:</span>
                  <p class="font-medium">${resource.contactInfo}</p>
                </div>
              ` : ''}
              <div class="text-xs text-gray-500 mt-2 pt-2 border-t">
                Added: ${new Date(resource.createdAt).toLocaleDateString('en-IN')}
              </div>
            </div>
          </div>
        `);

        markersRef.current.push(marker);
      });
    }

    // Draw lines between assigned volunteers and users
    if (allRescueRequestsQuery.data) {
      const assignedRequests = allRescueRequestsQuery.data.filter(req => 
        req.latitude && req.longitude && req.volunteer && 
        ["ASSIGNED", "IN_PROGRESS"].includes(req.status)
      );

      assignedRequests.forEach((request) => {
        const volunteer = volunteersQuery.data?.find(v => v.id === request.volunteer?.id);
        if (volunteer && volunteer.latitude && volunteer.longitude) {
          const polyline = L.polyline(
            [
              [request.latitude!, request.longitude!],
              [volunteer.latitude, volunteer.longitude],
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
      });
    }

  }, [dangerZonesQuery.data, safeZonesQuery.data, allRescueRequestsQuery.data, volunteersQuery.data, resourceNodesQuery.data, mapReady]);

  const isLoading = dangerZonesQuery.isLoading || safeZonesQuery.isLoading || 
                   allRescueRequestsQuery.isLoading || volunteersQuery.isLoading || 
                   resourceNodesQuery.isLoading;

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
        .leaflet-popup-tip {
          background: white;
          box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
        }
      `}</style>
      
      <div ref={mapRef} className="h-full w-full min-h-[500px] rounded-lg bg-gray-100" />
      
      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-10 rounded-lg">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600 mx-auto mb-2"></div>
            <p className="text-gray-600 text-sm">Loading command data...</p>
          </div>
        </div>
      )}

      {/* Map Legend */}
      <div className="absolute top-4 right-4 bg-white rounded-lg shadow-lg p-4 z-10 max-w-xs">
        <h4 className="font-semibold text-gray-900 mb-3 text-sm">Command Map Legend</h4>
        <div className="space-y-2 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-600 rounded"></div>
            <span>High Risk Zone</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-amber-600 rounded"></div>
            <span>Medium Risk Zone</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-600 rounded"></div>
            <span>Low Risk Zone</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-600 rounded-full animate-pulse"></div>
            <span>SOS Request</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-blue-500 rounded-full"></div>
            <span>Available Volunteer</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-orange-500 rounded-full"></div>
            <span>Busy Volunteer</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-500 rounded-full"></div>
            <span>Safe Zone</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-indigo-500 rounded-full"></div>
            <span>Resource Node</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-0.5 bg-indigo-500" style={{borderStyle: 'dashed'}}></div>
            <span>Active Rescue</span>
          </div>
        </div>
      </div>

      {/* Status Summary */}
      <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-lg p-4 z-10">
        <h4 className="font-semibold text-gray-900 mb-2 text-sm">Live Status</h4>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <div className="text-red-600 font-bold text-lg">
              {allRescueRequestsQuery.data?.filter(r => ["PENDING", "NO_VOLUNTEER"].includes(r.status)).length || 0}
            </div>
            <div className="text-gray-600">Urgent SOS</div>
          </div>
          <div>
            <div className="text-blue-600 font-bold text-lg">
              {volunteersQuery.data?.filter(v => v.available && v.activeAssignments === 0).length || 0}
            </div>
            <div className="text-gray-600">Available</div>
          </div>
          <div>
            <div className="text-green-600 font-bold text-lg">
              {safeZonesQuery.data?.length || 0}
            </div>
            <div className="text-gray-600">Safe Zones</div>
          </div>
          <div>
            <div className="text-orange-600 font-bold text-lg">
              {dangerZonesQuery.data?.filter(z => z.riskLevel === "HIGH").length || 0}
            </div>
            <div className="text-gray-600">High Risk</div>
          </div>
          <div>
            <div className="text-indigo-600 font-bold text-lg">
              {resourceNodesQuery.data?.length || 0}
            </div>
            <div className="text-gray-600">Resources</div>
          </div>
        </div>
      </div>
    </div>
  );
}
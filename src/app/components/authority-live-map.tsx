"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { api } from "~/trpc/react";

// Dynamically import Leaflet components (client-side only)
const MapContainer = dynamic(
  () => import("react-leaflet").then((mod) => mod.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic(
  () => import("react-leaflet").then((mod) => mod.TileLayer),
  { ssr: false }
);
const Rectangle = dynamic(
  () => import("react-leaflet").then((mod) => mod.Rectangle),
  { ssr: false }
);
const Marker = dynamic(
  () => import("react-leaflet").then((mod) => mod.Marker),
  { ssr: false }
);
const Popup = dynamic(
  () => import("react-leaflet").then((mod) => mod.Popup),
  { ssr: false }
);

interface AuthorityLiveMapProps {
  className?: string;
}

// Zone size for danger zone rectangles (matches backend precision)
const ZONE_SIZE = 0.01;

export function AuthorityLiveMap({ className = "" }: AuthorityLiveMapProps) {
  const [leafletLoaded, setLeafletLoaded] = useState(false);
  const [L, setL] = useState<any>(null);

  // Load Leaflet dynamically
  useEffect(() => {
    import("leaflet").then((leaflet) => {
      setL(leaflet);
      setLeafletLoaded(true);
    });
  }, []);

  // Fetch danger zones and safe zones
  const dangerZonesQuery = api.dangerZone.getAll.useQuery(undefined, {
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const safeZonesQuery = api.safeZone.getAll.useQuery(undefined, {
    refetchInterval: 60000, // Refresh every minute
  });

  // Default map center for Karnataka, India
  const defaultCenter: [number, number] = [15.3173, 75.7139]; // Karnataka center
  const defaultZoom = 7; // Good zoom level to see the entire state

  if (!leafletLoaded || !L) {
    return (
      <div className={`bg-gray-100 rounded-lg flex items-center justify-center ${className}`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600 mx-auto mb-2"></div>
          <p className="text-gray-600 text-sm">Loading map...</p>
        </div>
      </div>
    );
  }

  // Create custom icons for safe zones
  const createSafeZoneIcon = (type: string) => {
    const iconMap = {
      SHELTER: "🏕",
      CAMP: "⛺",
      HOSPITAL: "🏥",
    };
    
    return L.divIcon({
      html: `<div style="
        background: linear-gradient(135deg, #10b981, #059669); 
        border-radius: 50%; 
        padding: 6px; 
        border: 3px solid white; 
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        font-size: 18px; 
        text-align: center; 
        width: 40px; 
        height: 40px; 
        display: flex; 
        align-items: center; 
        justify-content: center;
        position: relative;
      ">${iconMap[type as keyof typeof iconMap] || "🏕"}</div>`,
      className: "custom-safe-zone-icon",
      iconSize: [40, 40],
      iconAnchor: [20, 20],
    });
  };

  // Get color for risk level
  const getRiskColor = (riskLevel: string) => {
    switch (riskLevel) {
      case "HIGH": return "#dc2626"; // red-600
      case "MEDIUM": return "#d97706"; // amber-600
      case "LOW": return "#16a34a"; // green-600
      default: return "#6b7280"; // gray-500
    }
  };

  return (
    <div className={className}>
      {/* Header Section */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
              </div>
              Karnataka Live Situation Map
            </h3>
            <p className="text-gray-600 mt-1">Real-time disaster monitoring and response coordination</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
              Live Updates
            </div>
          </div>
        </div>

        {/* Enhanced Legend */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <svg className="h-5 w-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Map Legend
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Risk Zones */}
            <div className="space-y-3">
              <h5 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Risk Zones</h5>
              <div className="space-y-2">
                <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors">
                  <div className="w-5 h-5 bg-red-600 rounded-md shadow-sm"></div>
                  <div>
                    <span className="font-medium text-gray-900">High Risk</span>
                    <p className="text-xs text-gray-500">Immediate attention required</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors">
                  <div className="w-5 h-5 bg-amber-500 rounded-md shadow-sm"></div>
                  <div>
                    <span className="font-medium text-gray-900">Medium Risk</span>
                    <p className="text-xs text-gray-500">Monitor closely</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors">
                  <div className="w-5 h-5 bg-green-500 rounded-md shadow-sm"></div>
                  <div>
                    <span className="font-medium text-gray-900">Low Risk</span>
                    <p className="text-xs text-gray-500">Normal conditions</p>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Safe Zones */}
            <div className="space-y-3">
              <h5 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Safe Zones</h5>
              <div className="space-y-2">
                <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors">
                  <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center text-lg">🏕</div>
                  <div>
                    <span className="font-medium text-gray-900">Shelter</span>
                    <p className="text-xs text-gray-500">Emergency shelters</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors">
                  <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center text-lg">⛺</div>
                  <div>
                    <span className="font-medium text-gray-900">Camp</span>
                    <p className="text-xs text-gray-500">Temporary camps</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors">
                  <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center text-lg">🏥</div>
                  <div>
                    <span className="font-medium text-gray-900">Hospital</span>
                    <p className="text-xs text-gray-500">Medical facilities</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Map Container */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4">
          <div className="flex items-center justify-between">
            <h4 className="text-white font-semibold flex items-center gap-2">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Karnataka State Overview
            </h4>
            <div className="text-blue-100 text-sm">
              Last updated: {new Date().toLocaleTimeString()}
            </div>
          </div>
        </div>
        
        <div style={{ height: "600px" }} className="relative">
          <style jsx>{`
            .custom-popup .leaflet-popup-content-wrapper {
              border-radius: 12px;
              box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
              border: none;
            }
            .custom-popup .leaflet-popup-content {
              margin: 0;
              padding: 0;
            }
            .custom-popup .leaflet-popup-tip {
              background: white;
              border: none;
              box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
            }
            .custom-safe-zone-icon {
              filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.2));
            }
            .leaflet-control-zoom {
              border: none !important;
              box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15) !important;
            }
            .leaflet-control-zoom a {
              border: none !important;
              background: white !important;
              color: #374151 !important;
              font-weight: bold !important;
            }
            .leaflet-control-zoom a:hover {
              background: #f3f4f6 !important;
            }
          `}</style>
          <MapContainer
            center={defaultCenter}
            zoom={defaultZoom}
            style={{ height: "100%", width: "100%" }}
            zoomControl={true}
            className="z-0"
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />

            {/* Render Danger Zones */}
            {dangerZonesQuery.data?.map((zone, index) => {
              const bounds: [[number, number], [number, number]] = [
                [zone.zoneLat, zone.zoneLng],
                [zone.zoneLat + ZONE_SIZE, zone.zoneLng + ZONE_SIZE],
              ];

              return (
                <Rectangle
                  key={`danger-${index}`}
                  bounds={bounds}
                  pathOptions={{
                    color: getRiskColor(zone.riskLevel),
                    fillColor: getRiskColor(zone.riskLevel),
                    fillOpacity: 0.4,
                    weight: 2,
                    opacity: 0.8,
                  }}
                >
                  <Popup className="custom-popup">
                    <div className="p-2 min-w-[200px]">
                      <div className="flex items-center gap-2 mb-3">
                        <div 
                          className="w-4 h-4 rounded-full" 
                          style={{ backgroundColor: getRiskColor(zone.riskLevel) }}
                        ></div>
                        <h4 className="font-bold text-gray-900 text-lg">
                          {zone.riskLevel} Risk Zone
                        </h4>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Risk Score:</span>
                          <span className="font-semibold">{zone.score}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Recent SOS:</span>
                          <span className="font-semibold text-red-600">{zone.sosCount}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Pending Help:</span>
                          <span className="font-semibold text-orange-600">{zone.unknownUsers}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Trend:</span>
                          <span className={`font-semibold ${zone.growthRate > 0 ? 'text-red-600' : zone.growthRate < 0 ? 'text-green-600' : 'text-gray-600'}`}>
                            {zone.growthRate > 0 ? `↗ +${zone.growthRate}` : zone.growthRate < 0 ? `↘ ${zone.growthRate}` : '→ 0'}
                          </span>
                        </div>
                        <div className="pt-2 mt-2 border-t border-gray-200">
                          <p className="text-xs text-gray-500">
                            Zone: {zone.zoneLat.toFixed(3)}, {zone.zoneLng.toFixed(3)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </Popup>
                </Rectangle>
              );
            })}

            {/* Render Safe Zones */}
            {safeZonesQuery.data?.map((safeZone) => (
              <Marker
                key={safeZone.id}
                position={[safeZone.latitude, safeZone.longitude]}
                icon={createSafeZoneIcon(safeZone.type)}
              >
                <Popup className="custom-popup">
                  <div className="p-2 min-w-[200px]">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-2xl">
                        {safeZone.type === "SHELTER" ? "🏕" : 
                         safeZone.type === "CAMP" ? "⛺" : "🏥"}
                      </span>
                      <h4 className="font-bold text-gray-900 text-lg">{safeZone.name}</h4>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Type:</span>
                        <span className="font-semibold capitalize">{safeZone.type.toLowerCase()}</span>
                      </div>
                      {safeZone.capacity && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Capacity:</span>
                          <span className="font-semibold text-blue-600">{safeZone.capacity} people</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-gray-600">Created by:</span>
                        <span className="font-semibold">{safeZone.creator.name || safeZone.creator.email}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Role:</span>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          safeZone.creator.role === 'AUTHORITY' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                        }`}>
                          {safeZone.creator.role}
                        </span>
                      </div>
                      <div className="pt-2 mt-2 border-t border-gray-200">
                        <p className="text-xs text-gray-500">
                          Created: {new Date(safeZone.createdAt).toLocaleDateString('en-IN')}
                        </p>
                        <p className="text-xs text-gray-500">
                          Location: {safeZone.latitude.toFixed(4)}, {safeZone.longitude.toFixed(4)}
                        </p>
                      </div>
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
          
          {/* Loading Overlay */}
          {(dangerZonesQuery.isLoading || safeZonesQuery.isLoading) && (
            <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-10">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                <p className="text-gray-600 text-sm">Loading map data...</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Enhanced Status Information */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Danger Zones Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-semibold text-gray-900">Risk Zones</h4>
            <div className="p-2 bg-red-100 rounded-lg">
              <svg className="h-5 w-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
          </div>
          {dangerZonesQuery.isLoading ? (
            <div className="animate-pulse space-y-2">
              <div className="h-4 bg-gray-200 rounded"></div>
              <div className="h-4 bg-gray-200 rounded"></div>
              <div className="h-4 bg-gray-200 rounded"></div>
            </div>
          ) : dangerZonesQuery.error ? (
            <p className="text-sm text-red-600">Error loading zones</p>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">High Risk</span>
                <span className="px-2 py-1 bg-red-100 text-red-800 rounded-full text-sm font-medium">
                  {dangerZonesQuery.data?.filter(z => z.riskLevel === "HIGH").length || 0}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Medium Risk</span>
                <span className="px-2 py-1 bg-amber-100 text-amber-800 rounded-full text-sm font-medium">
                  {dangerZonesQuery.data?.filter(z => z.riskLevel === "MEDIUM").length || 0}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Low Risk</span>
                <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                  {dangerZonesQuery.data?.filter(z => z.riskLevel === "LOW").length || 0}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Safe Zones Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-semibold text-gray-900">Safe Zones</h4>
            <div className="p-2 bg-green-100 rounded-lg">
              <svg className="h-5 w-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
          </div>
          {safeZonesQuery.isLoading ? (
            <div className="animate-pulse space-y-2">
              <div className="h-4 bg-gray-200 rounded"></div>
              <div className="h-4 bg-gray-200 rounded"></div>
              <div className="h-4 bg-gray-200 rounded"></div>
            </div>
          ) : safeZonesQuery.error ? (
            <p className="text-sm text-red-600">Error loading zones</p>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 flex items-center gap-2">
                  <span>🏕</span> Shelters
                </span>
                <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                  {safeZonesQuery.data?.filter(z => z.type === "SHELTER").length || 0}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 flex items-center gap-2">
                  <span>⛺</span> Camps
                </span>
                <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                  {safeZonesQuery.data?.filter(z => z.type === "CAMP").length || 0}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 flex items-center gap-2">
                  <span>🏥</span> Hospitals
                </span>
                <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                  {safeZonesQuery.data?.filter(z => z.type === "HOSPITAL").length || 0}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Total Capacity Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-semibold text-gray-900">Total Capacity</h4>
            <div className="p-2 bg-blue-100 rounded-lg">
              <svg className="h-5 w-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
          </div>
          {safeZonesQuery.isLoading ? (
            <div className="animate-pulse">
              <div className="h-8 bg-gray-200 rounded mb-2"></div>
              <div className="h-4 bg-gray-200 rounded"></div>
            </div>
          ) : (
            <div>
              <div className="text-3xl font-bold text-gray-900 mb-2">
                {safeZonesQuery.data?.reduce((total, zone) => total + (zone.capacity || 0), 0).toLocaleString() || 0}
              </div>
              <p className="text-sm text-gray-600">People can be accommodated</p>
            </div>
          )}
        </div>

        {/* Active Zones Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-semibold text-gray-900">Active Zones</h4>
            <div className="p-2 bg-purple-100 rounded-lg">
              <svg className="h-5 w-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
          </div>
          {(dangerZonesQuery.isLoading || safeZonesQuery.isLoading) ? (
            <div className="animate-pulse">
              <div className="h-8 bg-gray-200 rounded mb-2"></div>
              <div className="h-4 bg-gray-200 rounded"></div>
            </div>
          ) : (
            <div>
              <div className="text-3xl font-bold text-gray-900 mb-2">
                {((dangerZonesQuery.data?.length || 0) + (safeZonesQuery.data?.length || 0))}
              </div>
              <p className="text-sm text-gray-600">Total zones monitored</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
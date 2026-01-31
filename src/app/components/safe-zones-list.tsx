"use client";

import { useState } from "react";
import { api } from "~/trpc/react";

interface SafeZonesListProps {
  userLocation?: { latitude: number; longitude: number } | null;
  maxDistance?: number;
  showCreateButton?: boolean;
  onCreateClick?: () => void;
}

export function SafeZonesList({ 
  userLocation, 
  maxDistance = 50,
  showCreateButton = false,
  onCreateClick 
}: SafeZonesListProps) {
  const [selectedType, setSelectedType] = useState<string>("ALL");

  // Fetch safe zones
  const safeZonesQuery = api.safeZone.getPublic.useQuery(undefined, {
    refetchInterval: 60000,
  });

  // Get nearby safe zones if user location is available
  const nearbySafeZonesQuery = api.safeZone.getNearby.useQuery(
    {
      latitude: userLocation?.latitude ?? 0,
      longitude: userLocation?.longitude ?? 0,
      radiusKm: maxDistance,
    },
    {
      enabled: !!userLocation,
      refetchInterval: 60000,
    }
  );

  const safeZones = userLocation ? nearbySafeZonesQuery.data : safeZonesQuery.data;
  const isLoading = userLocation ? nearbySafeZonesQuery.isLoading : safeZonesQuery.isLoading;

  const filteredZones = safeZones?.filter(zone => 
    selectedType === "ALL" || zone.type === selectedType
  ) ?? [];

  const getSafeZoneIcon = (type: string) => {
    switch (type) {
      case 'SHELTER': return '🏠';
      case 'CAMP': return '⛺';
      case 'HOSPITAL': return '🏥';
      default: return '🏢';
    }
  };

  const getSafeZoneColor = (type: string) => {
    switch (type) {
      case 'SHELTER': return 'bg-green-100 text-green-800 border-green-300';
      case 'CAMP': return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'HOSPITAL': return 'bg-red-100 text-red-800 border-red-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const formatDistance = (distance?: number) => {
    if (!distance) return null;
    if (distance < 1) return `${Math.round(distance * 1000)}m away`;
    return `${distance.toFixed(1)}km away`;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">🏠 Safe Zones</h3>
          <p className="text-sm text-gray-600">
            {userLocation ? 'Nearby emergency shelters and facilities' : 'Available emergency shelters and facilities'}
          </p>
        </div>
        {showCreateButton && (
          <button
            onClick={onCreateClick}
            className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm font-medium"
          >
            + Add Safe Zone
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-600">Filter:</span>
        {['ALL', 'SHELTER', 'CAMP', 'HOSPITAL'].map((type) => (
          <button
            key={type}
            onClick={() => setSelectedType(type)}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
              selectedType === type
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {type === 'ALL' ? 'All' : type.toLowerCase()}
          </button>
        ))}
        <span className="text-sm text-gray-500 ml-2">
          ({filteredZones.length} zones)
        </span>
      </div>

      {/* Statistics */}
      {safeZones && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-green-50 rounded-lg p-3 text-center border border-green-200">
            <div className="text-2xl font-bold text-green-600">
              {safeZones.filter(z => z.type === 'SHELTER').length}
            </div>
            <div className="text-sm text-green-700">Shelters</div>
          </div>
          <div className="bg-orange-50 rounded-lg p-3 text-center border border-orange-200">
            <div className="text-2xl font-bold text-orange-600">
              {safeZones.filter(z => z.type === 'CAMP').length}
            </div>
            <div className="text-sm text-orange-700">Camps</div>
          </div>
          <div className="bg-red-50 rounded-lg p-3 text-center border border-red-200">
            <div className="text-2xl font-bold text-red-600">
              {safeZones.filter(z => z.type === 'HOSPITAL').length}
            </div>
            <div className="text-sm text-red-700">Hospitals</div>
          </div>
        </div>
      )}

      {/* Safe Zones List */}
      <div className="bg-white rounded-xl border border-gray-200">
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading safe zones...</p>
          </div>
        ) : filteredZones.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <div className="text-4xl mb-2">🏠</div>
            <p className="text-sm">No safe zones found</p>
            <p className="text-xs text-gray-400">
              {selectedType !== "ALL" ? `No ${selectedType.toLowerCase()} zones available` : 'No safe zones in this area'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredZones.map((zone) => (
              <div key={zone.id} className="p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="text-2xl">{getSafeZoneIcon(zone.type)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium text-gray-900 truncate">{zone.name}</h4>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getSafeZoneColor(zone.type)}`}>
                          {zone.type.toLowerCase()}
                        </span>
                      </div>
                      
                      <div className="space-y-1 text-sm text-gray-600">
                        {zone.capacity && (
                          <p>👥 Capacity: {zone.capacity} people</p>
                        )}
                        <p>✅ Verified by {zone.creator.role.toLowerCase()}</p>
                        {'distance' in zone && typeof zone.distance === 'number' && (
                          <p>📍 {formatDistance(zone.distance)}</p>
                        )}
                        <p className="text-xs text-gray-500">
                          Added {new Date(zone.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex flex-col gap-2 ml-4">
                    <button
                      onClick={() => {
                        const url = `https://www.google.com/maps/dir/?api=1&destination=${zone.latitude},${zone.longitude}`;
                        window.open(url, '_blank');
                      }}
                      className="px-3 py-1 bg-blue-500 text-white rounded text-xs font-medium hover:bg-blue-600 transition-colors"
                    >
                      Directions
                    </button>
                    <button
                      onClick={() => {
                        const url = `https://www.google.com/maps?q=${zone.latitude},${zone.longitude}`;
                        window.open(url, '_blank');
                      }}
                      className="px-3 py-1 bg-gray-100 text-gray-700 rounded text-xs font-medium hover:bg-gray-200 transition-colors"
                    >
                      View Map
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Emergency Info */}
      <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
        <div className="flex items-start gap-3">
          <div className="text-blue-600 text-xl">ℹ️</div>
          <div>
            <h4 className="font-medium text-blue-900 mb-1">Emergency Information</h4>
            <div className="text-sm text-blue-800 space-y-1">
              <p>• Safe zones are verified by volunteers and authorities</p>
              <p>• In case of emergency, head to the nearest safe zone</p>
              <p>• Contact emergency services: 112 (India Emergency Number)</p>
              {userLocation && (
                <p>• Distances shown are approximate straight-line distances</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
"use client";

import { useState, useEffect } from "react";
import { api } from "~/trpc/react";
import type { UseTRPCQueryResult } from "@trpc/react-query/shared";

interface Alert {
  id: string;
  title: string;
  message: string;
  disasterType: string;
  latitude: number;
  longitude: number;
  radiusKm: number;
  createdAt: Date;
}

interface UserInAffectedArea {
  id: string;
  name: string | null;
  email: string | null;
  latitude: number | null;
  longitude: number | null;
  distance: number;
  isInAffectedZone: boolean;
  lastSeen?: Date | null;
  phoneNumber: string | null;
  address: string | null;
  role: string;
}

interface AuthorityDisasterManagerProps {
  alerts: Alert[];
  volunteersQuery?: UseTRPCQueryResult<any[], any>;
  rescueRequestsQuery?: UseTRPCQueryResult<any[], any>;
  className?: string;
}

export default function AuthorityDisasterManager({
  alerts,
  className = "",
}: AuthorityDisasterManagerProps) {
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [usersInArea, setUsersInArea] = useState<UserInAffectedArea[]>([]);
  const [loading, setLoading] = useState(false);

  // Get users in affected area when an alert is selected
  const getUsersInAffectedArea = api.user.getUsersInArea.useQuery(
    {
      latitude: selectedAlert?.latitude ?? 0,
      longitude: selectedAlert?.longitude ?? 0,
      radiusKm: selectedAlert?.radiusKm ?? 5,
    },
    {
      enabled: !!selectedAlert,
      refetchInterval: 30000, // Refresh every 30 seconds
    }
  );

  useEffect(() => {
    if (selectedAlert && getUsersInAffectedArea.data) {
      setUsersInArea(getUsersInAffectedArea.data);
    }
  }, [selectedAlert, getUsersInAffectedArea.data]);

  const handleAlertSelect = (alert: Alert) => {
    setSelectedAlert(alert);
    setUsersInArea([]);
  };

  const disasterTypeColors: Record<string, string> = {
    FLOOD: "bg-blue-100 text-blue-800 border-blue-200",
    EARTHQUAKE: "bg-orange-100 text-orange-800 border-orange-200",
    FIRE: "bg-red-100 text-red-800 border-red-200",
  };

  const disasterTypeLabels: Record<string, string> = {
    FLOOD: "Flood",
    EARTHQUAKE: "Earthquake",
    FIRE: "Fire",
  };

  return (
    <div className={`rounded-lg bg-white p-6 shadow-md ${className}`}>
      <h2 className="mb-6 flex items-center gap-2 text-xl font-semibold text-gray-900">
        <svg
          className="h-6 w-6 text-red-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
          />
        </svg>
        Disaster Management
      </h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Alerts List */}
        <div>
          <h3 className="font-medium text-gray-900 mb-3">Active Alerts</h3>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {alerts.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>No active alerts</p>
                <p className="text-sm mt-1">Create an alert to get started</p>
              </div>
            ) : (
              alerts.map((alert) => (
                <div
                  key={alert.id}
                  onClick={() => handleAlertSelect(alert)}
                  className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                    selectedAlert?.id === alert.id
                      ? "border-red-500 bg-red-50"
                      : "border-gray-200 hover:bg-gray-50"
                  } ${disasterTypeColors[alert.disasterType]}`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="inline-block rounded-full px-2 py-1 text-xs font-medium">
                          {disasterTypeLabels[alert.disasterType]}
                        </span>
                        {selectedAlert?.id === alert.id && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-600 px-2 py-1 text-xs font-bold text-white">
                            SELECTED
                          </span>
                        )}
                      </div>
                      <h4 className="font-semibold">{alert.title}</h4>
                      <p className="text-sm mt-1">{alert.message}</p>
                    </div>
                    <div className="text-right text-xs text-gray-500">
                      <p>{new Date(alert.createdAt).toLocaleDateString()}</p>
                      <p>{alert.radiusKm} km radius</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Users in Affected Area */}
        <div>
          <h3 className="font-medium text-gray-900 mb-3">
            {selectedAlert
              ? `Users in ${selectedAlert.title} Area`
              : "Select an alert to view affected users"}
          </h3>

          {selectedAlert && (
            <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center gap-2 text-sm text-blue-800">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span>
                  Center: {selectedAlert.latitude.toFixed(4)}, {selectedAlert.longitude.toFixed(4)}
                </span>
              </div>
              <div className="text-sm text-blue-700 mt-1">
                Radius: {selectedAlert.radiusKm} km
              </div>
            </div>
          )}

          <div className="space-y-2 max-h-80 overflow-y-auto">
            {getUsersInAffectedArea.isLoading ? (
              <div className="text-center py-8 text-gray-500">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-red-600 mx-auto mb-2"></div>
                <p>Loading affected users...</p>
              </div>
            ) : getUsersInAffectedArea.error ? (
              <div className="text-center py-8 text-red-500">
                <p>Error loading users</p>
                <p className="text-sm mt-1">{getUsersInAffectedArea.error.message}</p>
              </div>
            ) : selectedAlert ? (
              usersInArea.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p>No users found in this area</p>
                  <p className="text-sm mt-1">Users may be offline or outside the radius</p>
                </div>
              ) : (
                usersInArea.map((user) => (
                  <div
                    key={user.id}
                    className={`p-3 rounded-lg border ${
                      user.isInAffectedZone
                        ? "border-red-300 bg-red-50"
                        : "border-gray-200 bg-gray-50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium text-gray-900">
                          {user.name || user.email}
                        </h4>
                        <p className="text-sm text-gray-600">{user.email}</p>
                      </div>
                      <div className="text-right">
                        {user.isInAffectedZone ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-600 px-2 py-1 text-xs font-bold text-white">
                            <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse"></span>
                            IN ZONE
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-800">
                            NEARBY
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="mt-2 text-xs text-gray-500 flex justify-between">
                      <span>
                        Distance: {user.distance.toFixed(1)} km
                      </span>
                      {user.lastSeen && (
                        <span>
                          Last seen: {new Date(user.lastSeen).toLocaleTimeString()}
                        </span>
                      )}
                    </div>
                    {user.isInAffectedZone && (
                      <div className="mt-2 p-2 bg-red-100 rounded border border-red-200">
                        <p className="text-xs text-red-700">
                          ⚠️ User is in the affected disaster zone
                        </p>
                      </div>
                    )}
                  </div>
                ))
              )
            ) : (
              <div className="text-center py-8 text-gray-500">
                <svg className="h-12 w-12 mx-auto text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                </svg>
                <p>Select an alert to view affected users</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      {selectedAlert && (
        <div className="mt-6 pt-6 border-t border-gray-200">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="p-3 bg-red-50 rounded-lg">
              <p className="text-2xl font-bold text-red-600">
                {usersInArea.filter(u => u.isInAffectedZone).length}
              </p>
              <p className="text-sm text-red-700">In Affected Zone</p>
            </div>
            <div className="p-3 bg-yellow-50 rounded-lg">
              <p className="text-2xl font-bold text-yellow-600">
                {usersInArea.filter(u => !u.isInAffectedZone).length}
              </p>
              <p className="text-sm text-yellow-700">Nearby Users</p>
            </div>
            <div className="p-3 bg-blue-50 rounded-lg">
              <p className="text-2xl font-bold text-blue-600">
                {usersInArea.length}
              </p>
              <p className="text-sm text-blue-700">Total Users</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
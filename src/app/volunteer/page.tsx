"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { api } from "~/trpc/react";

// Dynamically import the map component (client-side only)
const RescueMap = dynamic(() => import("~/app/components/rescue-map"), {
  ssr: false,
  loading: () => (
    <div className="h-[400px] bg-gray-100 rounded-lg flex items-center justify-center">
      <p className="text-gray-500">Loading map...</p>
    </div>
  ),
});

type RescueStatus = "PENDING" | "ASSIGNED" | "IN_PROGRESS" | "COMPLETED" | "NO_VOLUNTEER";

const rescueStatusLabels: Record<RescueStatus, string> = {
  PENDING: "Pending",
  ASSIGNED: "Assigned",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  NO_VOLUNTEER: "No Volunteer",
};

const rescueStatusColors: Record<RescueStatus, string> = {
  PENDING: "bg-yellow-100 text-yellow-800 border-yellow-200",
  ASSIGNED: "bg-blue-100 text-blue-800 border-blue-200",
  IN_PROGRESS: "bg-purple-100 text-purple-800 border-purple-200",
  COMPLETED: "bg-green-100 text-green-800 border-green-200",
  NO_VOLUNTEER: "bg-orange-100 text-orange-800 border-orange-200",
};

export default function VolunteerDashboard() {
  const router = useRouter();
  const utils = api.useUtils();

  // Location tracking state
  const [myLocation, setMyLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isTracking, setIsTracking] = useState(false);

  // Fetch pending requests
  const pendingRequestsQuery = api.rescue.getPendingRequests.useQuery(undefined, {
    refetchInterval: 10000,
  });

  // Fetch assigned requests
  const assignedRequestsQuery = api.rescue.getAssignedToMe.useQuery(undefined, {
    refetchInterval: 10000,
  });

  // Fetch my profile
  const myProfileQuery = api.volunteer.getMyProfile.useQuery();

  // Location update mutation
  const updateLocation = api.volunteer.updateLocation.useMutation();

  // Accept request mutation
  const acceptRequest = api.rescue.acceptRequest.useMutation({
    onSuccess: () => {
      pendingRequestsQuery.refetch();
      assignedRequestsQuery.refetch();
    },
  });

  // Update status mutation
  const updateStatus = api.rescue.updateStatus.useMutation({
    onSuccess: () => {
      assignedRequestsQuery.refetch();
    },
  });

  // Set availability mutation
  const setAvailability = api.volunteer.setAvailability.useMutation({
    onSuccess: () => {
      myProfileQuery.refetch();
    },
  });

  // Start location tracking on mount
  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported by your browser");
      return;
    }

    // Request permission and start watching
    const startTracking = () => {
      setIsTracking(true);
      setLocationError(null);

      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setMyLocation({ lat: latitude, lng: longitude });

          // Send location update to server
          updateLocation.mutate({ latitude, longitude });
        },
        (error) => {
          console.error("Location error:", error);
          setLocationError(error.message);
          setIsTracking(false);
        },
        {
          enableHighAccuracy: true,
          maximumAge: 10000, // 10 seconds
          timeout: 15000,
        }
      );

      // Clean up on unmount
      return () => {
        navigator.geolocation.clearWatch(watchId);
        setIsTracking(false);
      };
    };

    const cleanup = startTracking();
    return cleanup;
  }, []);

  // Periodic location update (every 15 seconds as backup)
  useEffect(() => {
    if (!myLocation) return;

    const interval = setInterval(() => {
      if (myLocation) {
        updateLocation.mutate({ latitude: myLocation.lat, longitude: myLocation.lng });
      }
    }, 15000);

    return () => clearInterval(interval);
  }, [myLocation]);

  const handleSignOut = async () => {
    router.push("/api/auth/signout");
  };

  const getTimeSince = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  // Calculate distance
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Build map markers for current assignment
  const getMapMarkers = () => {
    const markers: { lat: number; lng: number; type: "user" | "volunteer"; label?: string }[] = [];

    // Add volunteer's location (blue)
    if (myLocation) {
      markers.push({
        lat: myLocation.lat,
        lng: myLocation.lng,
        type: "volunteer",
        label: "Your location",
      });
    }

    // Add user in danger location (red) for assigned requests
    assignedRequestsQuery.data?.forEach((request) => {
      if (request.latitude && request.longitude) {
        markers.push({
          lat: request.latitude,
          lng: request.longitude,
          type: "user",
          label: `${request.user.name || request.user.email}\n${request.message}`,
        });
      }
    });

    return markers;
  };

  const mapMarkers = getMapMarkers();
  const isAvailable = myProfileQuery.data?.available ?? true;

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-green-600 text-white shadow-lg">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Volunteer Dashboard</h1>
              <p className="mt-1 text-green-100">Disaster Alert & Rescue Coordination System</p>
            </div>
            <div className="flex items-center gap-4">
              {/* Tracking Status */}
              <div
                className={`flex items-center gap-2 rounded-full px-3 py-1 text-sm ${
                  isTracking ? "bg-green-500" : "bg-yellow-500"
                }`}
              >
                <span
                  className={`h-2 w-2 rounded-full ${
                    isTracking ? "bg-green-200 animate-pulse" : "bg-yellow-200"
                  }`}
                />
                {isTracking ? "Tracking" : "Offline"}
              </div>

              {/* Availability Toggle */}
              <button
                onClick={() => setAvailability.mutate({ available: !isAvailable })}
                className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                  isAvailable
                    ? "bg-green-700 hover:bg-green-800"
                    : "bg-gray-500 hover:bg-gray-600"
                }`}
              >
                {isAvailable ? "Available" : "Unavailable"}
              </button>

              <button
                onClick={handleSignOut}
                className="rounded-md bg-green-700 px-4 py-2 text-sm font-medium hover:bg-green-800 transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Location Status Banner */}
      {locationError && (
        <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-3">
          <div className="mx-auto max-w-7xl flex items-center gap-2 text-yellow-800">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <span className="text-sm">Location access: {locationError}</span>
          </div>
        </div>
      )}

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Live Map Section */}
        {assignedRequestsQuery.data && assignedRequestsQuery.data.length > 0 && (
          <div className="mb-8 rounded-lg bg-white p-6 shadow-md">
            <h2 className="mb-4 text-xl font-semibold text-gray-900 flex items-center gap-2">
              <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                />
              </svg>
              Live Rescue Map
            </h2>

            <div className="mb-4 flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <span className="h-4 w-4 rounded-full bg-red-500"></span>
                <span className="text-gray-600">User in danger</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-4 w-4 rounded-full bg-blue-500"></span>
                <span className="text-gray-600">Your location</span>
              </div>
              {myLocation && assignedRequestsQuery.data[0]?.latitude && (
                <div className="ml-auto text-gray-600">
                  Distance:{" "}
                  <span className="font-medium">
                    {calculateDistance(
                      myLocation.lat,
                      myLocation.lng,
                      assignedRequestsQuery.data[0].latitude,
                      assignedRequestsQuery.data[0].longitude!
                    ).toFixed(2)}{" "}
                    km
                  </span>
                </div>
              )}
            </div>

            <div className="h-[400px] rounded-lg overflow-hidden border border-gray-200">
              <RescueMap markers={mapMarkers} />
            </div>
          </div>
        )}

        <div className="grid gap-8 lg:grid-cols-2">
          {/* My Assigned Requests */}
          <div className="rounded-lg bg-white p-6 shadow-md">
            <h2 className="mb-6 text-xl font-semibold text-gray-900 flex items-center gap-2">
              <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                />
              </svg>
              My Assigned Rescues
              {assignedRequestsQuery.data && assignedRequestsQuery.data.length > 0 && (
                <span className="rounded-full bg-green-100 px-2 py-1 text-xs text-green-800">
                  {assignedRequestsQuery.data.length} active
                </span>
              )}
            </h2>

            {assignedRequestsQuery.isLoading && (
              <div className="text-center text-gray-500 py-8">Loading...</div>
            )}

            {assignedRequestsQuery.data && assignedRequestsQuery.data.length === 0 && (
              <div className="text-center text-gray-500 py-8">
                No active assignments. Accept a pending request to start helping!
              </div>
            )}

            <div className="space-y-4">
              {assignedRequestsQuery.data?.map((request) => (
                <div
                  key={request.id}
                  className={`rounded-lg border-2 p-4 ${rescueStatusColors[request.status as RescueStatus]}`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <span className="inline-block rounded-full px-2 py-1 text-xs font-medium bg-white/50">
                        {rescueStatusLabels[request.status as RescueStatus]}
                      </span>
                      <p className="mt-2 font-medium">{request.user.name || request.user.email}</p>
                    </div>
                    <span className="text-xs">{getTimeSince(request.createdAt)}</span>
                  </div>

                  <p className="text-sm mb-2">{request.message}</p>

                  {request.location && (
                    <p className="text-xs mb-2">
                      <strong>Location:</strong> {request.location}
                    </p>
                  )}

                  {request.latitude && myLocation && (
                    <p className="text-xs mb-3 text-gray-600">
                      <strong>Distance:</strong>{" "}
                      {calculateDistance(
                        myLocation.lat,
                        myLocation.lng,
                        request.latitude,
                        request.longitude!
                      ).toFixed(2)}{" "}
                      km away
                    </p>
                  )}

                  <div className="flex gap-2">
                    {request.status === "ASSIGNED" && (
                      <button
                        onClick={() => updateStatus.mutate({ requestId: request.id, status: "IN_PROGRESS" })}
                        disabled={updateStatus.isPending}
                        className="flex-1 rounded-md bg-purple-600 px-3 py-2 text-sm text-white hover:bg-purple-700 disabled:opacity-50"
                      >
                        Start Rescue
                      </button>
                    )}
                    {request.status === "IN_PROGRESS" && (
                      <button
                        onClick={() => updateStatus.mutate({ requestId: request.id, status: "COMPLETED" })}
                        disabled={updateStatus.isPending}
                        className="flex-1 rounded-md bg-green-600 px-3 py-2 text-sm text-white hover:bg-green-700 disabled:opacity-50"
                      >
                        Mark Complete
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Pending Requests */}
          <div className="rounded-lg bg-white p-6 shadow-md">
            <h2 className="mb-6 text-xl font-semibold text-gray-900 flex items-center gap-2">
              <svg className="h-6 w-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              Pending SOS Requests
              {pendingRequestsQuery.data && pendingRequestsQuery.data.length > 0 && (
                <span className="rounded-full bg-yellow-100 px-2 py-1 text-xs text-yellow-800 animate-pulse">
                  {pendingRequestsQuery.data.length} waiting
                </span>
              )}
            </h2>

            {pendingRequestsQuery.isLoading && (
              <div className="text-center text-gray-500 py-8">Loading...</div>
            )}

            {pendingRequestsQuery.data && pendingRequestsQuery.data.length === 0 && (
              <div className="text-center text-gray-500 py-8">
                <svg
                  className="h-12 w-12 mx-auto text-gray-300 mb-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                No pending requests at this time.
              </div>
            )}

            <div className="space-y-4 max-h-96 overflow-y-auto">
              {pendingRequestsQuery.data?.map((request) => (
                <div key={request.id} className="rounded-lg border-2 border-yellow-200 bg-yellow-50 p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <span className="inline-block rounded-full bg-yellow-200 px-2 py-1 text-xs font-medium text-yellow-800">
                        URGENT
                      </span>
                      <p className="mt-2 font-medium text-gray-900">
                        {request.user.name || request.user.email}
                      </p>
                    </div>
                    <span className="text-xs text-yellow-700">{getTimeSince(request.createdAt)}</span>
                  </div>

                  <p className="text-sm text-gray-700 mb-2">{request.message}</p>

                  {request.location && (
                    <p className="text-xs text-gray-600 mb-2">
                      <strong>Location:</strong> {request.location}
                    </p>
                  )}

                  {request.latitude && myLocation && (
                    <p className="text-xs text-gray-600 mb-3">
                      <strong>Distance:</strong>{" "}
                      {calculateDistance(
                        myLocation.lat,
                        myLocation.lng,
                        request.latitude,
                        request.longitude!
                      ).toFixed(2)}{" "}
                      km away
                    </p>
                  )}

                  <button
                    onClick={() => acceptRequest.mutate({ requestId: request.id })}
                    disabled={acceptRequest.isPending || !isAvailable}
                    className="w-full rounded-md bg-green-600 px-4 py-2 text-white font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
                  >
                    {acceptRequest.isPending ? "Accepting..." : "Accept & Help"}
                  </button>

                  {acceptRequest.error && (
                    <p className="mt-2 text-xs text-red-600">{acceptRequest.error.message}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Stats Section */}
        <div className="mt-8 rounded-lg bg-white p-6 shadow-md">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Quick Stats</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
            <div className="rounded-lg bg-green-50 p-4 text-center">
              <p className="text-2xl font-bold text-green-600">
                {assignedRequestsQuery.data?.filter((r) => r.status === "ASSIGNED").length || 0}
              </p>
              <p className="text-sm text-green-700">Assigned</p>
            </div>
            <div className="rounded-lg bg-purple-50 p-4 text-center">
              <p className="text-2xl font-bold text-purple-600">
                {assignedRequestsQuery.data?.filter((r) => r.status === "IN_PROGRESS").length || 0}
              </p>
              <p className="text-sm text-purple-700">In Progress</p>
            </div>
            <div className="rounded-lg bg-yellow-50 p-4 text-center">
              <p className="text-2xl font-bold text-yellow-600">
                {pendingRequestsQuery.data?.length || 0}
              </p>
              <p className="text-sm text-yellow-700">Waiting</p>
            </div>
            <div className="rounded-lg bg-blue-50 p-4 text-center">
              <p className="text-2xl font-bold text-blue-600">
                {myLocation ? `${myLocation.lat.toFixed(4)}` : "—"}
              </p>
              <p className="text-sm text-blue-700">Latitude</p>
            </div>
            <div className="rounded-lg bg-blue-50 p-4 text-center">
              <p className="text-2xl font-bold text-blue-600">
                {myLocation ? `${myLocation.lng.toFixed(4)}` : "—"}
              </p>
              <p className="text-sm text-blue-700">Longitude</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import dynamic from "next/dynamic";
import { api } from "~/trpc/react";
import { CreateShelterForm } from "~/app/components/create-shelter-form";
import { AddResourceForm } from "~/app/components/add-resource-form";
import { formatETA, getConfidenceColor } from "~/lib/eta-prediction";

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

// Polling interval for alert delivery (5 seconds)
const POLLING_INTERVAL = 5000;

export default function VolunteerDashboard() {
  const router = useRouter();
  const utils = api.useUtils();
  const { data: session, status } = useSession();

  // Location tracking state
  const [myLocation, setMyLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  
  // Alert notification state
  const [showNewAlert, setShowNewAlert] = useState(false);
  const [newAlertCount, setNewAlertCount] = useState(0);
  const previousAlertCount = useRef(0);
  
  // Shelter creation state
  const [showCreateShelter, setShowCreateShelter] = useState(false);
  
  // Resource creation state
  const [showAddResource, setShowAddResource] = useState(false);

  // Check authentication and role before making queries
  const isAuthenticated = status === "authenticated";
  const isVolunteer = session?.user?.role === "VOLUNTEER";
  const shouldQuery = isAuthenticated && isVolunteer;

  // Redirect if not authenticated or wrong role
  useEffect(() => {
    if (status === "loading") return; // Still loading
    
    if (!isAuthenticated) {
      router.push("/");
      return;
    }
    
    if (!isVolunteer) {
      router.push("/dashboard");
      return;
    }
  }, [status, isAuthenticated, isVolunteer, router]);

  // Main polling query - fetches all relevant requests for this volunteer
  const volunteerAlertsQuery = api.rescue.getForVolunteer.useQuery(undefined, {
    enabled: shouldQuery, // Only run query when authenticated and is volunteer
    refetchInterval: shouldQuery ? POLLING_INTERVAL : false, // Poll every 5 seconds only when enabled
    refetchIntervalInBackground: shouldQuery, // Keep polling even when tab is not focused
  });

  // Extract data from the unified query
  const assignedRequests = volunteerAlertsQuery.data?.assigned ?? [];
  const pendingRequests = volunteerAlertsQuery.data?.pending ?? [];
  const escalatedRequests = volunteerAlertsQuery.data?.escalated ?? [];
  const totalAlerts = volunteerAlertsQuery.data?.totalAlerts ?? 0;

  // Detect new alerts and show notification
  useEffect(() => {
    if (totalAlerts > previousAlertCount.current && previousAlertCount.current > 0) {
      // New alert arrived!
      setShowNewAlert(true);
      setNewAlertCount(totalAlerts - previousAlertCount.current);
      
      // Play alert sound (if available)
      try {
        const audio = new Audio("data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdH2Onp2TfGNjcH+RoZ2QeF5eaXqMnZyRfGJgbHuOnp6SfGNhbHuOnp6SfGNhbHuOnZySfGNhbHyOnp6SfGNhbHuOnp6S");
        audio.volume = 0.5;
        audio.play().catch(() => {}); // Ignore if audio blocked
      } catch {}
      
      // Auto-hide notification after 5 seconds
      setTimeout(() => {
        setShowNewAlert(false);
        setNewAlertCount(0);
      }, 5000);
    }
    previousAlertCount.current = totalAlerts;
  }, [totalAlerts]);

  // Legacy queries for compatibility (still needed for some operations)
  const pendingRequestsQuery = { data: pendingRequests, isLoading: volunteerAlertsQuery.isLoading };
  const assignedRequestsQuery = { data: assignedRequests, isLoading: volunteerAlertsQuery.isLoading };

  // Fetch my profile
  const myProfileQuery = api.volunteer.getMyProfile.useQuery(undefined, {
    enabled: shouldQuery, // Only run when authenticated and is volunteer
  });

  // Fetch my safe zones
  const mySafeZonesQuery = api.safeZone.getMyZones.useQuery(undefined, {
    enabled: shouldQuery,
    refetchInterval: shouldQuery ? 60000 : false, // Refresh every minute
  });

  // Fetch my resources
  const myResourcesQuery = api.resourceNode.getMyResources.useQuery(undefined, {
    enabled: shouldQuery,
    refetchInterval: shouldQuery ? 60000 : false, // Refresh every minute
  });

  // Fetch nearby resources for smart suggestions
  const nearbyResourcesQuery = api.resourceNode.getNearby.useQuery(
    {
      volunteerLat: myLocation?.lat ?? 0,
      volunteerLng: myLocation?.lng ?? 0,
      maxDistance: 5, // 5km radius
      limit: 3,
    },
    {
      enabled: shouldQuery && !!myLocation && assignedRequests.length > 0,
      refetchInterval: shouldQuery ? 30000 : false, // Refresh every 30 seconds
    }
  );

  // Location update mutation
  const updateLocation = api.volunteer.updateLocation.useMutation({
    onError: (error) => {
      console.error("Failed to update location:", error.message);
      // Don't show location update errors to user as they're not critical
      // The location will be retried on the next update
    },
  });

  // Accept request mutation
  const acceptRequest = api.rescue.acceptRequest.useMutation({
    onSuccess: () => {
      volunteerAlertsQuery.refetch();
    },
  });

  // Update status mutation
  const updateStatus = api.rescue.updateStatus.useMutation({
    onSuccess: () => {
      volunteerAlertsQuery.refetch();
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
    // Only start tracking if user is authenticated and is a volunteer
    if (!shouldQuery) return;

    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported by your browser");
      return;
    }

    // Request permission and start watching
    const startTracking = () => {
      setIsTracking(true);
      setLocationError(null);

      // First, get an immediate fresh location
      console.log("🔍 [VOLUNTEER] Getting immediate fresh location...");
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude, accuracy } = position.coords;
          console.log(`✅ [VOLUNTEER] Initial location: Lat=${latitude}, Lng=${longitude}, Accuracy=${accuracy}m`);
          setMyLocation({ lat: latitude, lng: longitude });

          if (shouldQuery) {
            console.log(`🔄 [VOLUNTEER] Sending initial location to server`);
            updateLocation.mutate({ latitude, longitude });
          }
        },
        (error) => {
          console.error("❌ [VOLUNTEER] Initial location error:", error);
        },
        {
          enableHighAccuracy: true,
          maximumAge: 0,
          timeout: 30000,
        }
      );

      // Then start continuous watching
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          const { latitude, longitude, accuracy } = position.coords;
          console.log(`📍 [VOLUNTEER] Location update: Lat=${latitude}, Lng=${longitude}, Accuracy=${accuracy}m`);
          setMyLocation({ lat: latitude, lng: longitude });

          // Send location update to server only if authenticated and is volunteer
          if (shouldQuery) {
            console.log(`🔄 [VOLUNTEER] Sending to server: Lat=${latitude}, Lng=${longitude}`);
            updateLocation.mutate({ latitude, longitude });
          }
        },
        (error) => {
          console.error("❌ [VOLUNTEER] Location error:", error);
          setLocationError(error.message);
          setIsTracking(false);
        },
        {
          enableHighAccuracy: true,
          maximumAge: 0, // Force fresh location, no cache
          timeout: 30000, // Increased timeout for GPS lock
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
  }, [shouldQuery]);

  // Periodic location update (every 15 seconds as backup)
  useEffect(() => {
    if (!myLocation || !shouldQuery) return;

    const interval = setInterval(() => {
      if (myLocation && shouldQuery) {
        updateLocation.mutate({ latitude: myLocation.lat, longitude: myLocation.lng });
      }
    }, 15000);

    return () => clearInterval(interval);
  }, [myLocation, shouldQuery]);

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
          label: `${request.user?.name || request.user?.email || "Anonymous User"}\n${request.message}`,
        });
      }
    });

    return markers;
  };

  const mapMarkers = getMapMarkers();
  const isAvailable = myProfileQuery.data?.available ?? true;

  // Show loading screen while session is loading
  if (status === "loading") {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render anything if redirecting
  if (!isAuthenticated || !isVolunteer) {
    return null;
  }

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
                  isTracking && !updateLocation.error ? "bg-green-500" : "bg-yellow-500"
                }`}
              >
                <span
                  className={`h-2 w-2 rounded-full ${
                    isTracking && !updateLocation.error ? "bg-green-200 animate-pulse" : "bg-yellow-200"
                  }`}
                />
                {isTracking && !updateLocation.error ? "Tracking" : "Offline"}
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
                onClick={() => router.push("/profile")}
                className="rounded-md bg-green-700 px-4 py-2 text-sm font-medium hover:bg-green-800 transition-colors"
              >
                Profile
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

      {/* New Alert Notification Banner */}
      {showNewAlert && (
        <div className="bg-red-600 text-white px-4 py-3 animate-pulse">
          <div className="mx-auto max-w-7xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-white p-2">
                <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                  />
                </svg>
              </div>
              <div>
                <p className="font-bold text-lg">NEW RESCUE ALERT!</p>
                <p className="text-sm">{newAlertCount} new request(s) need your help</p>
              </div>
            </div>
            <button
              onClick={() => setShowNewAlert(false)}
              className="rounded-md bg-red-700 px-4 py-2 text-sm hover:bg-red-800"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Polling Status Indicator */}
      <div className="bg-gray-800 text-white px-4 py-2 text-xs">
        <div className="mx-auto max-w-7xl flex items-center justify-between">
          <span className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${volunteerAlertsQuery.error ? 'bg-red-400' : 'bg-green-400'} animate-pulse`}></span>
            {volunteerAlertsQuery.error ? 'Connection error' : `Live polling active (every ${POLLING_INTERVAL / 1000}s)`}
          </span>
          <span>
            Total alerts: {totalAlerts} | Assigned: {assignedRequests.length} | Pending: {pendingRequests.length}
          </span>
        </div>
      </div>

      {/* Error Banner */}
      {volunteerAlertsQuery.error && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-3">
          <div className="mx-auto max-w-7xl flex items-center gap-2 text-red-800">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <span className="text-sm">
              Error loading rescue data: {volunteerAlertsQuery.error.message}
            </span>
            <button
              onClick={() => volunteerAlertsQuery.refetch()}
              className="ml-auto text-sm bg-red-100 hover:bg-red-200 px-2 py-1 rounded"
            >
              Retry
            </button>
          </div>
        </div>
      )}

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
            <button
              onClick={() => {
                setLocationError(null);
                // Retry location tracking
                if (shouldQuery && navigator.geolocation) {
                  navigator.geolocation.getCurrentPosition(
                    (position) => {
                      const { latitude, longitude } = position.coords;
                      setMyLocation({ lat: latitude, lng: longitude });
                      updateLocation.mutate({ latitude, longitude });
                      setLocationError(null);
                    },
                    (error) => setLocationError(error.message),
                    { 
                      enableHighAccuracy: true, 
                      timeout: 30000, // Increased timeout for GPS lock
                      maximumAge: 0 // Force fresh location, no cache
                    }
                  );
                }
              }}
              className="ml-auto text-sm bg-yellow-100 hover:bg-yellow-200 px-2 py-1 rounded"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Location Update Error Banner */}
      {updateLocation.error && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-3">
          <div className="mx-auto max-w-7xl flex items-center gap-2 text-red-800">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <span className="text-sm">
              Failed to update location: {updateLocation.error.message}
            </span>
            <button
              onClick={() => {
                updateLocation.reset();
                // Retry location update if we have current location
                if (myLocation && shouldQuery) {
                  updateLocation.mutate({ 
                    latitude: myLocation.lat, 
                    longitude: myLocation.lng 
                  });
                }
              }}
              className="ml-auto text-sm bg-red-100 hover:bg-red-200 px-2 py-1 rounded"
            >
              Retry
            </button>
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
                      <p className="mt-2 font-medium">{request.user?.name || request.user?.email || "Anonymous User"}</p>
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
                    <p className="text-xs mb-2 text-gray-600">
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

                  {/* ML-assisted ETA Display */}
                  {request.etaMinMinutes && request.etaMaxMinutes && (
                    <div className="mb-3 p-2 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-blue-900">
                            🤖 ML-Assisted ETA: {formatETA({
                              minMinutes: request.etaMinMinutes,
                              maxMinutes: request.etaMaxMinutes,
                              confidence: request.etaConfidence as any,
                              factors: request.etaFactors ? JSON.parse(request.etaFactors) : []
                            })}
                          </p>
                          <p className={`text-xs ${getConfidenceColor(request.etaConfidence as any)}`}>
                            Confidence: {request.etaConfidence}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-blue-700">
                            Based on real-time signals
                          </p>
                        </div>
                      </div>
                      {request.etaFactors && (
                        <div className="mt-2">
                          <p className="text-xs text-blue-700">
                            <strong>Factors:</strong> {JSON.parse(request.etaFactors).join(', ')}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Smart Resource Suggestions */}
                  {nearbyResourcesQuery.data && nearbyResourcesQuery.data.length > 0 && (
                    <div className="mb-3 p-3 bg-green-50 rounded-lg border border-green-200">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-lg">📦</span>
                        <p className="text-sm font-medium text-green-900">
                          Nearby Resources You Can Pick Up:
                        </p>
                      </div>
                      <div className="space-y-2">
                        {nearbyResourcesQuery.data.slice(0, 2).map((resource) => (
                          <div key={resource.id} className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                              <span>
                                {resource.resourceType === "BOAT" ? "🚤" :
                                 resource.resourceType === "GENERATOR" ? "⚡" :
                                 resource.resourceType === "WATER" ? "💧" :
                                 resource.resourceType === "FOOD" ? "🍞" :
                                 resource.resourceType === "MEDICAL" ? "🏥" : "📦"}
                              </span>
                              <span className="font-medium">{resource.name}</span>
                              <span className="text-gray-600">({resource.quantity})</span>
                            </div>
                            <span className="text-green-600 font-medium">
                              {resource.distance.toFixed(1)}km
                            </span>
                          </div>
                        ))}
                        {nearbyResourcesQuery.data.length > 2 && (
                          <p className="text-xs text-green-700 text-center pt-1 border-t border-green-200">
                            +{nearbyResourcesQuery.data.length - 2} more resources nearby
                          </p>
                        )}
                      </div>
                    </div>
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
                        {request.user?.name || request.user?.email || "Anonymous User"}
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

          {/* Escalated Requests (NO_VOLUNTEER) */}
          {escalatedRequests.length > 0 && (
            <div className="rounded-lg bg-white p-6 shadow-md border-2 border-orange-400">
              <h2 className="mb-6 text-xl font-semibold text-gray-900 flex items-center gap-2">
                <svg className="h-6 w-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
                Escalated - No Volunteer Found
                <span className="rounded-full bg-orange-100 px-2 py-1 text-xs text-orange-800">
                  {escalatedRequests.length} critical
                </span>
              </h2>

              <div className="space-y-4">
                {escalatedRequests.map((request) => (
                  <div key={request.id} className="rounded-lg border-2 border-orange-300 bg-orange-50 p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <span className="inline-block rounded-full bg-orange-500 px-2 py-1 text-xs font-medium text-white">
                          CRITICAL - ESCALATED
                        </span>
                        <p className="mt-2 font-medium text-gray-900">
                          {request.user?.name || request.user?.email || "Anonymous User"}
                        </p>
                      </div>
                      <span className="text-xs text-orange-700">{getTimeSince(request.createdAt)}</span>
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
                      className="w-full rounded-md bg-orange-600 px-4 py-2 text-white font-medium hover:bg-orange-700 disabled:opacity-50 transition-colors"
                    >
                      {acceptRequest.isPending ? "Accepting..." : "Accept Critical Request"}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Shelter Management Section */}
        <div className="mt-8 grid gap-8 lg:grid-cols-2">
          {/* Create Shelter */}
          <div>
            {!showCreateShelter ? (
              <div className="rounded-lg bg-white p-6 shadow-md border-2 border-dashed border-green-300">
                <div className="text-center">
                  <svg className="mx-auto h-12 w-12 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <h3 className="mt-2 text-lg font-medium text-gray-900">Create Safe Zone</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Set up shelters, camps, or hospitals for people in need
                  </p>
                  <button
                    onClick={() => setShowCreateShelter(true)}
                    className="mt-4 rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 transition-colors"
                  >
                    Create Safe Zone
                  </button>
                </div>
              </div>
            ) : (
              <CreateShelterForm
                onSuccess={() => {
                  setShowCreateShelter(false);
                  mySafeZonesQuery.refetch();
                }}
                onCancel={() => setShowCreateShelter(false)}
              />
            )}
          </div>

          {/* My Safe Zones */}
          <div className="rounded-lg bg-white p-6 shadow-md">
            <h2 className="mb-6 text-xl font-semibold text-gray-900 flex items-center gap-2">
              <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              My Safe Zones
              {mySafeZonesQuery.data && mySafeZonesQuery.data.length > 0 && (
                <span className="rounded-full bg-blue-100 px-2 py-1 text-xs text-blue-800">
                  {mySafeZonesQuery.data.length} created
                </span>
              )}
            </h2>

            {mySafeZonesQuery.isLoading && (
              <div className="text-center text-gray-500 py-8">Loading...</div>
            )}

            {mySafeZonesQuery.data && mySafeZonesQuery.data.length === 0 && (
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
                    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                  />
                </svg>
                No safe zones created yet.
              </div>
            )}

            <div className="space-y-4 max-h-96 overflow-y-auto">
              {mySafeZonesQuery.data?.map((safeZone) => (
                <div key={safeZone.id} className="rounded-lg border-2 border-blue-200 bg-blue-50 p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg">
                          {safeZone.type === "SHELTER" ? "🏕" : 
                           safeZone.type === "CAMP" ? "⛺" : "🏥"}
                        </span>
                        <span className="inline-block rounded-full bg-blue-200 px-2 py-1 text-xs font-medium text-blue-800">
                          {safeZone.type}
                        </span>
                      </div>
                      <p className="font-medium text-gray-900">{safeZone.name}</p>
                    </div>
                    <span className="text-xs text-blue-700">
                      {new Date(safeZone.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  {safeZone.capacity && (
                    <p className="text-sm text-gray-700 mb-2">
                      <strong>Capacity:</strong> {safeZone.capacity} people
                    </p>
                  )}

                  <p className="text-xs text-gray-600 mb-3">
                    <strong>Location:</strong> {safeZone.latitude.toFixed(4)}, {safeZone.longitude.toFixed(4)}
                  </p>

                  <div className="text-xs text-green-600">
                    ✅ Visible to authorities on live map
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Resource Management Section */}
        <div className="mt-8 grid gap-8 lg:grid-cols-2">
          {/* Add Resource */}
          <div>
            {!showAddResource ? (
              <div className="rounded-lg bg-white p-6 shadow-md border-2 border-dashed border-blue-300">
                <div className="text-center">
                  <svg className="mx-auto h-12 w-12 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                  <h3 className="mt-2 text-lg font-medium text-gray-900">Add Resource</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Share disaster response resources with the community
                  </p>
                  <button
                    onClick={() => setShowAddResource(true)}
                    className="mt-4 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
                  >
                    Add Resource
                  </button>
                </div>
              </div>
            ) : (
              <AddResourceForm
                onSuccess={() => {
                  setShowAddResource(false);
                  myResourcesQuery.refetch();
                }}
                onCancel={() => setShowAddResource(false)}
              />
            )}
          </div>

          {/* My Resources */}
          <div className="rounded-lg bg-white p-6 shadow-md">
            <h2 className="mb-6 text-xl font-semibold text-gray-900 flex items-center gap-2">
              <svg className="h-6 w-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
              My Resources
              {myResourcesQuery.data && myResourcesQuery.data.length > 0 && (
                <span className="rounded-full bg-purple-100 px-2 py-1 text-xs text-purple-800">
                  {myResourcesQuery.data.length} shared
                </span>
              )}
            </h2>

            {myResourcesQuery.isLoading && (
              <div className="text-center text-gray-500 py-8">Loading...</div>
            )}

            {myResourcesQuery.data && myResourcesQuery.data.length === 0 && (
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
                    d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                  />
                </svg>
                No resources shared yet.
              </div>
            )}

            <div className="space-y-4 max-h-96 overflow-y-auto">
              {myResourcesQuery.data?.map((resource) => (
                <div key={resource.id} className="rounded-lg border-2 border-purple-200 bg-purple-50 p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg">
                          {resource.resourceType === "BOAT" ? "🚤" :
                           resource.resourceType === "GENERATOR" ? "⚡" :
                           resource.resourceType === "WATER" ? "💧" :
                           resource.resourceType === "FOOD" ? "🍞" :
                           resource.resourceType === "MEDICAL" ? "🏥" : "📦"}
                        </span>
                        <span className="inline-block rounded-full bg-purple-200 px-2 py-1 text-xs font-medium text-purple-800">
                          {resource.resourceType}
                        </span>
                      </div>
                      <p className="font-medium text-gray-900">{resource.name}</p>
                    </div>
                    <span className="text-xs text-purple-700">
                      {new Date(resource.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  <p className="text-sm text-gray-700 mb-2">
                    <strong>Quantity:</strong> {resource.quantity}
                  </p>

                  {resource.contactInfo && (
                    <p className="text-sm text-gray-700 mb-2">
                      <strong>Contact:</strong> {resource.contactInfo}
                    </p>
                  )}

                  <p className="text-xs text-gray-600 mb-3">
                    <strong>Location:</strong> {resource.latitude.toFixed(4)}, {resource.longitude.toFixed(4)}
                  </p>

                  <div className="text-xs text-green-600">
                    ✅ Visible to authorities and nearby volunteers
                  </div>
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
              {myLocation && <p className="text-xs text-gray-500 mt-1">Full: {myLocation.lat}</p>}
            </div>
            <div className="rounded-lg bg-blue-50 p-4 text-center">
              <p className="text-2xl font-bold text-blue-600">
                {myLocation ? `${myLocation.lng.toFixed(4)}` : "—"}
              </p>
              <p className="text-sm text-blue-700">Longitude</p>
              {myLocation && <p className="text-xs text-gray-500 mt-1">Full: {myLocation.lng}</p>}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

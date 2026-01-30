"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { api } from "~/trpc/react";
import {
  isOnline,
  cacheGuide,
  getCachedGuide,
  type CachedGuide,
} from "~/lib/offline";
import { formatETA, getConfidenceColor } from "~/lib/eta-prediction";
import AlertsMap from "~/app/components/alerts-map";
import { RealTimeCommunication } from "~/app/components/real-time-communication";

type DisasterType = "FLOOD" | "EARTHQUAKE" | "FIRE";

const disasterTypeLabels: Record<DisasterType, string> = {
  FLOOD: "Flood",
  EARTHQUAKE: "Earthquake",
  FIRE: "Fire",
};

const disasterTypeColors: Record<DisasterType, string> = {
  FLOOD: "bg-blue-100 text-blue-800 border-blue-200",
  EARTHQUAKE: "bg-orange-100 text-orange-800 border-orange-200",
  FIRE: "bg-red-100 text-red-800 border-red-200",
};

export default function UserDashboard() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [online, setOnline] = useState(true);
  const [selectedDisasterType, setSelectedDisasterType] =
    useState<DisasterType>("FLOOD");
  const [cachedGuideData, setCachedGuideData] = useState<CachedGuide | null>(
    null,
  );
  const [showingCached, setShowingCached] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [showRealTimeComms, setShowRealTimeComms] = useState(false);

  // Check authentication and role
  const isAuthenticated = status === "authenticated";
  const isUser = session?.user?.role === "USER";
  const shouldQuery = isAuthenticated && isUser;

  // Redirect if not authenticated or wrong role
  useEffect(() => {
    if (status === "loading") return; // Still loading
    
    if (!isAuthenticated) {
      router.push("/");
      return;
    }
    
    if (!isUser) {
      router.push("/dashboard");
      return;
    }
  }, [status, isAuthenticated, isUser, router]);

  // Get user location for affected zone detection
  useEffect(() => {
    if (typeof window === "undefined" || !navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      (error) => {
        console.log("Could not get user location:", error.message);
      },
      { 
        enableHighAccuracy: true, 
        timeout: 30000, // Increased timeout for GPS lock
        maximumAge: 0 // Force fresh location, no cache
      }
    );
  }, []);

  // Check online status
  useEffect(() => {
    setOnline(isOnline());

    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Fetch alerts with user location for affected zone detection
  const alertsQuery = api.alert.getAlertsForUser.useQuery(
    { latitude: userLocation?.latitude ?? 0, longitude: userLocation?.longitude ?? 0 },
    {
      enabled: online && shouldQuery && userLocation !== null,
      refetchInterval: online && shouldQuery ? 30000 : false,
    }
  );

  // Show loading state specifically for location-based alerts
  const showLocationLoading = userLocation === null && shouldQuery;

  // Fetch guide for selected disaster type
  const guideQuery = api.guide.getByDisaster.useQuery(
    { disasterType: selectedDisasterType },
    {
      enabled: online && shouldQuery,
      refetchOnWindowFocus: false,
    },
  );

  // Fetch my rescue requests to check status
  const myRequestsQuery = api.rescue.getMyRequests.useQuery(undefined, {
    enabled: shouldQuery,
    refetchInterval: shouldQuery ? 5000 : false, // Poll for status updates
  });

  // Find active request
  const currentRescue = myRequestsQuery.data?.find((req) =>
    ["PENDING", "ASSIGNED", "IN_PROGRESS", "NO_VOLUNTEER"].includes(req.status),
  );

  // Cache guide when fetched
  useEffect(() => {
    if (guideQuery.data) {
      cacheGuide(selectedDisasterType, guideQuery.data.content);
      setShowingCached(false);
    }
  }, [guideQuery.data, selectedDisasterType]);

  // Load cached guide when offline or when guide doesn't exist
  useEffect(() => {
    if (!online || (!guideQuery.data && !guideQuery.isLoading)) {
      const cached = getCachedGuide(selectedDisasterType);
      setCachedGuideData(cached);
      if (cached) {
        setShowingCached(true);
      }
    } else {
      setShowingCached(false);
    }
  }, [online, selectedDisasterType, guideQuery.data, guideQuery.isLoading]);

  const handleSignOut = async () => {
    await signOut({ redirect: false });
    router.push("/");
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleString();
  };

  // Determine what guide content to show
  const guideContent = showingCached
    ? cachedGuideData?.content
    : guideQuery.data?.content;

  // Show loading screen while session is loading
  if (status === "loading") {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render anything if redirecting
  if (!isAuthenticated || !isUser) {
    return null;
  }

  // Rescue mutations
  const createRescue = api.rescue.create.useMutation({
    onSuccess: () => {
      myRequestsQuery.refetch();
      setActionMessage("Emergency alert sent! Help is being coordinated.");
    },
    onError: (error) => {
      setActionMessage(`Failed to send alert: ${error.message}`);
    },
  });

  const cancelRescue = api.rescue.cancel.useMutation({
    onSuccess: () => {
      myRequestsQuery.refetch();
      setActionMessage("Rescue request cancelled. Glad you are safe.");
    },
    onError: (error) => {
      setActionMessage(`Failed to cancel: ${error.message}`);
    },
  });

  // Handler for "I need help" — captures geolocation and creates SOS via tRPC
  const handleNeedHelp = async () => {
    setActionMessage(null);

    // If already has active request
    if (currentRescue) {
      setActionMessage("You already have an active request.");
      return;
    }

    if (!navigator.geolocation) {
      setActionMessage("Geolocation is not supported by your browser.");
      return;
    }

    setActionMessage("Obtaining location...");

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          setActionMessage("Sending emergency alert...");

          await createRescue.mutateAsync({
            latitude,
            longitude,
            message: "Emergency Help Needed (Location Shared)", // Default message
            location: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
          });
        } catch (err: any) {
          // Handled in onError
        }
      },
      (error) => {
        setActionMessage(`Location error: ${error.message}`);
      },
      { 
        enableHighAccuracy: true, 
        timeout: 30000, // Increased timeout for GPS lock
        maximumAge: 0 // Force fresh location, no cache
      },
    );
  };

  // Handler for "I am safe" — cancels active rescue request
  const handleIAmSafe = async () => {
    setActionMessage(null);
    try {
      if (currentRescue) {
        setActionMessage("Cancelling rescue request...");
        await cancelRescue.mutateAsync({ requestId: currentRescue.id });
      } else {
        setActionMessage("No active rescue request found.");
      }
    } catch (err: any) {
      // Handled in onError
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="mx-auto max-w-7xl px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-xl bg-blue-500 flex items-center justify-center">
                <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">Safety Center</h1>
                <p className="text-sm text-gray-500">Emergency alerts and safety guides</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* Online/Offline indicator */}
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${
                online ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"
              }`}>
                <div className={`h-2 w-2 rounded-full ${online ? "bg-green-500 animate-pulse" : "bg-amber-500"}`}></div>
                <span className="font-medium">{online ? "Online" : "Offline"}</span>
              </div>

              {/* Quick Access Buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => router.push("/training")}
                  className="px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors text-sm font-medium"
                >
                  Training
                </button>
              </div>

              {/* Emergency action buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleIAmSafe}
                  disabled={!currentRescue}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                    !currentRescue
                      ? "cursor-not-allowed bg-gray-100 text-gray-400"
                      : "bg-green-500 text-white hover:bg-green-600"
                  }`}
                >
                  I'm Safe
                </button>
                <button
                  onClick={handleNeedHelp}
                  disabled={!!currentRescue || createRescue.isPending}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                    currentRescue || createRescue.isPending
                      ? "cursor-not-allowed bg-gray-100 text-gray-400"
                      : "bg-red-500 text-white hover:bg-red-600"
                  }`}
                >
                  {createRescue.isPending
                    ? "Sending..."
                    : currentRescue
                      ? "Help Requested"
                      : "Need Help"}
                </button>
              </div>

              <button
                onClick={() => router.push("/profile")}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </button>

              <button
                onClick={() => setShowRealTimeComms(true)}
                className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors text-sm font-medium flex items-center gap-2"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                🚨 Emergency Chat
              </button>

              <button
                onClick={handleSignOut}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Action message feedback */}
      {actionMessage && (
        <div className="mx-auto max-w-7xl px-6 py-4">
          <div className="rounded-xl bg-blue-50 p-4 text-blue-800 border border-blue-200">
            <div className="flex items-center gap-2">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {actionMessage}
            </div>
          </div>
        </div>
      )}

      {/* Active Rescue Status Banner */}
      {currentRescue && (
        <div className="border-b border-red-200 bg-red-50 px-6 py-6">
          <div className="mx-auto max-w-7xl">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <div className="relative flex h-4 w-4">
                  <div className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75"></div>
                  <div className="relative inline-flex h-4 w-4 rounded-full bg-red-500"></div>
                </div>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-red-900 mb-2">
                  Active Rescue Request
                </h3>
                <div className="space-y-2">
                  <p className="text-sm text-red-700">
                    Status: <span className="font-semibold">{currentRescue.status}</span>
                    {currentRescue.volunteer && (
                      <span className="ml-2">
                        • Volunteer: {currentRescue.volunteer.name || currentRescue.volunteer.email}
                      </span>
                    )}
                  </p>
                  
                  {/* ML-assisted ETA Display for User */}
                  {currentRescue.etaMinMinutes && currentRescue.etaMaxMinutes && (
                    <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-lg">🤖</span>
                        <p className="text-sm font-semibold text-blue-900">
                          Estimated Help Arrival: {formatETA({
                            minMinutes: currentRescue.etaMinMinutes,
                            maxMinutes: currentRescue.etaMaxMinutes,
                            confidence: currentRescue.etaConfidence as any,
                            factors: currentRescue.etaFactors ? JSON.parse(currentRescue.etaFactors) : []
                          })}
                        </p>
                      </div>
                      <p className={`text-xs ${getConfidenceColor(currentRescue.etaConfidence as any)}`}>
                        ML-assisted prediction ({currentRescue.etaConfidence} confidence)
                      </p>
                      <p className="text-xs text-blue-700 mt-1">
                        Based on real-time signals: distance, volunteer status, system load
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Disaster Alerts Map */}
        {alertsQuery.data && alertsQuery.data.length > 0 && (
          <div className="mb-8 rounded-2xl bg-white p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                <div className="p-2 bg-red-50 rounded-lg">
                  <svg className="h-5 w-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                  </svg>
                </div>
                Nearby Disaster Alerts
              </h2>
              {userLocation && (
                <span className="text-sm text-gray-600 bg-gray-50 px-3 py-1.5 rounded-lg">
                  Within {Math.max(...alertsQuery.data.map((a: any) => a.radiusKm + a.distance))?.toFixed(0) || '50'} km
                </span>
              )}
            </div>
            <div className="rounded-xl overflow-hidden border border-gray-200">
              <AlertsMap
                alerts={alertsQuery.data}
                userLocation={userLocation}
                className="h-72"
              />
            </div>
          </div>
        )}

        <div className="grid gap-8 lg:grid-cols-2">
          {/* Alert Feed */}
          <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100">
            <h2 className="mb-6 text-xl font-semibold text-gray-900 flex items-center gap-2">
              <div className="p-2 bg-red-50 rounded-lg">
                <svg className="h-5 w-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </div>
              Recent Alerts
            </h2>

            {!online && (
              <div className="mb-4 rounded-xl bg-amber-50 p-4 text-amber-800 border border-amber-200">
                <div className="flex items-center gap-2">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  You are offline. Alerts cannot be loaded.
                </div>
              </div>
            )}

            {showLocationLoading && (
              <div className="py-12 text-center text-gray-500">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="font-medium">Getting your location</p>
                <p className="text-sm mt-1">To show nearby alerts...</p>
              </div>
            )}

            {alertsQuery.isLoading && userLocation && (
              <div className="py-12 text-center text-gray-500">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p>Loading nearby alerts...</p>
              </div>
            )}

            {alertsQuery.error && (
              <div className="rounded-xl bg-red-50 p-4 text-red-800 border border-red-200">
                <div className="flex items-center gap-2">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Error loading alerts: {alertsQuery.error.message}
                </div>
              </div>
            )}

            {alertsQuery.data && alertsQuery.data.length === 0 && userLocation && (
              <div className="py-12 text-center text-gray-500">
                <svg className="h-12 w-12 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="font-medium">No alerts near your location</p>
                <p className="text-sm mt-1">Stay safe!</p>
              </div>
            )}

            {/* Show affected zone warning if user is in any affected area */}
            {alertsQuery.data && alertsQuery.data.some((a: any) => a.isInAffectedZone) && (
              <div className="mb-6 rounded-xl bg-red-100 border-2 border-red-400 p-4">
                <div className="flex items-center gap-3">
                  <div className="relative flex h-4 w-4">
                    <div className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75"></div>
                    <div className="relative inline-flex h-4 w-4 rounded-full bg-red-600"></div>
                  </div>
                  <div>
                    <p className="font-semibold text-red-900">You are in an affected zone!</p>
                    <p className="text-sm text-red-700 mt-1">
                      Follow safety instructions and stay alert. Check the alerts below for details.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="max-h-96 space-y-4 overflow-y-auto">
              {alertsQuery.data?.map((alert: any) => (
                <div
                  key={alert.id}
                  className={`rounded-xl border p-6 transition-all ${
                    alert.isInAffectedZone 
                      ? "border-red-500 border-2 bg-red-50 shadow-sm" 
                      : `${disasterTypeColors[alert.disasterType as DisasterType]} border-2`
                  }`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium bg-white/70">
                          {disasterTypeLabels[alert.disasterType as DisasterType]}
                        </span>
                        {alert.isInAffectedZone && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-600 px-3 py-1 text-xs font-semibold text-white">
                            <div className="h-1.5 w-1.5 rounded-full bg-white animate-pulse"></div>
                            IN AFFECTED ZONE
                          </span>
                        )}
                      </div>
                      <h3 className="font-semibold text-gray-900 mb-2">{alert.title}</h3>
                      <p className="text-sm text-gray-700">{alert.message}</p>
                    </div>
                    <span className="text-xs text-gray-500 ml-4">
                      {formatDate(alert.createdAt)}
                    </span>
                  </div>
                  
                  {/* Location info */}
                  <div className="pt-4 border-t border-gray-200">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Affected radius: {alert.radiusKm} km</span>
                      {alert.distance !== undefined && (
                        <span className={`font-medium ${alert.isInAffectedZone ? "text-red-700" : "text-gray-700"}`}>
                          Distance: {alert.distance.toFixed(1)} km
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Safety Guide Viewer */}
          <div className="rounded-lg bg-white p-6 shadow-md">
            <h2 className="mb-6 flex items-center gap-2 text-xl font-semibold text-gray-900">
              <svg
                className="h-6 w-6 text-blue-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              Safety Guides
              {showingCached && (
                <span className="ml-2 rounded-full bg-yellow-100 px-2 py-1 text-xs text-yellow-800">
                  Cached
                </span>
              )}
            </h2>

            {/* Disaster Type Selector */}
            <div className="mb-4">
              <label
                htmlFor="disaster-type"
                className="mb-2 block text-sm font-medium text-gray-700"
              >
                Select Disaster Type
              </label>
              <select
                id="disaster-type"
                value={selectedDisasterType}
                onChange={(e) =>
                  setSelectedDisasterType(e.target.value as DisasterType)
                }
                className="block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              >
                <option value="FLOOD">Flood</option>
                <option value="EARTHQUAKE">Earthquake</option>
                <option value="FIRE">Fire</option>
              </select>
            </div>

            {/* Guide Content */}
            <div className="min-h-48 rounded-lg bg-gray-50 p-4">
              {guideQuery.isLoading && online && (
                <div className="text-center text-gray-500">
                  Loading guide...
                </div>
              )}

              {guideContent ? (
                <div>
                  <h3 className="mb-3 font-medium text-gray-900">
                    {disasterTypeLabels[selectedDisasterType]} Safety
                    Instructions
                  </h3>
                  <div className="prose prose-sm whitespace-pre-wrap text-gray-700">
                    {guideContent}
                  </div>
                  {showingCached && cachedGuideData && (
                    <p className="mt-4 text-xs text-gray-500">
                      Last cached:{" "}
                      {new Date(cachedGuideData.savedAt).toLocaleString()}
                    </p>
                  )}
                </div>
              ) : (
                <div className="text-center text-gray-500">
                  {!online && !cachedGuideData ? (
                    <div>
                      <p>
                        No cached guide available for{" "}
                        {disasterTypeLabels[selectedDisasterType]}.
                      </p>
                      <p className="mt-2 text-sm">
                        Connect to the internet to download guides.
                      </p>
                    </div>
                  ) : (
                    <p>
                      No safety guide available for{" "}
                      {disasterTypeLabels[selectedDisasterType]} yet.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Offline Info */}
            {!online && (
              <div className="mt-4 rounded-md bg-blue-50 p-3 text-sm text-blue-800">
                <strong>Offline Mode:</strong> Viewing cached safety guides.
                Connect to the internet to get the latest updates.
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Real-Time Emergency Communication */}
      <RealTimeCommunication 
        isOpen={showRealTimeComms} 
        onClose={() => setShowRealTimeComms(false)} 
      />
    </div>
  );
}

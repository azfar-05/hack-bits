"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { api } from "~/trpc/react";
import {
  isOnline,
  cacheGuide,
  getCachedGuide,
  type CachedGuide,
} from "~/lib/offline";

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

  // Fetch alerts
  const alertsQuery = api.alert.getAll.useQuery(undefined, {
    enabled: online && shouldQuery,
    refetchInterval: online && shouldQuery ? 30000 : false, // Refetch every 30s when online
  });

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
    router.push("/api/auth/signout");
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
      { enableHighAccuracy: true, maximumAge: 10000 },
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
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-blue-600 text-white shadow-lg">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">User Dashboard</h1>
              <p className="mt-1 text-blue-100">
                Disaster Alert & Rescue Coordination System
              </p>
            </div>
            <div className="flex items-center gap-4">
              {/* Online/Offline indicator */}
              <div
                className={`flex items-center gap-2 rounded-full px-3 py-1 text-sm ${
                  online ? "bg-green-500" : "bg-yellow-500"
                }`}
              >
                <span
                  className={`h-2 w-2 rounded-full ${online ? "bg-green-200" : "bg-yellow-200"}`}
                />
                {online ? "Online" : "Offline"}
              </div>
              {/* Primary emergency action buttons (USER) */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleIAmSafe}
                  disabled={!currentRescue}
                  className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                    !currentRescue
                      ? "cursor-not-allowed bg-gray-400 text-gray-200"
                      : "bg-green-600 text-white hover:bg-green-700"
                  }`}
                >
                  I am safe
                </button>
                <button
                  onClick={handleNeedHelp}
                  disabled={!!currentRescue || createRescue.isPending}
                  className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                    currentRescue || createRescue.isPending
                      ? "cursor-not-allowed bg-gray-400 text-gray-200"
                      : "bg-red-600 text-white hover:bg-red-700"
                  }`}
                >
                  {createRescue.isPending
                    ? "Sending..."
                    : currentRescue
                      ? "Help Requested"
                      : "I need help"}
                </button>
              </div>
              <button
                onClick={() => router.push("/profile")}
                className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium transition-colors hover:bg-blue-800"
              >
                Profile
              </button>
              <button
                onClick={handleSignOut}
                className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium transition-colors hover:bg-blue-800"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Action message feedback */}
      {actionMessage && (
        <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
          <div className="rounded-md bg-indigo-50 p-3 text-sm text-indigo-700">
            {actionMessage}
          </div>
        </div>
      )}

      {/* Active Rescue Status Banner */}
      {currentRescue && (
        <div className="border-b border-red-200 bg-red-50 px-4 py-4">
          <div className="mx-auto max-w-7xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="relative flex h-3 w-3">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-red-500"></span>
                </span>
                <div>
                  <h3 className="text-lg font-medium text-red-800">
                    Active Rescue Request
                  </h3>
                  <p className="text-sm text-red-600">
                    Status:{" "}
                    <span className="font-bold">{currentRescue.status}</span>
                    {currentRescue.volunteer &&
                      ` - Volunteer: ${currentRescue.volunteer.name || currentRescue.volunteer.email}`}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-2">
          {/* Alert Feed */}
          <div className="rounded-lg bg-white p-6 shadow-md">
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
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                />
              </svg>
              Recent Alerts
            </h2>

            {!online && (
              <div className="mb-4 rounded-md bg-yellow-50 p-3 text-sm text-yellow-800">
                You are offline. Alerts cannot be loaded.
              </div>
            )}

            {alertsQuery.isLoading && (
              <div className="py-8 text-center text-gray-500">
                Loading alerts...
              </div>
            )}

            {alertsQuery.error && (
              <div className="rounded-md bg-red-50 p-4 text-red-800">
                Error loading alerts: {alertsQuery.error.message}
              </div>
            )}

            {alertsQuery.data && alertsQuery.data.length === 0 && (
              <div className="py-8 text-center text-gray-500">
                No alerts at this time. Stay safe!
              </div>
            )}

            <div className="max-h-96 space-y-4 overflow-y-auto">
              {alertsQuery.data?.map((alert) => (
                <div
                  key={alert.id}
                  className={`rounded-lg border p-4 ${disasterTypeColors[alert.disasterType as DisasterType]}`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="mb-2 inline-block rounded-full px-2 py-1 text-xs font-medium">
                        {disasterTypeLabels[alert.disasterType as DisasterType]}
                      </span>
                      <h3 className="font-semibold">{alert.title}</h3>
                    </div>
                    <span className="text-xs opacity-75">
                      {formatDate(alert.createdAt)}
                    </span>
                  </div>
                  <p className="mt-2 text-sm">{alert.message}</p>
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
    </div>
  );
}

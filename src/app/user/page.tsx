"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "~/trpc/react";
import { isOnline, cacheGuide, getCachedGuide, type CachedGuide } from "~/lib/offline";

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
  const [online, setOnline] = useState(true);
  const [selectedDisasterType, setSelectedDisasterType] = useState<DisasterType>("FLOOD");
  const [cachedGuideData, setCachedGuideData] = useState<CachedGuide | null>(null);
  const [showingCached, setShowingCached] = useState(false);

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
    enabled: online,
    refetchInterval: online ? 30000 : false, // Refetch every 30s when online
  });

  // Fetch guide for selected disaster type
  const guideQuery = api.guide.getByDisaster.useQuery(
    { disasterType: selectedDisasterType },
    {
      enabled: online,
      refetchOnWindowFocus: false,
    }
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
  const guideContent = showingCached ? cachedGuideData?.content : guideQuery.data?.content;

  // Emergency mutations
  const createEmergency = api.emergency.create.useMutation();
  const resolveLatest = api.emergency.resolveLatest.useMutation();
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Handler for "I need help" — captures geolocation and creates SOS via tRPC
  const handleNeedHelp = async () => {
    setActionMessage(null);

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

          await createEmergency.mutateAsync({ latitude, longitude });

          setActionMessage("Emergency alert sent. Authorities will be notified.");
        } catch (err: any) {
          setActionMessage(err?.message ?? "Failed to send emergency alert.");
        }
      },
      (error) => {
        setActionMessage(`Location error: ${error.message}`);
      },
      { enableHighAccuracy: true, maximumAge: 10000 }
    );
  };

  // Handler for "I am safe" — resolves latest open emergency or creates a safety confirmation
  const handleIAmSafe = async () => {
    setActionMessage(null);
    try {
      setActionMessage("Updating status...");
      const res = await resolveLatest.mutateAsync();

      if (res.resolved) {
        setActionMessage("Marked latest emergency as RESOLVED.");
      } else {
        setActionMessage("Safety confirmation recorded.");
      }
    } catch (err: any) {
      setActionMessage(err?.message ?? "Failed to update status.");
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
              <p className="mt-1 text-blue-100">Disaster Alert & Rescue Coordination System</p>
            </div>
            <div className="flex items-center gap-4">
              {/* Online/Offline indicator */}
              <div className={`flex items-center gap-2 rounded-full px-3 py-1 text-sm ${
                online ? "bg-green-500" : "bg-yellow-500"
              }`}>
                <span className={`h-2 w-2 rounded-full ${online ? "bg-green-200" : "bg-yellow-200"}`} />
                {online ? "Online" : "Offline"}
              </div>
              {/* Primary emergency action buttons (USER) */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleIAmSafe}
                  className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium hover:bg-green-700 transition-colors"
                >
                  I am safe
                </button>
                <button
                  onClick={handleNeedHelp}
                  className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium hover:bg-red-700 transition-colors"
                >
                  I need help
                </button>
              </div>
              <button
                onClick={handleSignOut}
                className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium hover:bg-blue-800 transition-colors"
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
          <div className="rounded-md bg-indigo-50 p-3 text-sm text-indigo-700">{actionMessage}</div>
        </div>
      )}

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-2">
          {/* Alert Feed */}
          <div className="rounded-lg bg-white p-6 shadow-md">
            <h2 className="mb-6 text-xl font-semibold text-gray-900 flex items-center gap-2">
              <svg className="h-6 w-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              Recent Alerts
            </h2>

            {!online && (
              <div className="mb-4 rounded-md bg-yellow-50 p-3 text-sm text-yellow-800">
                You are offline. Alerts cannot be loaded.
              </div>
            )}

            {alertsQuery.isLoading && (
              <div className="text-center text-gray-500 py-8">Loading alerts...</div>
            )}

            {alertsQuery.error && (
              <div className="rounded-md bg-red-50 p-4 text-red-800">
                Error loading alerts: {alertsQuery.error.message}
              </div>
            )}

            {alertsQuery.data && alertsQuery.data.length === 0 && (
              <div className="text-center text-gray-500 py-8">
                No alerts at this time. Stay safe!
              </div>
            )}

            <div className="space-y-4 max-h-96 overflow-y-auto">
              {alertsQuery.data?.map((alert) => (
                <div
                  key={alert.id}
                  className={`rounded-lg border p-4 ${disasterTypeColors[alert.disasterType as DisasterType]}`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="inline-block rounded-full px-2 py-1 text-xs font-medium mb-2">
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
            <h2 className="mb-6 text-xl font-semibold text-gray-900 flex items-center gap-2">
              <svg className="h-6 w-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
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
              <label htmlFor="disaster-type" className="block text-sm font-medium text-gray-700 mb-2">
                Select Disaster Type
              </label>
              <select
                id="disaster-type"
                value={selectedDisasterType}
                onChange={(e) => setSelectedDisasterType(e.target.value as DisasterType)}
                className="block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="FLOOD">Flood</option>
                <option value="EARTHQUAKE">Earthquake</option>
                <option value="FIRE">Fire</option>
              </select>
            </div>

            {/* Guide Content */}
            <div className="rounded-lg bg-gray-50 p-4 min-h-48">
              {guideQuery.isLoading && online && (
                <div className="text-center text-gray-500">Loading guide...</div>
              )}

              {guideContent ? (
                <div>
                  <h3 className="font-medium text-gray-900 mb-3">
                    {disasterTypeLabels[selectedDisasterType]} Safety Instructions
                  </h3>
                  <div className="prose prose-sm text-gray-700 whitespace-pre-wrap">
                    {guideContent}
                  </div>
                  {showingCached && cachedGuideData && (
                    <p className="mt-4 text-xs text-gray-500">
                      Last cached: {new Date(cachedGuideData.cachedAt).toLocaleString()}
                    </p>
                  )}
                </div>
              ) : (
                <div className="text-center text-gray-500">
                  {!online && !cachedGuideData ? (
                    <div>
                      <p>No cached guide available for {disasterTypeLabels[selectedDisasterType]}.</p>
                      <p className="text-sm mt-2">Connect to the internet to download guides.</p>
                    </div>
                  ) : (
                    <p>No safety guide available for {disasterTypeLabels[selectedDisasterType]} yet.</p>
                  )}
                </div>
              )}
            </div>

            {/* Offline Info */}
            {!online && (
              <div className="mt-4 rounded-md bg-blue-50 p-3 text-sm text-blue-800">
                <strong>Offline Mode:</strong> Viewing cached safety guides. Connect to the internet to get the latest updates.
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

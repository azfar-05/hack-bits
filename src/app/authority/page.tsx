"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { api } from "~/trpc/react";

type DisasterType = "FLOOD" | "EARTHQUAKE" | "FIRE";
type RescueStatus = "PENDING" | "ASSIGNED" | "IN_PROGRESS" | "COMPLETED" | "NO_VOLUNTEER";

const rescueStatusLabels: Record<RescueStatus, string> = {
  PENDING: "Pending",
  ASSIGNED: "Assigned",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  NO_VOLUNTEER: "No Volunteer",
};

const rescueStatusColors: Record<RescueStatus, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  ASSIGNED: "bg-blue-100 text-blue-800",
  IN_PROGRESS: "bg-purple-100 text-purple-800",
  COMPLETED: "bg-green-100 text-green-800",
  NO_VOLUNTEER: "bg-orange-100 text-orange-800 border-orange-300",
};

export default function AuthorityDashboard() {
  const router = useRouter();
  const { data: session, status } = useSession();

  // Check authentication and role
  const isAuthenticated = status === "authenticated";
  const isAuthority = session?.user?.role === "AUTHORITY";
  const shouldQuery = isAuthenticated && isAuthority;

  // Redirect if not authenticated or wrong role
  useEffect(() => {
    if (status === "loading") return; // Still loading
    
    if (!isAuthenticated) {
      router.push("/");
      return;
    }
    
    if (!isAuthority) {
      router.push("/dashboard");
      return;
    }
  }, [status, isAuthenticated, isAuthority, router]);

  // Alert form state
  const [alertTitle, setAlertTitle] = useState("");
  const [alertMessage, setAlertMessage] = useState("");
  const [alertDisasterType, setAlertDisasterType] = useState<DisasterType>("FLOOD");
  const [alertSuccess, setAlertSuccess] = useState(false);

  // Guide form state
  const [guideDisasterType, setGuideDisasterType] = useState<DisasterType>("FLOOD");
  const [guideContent, setGuideContent] = useState("");
  const [guideSuccess, setGuideSuccess] = useState(false);

  // Manual assign modal state
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [selectedVolunteerId, setSelectedVolunteerId] = useState("");

  // Fetch escalated requests (NO_VOLUNTEER)
  const escalatedQuery = api.rescue.getEscalated.useQuery(undefined, {
    enabled: shouldQuery,
    refetchInterval: shouldQuery ? 10000 : false, // Refresh every 10s
  });

  // Fetch all rescue requests for overview
  const allRequestsQuery = api.rescue.getAllRequests.useQuery(undefined, {
    enabled: shouldQuery,
    refetchInterval: shouldQuery ? 30000 : false,
  });

  // Fetch all volunteers with locations
  const volunteersQuery = api.volunteer.getAllWithLocations.useQuery(undefined, {
    enabled: shouldQuery,
    refetchInterval: shouldQuery ? 30000 : false,
  });

  // Manual assign mutation
  const manualAssign = api.rescue.manualAssign.useMutation({
    onSuccess: () => {
      setShowAssignModal(false);
      setSelectedRequest(null);
      setSelectedVolunteerId("");
      escalatedQuery.refetch();
      allRequestsQuery.refetch();
    },
  });

  const handleManualAssign = () => {
    if (!selectedRequest || !selectedVolunteerId) return;
    manualAssign.mutate({
      requestId: selectedRequest.id,
      volunteerId: selectedVolunteerId,
    });
  };

  const calculateDistance = (lat1?: number, lon1?: number, lat2?: number, lon2?: number) => {
    if (!lat1 || !lon1 || !lat2 || !lon2) return null;
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  // tRPC mutations
  const createAlert = api.alert.create.useMutation({
    onSuccess: () => {
      setAlertTitle("");
      setAlertMessage("");
      setAlertSuccess(true);
      setTimeout(() => setAlertSuccess(false), 3000);
    },
  });

  const createGuide = api.guide.create.useMutation({
    onSuccess: () => {
      setGuideContent("");
      setGuideSuccess(true);
      setTimeout(() => setGuideSuccess(false), 3000);
    },
  });

  const handleAlertSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createAlert.mutate({
      title: alertTitle,
      message: alertMessage,
      disasterType: alertDisasterType,
    });
  };

  const handleGuideSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createGuide.mutate({
      disasterType: guideDisasterType,
      content: guideContent,
    });
  };

  const handleSignOut = async () => {
    router.push("/api/auth/signout");
  };

  // Show loading screen while session is loading
  if (status === "loading") {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render anything if redirecting
  if (!isAuthenticated || !isAuthority) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-red-600 text-white shadow-lg">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Authority Dashboard</h1>
              <p className="mt-1 text-red-100">Disaster Alert & Rescue Coordination System</p>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push("/profile")}
                className="rounded-md bg-red-700 px-4 py-2 text-sm font-medium hover:bg-red-800 transition-colors"
              >
                Profile
              </button>
              <button
                onClick={handleSignOut}
                className="rounded-md bg-red-700 px-4 py-2 text-sm font-medium hover:bg-red-800 transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Escalated Requests Section - NO_VOLUNTEER */}
        {escalatedQuery.data && escalatedQuery.data.length > 0 && (
          <div className="mb-8 rounded-lg border-2 border-orange-400 bg-orange-50 p-6 shadow-lg">
            <div className="flex items-center gap-3 mb-4">
              <div className="rounded-full bg-orange-500 p-2">
                <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold text-orange-800">
                  Escalated Cases - No Volunteer Available
                </h2>
                <p className="text-sm text-orange-700">
                  {escalatedQuery.data.length} user(s) in danger require immediate attention
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {escalatedQuery.data.map((request) => {
                const timeSinceEscalation = request.escalatedAt
                  ? Math.floor((new Date().getTime() - new Date(request.escalatedAt).getTime()) / 60000)
                  : 0;

                return (
                  <div
                    key={request.id}
                    className="flex items-center justify-between rounded-lg bg-white p-4 border border-orange-200"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="inline-flex items-center rounded-full bg-orange-500 px-2 py-1 text-xs font-medium text-white">
                          URGENT
                        </span>
                        <span className="text-sm text-orange-700">
                          Escalated {timeSinceEscalation}m ago
                        </span>
                      </div>
                      <p className="font-medium text-gray-900">
                        {request.user.name || request.user.email}
                      </p>
                      <p className="text-sm text-gray-600 mt-1">{request.message}</p>
                      {request.location && (
                        <p className="text-xs text-gray-500 mt-1">
                          <strong>Location:</strong> {request.location}
                        </p>
                      )}
                    </div>
                    <div className="ml-4 text-right">
                      <p className="text-xs text-gray-500">
                        SOS sent: {new Date(request.createdAt).toLocaleTimeString()}
                      </p>
                      <div className="flex flex-col gap-2 mt-2">
                        <button
                          className="rounded-md bg-green-600 px-3 py-1.5 text-sm text-white hover:bg-green-700"
                          onClick={() => {
                            setSelectedRequest(request);
                            setShowAssignModal(true);
                          }}
                        >
                          Assign Volunteer
                        </button>
                        <button
                          className="rounded-md bg-orange-600 px-3 py-1.5 text-sm text-white hover:bg-orange-700"
                          onClick={() => {
                            alert(`Dispatching emergency services to: ${request.location || "Unknown location"}\nUser: ${request.user.name || request.user.email}`);
                          }}
                        >
                          Dispatch Services
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Rescue Overview Stats */}
        <div className="mb-8 rounded-lg bg-white p-6 shadow-md">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Rescue Operations Overview</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
            <div className="rounded-lg bg-yellow-50 p-4 text-center">
              <p className="text-2xl font-bold text-yellow-600">
                {allRequestsQuery.data?.filter(r => r.status === "PENDING").length || 0}
              </p>
              <p className="text-sm text-yellow-700">Pending</p>
            </div>
            <div className="rounded-lg bg-blue-50 p-4 text-center">
              <p className="text-2xl font-bold text-blue-600">
                {allRequestsQuery.data?.filter(r => r.status === "ASSIGNED").length || 0}
              </p>
              <p className="text-sm text-blue-700">Assigned</p>
            </div>
            <div className="rounded-lg bg-purple-50 p-4 text-center">
              <p className="text-2xl font-bold text-purple-600">
                {allRequestsQuery.data?.filter(r => r.status === "IN_PROGRESS").length || 0}
              </p>
              <p className="text-sm text-purple-700">In Progress</p>
            </div>
            <div className="rounded-lg bg-orange-50 p-4 text-center border-2 border-orange-200">
              <p className="text-2xl font-bold text-orange-600">
                {allRequestsQuery.data?.filter(r => r.status === "NO_VOLUNTEER").length || 0}
              </p>
              <p className="text-sm text-orange-700">No Volunteer</p>
            </div>
            <div className="rounded-lg bg-green-50 p-4 text-center">
              <p className="text-2xl font-bold text-green-600">
                {allRequestsQuery.data?.filter(r => r.status === "COMPLETED").length || 0}
              </p>
              <p className="text-sm text-green-700">Completed</p>
            </div>
          </div>
        </div>

        <div className="grid gap-8 md:grid-cols-2">
          {/* Disaster Alert Form */}
          <div className="rounded-lg bg-white p-6 shadow-md">
            <h2 className="mb-6 text-xl font-semibold text-gray-900">
              Send Disaster Alert
            </h2>

            {alertSuccess && (
              <div className="mb-4 rounded-md bg-green-50 p-4 text-green-800">
                Alert sent successfully!
              </div>
            )}

            {createAlert.error && (
              <div className="mb-4 rounded-md bg-red-50 p-4 text-red-800">
                Error: {createAlert.error.message}
              </div>
            )}

            <form onSubmit={handleAlertSubmit} className="space-y-4">
              <div>
                <label htmlFor="alert-title" className="block text-sm font-medium text-gray-700">
                  Title
                </label>
                <input
                  type="text"
                  id="alert-title"
                  value={alertTitle}
                  onChange={(e) => setAlertTitle(e.target.value)}
                  required
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                  placeholder="e.g., Flash Flood Warning"
                />
              </div>

              <div>
                <label htmlFor="alert-disaster-type" className="block text-sm font-medium text-gray-700">
                  Disaster Type
                </label>
                <select
                  id="alert-disaster-type"
                  value={alertDisasterType}
                  onChange={(e) => setAlertDisasterType(e.target.value as DisasterType)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                >
                  <option value="FLOOD">Flood</option>
                  <option value="EARTHQUAKE">Earthquake</option>
                  <option value="FIRE">Fire</option>
                </select>
              </div>

              <div>
                <label htmlFor="alert-message" className="block text-sm font-medium text-gray-700">
                  Message
                </label>
                <textarea
                  id="alert-message"
                  value={alertMessage}
                  onChange={(e) => setAlertMessage(e.target.value)}
                  required
                  rows={4}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                  placeholder="Enter detailed alert message..."
                />
              </div>

              <button
                type="submit"
                disabled={createAlert.isPending}
                className="w-full rounded-md bg-red-600 px-4 py-2 text-white font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {createAlert.isPending ? "Sending..." : "Send Alert"}
              </button>
            </form>
          </div>

          {/* Safety Guide Form */}
          <div className="rounded-lg bg-white p-6 shadow-md">
            <h2 className="mb-6 text-xl font-semibold text-gray-900">
              Create/Update Safety Guide
            </h2>

            {guideSuccess && (
              <div className="mb-4 rounded-md bg-green-50 p-4 text-green-800">
                Safety guide saved successfully!
              </div>
            )}

            {createGuide.error && (
              <div className="mb-4 rounded-md bg-red-50 p-4 text-red-800">
                Error: {createGuide.error.message}
              </div>
            )}

            <form onSubmit={handleGuideSubmit} className="space-y-4">
              <div>
                <label htmlFor="guide-disaster-type" className="block text-sm font-medium text-gray-700">
                  Disaster Type
                </label>
                <select
                  id="guide-disaster-type"
                  value={guideDisasterType}
                  onChange={(e) => setGuideDisasterType(e.target.value as DisasterType)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="FLOOD">Flood</option>
                  <option value="EARTHQUAKE">Earthquake</option>
                  <option value="FIRE">Fire</option>
                </select>
              </div>

              <div>
                <label htmlFor="guide-content" className="block text-sm font-medium text-gray-700">
                  Safety Instructions
                </label>
                <textarea
                  id="guide-content"
                  value={guideContent}
                  onChange={(e) => setGuideContent(e.target.value)}
                  required
                  rows={8}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="Enter safety instructions for this disaster type..."
                />
              </div>

              <button
                type="submit"
                disabled={createGuide.isPending}
                className="w-full rounded-md bg-blue-600 px-4 py-2 text-white font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {createGuide.isPending ? "Saving..." : "Save Guide"}
              </button>
            </form>
          </div>
        </div>

        {/* Manual Assignment Modal */}
        {showAssignModal && selectedRequest && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-xl max-h-[80vh] overflow-y-auto">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                Manually Assign Volunteer
              </h2>

              <div className="mb-4 rounded-lg bg-orange-50 p-4">
                <h3 className="font-medium text-orange-800">User in Danger</h3>
                <p className="text-sm text-gray-700 mt-1">
                  {selectedRequest.user.name || selectedRequest.user.email}
                </p>
                <p className="text-sm text-gray-600">{selectedRequest.message}</p>
                {selectedRequest.location && (
                  <p className="text-xs text-gray-500 mt-1">
                    Location: {selectedRequest.location}
                  </p>
                )}
                {selectedRequest.latitude && (
                  <p className="text-xs text-gray-500">
                    Coordinates: {selectedRequest.latitude.toFixed(4)}, {selectedRequest.longitude?.toFixed(4)}
                  </p>
                )}
              </div>

              <h3 className="font-medium text-gray-900 mb-3">Available Volunteers</h3>
              
              {volunteersQuery.isLoading && (
                <p className="text-gray-500 text-sm">Loading volunteers...</p>
              )}

              {volunteersQuery.data && volunteersQuery.data.length === 0 && (
                <p className="text-gray-500 text-sm">No volunteers registered in the system.</p>
              )}

              <div className="space-y-2 max-h-64 overflow-y-auto">
                {volunteersQuery.data?.map((volunteer) => {
                  const distance = calculateDistance(
                    selectedRequest.latitude,
                    selectedRequest.longitude,
                    volunteer.latitude ?? undefined,
                    volunteer.longitude ?? undefined
                  );
                  const isBusy = volunteer.activeAssignments > 0;

                  return (
                    <label
                      key={volunteer.id}
                      className={`flex items-center justify-between rounded-lg border p-3 cursor-pointer transition-colors ${
                        selectedVolunteerId === volunteer.id
                          ? "border-green-500 bg-green-50"
                          : "border-gray-200 hover:bg-gray-50"
                      } ${isBusy ? "opacity-50" : ""}`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="volunteer"
                          value={volunteer.id}
                          checked={selectedVolunteerId === volunteer.id}
                          onChange={(e) => setSelectedVolunteerId(e.target.value)}
                          disabled={isBusy}
                          className="h-4 w-4 text-green-600"
                        />
                        <div>
                          <p className="font-medium text-gray-900">
                            {volunteer.name || volunteer.email}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 ${
                              volunteer.available ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
                            }`}>
                              {volunteer.available ? "Available" : "Unavailable"}
                            </span>
                            {isBusy && (
                              <span className="inline-flex items-center rounded-full bg-yellow-100 px-2 py-0.5 text-yellow-700">
                                {volunteer.activeAssignments} active rescue
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        {distance !== null ? (
                          <p className="text-sm font-medium text-gray-900">
                            {distance.toFixed(1)} km
                          </p>
                        ) : (
                          <p className="text-xs text-gray-400">No location</p>
                        )}
                        {volunteer.lastUpdated && (
                          <p className="text-xs text-gray-400">
                            Updated {new Date(volunteer.lastUpdated).toLocaleTimeString()}
                          </p>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>

              {manualAssign.error && (
                <div className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-800">
                  {manualAssign.error.message}
                </div>
              )}

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowAssignModal(false);
                    setSelectedRequest(null);
                    setSelectedVolunteerId("");
                  }}
                  className="flex-1 rounded-md border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleManualAssign}
                  disabled={!selectedVolunteerId || manualAssign.isPending}
                  className="flex-1 rounded-md bg-green-600 px-4 py-2 text-white font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {manualAssign.isPending ? "Assigning..." : "Assign Volunteer"}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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

  // Alert form state
  const [alertTitle, setAlertTitle] = useState("");
  const [alertMessage, setAlertMessage] = useState("");
  const [alertDisasterType, setAlertDisasterType] = useState<DisasterType>("FLOOD");
  const [alertSuccess, setAlertSuccess] = useState(false);

  // Guide form state
  const [guideDisasterType, setGuideDisasterType] = useState<DisasterType>("FLOOD");
  const [guideContent, setGuideContent] = useState("");
  const [guideSuccess, setGuideSuccess] = useState(false);

  // Fetch escalated requests (NO_VOLUNTEER)
  const escalatedQuery = api.rescue.getEscalated.useQuery(undefined, {
    refetchInterval: 10000, // Refresh every 10s
  });

  // Fetch all rescue requests for overview
  const allRequestsQuery = api.rescue.getAllRequests.useQuery(undefined, {
    refetchInterval: 30000,
  });

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
            <button
              onClick={handleSignOut}
              className="rounded-md bg-red-700 px-4 py-2 text-sm font-medium hover:bg-red-800 transition-colors"
            >
              Sign Out
            </button>
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
                      <button
                        className="mt-2 rounded-md bg-orange-600 px-3 py-1.5 text-sm text-white hover:bg-orange-700"
                        onClick={() => {
                          // Mock dispatch action
                          alert(`Dispatching emergency services to: ${request.location || "Unknown location"}\nUser: ${request.user.name || request.user.email}`);
                        }}
                      >
                        Dispatch Services
                      </button>
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
      </main>
    </div>
  );
}

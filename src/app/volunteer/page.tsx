"use client";

import { useRouter } from "next/navigation";
import { api } from "~/trpc/react";

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

  // Fetch pending requests
  const pendingRequestsQuery = api.rescue.getPendingRequests.useQuery(undefined, {
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  // Fetch assigned requests
  const assignedRequestsQuery = api.rescue.getAssignedToMe.useQuery(undefined, {
    refetchInterval: 10000,
  });

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

  const handleSignOut = async () => {
    router.push("/api/auth/signout");
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleString();
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
            <button
              onClick={handleSignOut}
              className="rounded-md bg-green-700 px-4 py-2 text-sm font-medium hover:bg-green-800 transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-2">
          {/* My Assigned Requests */}
          <div className="rounded-lg bg-white p-6 shadow-md">
            <h2 className="mb-6 text-xl font-semibold text-gray-900 flex items-center gap-2">
              <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
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
                      <p className="mt-2 font-medium">
                        {request.user.name || request.user.email}
                      </p>
                    </div>
                    <span className="text-xs">{getTimeSince(request.createdAt)}</span>
                  </div>

                  <p className="text-sm mb-2">{request.message}</p>
                  
                  {request.location && (
                    <p className="text-xs mb-3">
                      <strong>Location:</strong> {request.location}
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
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
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
                <svg className="h-12 w-12 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                No pending requests at this time.
              </div>
            )}

            <div className="space-y-4 max-h-96 overflow-y-auto">
              {pendingRequestsQuery.data?.map((request) => (
                <div
                  key={request.id}
                  className="rounded-lg border-2 border-yellow-200 bg-yellow-50 p-4"
                >
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
                    <p className="text-xs text-gray-600 mb-3">
                      <strong>Location:</strong> {request.location}
                    </p>
                  )}

                  <button
                    onClick={() => acceptRequest.mutate({ requestId: request.id })}
                    disabled={acceptRequest.isPending}
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
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-lg bg-green-50 p-4 text-center">
              <p className="text-2xl font-bold text-green-600">
                {assignedRequestsQuery.data?.filter(r => r.status === "ASSIGNED").length || 0}
              </p>
              <p className="text-sm text-green-700">Assigned</p>
            </div>
            <div className="rounded-lg bg-purple-50 p-4 text-center">
              <p className="text-2xl font-bold text-purple-600">
                {assignedRequestsQuery.data?.filter(r => r.status === "IN_PROGRESS").length || 0}
              </p>
              <p className="text-sm text-purple-700">In Progress</p>
            </div>
            <div className="rounded-lg bg-yellow-50 p-4 text-center">
              <p className="text-2xl font-bold text-yellow-600">
                {pendingRequestsQuery.data?.length || 0}
              </p>
              <p className="text-sm text-yellow-700">Waiting</p>
            </div>
            <div className="rounded-lg bg-gray-50 p-4 text-center">
              <p className="text-2xl font-bold text-gray-600">
                {(assignedRequestsQuery.data?.length || 0) + (pendingRequestsQuery.data?.length || 0)}
              </p>
              <p className="text-sm text-gray-700">Total Active</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

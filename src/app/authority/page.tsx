"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { api } from "~/trpc/react";
import AuthorityCommandMap from "~/app/components/authority-command-map";
import { PredictiveAnalyticsMap } from "~/app/components/predictive-analytics-map";
import { CreateDisasterForm } from "~/app/components/create-disaster-form";
import { formatETA, getConfidenceColor } from "~/lib/eta-prediction";
import AlertLocationPicker from "~/app/components/alert-location-picker";

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
  const [alertLatitude, setAlertLatitude] = useState<number | null>(null);
  const [alertLongitude, setAlertLongitude] = useState<number | null>(null);
  const [alertRadiusKm, setAlertRadiusKm] = useState<number>(5);
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

  // Fetch danger zones
  const dangerZonesQuery = api.dangerZone.getAll.useQuery(undefined, {
    enabled: shouldQuery,
    refetchInterval: shouldQuery ? 30000 : false,
  });

  // Fetch safe zones
  const safeZonesQuery = api.safeZone.getAll.useQuery(undefined, {
    enabled: shouldQuery,
    refetchInterval: shouldQuery ? 60000 : false,
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
      setAlertLatitude(null);
      setAlertLongitude(null);
      setAlertRadiusKm(5);
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
    
    // Validate location is selected
    if (alertLatitude === null || alertLongitude === null) {
      alert("Please select a location for the alert on the map or enter coordinates manually.");
      return;
    }
    
    createAlert.mutate({
      title: alertTitle,
      message: alertMessage,
      disasterType: alertDisasterType,
      latitude: alertLatitude,
      longitude: alertLongitude,
      radiusKm: alertRadiusKm,
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
        {/* Live Command Map Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                <div className="p-2 bg-red-100 rounded-lg">
                  <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                  </svg>
                </div>
                 Command Center
              </h2>
              <p className="text-gray-600 mt-1">Real-time disaster monitoring and response coordination</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
                Live Updates
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
            <div className="bg-gradient-to-r from-red-600 to-red-700 px-6 py-4">
              <div className="flex items-center justify-between">
                <h3 className="text-white font-semibold flex items-center gap-2">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Karnataka State Command Map
                </h3>
                <div className="text-red-100 text-sm">
                  Last updated: {new Date().toLocaleTimeString()}
                </div>
              </div>
            </div>
            
            <div style={{ height: "600px" }}>
              <AuthorityCommandMap className="h-full" />
            </div>
          </div>
        </div>

        {/* Predictive Analytics Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <svg className="h-6 w-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                Advanced Geospatial Analytics
              </h2>
              <p className="text-gray-600 mt-1">Predictive flood/fire path analysis with safe zone intersection warnings</p>
            </div>
            <CreateDisasterForm />
          </div>
          
          <PredictiveAnalyticsMap />
        </div>

        {/* Comprehensive Status Dashboard */}
        <div className="mb-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Emergency Status Card */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-semibold text-gray-900">Emergency Status</h4>
              <div className="p-2 bg-red-100 rounded-lg">
                <svg className="h-5 w-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
            </div>
            {allRequestsQuery.isLoading ? (
              <div className="animate-pulse space-y-2">
                <div className="h-4 bg-gray-200 rounded"></div>
                <div className="h-4 bg-gray-200 rounded"></div>
                <div className="h-4 bg-gray-200 rounded"></div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Critical (No Volunteer)</span>
                  <span className="px-2 py-1 bg-red-100 text-red-800 rounded-full text-sm font-medium">
                    {allRequestsQuery.data?.filter(r => r.status === "NO_VOLUNTEER").length || 0}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Pending</span>
                  <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium">
                    {allRequestsQuery.data?.filter(r => r.status === "PENDING").length || 0}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">In Progress</span>
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                    {allRequestsQuery.data?.filter(r => r.status === "IN_PROGRESS").length || 0}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Completed Today</span>
                  <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                    {allRequestsQuery.data?.filter(r => 
                      r.status === "COMPLETED" && 
                      new Date(r.completedAt || r.createdAt).toDateString() === new Date().toDateString()
                    ).length || 0}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Volunteer Status Card */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-semibold text-gray-900">Volunteer Force</h4>
              <div className="p-2 bg-blue-100 rounded-lg">
                <svg className="h-5 w-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
            </div>
            {volunteersQuery.isLoading ? (
              <div className="animate-pulse space-y-2">
                <div className="h-4 bg-gray-200 rounded"></div>
                <div className="h-4 bg-gray-200 rounded"></div>
                <div className="h-4 bg-gray-200 rounded"></div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Available</span>
                  <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                    {volunteersQuery.data?.filter(v => v.available && v.activeAssignments === 0).length || 0}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">On Mission</span>
                  <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded-full text-sm font-medium">
                    {volunteersQuery.data?.filter(v => v.activeAssignments > 0).length || 0}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Offline</span>
                  <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded-full text-sm font-medium">
                    {volunteersQuery.data?.filter(v => !v.available).length || 0}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Total Registered</span>
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                    {volunteersQuery.data?.length || 0}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Risk Assessment Card */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-semibold text-gray-900">Risk Assessment</h4>
              <div className="p-2 bg-orange-100 rounded-lg">
                <svg className="h-5 w-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
            </div>
            {dangerZonesQuery.isLoading ? (
              <div className="animate-pulse space-y-2">
                <div className="h-4 bg-gray-200 rounded"></div>
                <div className="h-4 bg-gray-200 rounded"></div>
                <div className="h-4 bg-gray-200 rounded"></div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">High Risk Zones</span>
                  <span className="px-2 py-1 bg-red-100 text-red-800 rounded-full text-sm font-medium">
                    {dangerZonesQuery.data?.filter(z => z.riskLevel === "HIGH").length || 0}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Medium Risk Zones</span>
                  <span className="px-2 py-1 bg-amber-100 text-amber-800 rounded-full text-sm font-medium">
                    {dangerZonesQuery.data?.filter(z => z.riskLevel === "MEDIUM").length || 0}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Low Risk Zones</span>
                  <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                    {dangerZonesQuery.data?.filter(z => z.riskLevel === "LOW").length || 0}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Total Monitored</span>
                  <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded-full text-sm font-medium">
                    {dangerZonesQuery.data?.length || 0}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Infrastructure Card */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-semibold text-gray-900">Safe Infrastructure</h4>
              <div className="p-2 bg-green-100 rounded-lg">
                <svg className="h-5 w-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
            </div>
            {safeZonesQuery.isLoading ? (
              <div className="animate-pulse space-y-2">
                <div className="h-4 bg-gray-200 rounded"></div>
                <div className="h-4 bg-gray-200 rounded"></div>
                <div className="h-4 bg-gray-200 rounded"></div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 flex items-center gap-1">
                    <span>🏕</span> Shelters
                  </span>
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                    {safeZonesQuery.data?.filter(z => z.type === "SHELTER").length || 0}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 flex items-center gap-1">
                    <span>⛺</span> Camps
                  </span>
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                    {safeZonesQuery.data?.filter(z => z.type === "CAMP").length || 0}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 flex items-center gap-1">
                    <span>🏥</span> Hospitals
                  </span>
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                    {safeZonesQuery.data?.filter(z => z.type === "HOSPITAL").length || 0}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Total Capacity</span>
                  <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                    {safeZonesQuery.data?.reduce((total, zone) => total + (zone.capacity || 0), 0).toLocaleString() || 0}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
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
                      {/* Show ETA if request gets assigned */}
                      {request.etaMinMinutes && request.etaMaxMinutes && (
                        <div className="mt-2 p-2 bg-blue-50 rounded border border-blue-200">
                          <p className="text-xs text-blue-900">
                            🤖 <strong>ML-Predicted ETA:</strong> {formatETA({
                              minMinutes: request.etaMinMinutes,
                              maxMinutes: request.etaMaxMinutes,
                              confidence: request.etaConfidence as any,
                              factors: request.etaFactors ? JSON.parse(request.etaFactors) : []
                            })}
                            <span className={`ml-2 ${getConfidenceColor(request.etaConfidence as any)}`}>
                              ({request.etaConfidence} confidence)
                            </span>
                          </p>
                        </div>
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

        {/* ML-Assisted ETA Priority Board */}
        {allRequestsQuery.data && allRequestsQuery.data.filter(r => r.status === "ASSIGNED" && r.etaMinMinutes).length > 0 && (
          <div className="mb-8 rounded-lg bg-white p-6 shadow-md border-2 border-blue-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="rounded-full bg-blue-500 p-2">
                <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold text-blue-800">
                  🤖 ML-Assisted Response Priority Board
                </h2>
                <p className="text-sm text-blue-700">
                  Assigned rescues sorted by estimated arrival time for optimal coordination
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {allRequestsQuery.data
                ?.filter(r => r.status === "ASSIGNED" && r.etaMinMinutes)
                .sort((a, b) => (a.etaMinMinutes || 999) - (b.etaMinMinutes || 999))
                .map((request, index) => (
                  <div
                    key={request.id}
                    className={`flex items-center justify-between rounded-lg p-4 border-2 ${
                      index === 0 ? 'bg-green-50 border-green-300' : 
                      index === 1 ? 'bg-yellow-50 border-yellow-300' : 
                      'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                          index === 0 ? 'bg-green-500 text-white' :
                          index === 1 ? 'bg-yellow-500 text-white' :
                          'bg-gray-500 text-white'
                        }`}>
                          #{index + 1} PRIORITY
                        </span>
                        <span className="text-sm text-gray-600">
                          {new Date(request.createdAt).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="font-medium text-gray-900">
                        {request.user.name || request.user.email}
                      </p>
                      <p className="text-sm text-gray-600 mt-1">{request.message}</p>
                      {request.volunteer && (
                        <p className="text-xs text-blue-600 mt-1">
                          <strong>Volunteer:</strong> {request.volunteer.name || request.volunteer.email}
                        </p>
                      )}
                    </div>
                    <div className="ml-4 text-right">
                      <div className="p-3 bg-blue-100 rounded-lg border border-blue-200">
                        <p className="text-lg font-bold text-blue-900">
                          {formatETA({
                            minMinutes: request.etaMinMinutes!,
                            maxMinutes: request.etaMaxMinutes!,
                            confidence: request.etaConfidence as any,
                            factors: request.etaFactors ? JSON.parse(request.etaFactors) : []
                          })}
                        </p>
                        <p className={`text-xs ${getConfidenceColor(request.etaConfidence as any)}`}>
                          {request.etaConfidence} confidence
                        </p>
                        <p className="text-xs text-blue-700 mt-1">
                          ML-predicted ETA
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

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

              {/* Location Selection */}
              <div className="border-t border-gray-200 pt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Alert Location & Affected Area
                </label>
                <AlertLocationPicker
                  latitude={alertLatitude}
                  longitude={alertLongitude}
                  radiusKm={alertRadiusKm}
                  onLocationChange={(lat, lng) => {
                    setAlertLatitude(lat);
                    setAlertLongitude(lng);
                  }}
                  onRadiusChange={setAlertRadiusKm}
                />
              </div>

              <button
                type="submit"
                disabled={createAlert.isPending || alertLatitude === null || alertLongitude === null}
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

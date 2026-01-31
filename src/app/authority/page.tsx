"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { api } from "~/trpc/react";
import AuthorityCommandMap from "~/app/components/authority-command-map";
import { PredictiveAnalyticsMap } from "~/app/components/predictive-analytics-map";
import { CreateDisasterForm } from "~/app/components/create-disaster-form";
import { TrainingDashboard } from "~/app/components/training-dashboard";
import { RealTimeCommunication } from "~/app/components/real-time-communication";
import { DroneSwarmDashboard } from "~/app/components/drone-swarm-dashboard";
import { SocialMediaDashboard } from "~/app/components/social-media-dashboard";
import { quickDeployEmergencyDrone } from "~/lib/drone-swarm";
import { formatETA, getConfidenceColor } from "~/lib/eta-prediction";
import AlertLocationPicker from "~/app/components/alert-location-picker";
import AuthorityDisasterManager from "~/app/components/authority-disaster-manager";

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
  const [showTraining, setShowTraining] = useState(false);
  const [showRealTimeComms, setShowRealTimeComms] = useState(false);
  const [showDroneSwarm, setShowDroneSwarm] = useState(false);
  const [showSocialScanner, setShowSocialScanner] = useState(false);
  const [emergencyLocation, setEmergencyLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  // Quick drone deployment function
  const handleQuickDroneDeploy = async (location: { latitude: number; longitude: number }, type: 'SOS' | 'EMERGENCY_REQUEST' = 'SOS') => {
    try {
      const mission = await quickDeployEmergencyDrone(location, type);
      alert(`🚁 Emergency surveillance drone deployed!\n\nMission ID: ${mission.id}\nETA: ${mission.estimatedDuration} minutes\nDrone: ${mission.assignedDrones.length} unit(s)\n\nDrone will provide real-time surveillance and report findings.`);
    } catch (error) {
      alert(`Failed to deploy drone: ${(error as Error).message}`);
    }
  };

  // Fetch all alerts for authority management
  const alertsQuery = api.alert.getAll.useQuery(undefined, {
    enabled: shouldQuery,
    refetchInterval: shouldQuery ? 30000 : false,
  });

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
    await signOut({ redirect: false });
    router.push("/");
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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="mx-auto max-w-7xl px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-xl bg-red-500 flex items-center justify-center">
                <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">Authority Command</h1>
                <p className="text-sm text-gray-500">Emergency Response Center</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 rounded-full">
                <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-sm text-green-700 font-medium">Live</span>
              </div>
              <button
                onClick={() => setShowTraining(true)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                title="Training"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </button>

              <button
                onClick={() => setShowSocialScanner(true)}
                className="px-4 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors text-sm font-medium flex items-center gap-2"
                title="AI Social Media Scanner"
              >
                <span>🔍</span>
                Social Scanner
              </button>

              <button
                onClick={() => setShowDroneSwarm(true)}
                className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors text-sm font-medium flex items-center gap-2"
                title="AI Drone Swarm"
              >
                <span>🚁</span>
                AI Drone Swarm
              </button>

              <button
                onClick={() => setShowRealTimeComms(true)}
                className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors text-sm font-medium flex items-center gap-2"
                title="Emergency Communication"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                🚨 Command Center
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

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Live Command Map Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-semibold text-gray-900">Command Center</h2>
              <p className="text-gray-600 mt-1">Real-time disaster monitoring and response coordination</p>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 rounded-full">
              <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-sm text-green-700 font-medium">Live Updates</span>
            </div>
          </div>
          
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="bg-gray-50 px-6 py-4 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <svg className="h-5 w-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Karnataka State Command Map
                </h3>
                <div className="text-gray-500 text-sm">
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
              <h2 className="text-2xl font-semibold text-gray-900">Advanced Analytics</h2>
              <p className="text-gray-600 mt-1">Predictive flood/fire path analysis with safe zone intersection warnings</p>
            </div>
            <CreateDisasterForm />
          </div>
          
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <PredictiveAnalyticsMap />
          </div>
        </div>

        {/* Disaster Management Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-semibold text-gray-900">Active Disasters</h2>
              <p className="text-gray-600 mt-1">Monitor and manage ongoing disasters, view affected users</p>
            </div>
          </div>
          
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <AuthorityDisasterManager 
              alerts={alertsQuery.data || []}
            />
          </div>
        </div>

        {/* Comprehensive Status Dashboard */}
        <div className="mb-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Emergency Status Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-red-50 rounded-xl">
                <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-gray-900">
                  {allRequestsQuery.data?.filter(r => r.status === "NO_VOLUNTEER").length || 0}
                </p>
                <p className="text-sm text-red-600 font-medium">Critical</p>
              </div>
            </div>
            <h4 className="font-semibold text-gray-900 mb-3">Emergency Status</h4>
            {allRequestsQuery.isLoading ? (
              <div className="animate-pulse space-y-2">
                <div className="h-3 bg-gray-200 rounded"></div>
                <div className="h-3 bg-gray-200 rounded"></div>
                <div className="h-3 bg-gray-200 rounded"></div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Pending</span>
                  <span className="text-sm font-medium text-yellow-600">
                    {allRequestsQuery.data?.filter(r => r.status === "PENDING").length || 0}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">In Progress</span>
                  <span className="text-sm font-medium text-blue-600">
                    {allRequestsQuery.data?.filter(r => r.status === "IN_PROGRESS").length || 0}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Completed Today</span>
                  <span className="text-sm font-medium text-green-600">
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
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-blue-50 rounded-xl">
                <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-gray-900">
                  {volunteersQuery.data?.filter(v => v.available && v.activeAssignments === 0).length || 0}
                </p>
                <p className="text-sm text-green-600 font-medium">Available</p>
              </div>
            </div>
            <h4 className="font-semibold text-gray-900 mb-3">Volunteer Force</h4>
            {volunteersQuery.isLoading ? (
              <div className="animate-pulse space-y-2">
                <div className="h-3 bg-gray-200 rounded"></div>
                <div className="h-3 bg-gray-200 rounded"></div>
                <div className="h-3 bg-gray-200 rounded"></div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">On Mission</span>
                  <span className="text-sm font-medium text-orange-600">
                    {volunteersQuery.data?.filter(v => v.activeAssignments > 0).length || 0}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Offline</span>
                  <span className="text-sm font-medium text-gray-600">
                    {volunteersQuery.data?.filter(v => !v.available).length || 0}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Total</span>
                  <span className="text-sm font-medium text-blue-600">
                    {volunteersQuery.data?.length || 0}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Risk Assessment Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-orange-50 rounded-xl">
                <svg className="h-6 w-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-gray-900">
                  {dangerZonesQuery.data?.filter(z => z.riskLevel === "HIGH").length || 0}
                </p>
                <p className="text-sm text-red-600 font-medium">High Risk</p>
              </div>
            </div>
            <h4 className="font-semibold text-gray-900 mb-3">Risk Assessment</h4>
            {dangerZonesQuery.isLoading ? (
              <div className="animate-pulse space-y-2">
                <div className="h-3 bg-gray-200 rounded"></div>
                <div className="h-3 bg-gray-200 rounded"></div>
                <div className="h-3 bg-gray-200 rounded"></div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Medium Risk</span>
                  <span className="text-sm font-medium text-amber-600">
                    {dangerZonesQuery.data?.filter(z => z.riskLevel === "MEDIUM").length || 0}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Low Risk</span>
                  <span className="text-sm font-medium text-green-600">
                    {dangerZonesQuery.data?.filter(z => z.riskLevel === "LOW").length || 0}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Total Zones</span>
                  <span className="text-sm font-medium text-purple-600">
                    {dangerZonesQuery.data?.length || 0}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Infrastructure Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-green-50 rounded-xl">
                <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-gray-900">
                  {safeZonesQuery.data?.reduce((total, zone) => total + (zone.capacity || 0), 0).toLocaleString() || 0}
                </p>
                <p className="text-sm text-green-600 font-medium">Capacity</p>
              </div>
            </div>
            <h4 className="font-semibold text-gray-900 mb-3">Safe Infrastructure</h4>
            {safeZonesQuery.isLoading ? (
              <div className="animate-pulse space-y-2">
                <div className="h-3 bg-gray-200 rounded"></div>
                <div className="h-3 bg-gray-200 rounded"></div>
                <div className="h-3 bg-gray-200 rounded"></div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">🏕 Shelters</span>
                  <span className="text-sm font-medium text-blue-600">
                    {safeZonesQuery.data?.filter(z => z.type === "SHELTER").length || 0}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">⛺ Camps</span>
                  <span className="text-sm font-medium text-blue-600">
                    {safeZonesQuery.data?.filter(z => z.type === "CAMP").length || 0}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">🏥 Hospitals</span>
                  <span className="text-sm font-medium text-blue-600">
                    {safeZonesQuery.data?.filter(z => z.type === "HOSPITAL").length || 0}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
        {/* Escalated Requests Section - NO_VOLUNTEER */}
        {escalatedQuery.data && escalatedQuery.data.length > 0 && (
          <div className="mb-8 rounded-2xl border border-red-200 bg-red-50 p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="rounded-xl bg-red-500 p-3">
                <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-semibold text-red-900">
                  Critical Cases - No Volunteer Available
                </h2>
                <p className="text-sm text-red-700">
                  {escalatedQuery.data.length} user(s) in danger require immediate attention
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {escalatedQuery.data.map((request) => {
                const timeSinceEscalation = request.escalatedAt
                  ? Math.floor((new Date().getTime() - new Date(request.escalatedAt).getTime()) / 60000)
                  : 0;

                return (
                  <div
                    key={request.id}
                    className="flex items-center justify-between rounded-xl bg-white p-6 border border-red-200 shadow-sm"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="inline-flex items-center rounded-full bg-red-500 px-3 py-1 text-xs font-medium text-white">
                          URGENT
                        </span>
                        <span className="text-sm text-red-700 font-medium">
                          Escalated {timeSinceEscalation}m ago
                        </span>
                      </div>
                      <p className="font-semibold text-gray-900 mb-1">
                        {request.user?.name || request.user?.email || "Unknown User"}
                      </p>
                      <p className="text-sm text-gray-600 mb-2">{request.message}</p>
                      {request.location && (
                        <p className="text-xs text-gray-500">
                          <strong>Location:</strong> {request.location}
                        </p>
                      )}
                      {/* Show ETA if request gets assigned */}
                      {request.etaMinMinutes && request.etaMaxMinutes && (
                        <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
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
                    <div className="ml-6 text-right">
                      <p className="text-xs text-gray-500 mb-3">
                        SOS sent: {new Date(request.createdAt).toLocaleTimeString()}
                      </p>
                      <div className="flex flex-col gap-2">
                        <button
                          className="rounded-lg bg-green-500 px-4 py-2 text-sm font-medium text-white hover:bg-green-600 transition-colors"
                          onClick={() => {
                            setSelectedRequest(request);
                            setShowAssignModal(true);
                          }}
                        >
                          Assign Volunteer
                        </button>
                        <button
                          className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 transition-colors"
                          onClick={async () => {
                            const location = {
                              latitude: request.latitude || 0,
                              longitude: request.longitude || 0
                            };
                            await handleQuickDroneDeploy(location, 'EMERGENCY_REQUEST');
                          }}
                        >
                          🚁 Quick Deploy Drone
                        </button>
                        <button
                          className="rounded-lg bg-purple-500 px-4 py-2 text-sm font-medium text-white hover:bg-purple-600 transition-colors"
                          onClick={() => {
                            setEmergencyLocation({
                              latitude: request.latitude || 0,
                              longitude: request.longitude || 0
                            });
                            setShowDroneSwarm(true);
                          }}
                        >
                          🚁 Full Swarm Control
                        </button>
                        <button
                          className="rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 transition-colors"
                          onClick={() => {
                            alert(`Dispatching emergency services to: ${request.location || "Unknown location"}\nUser: ${request.user?.name || request.user?.email || "Unknown User"}`);
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
        <div className="mb-8 rounded-2xl bg-white p-6 shadow-sm border border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Rescue Operations Overview</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
            <div className="rounded-xl bg-yellow-50 p-4 text-center border border-yellow-200">
              <p className="text-2xl font-bold text-yellow-600">
                {allRequestsQuery.data?.filter(r => r.status === "PENDING").length || 0}
              </p>
              <p className="text-sm text-yellow-700 font-medium">Pending</p>
            </div>
            <div className="rounded-xl bg-blue-50 p-4 text-center border border-blue-200">
              <p className="text-2xl font-bold text-blue-600">
                {allRequestsQuery.data?.filter(r => r.status === "ASSIGNED").length || 0}
              </p>
              <p className="text-sm text-blue-700 font-medium">Assigned</p>
            </div>
            <div className="rounded-xl bg-purple-50 p-4 text-center border border-purple-200">
              <p className="text-2xl font-bold text-purple-600">
                {allRequestsQuery.data?.filter(r => r.status === "IN_PROGRESS").length || 0}
              </p>
              <p className="text-sm text-purple-700 font-medium">In Progress</p>
            </div>
            <div className="rounded-xl bg-red-50 p-4 text-center border-2 border-red-200">
              <p className="text-2xl font-bold text-red-600">
                {allRequestsQuery.data?.filter(r => r.status === "NO_VOLUNTEER").length || 0}
              </p>
              <p className="text-sm text-red-700 font-medium">No Volunteer</p>
            </div>
            <div className="rounded-xl bg-green-50 p-4 text-center border border-green-200">
              <p className="text-2xl font-bold text-green-600">
                {allRequestsQuery.data?.filter(r => r.status === "COMPLETED").length || 0}
              </p>
              <p className="text-sm text-green-700 font-medium">Completed</p>
            </div>
          </div>
        </div>

        {/* ML-Assisted ETA Priority Board */}
        {allRequestsQuery.data && allRequestsQuery.data.filter(r => r.status === "ASSIGNED" && r.etaMinMinutes).length > 0 && (
          <div className="mb-8 rounded-2xl bg-white p-6 shadow-sm border border-blue-200">
            <div className="flex items-center gap-3 mb-6">
              <div className="rounded-xl bg-blue-500 p-3">
                <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-semibold text-blue-900">
                  🤖 Response Priority Board
                </h2>
                <p className="text-sm text-blue-700">
                  Assigned rescues sorted by estimated arrival time for optimal coordination
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {allRequestsQuery.data
                ?.filter(r => r.status === "ASSIGNED" && r.etaMinMinutes)
                .sort((a, b) => (a.etaMinMinutes || 999) - (b.etaMinMinutes || 999))
                .map((request, index) => (
                  <div
                    key={request.id}
                    className={`flex items-center justify-between rounded-xl p-6 border-2 ${
                      index === 0 ? 'bg-green-50 border-green-300' : 
                      index === 1 ? 'bg-yellow-50 border-yellow-300' : 
                      'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
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
                      <p className="font-semibold text-gray-900 mb-1">
                        {request.user?.name || request.user?.email || "Unknown User"}
                      </p>
                      <p className="text-sm text-gray-600 mb-2">{request.message}</p>
                      {request.volunteer && (
                        <p className="text-xs text-blue-600">
                          <strong>Volunteer:</strong> {request.volunteer.name || request.volunteer.email}
                        </p>
                      )}
                    </div>
                    <div className="ml-6 text-right">
                      <div className="p-4 bg-blue-50 rounded-xl border border-blue-200 mb-3">
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
                      
                      {/* Quick Drone Deploy for Priority Cases */}
                      <button
                        onClick={async () => {
                          const location = {
                            latitude: request.latitude || 0,
                            longitude: request.longitude || 0
                          };
                          await handleQuickDroneDeploy(location, 'EMERGENCY_REQUEST');
                        }}
                        className="w-full px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-xs font-medium"
                      >
                        🚁 Deploy Surveillance
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          {/* Disaster Alert Form */}
          <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-red-50 rounded-lg">
                <svg className="h-5 w-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-gray-900">
                Send Disaster Alert
              </h2>
            </div>

            {alertSuccess && (
              <div className="mb-4 rounded-xl bg-green-50 p-4 text-green-800 border border-green-200">
                <div className="flex items-center gap-2">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Alert sent successfully!
                </div>
              </div>
            )}

            {createAlert.error && (
              <div className="mb-4 rounded-xl bg-red-50 p-4 text-red-800 border border-red-200">
                <div className="flex items-center gap-2">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Error: {createAlert.error.message}
                </div>
              </div>
            )}

            <form onSubmit={handleAlertSubmit} className="space-y-4">
              <div>
                <label htmlFor="alert-title" className="block text-sm font-medium text-gray-700 mb-2">
                  Title
                </label>
                <input
                  type="text"
                  id="alert-title"
                  value={alertTitle}
                  onChange={(e) => setAlertTitle(e.target.value)}
                  required
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-gray-900 placeholder-gray-500 focus:border-red-500 focus:ring-1 focus:ring-red-500 focus:outline-none transition-colors"
                  placeholder="e.g., Flash Flood Warning"
                />
              </div>

              <div>
                <label htmlFor="alert-disaster-type" className="block text-sm font-medium text-gray-700 mb-2">
                  Disaster Type
                </label>
                <select
                  id="alert-disaster-type"
                  value={alertDisasterType}
                  onChange={(e) => setAlertDisasterType(e.target.value as DisasterType)}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-gray-900 focus:border-red-500 focus:ring-1 focus:ring-red-500 focus:outline-none transition-colors"
                >
                  <option value="FLOOD">Flood</option>
                  <option value="EARTHQUAKE">Earthquake</option>
                  <option value="FIRE">Fire</option>
                </select>
              </div>

              <div>
                <label htmlFor="alert-message" className="block text-sm font-medium text-gray-700 mb-2">
                  Message
                </label>
                <textarea
                  id="alert-message"
                  value={alertMessage}
                  onChange={(e) => setAlertMessage(e.target.value)}
                  required
                  rows={4}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-gray-900 placeholder-gray-500 focus:border-red-500 focus:ring-1 focus:ring-red-500 focus:outline-none transition-colors resize-none"
                  placeholder="Enter detailed alert message..."
                />
              </div>

              {/* Location Selection */}
              <div className="border-t border-gray-100 pt-4">
                <label className="block text-sm font-medium text-gray-700 mb-3">
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
                className="w-full rounded-xl bg-red-500 px-4 py-3 text-white font-medium hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {createAlert.isPending ? (
                  <>
                    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Sending...
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                    Send Alert
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Safety Guide Form */}
          <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-blue-50 rounded-lg">
                <svg className="h-5 w-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-gray-900">
                Create Safety Guide
              </h2>
            </div>

            {guideSuccess && (
              <div className="mb-4 rounded-xl bg-green-50 p-4 text-green-800 border border-green-200">
                <div className="flex items-center gap-2">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Safety guide saved successfully!
                </div>
              </div>
            )}

            {createGuide.error && (
              <div className="mb-4 rounded-xl bg-red-50 p-4 text-red-800 border border-red-200">
                <div className="flex items-center gap-2">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Error: {createGuide.error.message}
                </div>
              </div>
            )}

            <form onSubmit={handleGuideSubmit} className="space-y-4">
              <div>
                <label htmlFor="guide-disaster-type" className="block text-sm font-medium text-gray-700 mb-2">
                  Disaster Type
                </label>
                <select
                  id="guide-disaster-type"
                  value={guideDisasterType}
                  onChange={(e) => setGuideDisasterType(e.target.value as DisasterType)}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none transition-colors"
                >
                  <option value="FLOOD">Flood</option>
                  <option value="EARTHQUAKE">Earthquake</option>
                  <option value="FIRE">Fire</option>
                </select>
              </div>

              <div>
                <label htmlFor="guide-content" className="block text-sm font-medium text-gray-700 mb-2">
                  Safety Instructions
                </label>
                <textarea
                  id="guide-content"
                  value={guideContent}
                  onChange={(e) => setGuideContent(e.target.value)}
                  required
                  rows={8}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none transition-colors resize-none"
                  placeholder="Enter safety instructions for this disaster type..."
                />
              </div>

              <button
                type="submit"
                disabled={createGuide.isPending}
                className="w-full rounded-xl bg-blue-500 px-4 py-3 text-white font-medium hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {createGuide.isPending ? (
                  <>
                    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Saving...
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                    </svg>
                    Save Guide
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Manual Assignment Modal */}
        {showAssignModal && selectedRequest && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="w-full max-w-2xl mx-4 rounded-2xl bg-white shadow-2xl max-h-[80vh] overflow-y-auto">
              {/* Modal Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-50 rounded-lg">
                    <svg className="h-5 w-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <h2 className="text-xl font-semibold text-gray-900">
                    Assign Volunteer
                  </h2>
                </div>
                <button
                  onClick={() => {
                    setShowAssignModal(false);
                    setSelectedRequest(null);
                    setSelectedVolunteerId("");
                  }}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="p-6 space-y-6">
                {/* Emergency Details */}
                <div className="rounded-xl bg-red-50 p-4 border border-red-200">
                  <h3 className="font-semibold text-red-900 mb-2">Emergency Details</h3>
                  <div className="space-y-2 text-sm">
                    <p><strong>User:</strong> {selectedRequest.user?.name || selectedRequest.user?.email || "Unknown User"}</p>
                    <p><strong>Message:</strong> {selectedRequest.message}</p>
                    {selectedRequest.location && (
                      <p><strong>Location:</strong> {selectedRequest.location}</p>
                    )}
                    {selectedRequest.latitude && (
                      <p><strong>Coordinates:</strong> {selectedRequest.latitude.toFixed(4)}, {selectedRequest.longitude?.toFixed(4)}</p>
                    )}
                  </div>
                </div>

                {/* Available Volunteers */}
                <div>
                  <h3 className="font-semibold text-gray-900 mb-4">Available Volunteers</h3>
                  
                  {volunteersQuery.isLoading && (
                    <div className="flex items-center justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
                      <span className="ml-2 text-gray-500">Loading volunteers...</span>
                    </div>
                  )}

                  {volunteersQuery.data && volunteersQuery.data.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      <svg className="h-12 w-12 mx-auto mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      No volunteers registered in the system.
                    </div>
                  )}

                  <div className="space-y-3 max-h-64 overflow-y-auto">
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
                          className={`flex items-center justify-between rounded-xl border p-4 cursor-pointer transition-all ${
                            selectedVolunteerId === volunteer.id
                              ? "border-green-500 bg-green-50 shadow-sm"
                              : "border-gray-200 hover:bg-gray-50 hover:border-gray-300"
                          } ${isBusy ? "opacity-60" : ""}`}
                        >
                          <div className="flex items-center gap-3">
                            <input
                              type="radio"
                              name="volunteer"
                              value={volunteer.id}
                              checked={selectedVolunteerId === volunteer.id}
                              onChange={(e) => setSelectedVolunteerId(e.target.value)}
                              disabled={isBusy}
                              className="h-4 w-4 text-green-600 border-gray-300 focus:ring-green-500"
                            />
                            <div>
                              <p className="font-medium text-gray-900">
                                {volunteer.name || volunteer.email}
                              </p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                                  volunteer.available ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
                                }`}>
                                  {volunteer.available ? "Available" : "Unavailable"}
                                </span>
                                {isBusy && (
                                  <span className="inline-flex items-center rounded-full bg-yellow-100 px-2 py-1 text-xs font-medium text-yellow-700">
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
                </div>

                {manualAssign.error && (
                  <div className="rounded-xl bg-red-50 p-4 text-sm text-red-800 border border-red-200">
                    <div className="flex items-center gap-2">
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {manualAssign.error.message}
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-3 pt-4 border-t border-gray-100">
                  <button
                    onClick={() => {
                      setShowAssignModal(false);
                      setSelectedRequest(null);
                      setSelectedVolunteerId("");
                    }}
                    className="flex-1 rounded-xl border border-gray-200 px-4 py-3 text-gray-700 font-medium hover:bg-gray-50 hover:border-gray-300 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleManualAssign}
                    disabled={!selectedVolunteerId || manualAssign.isPending}
                    className="flex-1 rounded-xl bg-green-500 px-4 py-3 text-white font-medium hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                  >
                    {manualAssign.isPending ? (
                      <>
                        <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Assigning...
                      </>
                    ) : (
                      <>
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Assign Volunteer
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Real-Time Emergency Communication */}
      <RealTimeCommunication 
        isOpen={showRealTimeComms} 
        onClose={() => setShowRealTimeComms(false)} 
      />

      {/* Training Dashboard Modal */}
      {showTraining && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Training Management</h2>
              <button
                onClick={() => setShowTraining(false)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 h-full overflow-y-auto">
              <TrainingDashboard />
            </div>
          </div>
        </div>
      )}

      {/* AI Drone Swarm Dashboard Modal */}
      {showDroneSwarm && (
        <div className="fixed inset-0 z-[9999] bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-7xl h-[90vh] overflow-hidden relative z-[10000]">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">🚁 AI Drone Swarm Command Center</h2>
              <button
                onClick={() => setShowDroneSwarm(false)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 h-full overflow-y-auto">
              <DroneSwarmDashboard 
                emergencyLocation={emergencyLocation || undefined}
                onMissionDeployed={(mission) => {
                  console.log('Mission deployed:', mission);
                  alert(`🚁 Drone swarm mission "${mission.type}" deployed with ${mission.assignedDrones.length} drones!`);
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* AI Social Media Scanner Modal */}
      {showSocialScanner && (
        <div className="fixed inset-0 z-[9999] bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-7xl h-[90vh] overflow-hidden relative z-[10000]">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">🔍 AI Social Media Emergency Scanner</h2>
              <button
                onClick={() => setShowSocialScanner(false)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 h-full overflow-y-auto">
              <SocialMediaDashboard 
                onEmergencyDetected={(post) => {
                  console.log('Emergency detected:', post);
                  if (post.severity === 'CRITICAL') {
                    alert(`🚨 CRITICAL EMERGENCY DETECTED!\n\n${post.content}\n\nLocation: ${post.location?.name || 'Unknown'}\nSource: ${post.platform}`);
                  }
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

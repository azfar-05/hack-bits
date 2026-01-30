"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { api } from "~/trpc/react";

export default function ProfilePage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    phoneNumber: "",
    address: "",
    latitude: 0,
    longitude: 0,
  });
  const [locationStatus, setLocationStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [locationError, setLocationError] = useState<string | null>(null);

  // Check authentication
  const isAuthenticated = status === "authenticated";

  // Redirect if not authenticated
  useEffect(() => {
    if (status === "loading") return;
    if (!isAuthenticated) {
      router.push("/");
      return;
    }
  }, [status, isAuthenticated, router]);

  const profileQuery = api.profile.getProfileStatus.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const updateProfile = api.profile.updateProfile.useMutation({
    onSuccess: () => {
      setIsEditing(false);
      profileQuery.refetch();
    },
  });

  // Load profile data when available
  useEffect(() => {
    if (profileQuery.data) {
      setFormData({
        name: profileQuery.data.name || "",
        phoneNumber: profileQuery.data.phoneNumber || "",
        address: profileQuery.data.address || "",
        latitude: profileQuery.data.latitude || 0,
        longitude: profileQuery.data.longitude || 0,
      });
    }
  }, [profileQuery.data]);

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported by your browser");
      return;
    }

    setLocationStatus("loading");
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setFormData(prev => ({ ...prev, latitude, longitude }));
        setLocationStatus("success");

        // Try to get address from coordinates
        try {
          const response = await fetch(
            `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
          );
          const data = await response.json();
          if (data.locality && data.countryName) {
            const suggestedAddress = `${data.locality}, ${data.principalSubdivision}, ${data.countryName}`;
            setFormData(prev => ({ 
              ...prev, 
              address: prev.address || suggestedAddress 
            }));
          }
        } catch (error) {
          console.log("Could not fetch address from coordinates");
        }
      },
      (error) => {
        setLocationStatus("error");
        setLocationError(error.message);
      },
      {
        enableHighAccuracy: true,
        timeout: 30000, // Increased timeout for GPS lock
        maximumAge: 0, // Force fresh location, no cache
      }
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    updateProfile.mutate({
      name: formData.name || undefined,
      phoneNumber: formData.phoneNumber || undefined,
      address: formData.address || undefined,
      latitude: formData.latitude || undefined,
      longitude: formData.longitude || undefined,
    });
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSignOut = async () => {
    router.push("/api/auth/signout");
  };

  // Show loading screen while session is loading
  if (status === "loading" || profileQuery.isLoading) {
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
  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-blue-600 text-white shadow-lg">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Profile Settings</h1>
              <p className="mt-1 text-blue-100">Manage your personal information</p>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push("/dashboard")}
                className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium hover:bg-blue-800 transition-colors"
              >
                Back to Dashboard
              </button>
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

      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-lg bg-white p-6 shadow-md">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">Personal Information</h2>
            {!isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
              >
                Edit Profile
              </button>
            )}
          </div>

          {!isEditing ? (
            // View Mode
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Email</label>
                <p className="mt-1 text-sm text-gray-900">{profileQuery.data?.email}</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">Full Name</label>
                <p className="mt-1 text-sm text-gray-900">{profileQuery.data?.name || "Not provided"}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Phone Number</label>
                <p className="mt-1 text-sm text-gray-900">{profileQuery.data?.phoneNumber || "Not provided"}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Address</label>
                <p className="mt-1 text-sm text-gray-900">{profileQuery.data?.address || "Not provided"}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Location Coordinates</label>
                <p className="mt-1 text-sm text-gray-900">
                  {profileQuery.data?.latitude && profileQuery.data?.longitude
                    ? `${profileQuery.data.latitude.toFixed(4)}, ${profileQuery.data.longitude.toFixed(4)}`
                    : "Not provided"}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Role</label>
                <p className="mt-1 text-sm text-gray-900">{profileQuery.data?.role}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Profile Status</label>
                <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                  profileQuery.data?.profileCompleted 
                    ? "bg-green-100 text-green-800" 
                    : "bg-yellow-100 text-yellow-800"
                }`}>
                  {profileQuery.data?.profileCompleted ? "Complete" : "Incomplete"}
                </span>
              </div>
            </div>
          ) : (
            // Edit Mode
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                  Full Name
                </label>
                <input
                  type="text"
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleInputChange("name", e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="Enter your full name"
                />
              </div>

              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                  Phone Number
                </label>
                <input
                  type="tel"
                  id="phone"
                  value={formData.phoneNumber}
                  onChange={(e) => handleInputChange("phoneNumber", e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="Enter your phone number"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Update Location
                </label>
                
                <button
                  type="button"
                  onClick={getCurrentLocation}
                  disabled={locationStatus === "loading"}
                  className={`w-full rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                    locationStatus === "success"
                      ? "bg-green-100 text-green-800 border border-green-200"
                      : locationStatus === "loading"
                      ? "bg-gray-100 text-gray-600 cursor-not-allowed"
                      : "bg-blue-600 text-white hover:bg-blue-700"
                  }`}
                >
                  {locationStatus === "loading" ? "Getting Location..." : 
                   locationStatus === "success" ? "✓ Location Updated" : 
                   "Get Current Location"}
                </button>

                {locationStatus === "success" && (
                  <div className="mt-2 text-xs text-green-600">
                    📍 Lat: {formData.latitude.toFixed(4)}, Lng: {formData.longitude.toFixed(4)}
                  </div>
                )}

                {locationError && (
                  <div className="mt-2 text-xs text-red-600">
                    ⚠️ {locationError}
                  </div>
                )}
              </div>

              <div>
                <label htmlFor="address" className="block text-sm font-medium text-gray-700">
                  Address
                </label>
                <textarea
                  id="address"
                  rows={3}
                  value={formData.address}
                  onChange={(e) => handleInputChange("address", e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="Enter your full address"
                />
              </div>

              {updateProfile.error && (
                <div className="rounded-md bg-red-50 p-3 text-sm text-red-800">
                  {updateProfile.error.message}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditing(false);
                    // Reset form data
                    if (profileQuery.data) {
                      setFormData({
                        name: profileQuery.data.name || "",
                        phoneNumber: profileQuery.data.phoneNumber || "",
                        address: profileQuery.data.address || "",
                        latitude: profileQuery.data.latitude || 0,
                        longitude: profileQuery.data.longitude || 0,
                      });
                    }
                  }}
                  className="flex-1 rounded-md border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updateProfile.isPending}
                  className="flex-1 rounded-md bg-blue-600 px-4 py-2 text-white font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {updateProfile.isPending ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
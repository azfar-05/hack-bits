"use client";

import { useState, useEffect } from "react";
import { api } from "~/trpc/react";

interface ProfileCompletionProps {
  onComplete: () => void;
}

export function ProfileCompletion({ onComplete }: ProfileCompletionProps) {
  const [formData, setFormData] = useState({
    name: "",
    phoneNumber: "",
    address: "",
    latitude: 0,
    longitude: 0,
  });
  const [locationStatus, setLocationStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [locationError, setLocationError] = useState<string | null>(null);

  const completeProfile = api.profile.completeProfile.useMutation({
    onSuccess: () => {
      onComplete();
    },
  });

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported by your browser");
      return;
    }

    console.log("🔍 Requesting location for profile...");
    setLocationStatus("loading");
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        console.log("✅ Location obtained:", position.coords);
        const { latitude, longitude, accuracy } = position.coords;
        console.log(`Accuracy: ${accuracy} meters`);
        
        setFormData(prev => ({ ...prev, latitude, longitude }));
        setLocationStatus("success");

        // Try to get address from coordinates using reverse geocoding
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
        console.error("❌ Geolocation error:", error);
        setLocationStatus("error");
        
        let errorMessage = "";
        switch(error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = "Location permission denied. Please enable location access in your browser settings.";
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = "Location information unavailable. Please check your device's location services.";
            break;
          case error.TIMEOUT:
            errorMessage = "Location request timed out. Please try again or check if you have clear sky view for GPS.";
            break;
          default:
            errorMessage = error.message;
        }
        
        setLocationError(errorMessage);
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
    
    if (!formData.latitude || !formData.longitude) {
      setLocationError("Please get your current location first");
      return;
    }

    completeProfile.mutate({
      name: formData.name || undefined,
      phoneNumber: formData.phoneNumber,
      address: formData.address,
      latitude: formData.latitude,
      longitude: formData.longitude,
    });
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl mx-4">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
            <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900">Complete Your Profile</h2>
          <p className="mt-2 text-sm text-gray-600">
            We need some basic information to help you in emergencies
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name Field */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">
              Full Name (Optional)
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

          {/* Phone Number Field */}
          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
              Phone Number *
            </label>
            <input
              type="tel"
              id="phone"
              required
              value={formData.phoneNumber}
              onChange={(e) => handleInputChange("phoneNumber", e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Enter your phone number"
            />
          </div>

          {/* Location Section */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Current Location *
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
              {locationStatus === "loading" && (
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-gray-600 inline" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              )}
              {locationStatus === "loading" ? "Getting Location..." : 
               locationStatus === "success" ? "✓ Location Obtained" : 
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

          {/* Address Field */}
          <div>
            <label htmlFor="address" className="block text-sm font-medium text-gray-700">
              Address *
            </label>
            <textarea
              id="address"
              required
              rows={3}
              value={formData.address}
              onChange={(e) => handleInputChange("address", e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Enter your full address"
            />
          </div>

          {/* Error Display */}
          {completeProfile.error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-800">
              {completeProfile.error.message}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={completeProfile.isPending || locationStatus !== "success"}
            className="w-full rounded-md bg-blue-600 px-4 py-2 text-white font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {completeProfile.isPending ? "Saving..." : "Complete Profile"}
          </button>
        </form>

        <div className="mt-4 text-center">
          <p className="text-xs text-gray-500">
            This information helps emergency services locate you quickly during disasters.
          </p>
        </div>
      </div>
    </div>
  );
}
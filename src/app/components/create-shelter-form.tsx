"use client";

import { useState } from "react";
import { api } from "~/trpc/react";

interface CreateShelterFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function CreateShelterForm({ onSuccess, onCancel }: CreateShelterFormProps) {
  const [formData, setFormData] = useState({
    name: "",
    type: "SHELTER" as "SHELTER" | "CAMP" | "HOSPITAL",
    latitude: 0,
    longitude: 0,
    capacity: "",
  });
  const [locationStatus, setLocationStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [locationError, setLocationError] = useState<string | null>(null);

  const createSafeZone = api.safeZone.create.useMutation({
    onSuccess: () => {
      // Reset form
      setFormData({
        name: "",
        type: "SHELTER",
        latitude: 0,
        longitude: 0,
        capacity: "",
      });
      setLocationStatus("idle");
      onSuccess?.();
    },
  });

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported by your browser");
      return;
    }

    setLocationStatus("loading");
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setFormData(prev => ({ ...prev, latitude, longitude }));
        setLocationStatus("success");
      },
      (error) => {
        setLocationStatus("error");
        setLocationError(error.message);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 10000,
      }
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.latitude || !formData.longitude) {
      setLocationError("Please get your current location first");
      return;
    }

    createSafeZone.mutate({
      name: formData.name,
      type: formData.type,
      latitude: formData.latitude,
      longitude: formData.longitude,
      capacity: formData.capacity ? parseInt(formData.capacity) : undefined,
    });
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="bg-white rounded-lg p-6 shadow-md border">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <svg className="h-5 w-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Create Safe Zone
        </h3>
        <p className="text-sm text-gray-600 mt-1">
          Create a shelter, camp, or hospital location for people in need
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Name Field */}
        <div>
          <label htmlFor="shelter-name" className="block text-sm font-medium text-gray-700">
            Name *
          </label>
          <input
            type="text"
            id="shelter-name"
            required
            value={formData.name}
            onChange={(e) => handleInputChange("name", e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
            placeholder="e.g., Community Center Shelter"
          />
        </div>

        {/* Type Field */}
        <div>
          <label htmlFor="shelter-type" className="block text-sm font-medium text-gray-700">
            Type *
          </label>
          <select
            id="shelter-type"
            required
            value={formData.type}
            onChange={(e) => handleInputChange("type", e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
          >
            <option value="SHELTER">🏕 Shelter</option>
            <option value="CAMP">⛺ Camp</option>
            <option value="HOSPITAL">🏥 Hospital</option>
          </select>
        </div>

        {/* Capacity Field */}
        <div>
          <label htmlFor="shelter-capacity" className="block text-sm font-medium text-gray-700">
            Capacity (Optional)
          </label>
          <input
            type="number"
            id="shelter-capacity"
            min="1"
            value={formData.capacity}
            onChange={(e) => handleInputChange("capacity", e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
            placeholder="Number of people this location can accommodate"
          />
        </div>

        {/* Location Section */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Location *
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
                : "bg-green-600 text-white hover:bg-green-700"
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

        {/* Error Display */}
        {createSafeZone.error && (
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-800">
            {createSafeZone.error.message}
          </div>
        )}

        {/* Success Message */}
        {createSafeZone.isSuccess && (
          <div className="rounded-md bg-green-50 p-3 text-sm text-green-800">
            ✅ Safe zone created successfully!
          </div>
        )}

        {/* Submit Buttons */}
        <div className="flex gap-3 pt-4">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 rounded-md border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={createSafeZone.isPending || locationStatus !== "success"}
            className="flex-1 rounded-md bg-green-600 px-4 py-2 text-white font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {createSafeZone.isPending ? "Creating..." : "Create Safe Zone"}
          </button>
        </div>
      </form>

      <div className="mt-4 text-center">
        <p className="text-xs text-gray-500">
          This location will be visible to authorities and other volunteers on the live map.
        </p>
      </div>
    </div>
  );
}
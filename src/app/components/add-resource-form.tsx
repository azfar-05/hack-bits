"use client";

import { useState } from "react";
import { api } from "~/trpc/react";

interface AddResourceFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

const resourceTypeOptions = [
  { value: "BOAT", label: "🚤 Boat", description: "Boats for water rescue" },
  { value: "GENERATOR", label: "⚡ Generator", description: "Power generators" },
  { value: "WATER", label: "💧 Water", description: "Drinking water supplies" },
  { value: "FOOD", label: "🍞 Food", description: "Food supplies" },
  { value: "MEDICAL", label: "🏥 Medical", description: "Medical supplies" },
  { value: "OTHER", label: "📦 Other", description: "Other resources" },
] as const;

export function AddResourceForm({ onSuccess, onCancel }: AddResourceFormProps) {
  const [formData, setFormData] = useState({
    name: "",
    resourceType: "WATER" as "BOAT" | "GENERATOR" | "WATER" | "FOOD" | "MEDICAL" | "OTHER",
    quantity: "",
    latitude: 0,
    longitude: 0,
    contactInfo: "",
    createdBy: "VOLUNTEER" as "VOLUNTEER" | "BUSINESS" | "AUTHORITY",
  });
  const [locationStatus, setLocationStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [locationError, setLocationError] = useState<string | null>(null);
  const [locationMethod, setLocationMethod] = useState<"gps" | "manual">("gps");
  const [manualLocation, setManualLocation] = useState({
    latitude: "",
    longitude: "",
  });

  const createResource = api.resourceNode.create.useMutation({
    onSuccess: () => {
      // Reset form
      setFormData({
        name: "",
        resourceType: "WATER",
        quantity: "",
        latitude: 0,
        longitude: 0,
        contactInfo: "",
        createdBy: "VOLUNTEER",
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
    
    let finalLatitude = formData.latitude;
    let finalLongitude = formData.longitude;
    
    // If using manual location, get values from manual inputs
    if (locationMethod === "manual") {
      if (!manualLocation.latitude || !manualLocation.longitude) {
        setLocationError("Please enter both latitude and longitude");
        return;
      }
      
      finalLatitude = parseFloat(manualLocation.latitude);
      finalLongitude = parseFloat(manualLocation.longitude);
      
      // Validate coordinate ranges
      if (finalLatitude < -90 || finalLatitude > 90) {
        setLocationError("Latitude must be between -90 and 90");
        return;
      }
      if (finalLongitude < -180 || finalLongitude > 180) {
        setLocationError("Longitude must be between -180 and 180");
        return;
      }
    } else {
      // GPS method validation
      if (!formData.latitude || !formData.longitude) {
        setLocationError("Please get your current location first");
        return;
      }
    }

    createResource.mutate({
      name: formData.name,
      resourceType: formData.resourceType,
      quantity: parseInt(formData.quantity),
      latitude: finalLatitude,
      longitude: finalLongitude,
      contactInfo: formData.contactInfo || undefined,
      createdBy: formData.createdBy,
    });
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="bg-white rounded-lg p-6 shadow-md border">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <svg className="h-5 w-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
          Add Resource
        </h3>
        <p className="text-sm text-gray-600 mt-1">
          Share available disaster response resources with the community
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Resource Name Field */}
        <div>
          <label htmlFor="resource-name" className="block text-sm font-medium text-gray-700">
            Resource Name *
          </label>
          <input
            type="text"
            id="resource-name"
            required
            value={formData.name}
            onChange={(e) => handleInputChange("name", e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="e.g., Portable Water Purifier, Emergency Generator"
          />
        </div>

        {/* Resource Type Field */}
        <div>
          <label htmlFor="resource-type" className="block text-sm font-medium text-gray-700">
            Resource Type *
          </label>
          <select
            id="resource-type"
            required
            value={formData.resourceType}
            onChange={(e) => handleInputChange("resourceType", e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {resourceTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-500">
            {resourceTypeOptions.find(opt => opt.value === formData.resourceType)?.description}
          </p>
        </div>

        {/* Quantity Field */}
        <div>
          <label htmlFor="resource-quantity" className="block text-sm font-medium text-gray-700">
            Quantity *
          </label>
          <input
            type="number"
            id="resource-quantity"
            required
            min="1"
            value={formData.quantity}
            onChange={(e) => handleInputChange("quantity", e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="Number of units available"
          />
        </div>

        {/* Creator Type Field */}
        <div>
          <label htmlFor="creator-type" className="block text-sm font-medium text-gray-700">
            You are a *
          </label>
          <select
            id="creator-type"
            required
            value={formData.createdBy}
            onChange={(e) => handleInputChange("createdBy", e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="VOLUNTEER">🙋‍♂️ Volunteer</option>
            <option value="BUSINESS">🏢 Local Business</option>
            <option value="AUTHORITY">🏛️ Authority</option>
          </select>
        </div>

        {/* Contact Info Field */}
        <div>
          <label htmlFor="contact-info" className="block text-sm font-medium text-gray-700">
            Contact Information (Optional)
          </label>
          <input
            type="text"
            id="contact-info"
            value={formData.contactInfo}
            onChange={(e) => handleInputChange("contactInfo", e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="Phone number, email, or pickup instructions"
          />
        </div>

        {/* Location Section */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Resource Location *
          </label>
          
          {/* Location Method Toggle */}
          <div className="flex rounded-md border border-gray-300 mb-3">
            <button
              type="button"
              onClick={() => {
                setLocationMethod("gps");
                setLocationError(null);
              }}
              className={`flex-1 px-4 py-2 text-sm font-medium rounded-l-md transition-colors ${
                locationMethod === "gps"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-50 text-gray-700 hover:bg-gray-100"
              }`}
            >
              📍 Use GPS
            </button>
            <button
              type="button"
              onClick={() => {
                setLocationMethod("manual");
                setLocationStatus("idle");
                setLocationError(null);
              }}
              className={`flex-1 px-4 py-2 text-sm font-medium rounded-r-md transition-colors ${
                locationMethod === "manual"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-50 text-gray-700 hover:bg-gray-100"
              }`}
            >
              ✏️ Enter Manually
            </button>
          </div>

          {/* GPS Location Method */}
          {locationMethod === "gps" && (
            <div>
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
            </div>
          )}

          {/* Manual Location Method */}
          {locationMethod === "manual" && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="manual-latitude" className="block text-xs font-medium text-gray-600 mb-1">
                    Latitude *
                  </label>
                  <input
                    type="number"
                    id="manual-latitude"
                    step="any"
                    min="-90"
                    max="90"
                    value={manualLocation.latitude}
                    onChange={(e) => setManualLocation(prev => ({ ...prev, latitude: e.target.value }))}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="e.g., 15.3173"
                  />
                </div>
                <div>
                  <label htmlFor="manual-longitude" className="block text-xs font-medium text-gray-600 mb-1">
                    Longitude *
                  </label>
                  <input
                    type="number"
                    id="manual-longitude"
                    step="any"
                    min="-180"
                    max="180"
                    value={manualLocation.longitude}
                    onChange={(e) => setManualLocation(prev => ({ ...prev, longitude: e.target.value }))}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="e.g., 75.7139"
                  />
                </div>
              </div>
              <div className="text-xs text-gray-500">
                💡 Tip: You can get coordinates from Google Maps by right-clicking on a location
              </div>
              {manualLocation.latitude && manualLocation.longitude && (
                <div className="text-xs text-green-600">
                  📍 Coordinates: {parseFloat(manualLocation.latitude).toFixed(4)}, {parseFloat(manualLocation.longitude).toFixed(4)}
                </div>
              )}
            </div>
          )}

          {locationError && (
            <div className="mt-2 text-xs text-red-600">
              ⚠️ {locationError}
            </div>
          )}
        </div>

        {/* Error Display */}
        {createResource.error && (
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-800">
            {createResource.error.message}
          </div>
        )}

        {/* Success Message */}
        {createResource.isSuccess && (
          <div className="rounded-md bg-green-50 p-3 text-sm text-green-800">
            ✅ Resource added successfully! It will now be visible to authorities and nearby volunteers.
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
            disabled={createResource.isPending || (locationMethod === "gps" && locationStatus !== "success") || (locationMethod === "manual" && (!manualLocation.latitude || !manualLocation.longitude))}
            className="flex-1 rounded-md bg-blue-600 px-4 py-2 text-white font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {createResource.isPending ? "Adding..." : "Add Resource"}
          </button>
        </div>
      </form>

      <div className="mt-4 text-center">
        <p className="text-xs text-gray-500">
          Your resource will be visible to authorities and volunteers who need assistance nearby.
        </p>
      </div>
    </div>
  );
}
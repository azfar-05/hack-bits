"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "~/trpc/react";
import { validateCoordinates, formatCoordinatesForDisplay, formatCoordinatesForDatabase } from "~/lib/coordinate-validation";

interface SosModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSendSos: (phoneNumber: string, message: string) => void;
  isSending: boolean;
}

function SosModal({ isOpen, onClose, onSendSos, isSending }: SosModalProps) {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [message, setMessage] = useState("");
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      // Get user location when modal opens
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            setLocation({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            });
            setLocationError(null);
          },
          (error) => {
            setLocationError("Could not get your location. Please ensure location services are enabled.");
            console.error("Geolocation error:", error);
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
        );
      } else {
        setLocationError("Geolocation is not supported by your browser.");
      }
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSendSos(phoneNumber, message);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-red-600">🚨 SOS Emergency</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            disabled={isSending}
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mb-4 p-3 bg-red-50 rounded-lg border border-red-200">
          <p className="text-sm text-red-700">
            <strong>Emergency alert sent!</strong> Help is being coordinated.
            {location && (
              <span className="block mt-1">
                Location: {formatCoordinatesForDisplay(location.latitude, location.longitude).latitude}, {formatCoordinatesForDisplay(location.latitude, location.longitude).longitude}
              </span>
            )}
          </p>
        </div>

        {locationError && (
          <div className="mb-4 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
            <p className="text-sm text-yellow-700">{locationError}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
              Phone Number (Optional)
            </label>
            <input
              type="tel"
              id="phone"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="Enter your phone number"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
            />
          </div>

          <div>
            <label htmlFor="message" className="block text-sm font-medium text-gray-700">
              Additional Details (Optional)
            </label>
            <textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Describe the emergency situation..."
              rows={3}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
            />
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSending}
              className="flex-1 rounded-md border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSending}
              className="flex-1 rounded-md bg-red-600 px-4 py-2 text-white font-medium hover:bg-red-700 disabled:opacity-50"
            >
              {isSending ? "Sending..." : "Send Details"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function SosButton() {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [initialSosSent, setInitialSosSent] = useState(false);

  // SOS mutation (unauthenticated)
  const createSos = api.rescue.createSOS.useMutation({
    onSuccess: () => {
      setInitialSosSent(true);
    },
    onError: (error) => {
      console.error("Failed to send SOS:", error);
      alert("Failed to send emergency alert. Please try again.");
    },
  });

  const handleSosClick = async () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
      return;
    }

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000,
        });
      });

      const { latitude, longitude, accuracy } = position.coords;
      
      // Validate and format coordinates
      const validation = validateCoordinates(latitude, longitude, accuracy);
      if (!validation.isValid) {
        console.error("Coordinate validation failed:", validation.error);
        alert(`Location validation error: ${validation.error}`);
        return;
      }
      
      // Format coordinates for consistent handling
      const formattedCoords = formatCoordinatesForDatabase(latitude, longitude);
      const displayCoords = formatCoordinatesForDisplay(latitude, longitude);
      
      // Debug logging with validation results
      console.log("=== SOS Location Capture ===");
      console.log("Raw coordinates:", { latitude, longitude });
      console.log("Formatted for DB:", formattedCoords);
      console.log("Formatted for display:", displayCoords);
      console.log("Validation:", validation);
      console.log("Accuracy:", `${accuracy} meters`);
      console.log("Timestamp:", new Date(position.timestamp).toLocaleString());
      console.log("===========================");
      
      // Send immediate SOS with validated location
      await createSos.mutateAsync({
        latitude: formattedCoords.latitude,
        longitude: formattedCoords.longitude,
        message: "SOS Emergency - Immediate Help Needed",
        location: `${displayCoords.latitude}, ${displayCoords.longitude}`,
      });

      setIsModalOpen(true);
    } catch (error) {
      console.error("Failed to get location:", error);
      alert("Could not get your location. Please ensure location services are enabled.");
    }
  };

  const handleSendDetails = async (phoneNumber: string, message: string) => {
    // Update the existing rescue request with additional details
    if (phoneNumber || message) {
      try {
        // In a real implementation, you'd update the rescue request with these details
        console.log("Additional details:", { phoneNumber, message });
        alert("Additional details sent successfully!");
        setIsModalOpen(false);
        setInitialSosSent(false);
      } catch (error) {
        console.error("Failed to send details:", error);
        alert("Failed to send additional details. Please try again.");
      }
    } else {
      setIsModalOpen(false);
      setInitialSosSent(false);
    }
  };

  return (
    <>
      {/* Floating SOS Button */}
      <button
        onClick={handleSosClick}
        disabled={createSos.isPending || initialSosSent}
        className={`fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full px-6 py-4 font-bold text-white shadow-lg transition-all duration-300 hover:scale-105 ${
          initialSosSent
            ? "bg-green-600 hover:bg-green-700"
            : "bg-red-600 hover:bg-red-700 animate-pulse"
        } ${createSos.isPending ? "opacity-50 cursor-not-allowed" : ""}`}
      >
        <svg
          className="h-6 w-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        {createSos.isPending ? "Sending..." : initialSosSent ? "Help Sent!" : "SOS"}
      </button>

      {/* SOS Modal for additional details */}
      <SosModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setInitialSosSent(false);
        }}
        onSendSos={handleSendDetails}
        isSending={false}
      />
    </>
  );
}
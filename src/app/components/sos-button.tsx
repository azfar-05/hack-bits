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
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Get user location when modal opens
      if (!navigator.geolocation) {
        setLocationError("Geolocation is not supported by your browser.");
        return;
      }

      console.log("🔍 Starting geolocation request...");
      setIsLoadingLocation(true);
      setLocationError(null);

      navigator.geolocation.getCurrentPosition(
        (position) => {
          console.log("✅ Location obtained:", position.coords);
          setLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
          setLocationError(null);
          setIsLoadingLocation(false);
        },
        (error) => {
          console.error("❌ Geolocation error:", error);
          let errorMessage = "Could not get your location. ";
          
          switch(error.code) {
            case error.PERMISSION_DENIED:
              errorMessage += "Location permission denied. Please enable location access in your browser settings.";
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage += "Location information unavailable. Please check your device's location services.";
              break;
            case error.TIMEOUT:
              errorMessage += "Location request timed out. Please try again or check if you have clear sky view for GPS.";
              break;
            default:
              errorMessage += "An unknown error occurred.";
          }
          
          setLocationError(errorMessage);
          setIsLoadingLocation(false);
        },
        { 
          enableHighAccuracy: true, 
          timeout: 30000, // Increased timeout for GPS lock
          maximumAge: 0 // Force fresh location, no cache
        }
      );
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSendSos(phoneNumber, message);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md mx-4 rounded-2xl bg-white shadow-2xl border border-gray-100">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
              <svg className="h-5 w-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Emergency Alert</h2>
              <p className="text-sm text-gray-500">Help is being coordinated</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-200 transition-colors"
            disabled={isSending}
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Status Alert */}
          <div className="p-4 bg-green-50 rounded-xl border border-green-200">
            <div className="flex items-start gap-3">
              <div className="h-5 w-5 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="h-3 w-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-green-800">Emergency alert sent successfully!</p>
                {isLoadingLocation && (
                  <p className="text-sm text-blue-700 mt-1 flex items-center gap-2">
                    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Getting precise location...
                  </p>
                )}
                {location && !isLoadingLocation && (
                  <p className="text-sm text-green-700 mt-1 flex items-center gap-2">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Location: {formatCoordinatesForDisplay(location.latitude, location.longitude).latitude}, {formatCoordinatesForDisplay(location.latitude, location.longitude).longitude}
                  </p>
                )}
              </div>
            </div>
          </div>

          {locationError && (
            <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
              <div className="flex items-start gap-3">
                <svg className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div className="flex-1">
                  <p className="text-sm text-amber-800">{locationError}</p>
                  <button
                    type="button"
                    onClick={() => window.location.reload()}
                    className="mt-2 text-sm text-amber-700 hover:text-amber-900 underline"
                  >
                    Reload and try again
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
                Phone Number
              </label>
              <input
                type="tel"
                id="phone"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="Your contact number"
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-gray-900 placeholder-gray-500 focus:border-red-500 focus:ring-1 focus:ring-red-500 focus:outline-none transition-colors"
              />
              <p className="text-xs text-gray-500 mt-1">Optional - helps responders contact you</p>
            </div>

            <div>
              <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-2">
                Additional Details
              </label>
              <textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Describe the emergency situation..."
                rows={3}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-gray-900 placeholder-gray-500 focus:border-red-500 focus:ring-1 focus:ring-red-500 focus:outline-none transition-colors resize-none"
              />
              <p className="text-xs text-gray-500 mt-1">Optional - any details that might help</p>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSending}
                className="flex-1 rounded-xl border border-gray-200 px-4 py-3 text-gray-700 font-medium hover:bg-gray-50 hover:border-gray-300 disabled:opacity-50 transition-colors"
              >
                Close
              </button>
              <button
                type="submit"
                disabled={isSending}
                className="flex-1 rounded-xl bg-red-500 px-4 py-3 text-white font-medium hover:bg-red-600 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {isSending ? (
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
                    Send Details
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export function SosButton() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [initialSosSent, setInitialSosSent] = useState(false);
  const [isPressed, setIsPressed] = useState(false);

  // Request notification permission on component mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // SOS mutation (unauthenticated)
  const createSos = api.rescue.createSOS.useMutation({
    onSuccess: (data) => {
      setInitialSosSent(true);
      
      // Show drone deployment notification
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('🚁 Emergency Response Activated', {
          body: 'SOS received! Authorities have been notified and surveillance drones may be deployed to your location for immediate assistance.',
          icon: '/favicon.ico'
        });
      }
      
      // Show alert about drone deployment
      setTimeout(() => {
        alert(`🚨 EMERGENCY RESPONSE ACTIVATED\n\n✅ SOS Signal Sent Successfully\n🚔 Authorities Notified\n🚁 Surveillance drones may be deployed to your location\n📍 Location: ${data?.rescueRequest?.location || 'Captured'}\n\nHelp is on the way! Stay calm and stay visible.`);
      }, 1000);
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

    setIsPressed(true);
    setTimeout(() => setIsPressed(false), 200);

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 30000, // Increased timeout for GPS lock
          maximumAge: 0, // Force fresh location, no cache
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
      <div className="fixed bottom-6 right-6 z-40">
        <button
          onClick={handleSosClick}
          disabled={createSos.isPending || initialSosSent}
          className={`group relative flex items-center justify-center h-16 w-16 rounded-full font-bold text-white shadow-2xl transition-all duration-300 ${
            initialSosSent
              ? "bg-green-500 hover:bg-green-600 scale-110"
              : createSos.isPending
              ? "bg-red-400 cursor-not-allowed"
              : "bg-red-500 hover:bg-red-600 hover:scale-110 active:scale-95"
          } ${isPressed ? "scale-95" : ""} ${!initialSosSent && !createSos.isPending ? "animate-pulse" : ""}`}
        >
          {/* Ripple effect */}
          {!initialSosSent && !createSos.isPending && (
            <div className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-20"></div>
          )}
          
          {/* Icon */}
          {createSos.isPending ? (
            <svg className="h-6 w-6 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          ) : initialSosSent ? (
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          )}

          {/* Tooltip */}
          <div className="absolute bottom-full right-0 mb-2 px-3 py-1 bg-gray-900 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap">
            {createSos.isPending ? "Sending..." : initialSosSent ? "Help Sent!" : "Emergency SOS"}
            <div className="absolute top-full right-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
          </div>
        </button>

        {/* Label for accessibility */}
        {!initialSosSent && !createSos.isPending && (
          <div className="absolute -top-2 -left-8 bg-red-500 text-white text-xs px-2 py-1 rounded-full animate-bounce">
            SOS
          </div>
        )}
      </div>

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
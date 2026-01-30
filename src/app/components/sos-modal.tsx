"use client";

import { useState, useEffect } from "react";
import { api } from "~/trpc/react";

interface SOSModalProps {
  isOpen: boolean;
  onClose: () => void;
  latitude: number | null;
  longitude: number | null;
}

export function SOSModal({ isOpen, onClose, latitude, longitude }: SOSModalProps) {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setPhoneNumber("");
      setDescription("");
      setSuccessMessage("");
      setErrorMessage("");
    }
  }, [isOpen]);

  const createRescueRequest = api.rescue.create.useMutation({
    onSuccess: () => {
      setIsSubmitting(false);
      setSuccessMessage("SOS alert sent successfully! Help is on the way.");
      // Reset form after success
      setPhoneNumber("");
      setDescription("");
      // Auto-close after 3 seconds
      setTimeout(() => {
        onClose();
        setSuccessMessage("");
      }, 3000);
    },
    onError: (error) => {
      setIsSubmitting(false);
      setErrorMessage(error.message || "Failed to send SOS alert");
      setTimeout(() => setErrorMessage(""), 5000);
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!latitude || !longitude) {
      setErrorMessage("Location not available. Please enable location services.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    try {
      await createRescueRequest.mutateAsync({
        latitude,
        longitude,
        message: description || "Emergency Help Needed",
        location: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
        phoneNumber: phoneNumber || undefined,
      });
    } catch (error) {
      // Error handled in onError
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl mx-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-red-600 flex items-center gap-2">
            <svg 
              className="h-6 w-6 animate-pulse" 
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
            Send SOS Alert
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
            disabled={isSubmitting}
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {successMessage && (
          <div className="mb-4 rounded-md bg-green-50 p-3 text-green-800 border border-green-200">
            <div className="flex items-center gap-2">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {successMessage}
            </div>
          </div>
        )}

        {errorMessage && (
          <div className="mb-4 rounded-md bg-red-50 p-3 text-red-800 border border-red-200">
            <div className="flex items-center gap-2">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {errorMessage}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="text-center text-sm text-gray-600 p-3 bg-red-50 rounded-lg border border-red-100">
            <p className="font-medium text-red-700 mb-1">
              Help will be sent based on your current location.
            </p>
            {latitude && longitude ? (
              <p>
                Location: {latitude.toFixed(4)}, {longitude.toFixed(4)}
              </p>
            ) : (
              <p className="text-orange-600 animate-pulse">Detecting location...</p>
            )}
          </div>

          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
              Phone Number (Optional)
            </label>
            <input
              type="tel"
              id="phone"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="Enter your phone number"
              className="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
              disabled={isSubmitting}
            />
            <p className="text-xs text-gray-500 mt-1">
              Helps authorities contact you directly
            </p>
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
              Description (Optional)
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the emergency situation..."
              rows={3}
              className="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
              disabled={isSubmitting}
            />
            <p className="text-xs text-gray-500 mt-1">
              Any details about the incident that might help responders
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-md border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !latitude || !longitude}
              className="flex-1 rounded-md bg-red-600 px-4 py-2 text-white font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
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
                  Send SOS
                </>
              )}
            </button>
          </div>
        </form>

        <div className="mt-4 pt-4 border-t border-gray-200 text-xs text-gray-500">
          <p className="text-center">
            Your location will be shared with nearby volunteers and authorities.
            Emergency services will be notified immediately.
          </p>
        </div>
      </div>
    </div>
  );
}
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "~/trpc/react";

type DisasterType = "FLOOD" | "EARTHQUAKE" | "FIRE";

export default function AuthorityDashboard() {
  const router = useRouter();

  // Alert form state
  const [alertTitle, setAlertTitle] = useState("");
  const [alertMessage, setAlertMessage] = useState("");
  const [alertDisasterType, setAlertDisasterType] = useState<DisasterType>("FLOOD");
  const [alertSuccess, setAlertSuccess] = useState(false);

  // Guide form state
  const [guideDisasterType, setGuideDisasterType] = useState<DisasterType>("FLOOD");
  const [guideContent, setGuideContent] = useState("");
  const [guideSuccess, setGuideSuccess] = useState(false);

  // tRPC mutations
  const createAlert = api.alert.create.useMutation({
    onSuccess: () => {
      setAlertTitle("");
      setAlertMessage("");
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
    createAlert.mutate({
      title: alertTitle,
      message: alertMessage,
      disasterType: alertDisasterType,
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
            <button
              onClick={handleSignOut}
              className="rounded-md bg-red-700 px-4 py-2 text-sm font-medium hover:bg-red-800 transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
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

              <button
                type="submit"
                disabled={createAlert.isPending}
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
      </main>
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";

export default function VolunteerDashboard() {
  const router = useRouter();

  const handleSignOut = async () => {
    router.push("/api/auth/signout");
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-green-600 text-white shadow-lg">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Volunteer Dashboard</h1>
              <p className="mt-1 text-green-100">Disaster Alert & Rescue Coordination System</p>
            </div>
            <button
              onClick={handleSignOut}
              className="rounded-md bg-green-700 px-4 py-2 text-sm font-medium hover:bg-green-800 transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-lg bg-white p-8 shadow-md text-center">
          <div className="mx-auto h-24 w-24 rounded-full bg-green-100 flex items-center justify-center mb-6">
            <svg
              className="h-12 w-12 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
          </div>

          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            Volunteer Dashboard Ready for SOS Features
          </h2>

          <p className="text-gray-600 max-w-md mx-auto mb-6">
            Thank you for volunteering! This dashboard will be enhanced with SOS response 
            features, rescue coordination tools, and real-time location tracking in future updates.
          </p>

          <div className="bg-green-50 rounded-lg p-4 max-w-md mx-auto">
            <h3 className="font-medium text-green-800 mb-2">Coming Soon:</h3>
            <ul className="text-sm text-green-700 text-left space-y-1">
              <li>- SOS request notifications</li>
              <li>- Rescue mission assignments</li>
              <li>- Real-time coordination with other volunteers</li>
              <li>- Resource inventory management</li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
}

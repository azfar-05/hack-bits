import { redirect } from "next/navigation";
import { auth } from "~/server/auth";
import { LoginForm } from "~/app/components/login-form";
import { SosButton } from "~/app/components/sos-button";

export default async function Home() {
  const session = await auth();

  // If already logged in, redirect to dashboard
  if (session?.user) {
    redirect("/dashboard");
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-slate-900 to-slate-800">
      <div className="container flex flex-col items-center justify-center gap-8 px-4 py-16">
        {/* Hero Section */}
        <div className="text-center">
          <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-6xl">
            Disaster Alert & <span className="text-red-500">Rescue</span> System
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-slate-300">
            Real-time disaster alerts, safety guides, and rescue coordination.
            Stay informed, stay safe.
          </p>
        </div>

        {/* Features */}
        <div className="mt-8 grid max-w-4xl grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-lg bg-white/5 p-6 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/20">
              <svg
                className="h-6 w-6 text-red-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                />
              </svg>
            </div>
            <h3 className="mb-2 font-semibold text-white">Real-time Alerts</h3>
            <p className="text-sm text-slate-400">
              Receive instant disaster notifications from authorities
            </p>
          </div>

          <div className="rounded-lg bg-white/5 p-6 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-500/20">
              <svg
                className="h-6 w-6 text-blue-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <h3 className="mb-2 font-semibold text-white">Safety Guides</h3>
            <p className="text-sm text-slate-400">
              Access offline-ready safety instructions for emergencies
            </p>
          </div>

          <div className="rounded-lg bg-white/5 p-6 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-500/20">
              <svg
                className="h-6 w-6 text-green-500"
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
            <h3 className="mb-2 font-semibold text-white">Volunteer Network</h3>
            <p className="text-sm text-slate-400">
              Coordinate rescue efforts with community volunteers
            </p>
          </div>
        </div>

        {/* Login Form */}
        <LoginForm />
      </div>

      {/* SOS Button - Always visible on main page */}
      <SosButton />
    </main>
  );
}

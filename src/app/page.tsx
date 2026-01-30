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
    <main className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="absolute top-0 w-full z-10">
        <div className="mx-auto max-w-7xl px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="h-8 w-8 rounded-full bg-red-500"></div>
              <span className="text-xl font-semibold text-gray-900">DARS</span>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-32 pb-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left Column - Content */}
            <div className="space-y-8">
              <div className="space-y-6">
                <h1 className="text-5xl lg:text-6xl font-light text-gray-900 leading-tight">
                  Stay Safe.
                  <br />
                  <span className="font-medium text-red-500">Stay Connected.</span>
                </h1>
                <p className="text-xl text-gray-600 leading-relaxed max-w-lg">
                  Real-time disaster alerts and emergency coordination 
                  when it matters most.
                </p>
              </div>

              {/* Key Features - Minimal */}
              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                  <div className="h-2 w-2 rounded-full bg-red-500"></div>
                  <span className="text-gray-700">Instant emergency alerts</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="h-2 w-2 rounded-full bg-blue-500"></div>
                  <span className="text-gray-700">Offline safety guides</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="h-2 w-2 rounded-full bg-green-500"></div>
                  <span className="text-gray-700">Community rescue network</span>
                </div>
              </div>
            </div>

            {/* Right Column - Login */}
            <div className="flex justify-center lg:justify-end">
              <div className="w-full max-w-md">
                <LoginForm />
              </div>
            </div>
          </div>
        </div>

        {/* Subtle background elements */}
        <div className="absolute top-0 right-0 -z-10 h-96 w-96 rounded-full bg-red-50 blur-3xl opacity-30"></div>
        <div className="absolute bottom-0 left-0 -z-10 h-96 w-96 rounded-full bg-blue-50 blur-3xl opacity-30"></div>
      </section>



      {/* SOS Button - Always visible */}
      <SosButton />
    </main>
  );
}

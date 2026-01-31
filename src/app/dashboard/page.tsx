"use client";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "~/trpc/react";

export default function Dashboard() {
  const { data, status } = useSession();
  const router = useRouter();
  const [redirectTimeout, setRedirectTimeout] = useState(false);

  // Check profile completion status
  const profileQuery = api.profile.getProfileStatus.useQuery(undefined, {
    enabled: status === "authenticated",
  });

  // Set timeout for redirect
  useEffect(() => {
    const timeout = setTimeout(() => {
      setRedirectTimeout(true);
    }, 5000); // 5 second timeout

    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => {
    console.log("Dashboard - Session status:", status);
    console.log("Dashboard - User data:", data);
    console.log("Dashboard - Profile query:", profileQuery.status);

    if (status === "loading") return;

    if (status === "unauthenticated") {
      console.log("Dashboard - Not authenticated, redirecting to home");
      router.push("/");
      return;
    }

    if (!data) return;

    // If profile is incomplete, the ProfileGuard will handle showing the completion modal
    // Just redirect to the appropriate role-based dashboard
    if (data.user.role === "USER") {
      console.log("Dashboard - Redirecting to /user");
      router.push("/user");
    } else if (data.user.role === "VOLUNTEER") {
      console.log("Dashboard - Redirecting to /volunteer");
      router.push("/volunteer");
    } else if (data.user.role === "AUTHORITY") {
      console.log("Dashboard - Redirecting to /authority");
      router.push("/authority");
    } else {
      console.error("Dashboard - Unknown role:", data.user.role);
    }
  }, [data, status, router, profileQuery.status]);

  if (redirectTimeout) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-red-600 mb-4">
            <svg className="h-12 w-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Redirect Taking Too Long</h2>
          <p className="text-gray-600 mb-4">
            Status: {status}
            <br />
            {data ? `Role: ${data.user.role}` : "No user data"}
          </p>
          <button
            onClick={() => router.push("/")}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Redirecting...</p>
        <p className="text-sm text-gray-500 mt-2">Status: {status}</p>
        {data && <p className="text-sm text-gray-500">Role: {data.user.role}</p>}
      </div>
    </div>
  );
}

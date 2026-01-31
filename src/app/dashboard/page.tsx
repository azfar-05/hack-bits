"use client";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { api } from "~/trpc/react";

export default function Dashboard() {
  const { data, status } = useSession();
  const router = useRouter();

  // Check profile completion status
  const profileQuery = api.profile.getProfileStatus.useQuery(undefined, {
    enabled: status === "authenticated",
  });

  useEffect(() => {
    if (!data || status !== "authenticated") return;

    // If profile is incomplete, the ProfileGuard will handle showing the completion modal
    // Just redirect to the appropriate role-based dashboard
    if (data.user.role === "USER") router.push("/user");
    if (data.user.role === "VOLUNTEER") router.push("/volunteer");
    if (data.user.role === "AUTHORITY") router.push("/authority");
  }, [data, status, router]);

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Redirecting...</p>
      </div>
    </div>
  );
}

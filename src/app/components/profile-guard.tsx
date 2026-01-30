"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { api } from "~/trpc/react";
import { ProfileCompletion } from "./profile-completion";

interface ProfileGuardProps {
  children: React.ReactNode;
}

export function ProfileGuard({ children }: ProfileGuardProps) {
  const { data: session, status } = useSession();
  const [showProfileCompletion, setShowProfileCompletion] = useState(false);

  const profileQuery = api.profile.getProfileStatus.useQuery(undefined, {
    enabled: status === "authenticated",
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (profileQuery.data?.needsProfileCompletion) {
      setShowProfileCompletion(true);
    }
  }, [profileQuery.data]);

  const handleProfileComplete = () => {
    setShowProfileCompletion(false);
    profileQuery.refetch();
  };

  // Don't show profile completion for unauthenticated users
  if (status !== "authenticated") {
    return <>{children}</>;
  }

  // Show loading while checking profile status
  if (profileQuery.isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Show profile completion modal if needed
  if (showProfileCompletion) {
    return (
      <>
        {children}
        <ProfileCompletion onComplete={handleProfileComplete} />
      </>
    );
  }

  return <>{children}</>;
}
"use client";

import { SessionProvider } from "next-auth/react";
import { TRPCReactProvider } from "~/trpc/react";
import { ProfileGuard } from "./components/profile-guard";

interface ProvidersProps {
  children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <SessionProvider>
      <TRPCReactProvider>
        <ProfileGuard>
          {children}
        </ProfileGuard>
      </TRPCReactProvider>
    </SessionProvider>
  );
}

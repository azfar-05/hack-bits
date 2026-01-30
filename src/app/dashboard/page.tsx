"use client";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function Dashboard() {
  const { data } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (!data) return;

    if (data.user.role === "USER") router.push("/user");
    if (data.user.role === "VOLUNTEER") router.push("/volunteer");
    if (data.user.role === "AUTHORITY") router.push("/authority");
  }, [data]);

  return null;
}

import { redirect } from "next/navigation";
import { auth } from "~/server/auth";

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/");
  }

  // Redirect based on user role
  const role = session.user.role;

  switch (role) {
    case "AUTHORITY":
      redirect("/authority");
    case "VOLUNTEER":
      redirect("/volunteer");
    case "USER":
    default:
      redirect("/user");
  }
}

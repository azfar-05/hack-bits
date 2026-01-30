import { getToken } from "next-auth/jwt";
import { type NextRequest, NextResponse } from "next/server";

export async function middleware(req: NextRequest) {
  const token = await getToken({ req });
  const path = req.nextUrl.pathname;

  // Redirect unauthenticated users to home
  if (!token) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  const role = token.role as string;

  // Role-based route protection
  if (path.startsWith("/authority") && role !== "AUTHORITY") {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  if (path.startsWith("/volunteer") && role !== "VOLUNTEER") {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  if (path.startsWith("/user") && role !== "USER") {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard", "/user/:path*", "/volunteer/:path*", "/authority/:path*"],
};

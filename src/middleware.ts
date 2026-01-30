import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(req: NextRequest) {
  const token = await getToken({
    req,
    secret: process.env.AUTH_SECRET,
  });

  const path = req.nextUrl.pathname;

  // Allow public routes
  if (path === "/" || path.startsWith("/api")) {
    return NextResponse.next();
  }

  // Redirect unauthenticated users
  if (!token) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  return NextResponse.next();
}

// Apply middleware only to app routes
export const config = {
  matcher: ["/authority/:path*", "/volunteer/:path*", "/user/:path*"],
};

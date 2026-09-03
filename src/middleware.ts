import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_NAME, decodeSession } from "@/lib/session";

const PUBLIC_PATHS = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  // Client portal authenticates with its own single-use link token.
  "/portal",
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = await decodeSession(request.cookies.get(COOKIE_NAME)?.value);
  const isPublic = PUBLIC_PATHS.some((path) => pathname.startsWith(path));

  if (!session && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // A signed-in staff member opening a portal link should still see the portal.
  if (session && isPublic && !pathname.startsWith("/portal")) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Webhooks authenticate with provider signatures, cron with a shared secret.
    "/((?!api/webhooks|api/cron|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};

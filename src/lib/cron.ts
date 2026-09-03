import { NextResponse } from "next/server";

/**
 * Cron routes sit outside the session middleware, so they authenticate with a
 * shared secret sent as a bearer token or the `x-cron-secret` header.
 */
export function authorizeCron(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET belum diisi di server" },
      { status: 500 },
    );
  }

  const header =
    request.headers.get("x-cron-secret") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  if (header !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

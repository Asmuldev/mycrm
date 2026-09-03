/**
 * Minimal error reporting. Logs a structured line the host's log drain can pick
 * up, and forwards to ERROR_WEBHOOK_URL when set (Sentry, Slack, or anything
 * that accepts a JSON POST). Never throws — reporting must not mask the
 * original failure.
 */
export type ErrorContext = Record<string, string | number | boolean | null>;

export async function reportError(
  error: unknown,
  context: ErrorContext = {},
) {
  const payload = {
    level: "error" as const,
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    digest:
      error && typeof error === "object" && "digest" in error
        ? String((error as { digest?: unknown }).digest)
        : undefined,
    context,
    at: new Date().toISOString(),
    app: "my-crm",
    env: process.env.NODE_ENV,
  };

  console.error(JSON.stringify(payload));

  const url = process.env.ERROR_WEBHOOK_URL;
  if (!url) return;

  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (sendError) {
    console.error("error webhook failed", sendError);
  }
}

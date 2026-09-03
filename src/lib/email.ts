import { reportError } from "@/lib/observability";
import { prisma } from "@/lib/prisma";

export type EmailAttachment = {
  filename: string;
  content: Buffer;
};

export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  kind: string;
  invoiceId?: string;
  attachments?: EmailAttachment[];
  replyTo?: string | null;
  fromName?: string | null;
};

export function isEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

/**
 * Sends through Resend's REST API (no SDK needed). When credentials are absent
 * the message is logged as SKIPPED instead of failing, so the app stays usable
 * before email is configured.
 */
export async function sendEmail(input: SendEmailInput) {
  if (!isEmailConfigured()) {
    await logEmail(input, "SKIPPED", "RESEND_API_KEY atau EMAIL_FROM belum diisi");
    console.info(`[email:skipped] ${input.kind} -> ${input.to}: ${input.subject}`);
    return { ok: false as const, skipped: true as const };
  }

  const from = input.fromName
    ? `${input.fromName} <${process.env.EMAIL_FROM}>`
    : process.env.EMAIL_FROM!;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: input.subject,
        html: input.html,
        text: input.text,
        reply_to: input.replyTo ?? undefined,
        attachments: input.attachments?.map((attachment) => ({
          filename: attachment.filename,
          content: attachment.content.toString("base64"),
        })),
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      await logEmail(input, "FAILED", detail.slice(0, 500));
      await reportError(new Error(`Resend menolak kiriman: ${detail}`), {
        kind: input.kind,
        to: input.to,
        status: response.status,
      });
      return { ok: false as const, error: detail };
    }

    await logEmail(input, "SENT");
    return { ok: true as const };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await logEmail(input, "FAILED", message);
    await reportError(error, { kind: input.kind, to: input.to });
    return { ok: false as const, error: message };
  }
}

async function logEmail(
  input: SendEmailInput,
  status: "SENT" | "FAILED" | "SKIPPED",
  error?: string,
) {
  try {
    await prisma.emailLog.create({
      data: {
        to: input.to,
        subject: input.subject,
        kind: input.kind,
        status,
        error: error ?? null,
        invoiceId: input.invoiceId ?? null,
      },
    });
  } catch (logError) {
    console.error("email log failed", logError);
  }
}

/** Minimal, email-client-safe HTML shell. */
export function emailShell({
  accent,
  heading,
  body,
  cta,
  footer,
}: {
  accent: string;
  heading: string;
  body: string;
  cta?: { label: string; url: string };
  footer?: string;
}) {
  return `<!doctype html>
<html lang="id"><body style="margin:0;padding:24px;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;">
    <tr><td style="height:6px;background:${accent};"></td></tr>
    <tr><td style="padding:28px;">
      <h1 style="margin:0 0 12px;font-size:18px;">${heading}</h1>
      <div style="font-size:14px;line-height:1.6;color:#334155;">${body}</div>
      ${
        cta
          ? `<p style="margin:24px 0 0;"><a href="${cta.url}" style="display:inline-block;background:${accent};color:#ffffff;text-decoration:none;padding:11px 20px;border-radius:8px;font-size:14px;font-weight:bold;">${cta.label}</a></p>`
          : ""
      }
    </td></tr>
    ${
      footer
        ? `<tr><td style="padding:16px 28px;border-top:1px solid #e2e8f0;font-size:12px;color:#94a3b8;">${footer}</td></tr>`
        : ""
    }
  </table>
</body></html>`;
}

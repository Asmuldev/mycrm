"use client";

import { useState } from "react";
import { MessageCircle } from "lucide-react";
import { buttonClass, cn } from "@/components/ui";

/**
 * Opens WhatsApp with the message already written, using the staff member's own
 * account. Also offers a copy fallback, because wa.me on a desktop without
 * WhatsApp installed leads to a dead end.
 */
export function WhatsappButton({
  href,
  message,
  label = "Kirim via WhatsApp",
  variant = "secondary",
  className,
}: {
  href: string | null;
  message: string;
  label?: string;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  if (!href) {
    return (
      <span
        title="Nomor telepon klien belum diisi atau formatnya tidak terbaca"
        className={cn(
          buttonClass("ghost"),
          "pointer-events-none opacity-50",
          className,
        )}
      >
        <MessageCircle className="h-4 w-4" />
        WhatsApp belum tersedia
      </span>
    );
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-1">
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className={cn(buttonClass(variant), className)}
      >
        <MessageCircle className="h-4 w-4" />
        {label}
      </a>
      <button
        type="button"
        onClick={copy}
        title="Salin teks pesannya saja"
        className={cn(buttonClass("ghost"), "px-2 py-1 text-xs")}
      >
        {copied ? "Tersalin" : "Salin teks"}
      </button>
    </span>
  );
}

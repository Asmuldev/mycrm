"use client";

import { useActionState } from "react";
import { buttonClass, cn } from "@/components/ui";

export type ActionResult = { error?: string; success?: string } | void;

/**
 * Runs a server action that may refuse, and shows the reason inline.
 *
 * A server action that throws renders nothing where the user is looking, so a
 * refused delete looks like a dead button. Actions used here return their
 * refusal instead, and it is displayed next to the button that caused it.
 */
export function ActionButton({
  action,
  children,
  message,
  variant = "danger",
  className,
  pendingLabel = "Memproses...",
}: {
  action: () => Promise<ActionResult>;
  children: React.ReactNode;
  /** Shown in a confirm dialog first. Omit to run without confirmation. */
  message?: string;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  className?: string;
  pendingLabel?: string;
}) {
  const [state, formAction, pending] = useActionState<ActionResult, FormData>(
    async () => (await action()) ?? undefined,
    undefined,
  );

  return (
    <form action={formAction} className="inline-block">
      <button
        type="submit"
        disabled={pending}
        className={cn(buttonClass(variant), className)}
        onClick={(event) => {
          if (message && !window.confirm(message)) event.preventDefault();
        }}
      >
        {pending ? pendingLabel : children}
      </button>

      {state?.error ? (
        <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {state.error}
        </p>
      ) : null}
      {state?.success ? (
        <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
          {state.success}
        </p>
      ) : null}
    </form>
  );
}

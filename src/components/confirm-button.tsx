"use client";

import { useFormStatus } from "react-dom";
import { buttonClass, cn } from "@/components/ui";

export function ConfirmButton({
  children,
  message,
  variant = "danger",
  className,
}: {
  children: React.ReactNode;
  message: string;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  className?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className={cn(buttonClass(variant), className)}
      onClick={(event) => {
        if (!window.confirm(message)) event.preventDefault();
      }}
    >
      {pending ? "Memproses..." : children}
    </button>
  );
}

import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { badgeTone } from "@/lib/labels";

export function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function Card({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-slate-200 bg-white shadow-sm",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
      <div>
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        {description ? (
          <p className="mt-0.5 text-xs text-slate-500">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export function Badge({ value, label }: { value: string; label?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        badgeTone[value] ?? "bg-slate-100 text-slate-700 ring-slate-200",
      )}
    >
      {label ?? value}
    </span>
  );
}

export function Button({
  className,
  variant = "primary",
  ...props
}: ComponentProps<"button"> & {
  variant?: "primary" | "secondary" | "danger" | "ghost";
}) {
  return (
    <button
      {...props}
      className={cn(buttonClass(variant), className)}
    />
  );
}

export function LinkButton({
  className,
  variant = "primary",
  ...props
}: ComponentProps<typeof Link> & {
  variant?: "primary" | "secondary" | "danger" | "ghost";
}) {
  return <Link {...props} className={cn(buttonClass(variant), className)} />;
}

export function buttonClass(
  variant: "primary" | "secondary" | "danger" | "ghost" = "primary",
) {
  const base =
    "inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60";
  const variants = {
    primary: "bg-slate-900 text-white hover:bg-slate-700",
    secondary:
      "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
    danger: "bg-rose-600 text-white hover:bg-rose-500",
    ghost: "text-slate-600 hover:bg-slate-100",
  };
  return cn(base, variants[variant]);
}

export function Field({
  label,
  children,
  hint,
  className,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
  className?: string;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1 block text-xs font-medium text-slate-600">
        {label}
      </span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-slate-400">{hint}</span> : null}
    </label>
  );
}

export const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-200";

export function Input(props: ComponentProps<"input">) {
  return <input {...props} className={cn(inputClass, props.className)} />;
}

export function Textarea(props: ComponentProps<"textarea">) {
  return <textarea {...props} className={cn(inputClass, props.className)} />;
}

export function Select(props: ComponentProps<"select">) {
  return <select {...props} className={cn(inputClass, props.className)} />;
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      <p className="text-sm font-medium text-slate-700">{title}</p>
      {description ? (
        <p className="max-w-sm text-xs text-slate-500">{description}</p>
      ) : null}
      {action}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">
          {title}
        </h1>
        {description ? (
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

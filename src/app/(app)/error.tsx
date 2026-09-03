"use client";

import { useEffect } from "react";
import { Card, buttonClass } from "@/components/ui";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Card className="mx-auto max-w-lg p-6 text-center">
      <h1 className="text-base font-semibold text-slate-900">
        Terjadi kesalahan
      </h1>
      <p className="mt-2 text-sm text-slate-600">
        Halaman ini gagal dimuat. Coba lagi, atau kembali ke dashboard.
      </p>
      {error.digest ? (
        <p className="mt-3 font-mono text-xs text-slate-400">
          Kode kesalahan: {error.digest}
        </p>
      ) : null}
      <div className="mt-5 flex justify-center gap-2">
        <button type="button" onClick={reset} className={buttonClass("primary")}>
          Coba lagi
        </button>
        <a href="/dashboard" className={buttonClass("secondary")}>
          Ke dashboard
        </a>
      </div>
    </Card>
  );
}

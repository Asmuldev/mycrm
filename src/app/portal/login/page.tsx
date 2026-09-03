"use client";

import { useActionState } from "react";
import { clientLogin, type PortalLoginState } from "../portal-actions";

const initialState: PortalLoginState = {};

export default function PortalLoginPage() {
  const [state, formAction, pending] = useActionState(clientLogin, initialState);

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="mb-1 text-center text-lg font-semibold text-slate-900">
        Portal Klien
      </h1>
      <p className="mb-6 text-center text-sm text-slate-500">
        Masuk untuk melihat tagihan dan layanan Anda
      </p>

      <form
        action={formAction}
        className="space-y-4 rounded-xl border border-slate-200 bg-white p-6"
      >
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">
            Email
          </span>
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">
            Password
          </span>
          <input
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
          />
        </label>

        {state.error ? (
          <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {state.error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {pending ? "Memproses..." : "Masuk"}
        </button>
      </form>

      <p className="mt-4 text-center text-xs text-slate-500">
        Belum punya akses? Hubungi kami untuk dibuatkan akun.
      </p>
    </div>
  );
}

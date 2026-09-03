"use client";

import { useActionState } from "react";
import { uploadPaymentProof, type UploadProofState } from "./portal-actions";

const initialState: UploadProofState = {};

export function PaymentProofForm({
  invoiceId,
  token,
  accent,
}: {
  invoiceId: string;
  /** Present when the visitor arrived through a portal link. */
  token: string | null;
  accent: string;
}) {
  const action = uploadPaymentProof.bind(null, invoiceId, token);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-3">
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-600">
          Unggah bukti transfer
        </span>
        <input
          type="file"
          name="file"
          required
          accept="application/pdf,image/png,image/jpeg,image/webp"
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-slate-900 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white"
        />
        <span className="mt-1 block text-xs text-slate-400">
          PDF, PNG, JPG, atau WEBP. Maksimal 5 MB.
        </span>
      </label>

      {state.error ? (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
          {state.success}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
        style={{ backgroundColor: accent }}
      >
        {pending ? "Mengirim..." : "Kirim bukti transfer"}
      </button>
    </form>
  );
}

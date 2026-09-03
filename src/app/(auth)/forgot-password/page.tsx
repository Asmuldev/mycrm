"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestPasswordReset, type ResetState } from "../actions";
import { Button, Card, Field, Input } from "@/components/ui";

const initialState: ResetState = {};

export default function ForgotPasswordPage() {
  const [state, formAction, pending] = useActionState(
    requestPasswordReset,
    initialState,
  );

  return (
    <Card className="p-6">
      <h2 className="mb-1 text-sm font-semibold text-slate-900">Lupa password</h2>
      <p className="mb-4 text-xs text-slate-500">
        Masukkan email akun Anda. Kami kirim tautan untuk membuat password baru.
      </p>
      <form action={formAction} className="space-y-4">
        <Field label="Email">
          <Input name="email" type="email" required placeholder="you@mail.com" />
        </Field>
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
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Mengirim..." : "Kirim tautan"}
        </Button>
      </form>
      <p className="mt-4 text-center text-xs text-slate-500">
        <Link href="/login" className="font-medium text-slate-900 underline">
          Kembali ke halaman masuk
        </Link>
      </p>
    </Card>
  );
}

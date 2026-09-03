"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useActionState } from "react";
import { resetPassword, type ResetState } from "../actions";
import { Button, Card, Field, Input } from "@/components/ui";

const initialState: ResetState = {};

function ResetPasswordForm() {
  const token = useSearchParams().get("token") ?? "";
  const [state, formAction, pending] = useActionState(
    resetPassword,
    initialState,
  );

  if (!token) {
    return (
      <Card className="p-6">
        <p className="text-sm text-slate-700">
          Tautan tidak lengkap. Minta tautan baru dari halaman lupa password.
        </p>
        <Link
          href="/forgot-password"
          className="mt-3 inline-block text-xs font-medium text-slate-900 underline"
        >
          Minta tautan baru
        </Link>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <h2 className="mb-4 text-sm font-semibold text-slate-900">
        Buat password baru
      </h2>
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="token" value={token} />
        <Field label="Password baru" hint="Minimal 8 karakter">
          <Input name="password" type="password" required minLength={8} />
        </Field>
        <Field label="Ulangi password baru">
          <Input name="confirm" type="password" required minLength={8} />
        </Field>
        {state.error ? (
          <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {state.error}
          </p>
        ) : null}
        {state.success ? (
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
            {state.success}{" "}
            <Link href="/login" className="font-medium underline">
              Masuk
            </Link>
          </p>
        ) : null}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Menyimpan..." : "Simpan password"}
        </Button>
      </form>
    </Card>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<Card className="p-6 text-sm text-slate-500">Memuat...</Card>}>
      <ResetPasswordForm />
    </Suspense>
  );
}

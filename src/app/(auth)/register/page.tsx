"use client";

import Link from "next/link";
import { useActionState } from "react";
import { registerAction, type AuthState } from "../actions";
import { Button, Card, Field, Input } from "@/components/ui";

const initialState: AuthState = {};

export default function RegisterPage() {
  const [state, formAction, pending] = useActionState(
    registerAction,
    initialState,
  );

  return (
    <Card className="p-6">
      <h2 className="mb-4 text-sm font-semibold text-slate-900">Daftar</h2>
      <form action={formAction} className="space-y-4">
        <Field label="Nama">
          <Input name="name" required placeholder="Nama lengkap" />
        </Field>
        <Field label="Email">
          <Input name="email" type="email" required placeholder="you@mail.com" />
        </Field>
        <Field label="Password" hint="Minimal 8 karakter">
          <Input name="password" type="password" required minLength={8} />
        </Field>
        {state.error ? (
          <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {state.error}
          </p>
        ) : null}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Memproses..." : "Buat akun"}
        </Button>
      </form>
      <p className="mt-4 text-center text-xs text-slate-500">
        Sudah punya akun?{" "}
        <Link href="/login" className="font-medium text-slate-900 underline">
          Masuk
        </Link>
      </p>
    </Card>
  );
}

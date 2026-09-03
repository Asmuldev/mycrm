"use client";

import Link from "next/link";
import { useActionState } from "react";
import { loginAction, type AuthState } from "../actions";
import { Button, Card, Field, Input } from "@/components/ui";

const initialState: AuthState = {};

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <Card className="p-6">
      <h2 className="mb-4 text-sm font-semibold text-slate-900">Masuk</h2>
      <form action={formAction} className="space-y-4">
        <Field label="Email">
          <Input name="email" type="email" required placeholder="you@mail.com" />
        </Field>
        <Field label="Password">
          <Input name="password" type="password" required placeholder="••••••••" />
        </Field>
        {state.error ? (
          <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {state.error}
          </p>
        ) : null}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Memproses..." : "Masuk"}
        </Button>
      </form>
      <p className="mt-4 text-center text-xs text-slate-500">
        <Link
          href="/forgot-password"
          className="font-medium text-slate-900 underline"
        >
          Lupa password?
        </Link>
      </p>
      <p className="mt-2 text-center text-xs text-slate-500">
        Belum punya akun?{" "}
        <Link href="/register" className="font-medium text-slate-900 underline">
          Daftar
        </Link>
      </p>
    </Card>
  );
}

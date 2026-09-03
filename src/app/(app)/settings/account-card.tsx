"use client";

import { useActionState } from "react";
import { Card, CardHeader, Field, Input } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { changePassword, type AccountState } from "./actions";

const initialState: AccountState = {};

export function AccountCard() {
  const [state, formAction] = useActionState(changePassword, initialState);

  return (
    <Card className="mt-4">
      <CardHeader title="Akun saya" description="Ganti password login" />
      <form action={formAction} className="space-y-3 px-5 py-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Password lama">
            <Input name="currentPassword" type="password" required />
          </Field>
          <Field label="Password baru" hint="Minimal 8 karakter">
            <Input name="newPassword" type="password" required minLength={8} />
          </Field>
          <Field label="Ulangi password baru">
            <Input name="confirmPassword" type="password" required minLength={8} />
          </Field>
        </div>
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
        <SubmitButton variant="secondary">Ganti password</SubmitButton>
      </form>
    </Card>
  );
}

"use client";

import { useActionState } from "react";
import { Card, CardHeader, Field, Input } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { createPortalLink, type PortalLinkState } from "../actions";

const initialState: PortalLinkState = {};

export function PortalLinkCard({
  clientId,
  appUrl,
  children,
}: {
  clientId: string;
  appUrl: string;
  children: React.ReactNode;
}) {
  const action = createPortalLink.bind(null, clientId);
  const [state, formAction] = useActionState(action, initialState);

  return (
    <Card>
      <CardHeader
        title="Portal klien"
        description="Tautan pribadi berisi daftar invoice, unduhan PDF, dan tombol bayar"
      />

      {state.token ? (
        <div className="border-b border-slate-100 px-5 py-4">
          <p className="text-xs font-medium text-emerald-700">
            Tautan dibuat. Salin sekarang — tautan ini tidak ditampilkan lagi.
          </p>
          <code className="mt-2 block overflow-x-auto rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-800">
            {appUrl}/portal/{state.token}
          </code>
        </div>
      ) : null}

      {children}

      <form action={formAction} className="space-y-3 border-t border-slate-100 px-5 py-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Nama tautan">
            <Input name="label" placeholder="Portal keuangan" />
          </Field>
          <Field label="Berlaku (hari)" hint="0 = tanpa batas waktu">
            <Input name="expiresInDays" type="number" min="0" defaultValue={0} />
          </Field>
        </div>
        {state.error ? (
          <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {state.error}
          </p>
        ) : null}
        <SubmitButton variant="secondary">+ Buat tautan portal</SubmitButton>
      </form>
    </Card>
  );
}

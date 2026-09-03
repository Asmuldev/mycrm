"use client";

import { useActionState } from "react";
import { Card, CardHeader, Field, Input } from "@/components/ui";
import { ConfirmButton } from "@/components/confirm-button";
import { SubmitButton } from "@/components/submit-button";
import { removeLogo, uploadLogo, type LogoState } from "./actions";

const initialState: LogoState = {};

export function LogoCard({ logoUrl }: { logoUrl: string | null }) {
  const [state, formAction] = useActionState(uploadLogo, initialState);

  return (
    <Card>
      <CardHeader
        title="Logo perusahaan"
        description="Tampil di halaman cetak dan PDF invoice"
      />
      <div className="flex flex-wrap items-start gap-5 px-5 py-4">
        <div className="flex h-24 w-40 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 p-2">
          {logoUrl ? (
            // Data URI from the company profile; next/image adds nothing here.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt="Logo perusahaan"
              className="max-h-full max-w-full object-contain"
            />
          ) : (
            <span className="text-xs text-slate-400">Belum ada logo</span>
          )}
        </div>

        <div className="min-w-[240px] flex-1 space-y-3">
          <form action={formAction} className="space-y-3">
            <Field label="Unggah logo" hint="PNG atau JPG, maksimal 512 KB">
              <Input
                type="file"
                name="logo"
                accept="image/png,image/jpeg"
                required
                className="file:mr-3 file:rounded-md file:border-0 file:bg-slate-900 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white"
              />
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
            <SubmitButton variant="secondary" pendingLabel="Mengunggah...">
              Simpan logo
            </SubmitButton>
          </form>

          {logoUrl ? (
            <form action={removeLogo}>
              <ConfirmButton
                message="Hapus logo perusahaan?"
                variant="ghost"
                className="px-2 py-1 text-xs text-rose-600"
              >
                Hapus logo
              </ConfirmButton>
            </form>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

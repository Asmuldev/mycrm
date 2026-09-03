"use client";

import { useActionState } from "react";
import { Field, Input } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { createServerNode, type ServerState } from "./actions";

const initialState: ServerState = {};

export function ServerForm() {
  const [state, formAction] = useActionState(createServerNode, initialState);

  return (
    <form action={formAction} className="space-y-3 px-5 py-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Nama server">
          <Input name="name" required placeholder="VPS Utama" />
        </Field>
        <Field label="Alamat panel" hint="Termasuk http:// atau https:// dan port">
          <Input name="baseUrl" required placeholder="https://1.2.3.4:36842" />
        </Field>
      </div>

      <Field
        label="Kunci API"
        hint="Dari Settings → API di aaPanel. Disimpan terenkripsi, tidak pernah ditampilkan lagi."
      >
        <Input name="apiKey" type="password" required autoComplete="off" />
      </Field>

      <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
        IP server tempat aplikasi ini berjalan harus masuk whitelist di panel,
        atau semua permintaan akan ditolak.
      </p>

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

      <SubmitButton variant="secondary" pendingLabel="Menguji koneksi...">
        + Tambah server
      </SubmitButton>
    </form>
  );
}

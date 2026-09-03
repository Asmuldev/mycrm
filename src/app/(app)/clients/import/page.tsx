"use client";

import Link from "next/link";
import { useActionState } from "react";
import { importClients, type ImportState } from "../actions";
import { Card, CardHeader, Field, Input, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";

const initialState: ImportState = {};

export default function ImportClientsPage() {
  const [state, formAction] = useActionState(importClients, initialState);

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="Impor klien"
        description="Unggah CSV dari spreadsheet atau CRM lama"
      />

      <Card>
        <CardHeader
          title="Format kolom"
          description="Baris pertama harus header. Kolom yang tidak dikenali diabaikan."
        />
        <div className="px-5 py-4 text-xs text-slate-600">
          <p className="mb-2">
            Kolom yang dikenali:{" "}
            <span className="font-medium text-slate-800">
              Nama (wajib), Perusahaan, Email, Telepon, Website, NPWP, Alamat,
              Kota, Negara, Status, Tag, Catatan
            </span>
          </p>
          <p className="mb-2">
            Status diisi LEAD, ACTIVE, atau INACTIVE. Tag dipisah titik koma.
          </p>
          <p>
            Baris dengan email yang sudah terdaftar akan{" "}
            <span className="font-medium text-slate-800">diperbarui</span>, bukan
            digandakan.
          </p>
          <pre className="mt-3 overflow-x-auto rounded-lg bg-slate-50 p-3 text-[11px] text-slate-700">
{`Nama,Perusahaan,Email,Telepon,Status,Kota,Tag
PT Maju Jaya,Maju Group,finance@maju.id,+628111,ACTIVE,Jakarta,retainer;prioritas`}
          </pre>
        </div>
      </Card>

      <Card className="mt-4">
        <CardHeader title="Unggah file" />
        <form action={formAction} className="space-y-3 px-5 py-4">
          <Field label="File CSV" hint="Maksimal 2 MB">
            <Input
              type="file"
              name="file"
              accept=".csv,text/csv"
              required
              className="file:mr-3 file:rounded-md file:border-0 file:bg-slate-900 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white"
            />
          </Field>

          {state.error ? (
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {state.error}
            </p>
          ) : null}

          {state.created !== undefined ? (
            <div className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
              <p>
                {state.created} klien baru, {state.updated} diperbarui
                {state.skipped?.length ? `, ${state.skipped.length} dilewati` : ""}.
              </p>
              {state.skipped?.length ? (
                <ul className="mt-1 list-inside list-disc text-emerald-700">
                  {state.skipped.slice(0, 10).map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              ) : null}
              <Link href="/clients" className="mt-2 inline-block font-medium underline">
                Lihat daftar klien
              </Link>
            </div>
          ) : null}

          <SubmitButton pendingLabel="Mengimpor...">Impor CSV</SubmitButton>
        </form>
      </Card>
    </div>
  );
}

"use client";

import { useActionState, useState } from "react";
import { Field, Input, Select } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { createCustomField, type FieldDefState } from "./actions";
import { customFieldEntityLabel, customFieldTypeLabel } from "@/lib/labels";

const initialState: FieldDefState = {};

export function CustomFieldForm() {
  const [state, formAction] = useActionState(createCustomField, initialState);
  const [type, setType] = useState("TEXT");

  return (
    <form action={formAction} className="space-y-3 px-5 py-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <Field label="Berlaku untuk">
          <Select name="entity" defaultValue="CLIENT">
            {Object.entries(customFieldEntityLabel).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Nama kolom" className="sm:col-span-2">
          <Input name="label" required placeholder="Nomor kontrak" />
        </Field>
        <Field label="Tipe">
          <Select
            name="type"
            value={type}
            onChange={(event) => setType(event.target.value)}
          >
            {Object.entries(customFieldTypeLabel).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {type === "SELECT" ? (
        <Field label="Opsi" hint="Pisahkan dengan koma">
          <Input name="options" placeholder="Bulanan, Tahunan, Sekali bayar" />
        </Field>
      ) : null}

      <label className="flex items-center gap-2 text-xs text-slate-600">
        <input type="checkbox" name="required" className="rounded" />
        Wajib diisi
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

      <SubmitButton variant="secondary">+ Tambah kolom</SubmitButton>
    </form>
  );
}

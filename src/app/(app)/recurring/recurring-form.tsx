"use client";

import { useMemo, useState } from "react";
import {
  Button,
  Field,
  Input,
  LinkButton,
  Select,
  Textarea,
} from "@/components/ui";
import { formatDateInput, formatMoney } from "@/lib/format";
import { recurringFrequencyLabel } from "@/lib/labels";

type LineItem = {
  key: string;
  description: string;
  quantity: string;
  unitPrice: string;
};

export type RecurringFormValues = {
  title?: string;
  clientId?: string;
  frequency?: string;
  interval?: number;
  startDate?: string | null;
  endDate?: string | null;
  dueInDays?: number;
  currency?: string;
  discount?: number;
  taxRate?: number;
  exchangeRate?: number;
  withholdingRate?: number;
  notes?: string | null;
  terms?: string | null;
  autoSend?: boolean;
  active?: boolean;
  items?: Array<{ description: string; quantity: number; unitPrice: number }>;
};

let counter = 0;
const nextKey = () => `r-${(counter += 1)}`;

export function RecurringForm({
  action,
  clients,
  values,
  submitLabel,
  cancelHref,
  baseCurrency,
}: {
  action: (formData: FormData) => void | Promise<void>;
  clients: Array<{ id: string; name: string }>;
  values?: RecurringFormValues;
  submitLabel: string;
  cancelHref: string;
  baseCurrency: string;
}) {
  const [items, setItems] = useState<LineItem[]>(() =>
    values?.items?.length
      ? values.items.map((item) => ({
          key: nextKey(),
          description: item.description,
          quantity: String(item.quantity),
          unitPrice: String(item.unitPrice),
        }))
      : [{ key: nextKey(), description: "", quantity: "1", unitPrice: "0" }],
  );
  const currency = values?.currency ?? baseCurrency;

  const subtotal = useMemo(
    () =>
      items.reduce(
        (sum, item) =>
          sum + Number(item.quantity || 0) * Number(item.unitPrice || 0),
        0,
      ),
    [items],
  );

  function updateItem(key: string, patch: Partial<LineItem>) {
    setItems((current) =>
      current.map((item) => (item.key === key ? { ...item, ...patch } : item)),
    );
  }

  return (
    <form action={action} className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Judul langganan *">
          <Input
            name="title"
            required
            defaultValue={values?.title ?? ""}
            placeholder="Retainer bulanan"
          />
        </Field>
        <Field label="Klien *">
          <Select name="clientId" required defaultValue={values?.clientId ?? ""}>
            <option value="" disabled>
              Pilih klien
            </option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <Field label="Frekuensi">
          <Select name="frequency" defaultValue={values?.frequency ?? "MONTHLY"}>
            {Object.entries(recurringFrequencyLabel).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Setiap" hint="1 = tiap periode">
          <Input
            name="interval"
            type="number"
            min="1"
            defaultValue={values?.interval ?? 1}
          />
        </Field>
        <Field label="Mulai">
          <Input
            name="startDate"
            type="date"
            required
            defaultValue={formatDateInput(values?.startDate)}
          />
        </Field>
        <Field label="Berakhir" hint="Kosongkan kalau tanpa batas">
          <Input
            name="endDate"
            type="date"
            defaultValue={formatDateInput(values?.endDate ?? null)}
          />
        </Field>
        <Field label="Jatuh tempo (hari)">
          <Input
            name="dueInDays"
            type="number"
            min="0"
            defaultValue={values?.dueInDays ?? 14}
          />
        </Field>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-800">Item</h3>
          <button
            type="button"
            onClick={() =>
              setItems((current) => [
                ...current,
                { key: nextKey(), description: "", quantity: "1", unitPrice: "0" },
              ])
            }
            className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            + Tambah baris
          </button>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full min-w-[600px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2 font-medium">Deskripsi</th>
                <th className="w-24 px-3 py-2 font-medium">Qty</th>
                <th className="w-40 px-3 py-2 font-medium">Harga satuan</th>
                <th className="w-12 px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item) => (
                <tr key={item.key}>
                  <td className="px-3 py-2">
                    <Input
                      name="itemDescription"
                      value={item.description}
                      onChange={(event) =>
                        updateItem(item.key, { description: event.target.value })
                      }
                      placeholder="Retainer desain bulanan"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      name="itemQuantity"
                      type="number"
                      step="0.01"
                      min="0"
                      value={item.quantity}
                      onChange={(event) =>
                        updateItem(item.key, { quantity: event.target.value })
                      }
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      name="itemUnitPrice"
                      type="number"
                      step="0.01"
                      min="0"
                      value={item.unitPrice}
                      onChange={(event) =>
                        updateItem(item.key, { unitPrice: event.target.value })
                      }
                    />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      disabled={items.length === 1}
                      onClick={() =>
                        setItems((current) =>
                          current.filter((row) => row.key !== item.key),
                        )
                      }
                      className="rounded px-2 py-1 text-xs text-rose-600 hover:bg-rose-50 disabled:opacity-40"
                    >
                      Hapus
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-right text-sm text-slate-600">
          Subtotal per periode:{" "}
          <span className="font-semibold text-slate-900">
            {formatMoney(subtotal, currency)}
          </span>
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <Field label="Mata uang">
          <Select name="currency" defaultValue={currency}>
            <option value="IDR">IDR</option>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
            <option value="SGD">SGD</option>
          </Select>
        </Field>
        <Field label="Diskon">
          <Input
            name="discount"
            type="number"
            step="0.01"
            min="0"
            defaultValue={values?.discount ?? 0}
          />
        </Field>
        <Field label="PPN (%)">
          <Input
            name="taxRate"
            type="number"
            step="0.01"
            min="0"
            defaultValue={values?.taxRate ?? 0}
          />
        </Field>
        <Field
          label={`Kurs ke ${baseCurrency}`}
          hint={`Isi 1 kalau tagihan dalam ${baseCurrency}`}
        >
          <Input
            name="exchangeRate"
            type="number"
            step="0.000001"
            min="0"
            defaultValue={values?.exchangeRate ?? 1}
          />
        </Field>
        <Field label="PPh 23 (%)">
          <Input
            name="withholdingRate"
            type="number"
            step="0.01"
            min="0"
            defaultValue={values?.withholdingRate ?? 0}
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Catatan">
          <Textarea name="notes" rows={3} defaultValue={values?.notes ?? ""} />
        </Field>
        <Field label="Syarat pembayaran">
          <Textarea name="terms" rows={3} defaultValue={values?.terms ?? ""} />
        </Field>
      </div>

      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            name="autoSend"
            defaultChecked={values?.autoSend ?? false}
            className="rounded"
          />
          Kirim otomatis ke email klien saat invoice dibuat
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            name="active"
            defaultChecked={values?.active ?? true}
            className="rounded"
          />
          Langganan aktif
        </label>
      </div>

      <div className="flex gap-2">
        <Button type="submit">{submitLabel}</Button>
        <LinkButton href={cancelHref} variant="secondary">
          Batal
        </LinkButton>
      </div>
    </form>
  );
}

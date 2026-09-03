"use client";

import { useMemo, useState } from "react";
import {
  Button,
  Field,
  Input,
  LinkButton,
  Textarea,
} from "@/components/ui";
import { formatMoney } from "@/lib/format";

type LineItem = {
  key: string;
  description: string;
  quantity: string;
  unitPrice: string;
};

let counter = 0;
const nextKey = () => `cn-${(counter += 1)}`;

export function CreditNoteForm({
  action,
  invoice,
  today,
}: {
  action: (formData: FormData) => void | Promise<void>;
  invoice: {
    id: string;
    number: string;
    currency: string;
    taxRate: number;
    balance: number;
    items: Array<{ description: string; quantity: number; unitPrice: number }>;
  };
  today: string;
}) {
  const [items, setItems] = useState<LineItem[]>([
    { key: nextKey(), description: "", quantity: "1", unitPrice: "0" },
  ]);

  const totals = useMemo(() => {
    const subtotal = items.reduce(
      (sum, item) =>
        sum + Number(item.quantity || 0) * Number(item.unitPrice || 0),
      0,
    );
    const taxAmount = (subtotal * invoice.taxRate) / 100;
    return { subtotal, taxAmount, total: subtotal + taxAmount };
  }, [items, invoice.taxRate]);

  function updateItem(key: string, patch: Partial<LineItem>) {
    setItems((current) =>
      current.map((item) => (item.key === key ? { ...item, ...patch } : item)),
    );
  }

  const exceedsBalance = totals.total > invoice.balance + 0.005;

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="invoiceId" value={invoice.id} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Tanggal nota">
          <Input name="issueDate" type="date" defaultValue={today} />
        </Field>
        <Field label="Alasan koreksi *">
          <Input
            name="reason"
            required
            placeholder="Salah kuantitas, retur pekerjaan, diskon menyusul"
          />
        </Field>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-800">Baris koreksi</h3>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() =>
                setItems(
                  invoice.items.map((item) => ({
                    key: nextKey(),
                    description: item.description,
                    quantity: String(item.quantity),
                    unitPrice: String(item.unitPrice),
                  })),
                )
              }
              className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              Salin semua baris invoice
            </button>
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
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full min-w-[620px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2 font-medium">Deskripsi</th>
                <th className="w-24 px-3 py-2 font-medium">Qty</th>
                <th className="w-40 px-3 py-2 font-medium">Harga satuan</th>
                <th className="w-36 px-3 py-2 text-right font-medium">Jumlah</th>
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
                  <td className="px-3 py-2 text-right font-medium text-slate-800">
                    {formatMoney(
                      Number(item.quantity || 0) * Number(item.unitPrice || 0),
                      invoice.currency,
                    )}
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
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
        <div className="flex justify-between py-1">
          <span className="text-slate-600">Subtotal koreksi</span>
          <span>{formatMoney(totals.subtotal, invoice.currency)}</span>
        </div>
        <div className="flex justify-between py-1">
          <span className="text-slate-600">PPN ({invoice.taxRate}%)</span>
          <span>{formatMoney(totals.taxAmount, invoice.currency)}</span>
        </div>
        <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-semibold">
          <span>Total dikreditkan</span>
          <span>{formatMoney(totals.total, invoice.currency)}</span>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Sisa tagihan invoice saat ini{" "}
          {formatMoney(invoice.balance, invoice.currency)}.
        </p>
        {exceedsBalance ? (
          <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Nilai koreksi melebihi sisa tagihan. Boleh disimpan, tapi periksa
            lagi sebelum diterbitkan.
          </p>
        ) : null}
      </div>

      <Field label="Catatan">
        <Textarea name="notes" rows={3} />
      </Field>

      <div className="flex gap-2">
        <Button type="submit">Simpan draft nota kredit</Button>
        <LinkButton href={`/invoices/${invoice.id}`} variant="secondary">
          Batal
        </LinkButton>
      </div>
    </form>
  );
}

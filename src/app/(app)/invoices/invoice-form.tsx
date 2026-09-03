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
import { invoiceStatusLabel } from "@/lib/labels";

type LineItem = {
  key: string;
  description: string;
  quantity: string;
  unitPrice: string;
};

/**
 * Plain-JSON shape only. Prisma Decimal/Date instances must be converted by the
 * server page before crossing the client boundary.
 */
export type InvoiceFormValues = {
  clientId?: string;
  status?: string;
  issueDate?: string | null;
  dueDate?: string | null;
  currency?: string;
  discount?: number;
  taxRate?: number;
  withholdingRate?: number;
  exchangeRate?: number;
  notes?: string | null;
  terms?: string | null;
  items?: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
  }>;
};

let counter = 0;
function nextKey() {
  counter += 1;
  return `item-${counter}`;
}

export function InvoiceForm({
  action,
  clients,
  values,
  submitLabel,
  cancelHref,
  baseCurrency,
}: {
  action: (formData: FormData) => void | Promise<void>;
  clients: Array<{ id: string; name: string }>;
  values?: InvoiceFormValues;
  submitLabel: string;
  cancelHref: string;
  baseCurrency: string;
}) {
  const [items, setItems] = useState<LineItem[]>(() =>
    values?.items?.length
      ? values.items.map((item) => ({
          key: nextKey(),
          description: item.description,
          quantity: String(Number(item.quantity)),
          unitPrice: String(Number(item.unitPrice)),
        }))
      : [{ key: nextKey(), description: "", quantity: "1", unitPrice: "0" }],
  );
  const [discount, setDiscount] = useState(String(Number(values?.discount ?? 0)));
  const [taxRate, setTaxRate] = useState(String(Number(values?.taxRate ?? 0)));
  const [withholdingRate, setWithholdingRate] = useState(
    String(Number(values?.withholdingRate ?? 0)),
  );
  const [currency, setCurrency] = useState(values?.currency ?? baseCurrency);
  const [exchangeRate, setExchangeRate] = useState(
    String(values?.exchangeRate ?? 1),
  );
  const foreign = currency !== baseCurrency;

  const totals = useMemo(() => {
    const subtotal = items.reduce(
      (sum, item) => sum + Number(item.quantity || 0) * Number(item.unitPrice || 0),
      0,
    );
    const taxable = Math.max(subtotal - Number(discount || 0), 0);
    const taxAmount = (taxable * Number(taxRate || 0)) / 100;
    const withholdingAmount = (taxable * Number(withholdingRate || 0)) / 100;
    return {
      subtotal,
      taxAmount,
      withholdingAmount,
      total: taxable + taxAmount - withholdingAmount,
    };
  }, [items, discount, taxRate, withholdingRate]);

  function updateItem(key: string, patch: Partial<LineItem>) {
    setItems((current) =>
      current.map((item) => (item.key === key ? { ...item, ...patch } : item)),
    );
  }

  return (
    <form action={action} className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
        <Field label="Status">
          <Select name="status" defaultValue={values?.status ?? "DRAFT"}>
            {Object.entries(invoiceStatusLabel).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Mata uang">
          <Select
            name="currency"
            value={currency}
            onChange={(event) => setCurrency(event.target.value)}
          >
            <option value="IDR">IDR</option>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
            <option value="SGD">SGD</option>
          </Select>
        </Field>
        {foreign ? (
          <Field
            label={`Kurs 1 ${currency} ke ${baseCurrency}`}
            hint="Dipakai untuk menjumlahkan laporan dalam mata uang dasar"
          >
            <Input
              name="exchangeRate"
              type="number"
              step="0.000001"
              min="0"
              required
              value={exchangeRate}
              onChange={(event) => setExchangeRate(event.target.value)}
            />
          </Field>
        ) : (
          <input type="hidden" name="exchangeRate" value="1" />
        )}
        <Field label="Tanggal terbit">
          <Input
            name="issueDate"
            type="date"
            defaultValue={formatDateInput(values?.issueDate)}
          />
        </Field>
        <Field label="Jatuh tempo">
          <Input
            name="dueDate"
            type="date"
            required
            defaultValue={formatDateInput(values?.dueDate)}
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
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2 font-medium">Deskripsi</th>
                <th className="w-28 px-3 py-2 font-medium">Qty</th>
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
                      placeholder="Jasa desain, retainer bulanan, ..."
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
                      currency,
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <Field label="Catatan">
            <Textarea name="notes" rows={3} defaultValue={values?.notes ?? ""} />
          </Field>
          <Field label="Syarat pembayaran">
            <Textarea name="terms" rows={3} defaultValue={values?.terms ?? ""} />
          </Field>
        </div>

        <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-600">Subtotal</span>
            <span className="font-medium text-slate-900">
              {formatMoney(totals.subtotal, currency)}
            </span>
          </div>
          <Field label="Diskon">
            <Input
              name="discount"
              type="number"
              step="0.01"
              min="0"
              value={discount}
              onChange={(event) => setDiscount(event.target.value)}
            />
          </Field>
          <Field label="PPN (%)">
            <Input
              name="taxRate"
              type="number"
              step="0.01"
              min="0"
              value={taxRate}
              onChange={(event) => setTaxRate(event.target.value)}
            />
          </Field>
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-600">PPN</span>
            <span className="font-medium text-slate-900">
              {formatMoney(totals.taxAmount, currency)}
            </span>
          </div>
          <Field label="PPh 23 (%)" hint="Dipotong klien, mengurangi total">
            <Input
              name="withholdingRate"
              type="number"
              step="0.01"
              min="0"
              value={withholdingRate}
              onChange={(event) => setWithholdingRate(event.target.value)}
            />
          </Field>
          {totals.withholdingAmount > 0 ? (
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">PPh 23</span>
              <span className="font-medium text-slate-900">
                -{formatMoney(totals.withholdingAmount, currency)}
              </span>
            </div>
          ) : null}
          <div className="flex items-center justify-between border-t border-slate-200 pt-3 text-base">
            <span className="font-semibold text-slate-700">Total</span>
            <span className="font-semibold text-slate-900">
              {formatMoney(totals.total, currency)}
            </span>
          </div>
        </div>
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

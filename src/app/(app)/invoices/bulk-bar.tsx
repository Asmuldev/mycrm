"use client";

import { useState } from "react";
import { Select } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { bulkInvoiceAction } from "./actions";

/**
 * Wraps the invoice table so the checkboxes inside it post together with the
 * chosen action. Keeping the form here avoids duplicating the table markup.
 */
export function BulkInvoiceForm({
  children,
  canDelete,
}: {
  children: React.ReactNode;
  canDelete: boolean;
}) {
  const [selected, setSelected] = useState(0);

  return (
    <form
      action={bulkInvoiceAction}
      onChange={(event) => {
        const form = event.currentTarget;
        setSelected(
          form.querySelectorAll<HTMLInputElement>(
            'input[name="invoiceId"]:checked',
          ).length,
        );
      }}
    >
      {children}

      <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
        <span className="text-xs text-slate-500">
          {selected > 0 ? `${selected} invoice dipilih` : "Pilih invoice dulu"}
        </span>
        <Select name="bulkAction" defaultValue="sent" className="w-auto">
          <option value="sent">Tandai terkirim</option>
          <option value="paid">Tandai lunas</option>
          <option value="cancelled">Batalkan</option>
          {canDelete ? <option value="delete">Pindahkan ke sampah</option> : null}
        </Select>
        <SubmitButton
          variant="secondary"
          className="px-3 py-1.5 text-xs"
          pendingLabel="Memproses..."
        >
          Jalankan
        </SubmitButton>
      </div>
    </form>
  );
}

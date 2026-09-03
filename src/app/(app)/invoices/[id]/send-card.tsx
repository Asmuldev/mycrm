"use client";

import { useActionState } from "react";
import { Card, CardHeader, Field, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { sendInvoice, type InvoiceActionState } from "../actions";

const initialState: InvoiceActionState = {};

export function SendInvoiceCard({
  invoiceId,
  clientEmail,
  sentAt,
}: {
  invoiceId: string;
  clientEmail: string | null;
  sentAt: string | null;
}) {
  const action = sendInvoice.bind(null, invoiceId);
  const [state, formAction] = useActionState(action, initialState);

  return (
    <Card className="no-print">
      <CardHeader
        title="Kirim ke klien"
        description={
          clientEmail
            ? `PDF akan dilampirkan dan dikirim ke ${clientEmail}`
            : "Klien belum punya alamat email"
        }
      />
      <form action={formAction} className="space-y-3 px-5 py-4">
        <Field label="Pesan tambahan (opsional)">
          <Textarea
            name="message"
            rows={3}
            placeholder="Terima kasih atas kerja samanya. Mohon konfirmasi setelah transfer."
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
        <div className="flex items-center gap-3">
          <SubmitButton pendingLabel="Mengirim...">
            {sentAt ? "Kirim ulang invoice" : "Kirim invoice"}
          </SubmitButton>
          {sentAt ? (
            <span className="text-xs text-slate-500">
              Terakhir dikirim{" "}
              {new Date(sentAt).toLocaleString("id-ID", {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </span>
          ) : null}
        </div>
      </form>
    </Card>
  );
}

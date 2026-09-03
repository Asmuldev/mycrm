"use client";

import { useActionState } from "react";
import { Card, CardHeader, Field, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { sendQuote, type QuoteActionState } from "../actions";

const initialState: QuoteActionState = {};

export function SendQuoteCard({
  quoteId,
  clientEmail,
  sentAt,
}: {
  quoteId: string;
  clientEmail: string | null;
  sentAt: string | null;
}) {
  const action = sendQuote.bind(null, quoteId);
  const [state, formAction] = useActionState(action, initialState);

  return (
    <Card>
      <CardHeader
        title="Kirim ke klien"
        description={
          clientEmail ? `Dikirim ke ${clientEmail}` : "Klien belum punya email"
        }
      />
      <form action={formAction} className="space-y-3 px-5 py-4">
        <Field label="Pesan tambahan (opsional)">
          <Textarea name="message" rows={3} />
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
            {sentAt ? "Kirim ulang" : "Kirim penawaran"}
          </SubmitButton>
          {sentAt ? (
            <span className="text-xs text-slate-500">
              Terakhir dikirim{" "}
              {new Date(sentAt).toLocaleDateString("id-ID")}
            </span>
          ) : null}
        </div>
      </form>
    </Card>
  );
}

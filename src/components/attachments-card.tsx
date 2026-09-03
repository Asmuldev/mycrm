"use client";

import { useActionState } from "react";
import { Card, CardHeader, EmptyState, Field, Input } from "@/components/ui";
import { ConfirmButton } from "@/components/confirm-button";
import { SubmitButton } from "@/components/submit-button";
import {
  deleteAttachment,
  uploadAttachment,
  type AttachmentState,
} from "@/lib/attachments";

const initialState: AttachmentState = {};

export type AttachmentRow = {
  id: string;
  filename: string;
  size: number;
  createdAt: string;
};

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AttachmentsCard({
  attachments,
  clientId,
  invoiceId,
  expenseId,
  revalidate,
}: {
  attachments: AttachmentRow[];
  clientId?: string;
  invoiceId?: string;
  expenseId?: string;
  revalidate: string;
}) {
  const action = uploadAttachment.bind(null, {
    clientId,
    invoiceId,
    expenseId,
    revalidate,
  });
  const [state, formAction] = useActionState(action, initialState);

  return (
    <Card>
      <CardHeader
        title="Lampiran"
        description="Kontrak, PO, bukti transfer — maksimal 5 MB per file"
      />
      {attachments.length === 0 ? (
        <EmptyState title="Belum ada lampiran" />
      ) : (
        <ul className="divide-y divide-slate-100">
          {attachments.map((attachment) => {
            const remove = deleteAttachment.bind(
              null,
              attachment.id,
              revalidate,
            );
            return (
              <li
                key={attachment.id}
                className="flex items-center justify-between gap-3 px-5 py-3"
              >
                <div className="min-w-0">
                  <a
                    href={`/api/attachments/${attachment.id}`}
                    className="truncate text-sm font-medium text-slate-800 hover:underline"
                  >
                    {attachment.filename}
                  </a>
                  <p className="text-xs text-slate-500">
                    {formatSize(attachment.size)} ·{" "}
                    {new Date(attachment.createdAt).toLocaleDateString("id-ID")}
                  </p>
                </div>
                <form action={remove}>
                  <ConfirmButton
                    message={`Hapus lampiran "${attachment.filename}"?`}
                    variant="ghost"
                    className="px-2 py-1 text-xs text-rose-600"
                  >
                    Hapus
                  </ConfirmButton>
                </form>
              </li>
            );
          })}
        </ul>
      )}

      <form
        action={formAction}
        className="space-y-3 border-t border-slate-100 px-5 py-4"
      >
        <Field label="Unggah file">
          <Input
            type="file"
            name="file"
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
          + Unggah lampiran
        </SubmitButton>
      </form>
    </Card>
  );
}

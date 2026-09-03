"use server";

import { revalidatePath } from "next/cache";
import { recordAudit } from "@/lib/audit";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// A "use server" module may only export async functions, so this stays local.
const ATTACHMENT_MAX_BYTES = 5 * 1024 * 1024;

const ALLOWED = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
  "text/plain",
];

export type AttachmentState = { error?: string; success?: string };

export async function uploadAttachment(
  target: {
    clientId?: string;
    invoiceId?: string;
    expenseId?: string;
    revalidate: string;
  },
  _prev: AttachmentState,
  formData: FormData,
): Promise<AttachmentState> {
  const session = await requireSession();
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    return { error: "Pilih file dulu" };
  }
  if (file.size > ATTACHMENT_MAX_BYTES) {
    return { error: "Ukuran file maksimal 5 MB" };
  }
  if (!ALLOWED.includes(file.type)) {
    return { error: "Tipe file tidak didukung" };
  }

  const attachment = await prisma.attachment.create({
    data: {
      filename: file.name.slice(0, 200),
      mimeType: file.type,
      size: file.size,
      data: Buffer.from(await file.arrayBuffer()),
      clientId: target.clientId ?? null,
      invoiceId: target.invoiceId ?? null,
      expenseId: target.expenseId ?? null,
      uploadedById: session.userId,
    },
  });

  await recordAudit(session, {
    action: "attachment.upload",
    entity: target.invoiceId ? "Invoice" : target.expenseId ? "Expense" : "Client",
    entityId: target.invoiceId ?? target.expenseId ?? target.clientId ?? null,
    summary: `Mengunggah lampiran ${attachment.filename}`,
  });

  revalidatePath(target.revalidate);
  return { success: `${attachment.filename} terunggah` };
}

export async function deleteAttachment(
  attachmentId: string,
  revalidate: string,
) {
  const session = await requireSession();
  const attachment = await prisma.attachment.delete({
    where: { id: attachmentId },
  });
  await recordAudit(session, {
    action: "attachment.delete",
    entity: attachment.invoiceId
      ? "Invoice"
      : attachment.expenseId
        ? "Expense"
        : "Client",
    entityId: attachment.invoiceId ?? attachment.expenseId ?? attachment.clientId,
    summary: `Menghapus lampiran ${attachment.filename}`,
  });
  revalidatePath(revalidate);
}

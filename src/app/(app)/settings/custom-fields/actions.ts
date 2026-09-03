"use server";

import { revalidatePath } from "next/cache";
import { recordAudit } from "@/lib/audit";
import { requireSession } from "@/lib/auth";
import { optionalString, toNumber } from "@/lib/format";
import { requireAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import type {
  CustomFieldEntity,
  CustomFieldType,
} from "@/generated/prisma/client";

export type FieldDefState = { error?: string; success?: string };

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

export async function createCustomField(
  _prev: FieldDefState,
  formData: FormData,
): Promise<FieldDefState> {
  const session = await requireAdmin();

  const label = String(formData.get("label") ?? "").trim();
  if (label.length < 2) return { error: "Nama kolom minimal 2 karakter" };

  const entity = String(formData.get("entity") ?? "CLIENT") as CustomFieldEntity;
  const key = slugify(label);
  if (!key) return { error: "Nama kolom tidak menghasilkan kunci yang valid" };

  const existing = await prisma.customFieldDef.findUnique({
    where: { entity_key: { entity, key } },
  });
  if (existing) return { error: "Kolom dengan nama itu sudah ada" };

  const options = String(formData.get("options") ?? "")
    .split(",")
    .map((option) => option.trim())
    .filter(Boolean);

  const type = String(formData.get("type") ?? "TEXT") as CustomFieldType;
  if (type === "SELECT" && options.length === 0) {
    return { error: "Kolom pilihan butuh minimal satu opsi" };
  }

  await prisma.customFieldDef.create({
    data: {
      entity,
      key,
      label,
      type,
      options,
      required: formData.get("required") !== null,
      position: toNumber(formData.get("position"), 0),
    },
  });

  await recordAudit(session, {
    action: "custom_field.create",
    entity: "CustomFieldDef",
    summary: `Menambah kolom kustom "${label}" untuk ${entity}`,
  });

  revalidatePath("/settings/custom-fields");
  return { success: `Kolom "${label}" dibuat` };
}

export async function toggleCustomField(id: string) {
  await requireAdmin();
  const def = await prisma.customFieldDef.findUnique({ where: { id } });
  if (!def) return;

  await prisma.customFieldDef.update({
    where: { id },
    data: { active: !def.active },
  });
  revalidatePath("/settings/custom-fields");
}

export async function deleteCustomField(id: string) {
  const session = await requireAdmin();
  const def = await prisma.customFieldDef.delete({ where: { id } });
  await recordAudit(session, {
    action: "custom_field.delete",
    entity: "CustomFieldDef",
    summary: `Menghapus kolom kustom "${def.label}" beserta isinya`,
  });
  revalidatePath("/settings/custom-fields");
}

/** Saves every custom field value for one record in a single submit. */
export async function saveCustomFieldValues(
  entity: CustomFieldEntity,
  entityId: string,
  revalidate: string,
  formData: FormData,
) {
  await requireSession();

  const defs = await prisma.customFieldDef.findMany({
    where: { entity, active: true },
  });

  for (const def of defs) {
    const raw =
      def.type === "BOOLEAN"
        ? formData.get(`cf_${def.key}`) !== null
          ? "true"
          : "false"
        : optionalString(formData.get(`cf_${def.key}`));

    if (raw === null || raw === "") {
      await prisma.customFieldValue.deleteMany({
        where: { defId: def.id, entityId },
      });
      continue;
    }

    await prisma.customFieldValue.upsert({
      where: { defId_entityId: { defId: def.id, entityId } },
      create: { defId: def.id, entityId, value: raw },
      update: { value: raw },
    });
  }

  revalidatePath(revalidate);
}

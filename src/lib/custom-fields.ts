import { prisma } from "@/lib/prisma";
import type { CustomFieldEntity } from "@/generated/prisma/client";

export type CustomFieldWithValue = {
  id: string;
  key: string;
  label: string;
  type: string;
  options: string[];
  required: boolean;
  value: string;
};

/** Definitions for one entity, joined with this record's stored values. */
export async function getCustomFields(
  entity: CustomFieldEntity,
  entityId: string,
): Promise<CustomFieldWithValue[]> {
  const defs = await prisma.customFieldDef.findMany({
    where: { entity, active: true },
    orderBy: [{ position: "asc" }, { label: "asc" }],
    include: { values: { where: { entityId } } },
  });

  return defs.map((def) => ({
    id: def.id,
    key: def.key,
    label: def.label,
    type: def.type,
    options: def.options,
    required: def.required,
    value: def.values[0]?.value ?? "",
  }));
}

export function displayCustomValue(field: CustomFieldWithValue) {
  if (!field.value) return "-";
  if (field.type === "BOOLEAN") return field.value === "true" ? "Ya" : "Tidak";
  return field.value;
}

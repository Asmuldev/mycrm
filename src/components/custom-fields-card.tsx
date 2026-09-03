import { Card, CardHeader, Field, Input, Select, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { getCustomFields } from "@/lib/custom-fields";
import { saveCustomFieldValues } from "@/app/(app)/settings/custom-fields/actions";
import type { CustomFieldEntity } from "@/generated/prisma/client";

export async function CustomFieldsCard({
  entity,
  entityId,
  revalidate,
}: {
  entity: CustomFieldEntity;
  entityId: string;
  revalidate: string;
}) {
  const fields = await getCustomFields(entity, entityId);
  if (fields.length === 0) return null;

  const action = saveCustomFieldValues.bind(null, entity, entityId, revalidate);

  return (
    <Card>
      <CardHeader title="Kolom kustom" />
      <form action={action} className="space-y-3 px-5 py-4">
        {fields.map((field) => {
          const name = `cf_${field.key}`;

          if (field.type === "BOOLEAN") {
            return (
              <label
                key={field.id}
                className="flex items-center gap-2 text-sm text-slate-700"
              >
                <input
                  type="checkbox"
                  name={name}
                  defaultChecked={field.value === "true"}
                  className="rounded"
                />
                {field.label}
              </label>
            );
          }

          return (
            <Field key={field.id} label={field.label}>
              {field.type === "TEXTAREA" ? (
                <Textarea name={name} rows={3} defaultValue={field.value} />
              ) : field.type === "SELECT" ? (
                <Select name={name} defaultValue={field.value}>
                  <option value="">-</option>
                  {field.options.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </Select>
              ) : (
                <Input
                  name={name}
                  required={field.required}
                  type={
                    field.type === "NUMBER"
                      ? "number"
                      : field.type === "DATE"
                        ? "date"
                        : "text"
                  }
                  step={field.type === "NUMBER" ? "any" : undefined}
                  defaultValue={field.value}
                />
              )}
            </Field>
          );
        })}

        <SubmitButton variant="secondary">Simpan kolom kustom</SubmitButton>
      </form>
    </Card>
  );
}

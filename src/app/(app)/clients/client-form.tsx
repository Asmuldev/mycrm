import { Button, Field, Input, LinkButton, Select, Textarea } from "@/components/ui";
import { clientStatusLabel } from "@/lib/labels";

type ClientFormValues = {
  name?: string;
  company?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  taxId?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  status?: string;
  tags?: string[];
  notes?: string | null;
};

export function ClientForm({
  action,
  values,
  submitLabel,
  cancelHref,
}: {
  action: (formData: FormData) => void | Promise<void>;
  values?: ClientFormValues;
  submitLabel: string;
  cancelHref: string;
}) {
  return (
    <form action={action} className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Nama klien *">
          <Input name="name" required defaultValue={values?.name ?? ""} />
        </Field>
        <Field label="Perusahaan">
          <Input name="company" defaultValue={values?.company ?? ""} />
        </Field>
        <Field label="Email">
          <Input name="email" type="email" defaultValue={values?.email ?? ""} />
        </Field>
        <Field label="Telepon">
          <Input name="phone" defaultValue={values?.phone ?? ""} />
        </Field>
        <Field label="Website">
          <Input name="website" defaultValue={values?.website ?? ""} />
        </Field>
        <Field label="NPWP / Tax ID">
          <Input name="taxId" defaultValue={values?.taxId ?? ""} />
        </Field>
        <Field label="Kota">
          <Input name="city" defaultValue={values?.city ?? ""} />
        </Field>
        <Field label="Negara">
          <Input name="country" defaultValue={values?.country ?? "Indonesia"} />
        </Field>
        <Field label="Status">
          <Select name="status" defaultValue={values?.status ?? "LEAD"}>
            {Object.entries(clientStatusLabel).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Tag" hint="Pisahkan dengan koma">
          <Input
            name="tags"
            defaultValue={(values?.tags ?? []).join(", ")}
            placeholder="retainer, prioritas"
          />
        </Field>
      </div>

      <Field label="Alamat">
        <Textarea name="address" rows={2} defaultValue={values?.address ?? ""} />
      </Field>
      <Field label="Catatan">
        <Textarea name="notes" rows={3} defaultValue={values?.notes ?? ""} />
      </Field>

      <div className="flex gap-2">
        <Button type="submit">{submitLabel}</Button>
        <LinkButton href={cancelHref} variant="secondary">
          Batal
        </LinkButton>
      </div>
    </form>
  );
}

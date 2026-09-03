import {
  Button,
  Field,
  Input,
  LinkButton,
  Select,
  Textarea,
} from "@/components/ui";
import { formatDateInput } from "@/lib/format";
import { projectStatusLabel } from "@/lib/labels";

type ProjectFormValues = {
  name?: string;
  code?: string | null;
  clientId?: string;
  dealId?: string | null;
  status?: string;
  startDate?: Date | string | null;
  endDate?: Date | string | null;
  budgetAmount?: unknown;
  budgetHours?: unknown;
  hourlyRate?: unknown;
  currency?: string;
  exchangeRate?: unknown;
  notes?: string | null;
};

export function ProjectForm({
  action,
  clients,
  deals,
  values,
  submitLabel,
  cancelHref,
  baseCurrency,
}: {
  action: (formData: FormData) => void | Promise<void>;
  clients: Array<{ id: string; name: string }>;
  deals: Array<{ id: string; title: string }>;
  values?: ProjectFormValues;
  submitLabel: string;
  cancelHref: string;
  baseCurrency: string;
}) {
  return (
    <form action={action} className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Nama proyek *">
          <Input name="name" required defaultValue={values?.name ?? ""} />
        </Field>
        <Field label="Kode" hint="Opsional, misalnya ACME-2026-01">
          <Input name="code" defaultValue={values?.code ?? ""} />
        </Field>
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
        <Field label="Deal asal">
          <Select name="dealId" defaultValue={values?.dealId ?? ""}>
            <option value="">Tanpa deal</option>
            {deals.map((deal) => (
              <option key={deal.id} value={deal.id}>
                {deal.title}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label="Status">
          <Select name="status" defaultValue={values?.status ?? "ACTIVE"}>
            {Object.entries(projectStatusLabel).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Mulai">
          <Input
            name="startDate"
            type="date"
            defaultValue={formatDateInput(values?.startDate)}
          />
        </Field>
        <Field label="Target selesai">
          <Input
            name="endDate"
            type="date"
            defaultValue={formatDateInput(values?.endDate)}
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Tarif per jam" hint="Dipakai saat mencatat waktu">
          <Input
            name="hourlyRate"
            type="number"
            step="0.01"
            min="0"
            defaultValue={Number(values?.hourlyRate ?? 0)}
          />
        </Field>
        <Field label="Anggaran nilai" hint="Kosongkan kalau tanpa batas">
          <Input
            name="budgetAmount"
            type="number"
            step="0.01"
            min="0"
            defaultValue={
              values?.budgetAmount == null ? "" : Number(values.budgetAmount)
            }
          />
        </Field>
        <Field label="Anggaran jam">
          <Input
            name="budgetHours"
            type="number"
            step="0.01"
            min="0"
            defaultValue={
              values?.budgetHours == null ? "" : Number(values.budgetHours)
            }
          />
        </Field>
        <Field label="Mata uang">
          <Select name="currency" defaultValue={values?.currency ?? baseCurrency}>
            <option value="IDR">IDR</option>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
            <option value="SGD">SGD</option>
          </Select>
        </Field>
      </div>

      <Field
        label={`Kurs ke ${baseCurrency}`}
        hint={`Isi 1 kalau proyek dalam ${baseCurrency}`}
        className="max-w-[220px]"
      >
        <Input
          name="exchangeRate"
          type="number"
          step="0.000001"
          min="0"
          defaultValue={Number(values?.exchangeRate ?? 1)}
        />
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

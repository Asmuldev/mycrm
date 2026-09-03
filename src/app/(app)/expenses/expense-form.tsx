import {
  Button,
  Field,
  Input,
  LinkButton,
  Select,
  Textarea,
} from "@/components/ui";
import { formatDateInput } from "@/lib/format";
import { expenseCategoryLabel } from "@/lib/labels";

type ExpenseFormValues = {
  spentOn?: Date | string | null;
  description?: string;
  category?: string;
  vendor?: string | null;
  amount?: unknown;
  currency?: string;
  exchangeRate?: unknown;
  billable?: boolean;
  clientId?: string | null;
  projectId?: string | null;
  notes?: string | null;
};

export function ExpenseForm({
  action,
  clients,
  projects,
  values,
  submitLabel,
  cancelHref,
  baseCurrency,
}: {
  action: (formData: FormData) => void | Promise<void>;
  clients: Array<{ id: string; name: string }>;
  projects: Array<{ id: string; name: string }>;
  values?: ExpenseFormValues;
  submitLabel: string;
  cancelHref: string;
  baseCurrency: string;
}) {
  return (
    <form action={action} className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Tanggal">
          <Input
            name="spentOn"
            type="date"
            defaultValue={formatDateInput(values?.spentOn ?? new Date())}
          />
        </Field>
        <Field label="Kategori">
          <Select name="category" defaultValue={values?.category ?? "LAINNYA"}>
            {Object.entries(expenseCategoryLabel).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label="Keterangan *">
        <Input
          name="description"
          required
          defaultValue={values?.description ?? ""}
          placeholder="Lisensi Figma tahunan"
        />
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Nominal *">
          <Input
            name="amount"
            type="number"
            step="0.01"
            min="0"
            required
            defaultValue={Number(values?.amount ?? 0)}
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
        <Field label={`Kurs ke ${baseCurrency}`}>
          <Input
            name="exchangeRate"
            type="number"
            step="0.000001"
            min="0"
            defaultValue={Number(values?.exchangeRate ?? 1)}
          />
        </Field>
        <Field label="Vendor">
          <Input name="vendor" defaultValue={values?.vendor ?? ""} />
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Klien">
          <Select name="clientId" defaultValue={values?.clientId ?? ""}>
            <option value="">Biaya umum</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Proyek">
          <Select name="projectId" defaultValue={values?.projectId ?? ""}>
            <option value="">Tanpa proyek</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          name="billable"
          defaultChecked={values?.billable ?? false}
          className="rounded"
        />
        Tagihkan ulang ke klien
      </label>

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

import { Button, Field, Input, LinkButton, Select, Textarea } from "@/components/ui";
import { formatDateInput } from "@/lib/format";
import { dealStageLabel, dealStages } from "@/lib/labels";

type DealFormValues = {
  title?: string;
  clientId?: string;
  value?: unknown;
  currency?: string;
  stage?: string;
  probability?: number;
  expectedCloseDate?: Date | null;
  notes?: string | null;
  exchangeRate?: unknown;
};

export function DealForm({
  action,
  clients,
  values,
  submitLabel,
  cancelHref,
  baseCurrency,
}: {
  action: (formData: FormData) => void | Promise<void>;
  clients: Array<{ id: string; name: string }>;
  values?: DealFormValues;
  submitLabel: string;
  cancelHref: string;
  baseCurrency: string;
}) {
  return (
    <form action={action} className="space-y-5">
      <Field label="Judul deal *">
        <Input name="title" required defaultValue={values?.title ?? ""} />
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
        <Field label="Tahap">
          <Select name="stage" defaultValue={values?.stage ?? "LEAD"}>
            {dealStages.map((stage) => (
              <option key={stage} value={stage}>
                {dealStageLabel[stage]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Nilai">
          <Input
            name="value"
            type="number"
            step="0.01"
            min="0"
            defaultValue={Number(values?.value ?? 0)}
          />
        </Field>
        <Field label="Mata uang">
          <Select name="currency" defaultValue={values?.currency ?? "IDR"}>
            <option value="IDR">IDR</option>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
            <option value="SGD">SGD</option>
          </Select>
        </Field>
        <Field
          label={`Kurs ke ${baseCurrency}`}
          hint={`Isi 1 kalau deal dalam ${baseCurrency}`}
        >
          <Input
            name="exchangeRate"
            type="number"
            step="0.000001"
            min="0"
            defaultValue={Number(values?.exchangeRate ?? 1)}
          />
        </Field>
        <Field label="Probabilitas (%)">
          <Input
            name="probability"
            type="number"
            min="0"
            max="100"
            defaultValue={values?.probability ?? 10}
          />
        </Field>
        <Field label="Target tutup">
          <Input
            name="expectedCloseDate"
            type="date"
            defaultValue={formatDateInput(values?.expectedCloseDate)}
          />
        </Field>
      </div>

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

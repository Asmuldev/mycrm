import {
  Button,
  Field,
  Input,
  LinkButton,
  Select,
  Textarea,
} from "@/components/ui";
import { serviceStatusLabel } from "@/lib/labels";

type ServiceFormValues = {
  clientId?: string;
  serverNodeId?: string | null;
  remoteId?: string | null;
  remoteName?: string | null;
  name?: string;
  domain?: string | null;
  status?: string;
  recurringInvoiceId?: string | null;
  notes?: string | null;
};

export function ServiceForm({
  action,
  clients,
  servers,
  subscriptions,
  sites,
  values,
  submitLabel,
  cancelHref,
  locked,
}: {
  action: (formData: FormData) => void | Promise<void>;
  clients: Array<{ id: string; name: string }>;
  servers: Array<{ id: string; name: string }>;
  subscriptions: Array<{ id: string; title: string; clientName: string }>;
  sites?: Array<{ id: string; name: string; running: boolean }>;
  values?: ServiceFormValues;
  submitLabel: string;
  cancelHref: string;
  /** Mapping to a panel site is fixed after creation. */
  locked?: boolean;
}) {
  return (
    <form action={action} className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Klien *">
          <Select
            name="clientId"
            required
            defaultValue={values?.clientId ?? ""}
            disabled={locked}
          >
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
        <Field label="Nama layanan *" hint="Misalnya: Hosting mifapeduli.com">
          <Input name="name" required defaultValue={values?.name ?? ""} />
        </Field>
        <Field label="Domain">
          <Input name="domain" defaultValue={values?.domain ?? ""} />
        </Field>
        <Field label="Status">
          <Select name="status" defaultValue={values?.status ?? "ACTIVE"}>
            {Object.entries(serviceStatusLabel).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {locked ? null : (
        <div className="rounded-xl border border-slate-200 p-4">
          <p className="mb-3 text-xs font-medium text-slate-700">
            Hubungkan ke situs di panel
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Server">
              <Select name="serverNodeId" defaultValue={values?.serverNodeId ?? ""}>
                <option value="">Tanpa server</option>
                {servers.map((server) => (
                  <option key={server.id} value={server.id}>
                    {server.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Situs" hint="Daftar situs yang belum dipetakan">
              <Select name="remoteId" defaultValue={values?.remoteId ?? ""}>
                <option value="">Tanpa situs</option>
                {(sites ?? []).map((site) => (
                  <option key={site.id} value={site.id}>
                    {site.name}
                    {site.running ? "" : " (berhenti)"}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Pemetaan ini tidak bisa diubah setelah tersimpan. Kalau salah, hapus
            layanannya dan buat ulang.
          </p>
        </div>
      )}

      <Field label="Langganan penagih" hint="Invoice berulang yang menagih layanan ini">
        <Select
          name="recurringInvoiceId"
          defaultValue={values?.recurringInvoiceId ?? ""}
        >
          <option value="">Belum dihubungkan</option>
          {subscriptions.map((subscription) => (
            <option key={subscription.id} value={subscription.id}>
              {subscription.title} · {subscription.clientName}
            </option>
          ))}
        </Select>
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

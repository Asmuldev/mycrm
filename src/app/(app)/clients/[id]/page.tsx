import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatDate, formatMoney } from "@/lib/format";
import {
  activityTypeLabel,
  clientStatusLabel,
  dealStageLabel,
  invoiceStatusLabel,
  taskStatusLabel,
} from "@/lib/labels";
import {
  Badge,
  Card,
  CardHeader,
  EmptyState,
  Field,
  Input,
  LinkButton,
  PageHeader,
  Select,
  Textarea,
} from "@/components/ui";
import { getCompanyProfile } from "@/lib/invoice";
import { invoiceBalance, toBaseAmount } from "@/lib/money";
import { ActionButton } from "@/components/action-button";
import { ConfirmButton } from "@/components/confirm-button";
import { SubmitButton } from "@/components/submit-button";
import { AttachmentsCard } from "@/components/attachments-card";
import { requireSession } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import { quoteStatusLabel } from "@/lib/labels";
import { CustomFieldsCard } from "@/components/custom-fields-card";
import { formatDateInput } from "@/lib/format";
import {
  applyClientCredit,
  createActivity,
  createContact,
  deleteClient,
  deleteClientCredit,
  deleteContact,
  recordClientCredit,
  revokePortalLink,
} from "../actions";
import { PortalLinkCard } from "./portal-card";

export const dynamic = "force-dynamic";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireSession();
  const profile = await getCompanyProfile();
  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      quotes: { where: { deletedAt: null }, orderBy: { issueDate: "desc" } },
      projects: { where: { deletedAt: null }, orderBy: { updatedAt: "desc" } },
      services: { where: { deletedAt: null }, orderBy: { name: "asc" } },
      credits: {
        orderBy: { receivedAt: "desc" },
        include: { applications: true },
      },
      portalTokens: { orderBy: { createdAt: "desc" } },
      attachments: { orderBy: { createdAt: "desc" } },
      contacts: { orderBy: [{ isPrimary: "desc" }, { name: "asc" }] },
      deals: { where: { deletedAt: null }, orderBy: { updatedAt: "desc" } },
      invoices: { where: { deletedAt: null }, orderBy: { issueDate: "desc" } },
      tasks: {
        where: { status: { not: "DONE" } },
        orderBy: [{ dueDate: "asc" }],
      },
      activities: { orderBy: { occurredAt: "desc" }, take: 30 },
    },
  });

  if (!client || client.deletedAt) notFound();

  const outstanding = client.invoices
    .filter((invoice) => invoice.status !== "CANCELLED")
    .reduce(
      (sum, invoice) =>
        sum +
        toBaseAmount(
          invoiceBalance(invoice),
          invoice.exchangeRate,
        ),
      0,
    );
  const openPipeline = client.deals
    .filter((deal) => deal.stage !== "WON" && deal.stage !== "LOST")
    .reduce((sum, deal) => sum + toBaseAmount(deal.value, deal.exchangeRate), 0);

  const deleteThisClient = deleteClient.bind(null, client.id);
  const addContact = createContact.bind(null, client.id);
  const addActivity = createActivity.bind(null, client.id);
  const addCredit = recordClientCredit.bind(null, client.id);
  const openInvoices = client.invoices.filter(
    (invoice) =>
      invoice.status !== "CANCELLED" &&
      Number(invoice.total) -
        Number(invoice.amountPaid) -
        Number(invoice.creditedAmount) >
        0,
  );
  const appUrl = process.env.APP_URL?.replace(/\/$/, "") ?? "http://localhost:3000";

  return (
    <div>
      <PageHeader
        title={client.name}
        description={client.company ?? undefined}
        action={
          <div className="flex flex-wrap gap-2">
            <LinkButton
              href={`/quotes/new?clientId=${client.id}`}
              variant="secondary"
            >
              Buat penawaran
            </LinkButton>
            <LinkButton
              href={`/invoices/new?clientId=${client.id}`}
              variant="secondary"
            >
              Buat invoice
            </LinkButton>
            <LinkButton href={`/clients/${client.id}/edit`} variant="secondary">
              Edit
            </LinkButton>
            {isAdmin(session) ? (
              <ActionButton
                action={deleteThisClient}
                message={`Pindahkan klien "${client.name}" ke sampah? Invoice, penawaran, dan proyeknya tetap tersimpan, dan klien bisa dipulihkan lagi.`}
              >
                Hapus
              </ActionButton>
            ) : null}
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-1">
          <Card>
            <CardHeader title="Profil" />
            <dl className="space-y-3 px-5 py-4 text-sm">
              <Row label="Status">
                <Badge
                  value={client.status}
                  label={clientStatusLabel[client.status]}
                />
              </Row>
              <Row label="Email">{client.email ?? "-"}</Row>
              <Row label="Telepon">{client.phone ?? "-"}</Row>
              <Row label="Website">{client.website ?? "-"}</Row>
              <Row label="NPWP">{client.taxId ?? "-"}</Row>
              <Row label="Alamat">
                {[client.address, client.city, client.country]
                  .filter(Boolean)
                  .join(", ") || "-"}
              </Row>
              <Row label="Piutang">
                <span className="font-medium">
                  {formatMoney(outstanding, profile.currency)}
                </span>
              </Row>
              <Row label="Pipeline">
                {formatMoney(openPipeline, profile.currency)}
              </Row>
            </dl>
            {client.tags.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 border-t border-slate-100 px-5 py-3">
                {client.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            ) : null}
            {client.notes ? (
              <p className="border-t border-slate-100 px-5 py-3 text-sm whitespace-pre-wrap text-slate-600">
                {client.notes}
              </p>
            ) : null}
          </Card>

          <Card>
            <CardHeader title="Kontak" />
            {client.contacts.length === 0 ? (
              <EmptyState title="Belum ada kontak" />
            ) : (
              <ul className="divide-y divide-slate-100">
                {client.contacts.map((contact) => {
                  const removeContact = deleteContact.bind(
                    null,
                    client.id,
                    contact.id,
                  );
                  return (
                    <li
                      key={contact.id}
                      className="flex items-start justify-between gap-3 px-5 py-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-800">
                          {contact.name}
                          {contact.isPrimary ? (
                            <span className="ml-2 rounded-full bg-slate-900 px-1.5 py-0.5 text-[10px] font-medium text-white">
                              utama
                            </span>
                          ) : null}
                        </p>
                        <p className="text-xs text-slate-500">
                          {contact.position ?? "-"}
                        </p>
                        <p className="text-xs text-slate-500">
                          {[contact.email, contact.phone]
                            .filter(Boolean)
                            .join(" · ") || "-"}
                        </p>
                      </div>
                      <form action={removeContact}>
                        <ConfirmButton
                          message={`Hapus kontak "${contact.name}"?`}
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
              action={addContact}
              className="space-y-3 border-t border-slate-100 px-5 py-4"
            >
              <Field label="Nama kontak">
                <Input name="name" required placeholder="Nama" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Email">
                  <Input name="email" type="email" />
                </Field>
                <Field label="Telepon">
                  <Input name="phone" />
                </Field>
              </div>
              <Field label="Jabatan">
                <Input name="position" />
              </Field>
              <label className="flex items-center gap-2 text-xs text-slate-600">
                <input type="checkbox" name="isPrimary" className="rounded" />
                Jadikan kontak utama
              </label>
              <SubmitButton variant="secondary">+ Tambah kontak</SubmitButton>
            </form>
          </Card>
        </div>

        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader
              title="Deal"
              action={
                <LinkButton
                  href={`/deals/new?clientId=${client.id}`}
                  variant="secondary"
                  className="px-2 py-1 text-xs"
                >
                  + Deal
                </LinkButton>
              }
            />
            {client.deals.length === 0 ? (
              <EmptyState title="Belum ada deal" />
            ) : (
              <ul className="divide-y divide-slate-100">
                {client.deals.map((deal) => (
                  <li
                    key={deal.id}
                    className="flex items-center justify-between gap-3 px-5 py-3"
                  >
                    <div className="min-w-0">
                      <Link
                        href={`/deals/${deal.id}`}
                        className="text-sm font-medium text-slate-800 hover:underline"
                      >
                        {deal.title}
                      </Link>
                      <p className="text-xs text-slate-500">
                        {deal.expectedCloseDate
                          ? `Target ${formatDate(deal.expectedCloseDate)}`
                          : "Tanpa target tutup"}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="text-sm text-slate-700">
                        {formatMoney(deal.value, deal.currency)}
                      </span>
                      <Badge
                        value={deal.stage}
                        label={dealStageLabel[deal.stage]}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader
              title="Penawaran"
              action={
                <LinkButton
                  href={`/quotes/new?clientId=${client.id}`}
                  variant="secondary"
                  className="px-2 py-1 text-xs"
                >
                  + Penawaran
                </LinkButton>
              }
            />
            {client.quotes.length === 0 ? (
              <EmptyState title="Belum ada penawaran" />
            ) : (
              <ul className="divide-y divide-slate-100">
                {client.quotes.map((quote) => (
                  <li
                    key={quote.id}
                    className="flex items-center justify-between gap-3 px-5 py-3"
                  >
                    <div className="min-w-0">
                      <Link
                        href={`/quotes/${quote.id}`}
                        className="text-sm font-medium text-slate-800 hover:underline"
                      >
                        {quote.number}
                      </Link>
                      <p className="text-xs text-slate-500">
                        Berlaku sampai {formatDate(quote.validUntil)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="text-sm text-slate-700">
                        {formatMoney(quote.total, quote.currency)}
                      </span>
                      <Badge
                        value={quote.status}
                        label={quoteStatusLabel[quote.status]}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader
              title="Invoice"
              action={
                <LinkButton
                  href={`/invoices/new?clientId=${client.id}`}
                  variant="secondary"
                  className="px-2 py-1 text-xs"
                >
                  + Invoice
                </LinkButton>
              }
            />
            {client.invoices.length === 0 ? (
              <EmptyState title="Belum ada invoice" />
            ) : (
              <ul className="divide-y divide-slate-100">
                {client.invoices.map((invoice) => (
                  <li
                    key={invoice.id}
                    className="flex items-center justify-between gap-3 px-5 py-3"
                  >
                    <div className="min-w-0">
                      <Link
                        href={`/invoices/${invoice.id}`}
                        className="text-sm font-medium text-slate-800 hover:underline"
                      >
                        {invoice.number}
                      </Link>
                      <p className="text-xs text-slate-500">
                        Terbit {formatDate(invoice.issueDate)} · jatuh tempo{" "}
                        {formatDate(invoice.dueDate)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="text-sm text-slate-700">
                        {formatMoney(invoice.total, invoice.currency)}
                      </span>
                      <Badge
                        value={invoice.status}
                        label={invoiceStatusLabel[invoice.status]}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title="Tugas terbuka" />
            {client.tasks.length === 0 ? (
              <EmptyState title="Tidak ada tugas terbuka" />
            ) : (
              <ul className="divide-y divide-slate-100">
                {client.tasks.map((task) => (
                  <li
                    key={task.id}
                    className="flex items-center justify-between gap-3 px-5 py-3"
                  >
                    <div>
                      <p className="text-sm text-slate-800">{task.title}</p>
                      <p className="text-xs text-slate-500">
                        {task.dueDate ? formatDate(task.dueDate) : "tanpa deadline"}
                      </p>
                    </div>
                    <Badge
                      value={task.status}
                      label={taskStatusLabel[task.status]}
                    />
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader
              title="Proyek"
              action={
                <LinkButton
                  href={`/projects/new?clientId=${client.id}`}
                  variant="secondary"
                  className="px-2 py-1 text-xs"
                >
                  + Proyek
                </LinkButton>
              }
            />
            {client.projects.length === 0 ? (
              <EmptyState title="Belum ada proyek" />
            ) : (
              <ul className="divide-y divide-slate-100">
                {client.projects.map((project) => (
                  <li
                    key={project.id}
                    className="flex items-center justify-between gap-3 px-5 py-3"
                  >
                    <Link
                      href={`/projects/${project.id}`}
                      className="text-sm font-medium text-slate-800 hover:underline"
                    >
                      {project.name}
                    </Link>
                    <Badge value={project.status} label={project.status} />
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader
              title="Layanan"
              action={
                <LinkButton
                  href={`/services/new?clientId=${client.id}`}
                  variant="secondary"
                  className="px-2 py-1 text-xs"
                >
                  + Layanan
                </LinkButton>
              }
            />
            {client.services.length === 0 ? (
              <EmptyState title="Belum ada layanan" />
            ) : (
              <ul className="divide-y divide-slate-100">
                {client.services.map((service) => (
                  <li
                    key={service.id}
                    className="flex items-center justify-between gap-3 px-5 py-3"
                  >
                    <div className="min-w-0">
                      <Link
                        href={`/services/${service.id}`}
                        className="text-sm font-medium text-slate-800 hover:underline"
                      >
                        {service.name}
                      </Link>
                      <p className="text-xs text-slate-500">
                        {service.domain ?? "-"}
                      </p>
                    </div>
                    <Badge value={service.status} label={service.status} />
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader
              title="Uang muka"
              description="Uang yang diterima sebelum ada invoice, dipakai lintas invoice"
            />
            {client.credits.length === 0 ? (
              <EmptyState title="Belum ada uang muka" />
            ) : (
              <ul className="divide-y divide-slate-100">
                {client.credits.map((credit) => {
                  const apply = applyClientCredit.bind(null, credit.id);
                  const removeCredit = deleteClientCredit.bind(null, credit.id);
                  const remaining = Number(credit.remaining);

                  return (
                    <li key={credit.id} className="px-5 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-slate-800">
                            {formatMoney(credit.amount, credit.currency)}
                            <span className="ml-2 text-xs text-slate-500">
                              sisa {formatMoney(remaining, credit.currency)}
                            </span>
                          </p>
                          <p className="text-xs text-slate-500">
                            {formatDate(credit.receivedAt)} · {credit.method}
                            {credit.reference ? ` · ${credit.reference}` : ""}
                          </p>
                        </div>
                        <ActionButton
                          action={removeCredit}
                          message="Hapus catatan uang muka ini?"
                          variant="ghost"
                          className="px-2 py-1 text-xs text-rose-600"
                        >
                          Hapus
                        </ActionButton>
                      </div>

                      {remaining > 0 && openInvoices.length > 0 ? (
                        <form
                          action={apply}
                          className="mt-2 flex flex-wrap items-end gap-2"
                        >
                          <label className="min-w-[180px] flex-1">
                            <span className="mb-1 block text-xs text-slate-500">
                              Pakai untuk invoice
                            </span>
                            <Select name="invoiceId" required defaultValue="">
                              <option value="" disabled>
                                Pilih invoice
                              </option>
                              {openInvoices.map((invoice) => (
                                <option key={invoice.id} value={invoice.id}>
                                  {invoice.number}
                                </option>
                              ))}
                            </Select>
                          </label>
                          <label className="w-32">
                            <span className="mb-1 block text-xs text-slate-500">
                              Nominal
                            </span>
                            <Input
                              name="amount"
                              type="number"
                              step="0.01"
                              min="0"
                              defaultValue={remaining.toFixed(2)}
                            />
                          </label>
                          <SubmitButton
                            variant="secondary"
                            className="px-2 py-1 text-xs"
                          >
                            Pakai
                          </SubmitButton>
                        </form>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
            <form
              action={addCredit}
              className="grid grid-cols-1 gap-3 border-t border-slate-100 px-5 py-4 sm:grid-cols-3"
            >
              <Field label="Nominal">
                <Input name="amount" type="number" step="0.01" min="0" required />
              </Field>
              <Field label="Tanggal terima">
                <Input
                  name="receivedAt"
                  type="date"
                  defaultValue={formatDateInput(new Date())}
                />
              </Field>
              <Field label="Referensi">
                <Input name="reference" placeholder="No. transfer" />
              </Field>
              <div className="sm:col-span-3">
                <SubmitButton variant="secondary">+ Catat uang muka</SubmitButton>
              </div>
            </form>
          </Card>

          <PortalLinkCard clientId={client.id} appUrl={appUrl}>
            {client.portalTokens.length === 0 ? null : (
              <ul className="divide-y divide-slate-100">
                {client.portalTokens.map((portalToken) => {
                  const revoke = revokePortalLink.bind(
                    null,
                    client.id,
                    portalToken.id,
                  );
                  const inactive =
                    portalToken.revokedAt !== null ||
                    (portalToken.expiresAt !== null &&
                      portalToken.expiresAt < new Date());

                  return (
                    <li
                      key={portalToken.id}
                      className="flex items-center justify-between gap-3 px-5 py-3"
                    >
                      <div>
                        <p className="text-sm text-slate-800">
                          {portalToken.label}
                          {inactive ? (
                            <span className="ml-2 text-xs text-slate-400">
                              (tidak aktif)
                            </span>
                          ) : null}
                        </p>
                        <p className="text-xs text-slate-500">
                          Dibuat {formatDate(portalToken.createdAt)}
                          {portalToken.lastUsedAt
                            ? ` · terakhir dibuka ${formatDate(portalToken.lastUsedAt)}`
                            : " · belum pernah dibuka"}
                        </p>
                      </div>
                      {inactive ? null : (
                        <form action={revoke}>
                          <ConfirmButton
                            message="Cabut tautan portal ini? Klien tidak bisa membukanya lagi."
                            variant="ghost"
                            className="px-2 py-1 text-xs text-rose-600"
                          >
                            Cabut
                          </ConfirmButton>
                        </form>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </PortalLinkCard>

          <CustomFieldsCard
            entity="CLIENT"
            entityId={client.id}
            revalidate={`/clients/${client.id}`}
          />

          <AttachmentsCard
            clientId={client.id}
            revalidate={`/clients/${client.id}`}
            attachments={client.attachments.map((attachment) => ({
              id: attachment.id,
              filename: attachment.filename,
              size: attachment.size,
              createdAt: attachment.createdAt.toISOString(),
            }))}
          />

          <Card>
            <CardHeader title="Aktivitas" />
            <form
              action={addActivity}
              className="space-y-3 border-b border-slate-100 px-5 py-4"
            >
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Field label="Tipe">
                  <Select name="type" defaultValue="NOTE">
                    {Object.entries(activityTypeLabel).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Judul" className="sm:col-span-2">
                  <Input name="subject" placeholder="Ringkasan singkat" />
                </Field>
              </div>
              <Field label="Isi">
                <Textarea name="content" rows={3} required />
              </Field>
              <SubmitButton variant="secondary">+ Catat aktivitas</SubmitButton>
            </form>
            {client.activities.length === 0 ? (
              <EmptyState title="Belum ada aktivitas" />
            ) : (
              <ul className="divide-y divide-slate-100">
                {client.activities.map((activity) => (
                  <li key={activity.id} className="px-5 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Badge
                          value={activity.type}
                          label={activityTypeLabel[activity.type]}
                        />
                        <span className="text-sm font-medium text-slate-800">
                          {activity.subject ?? "-"}
                        </span>
                      </div>
                      <span className="shrink-0 text-xs text-slate-400">
                        {formatDate(activity.occurredAt)}
                      </span>
                    </div>
                    <p className="mt-1 text-sm whitespace-pre-wrap text-slate-600">
                      {activity.content}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="text-right text-sm text-slate-800">{children}</dd>
    </div>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { invoiceStatusLabel, serviceStatusLabel } from "@/lib/labels";
import { invoiceBalance } from "@/lib/money";
import { formatBytes } from "@/lib/services";
import { requireSession } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import {
  Badge,
  Card,
  CardHeader,
  EmptyState,
  LinkButton,
  PageHeader,
} from "@/components/ui";
import { ActionButton } from "@/components/action-button";
import { CustomFieldsCard } from "@/components/custom-fields-card";
import {
  deleteService,
  resumeServiceNow,
  suspendServiceNow,
  syncService,
  toggleSuspendExempt,
} from "../actions";
import { getCompanyProfile } from "@/lib/invoice";

export const dynamic = "force-dynamic";

export default async function ServiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireSession();

  const service = await prisma.service.findUnique({
    where: { id },
    include: {
      client: { select: { id: true, name: true } },
      serverNode: { select: { id: true, name: true, baseUrl: true } },
      recurringInvoice: {
        select: { id: true, title: true, nextRunAt: true, active: true },
      },
    },
  });
  if (!service || service.deletedAt) notFound();

  // Invoices are matched through the subscription that bills this service.
  const invoices = service.recurringInvoiceId
    ? await prisma.invoice.findMany({
        where: { recurringInvoiceId: service.recurringInvoiceId },
        orderBy: { issueDate: "desc" },
        take: 6,
      })
    : [];

  const profile = await getCompanyProfile();
  const sync = syncService.bind(null, service.id);
  const remove = deleteService.bind(null, service.id);
  const suspend = suspendServiceNow.bind(null, service.id);
  const resume = resumeServiceNow.bind(null, service.id);
  const toggleExempt = toggleSuspendExempt.bind(null, service.id);
  const controllable = Boolean(service.serverNodeId && service.remoteId);

  return (
    <div className="max-w-4xl">
      <PageHeader
        title={service.name}
        description={`${service.client.name}${service.domain ? ` · ${service.domain}` : ""}`}
        action={
          <div className="flex flex-wrap gap-2">
            <ActionButton
              action={sync}
              variant="secondary"
              pendingLabel="Menyinkronkan..."
            >
              Sinkronkan
            </ActionButton>
            <LinkButton href={`/services/${service.id}/edit`} variant="secondary">
              Edit
            </LinkButton>
            {isAdmin(session) ? (
              <ActionButton
                action={remove}
                message={`Pindahkan layanan "${service.name}" ke sampah? Situs di server tidak ikut terhapus.`}
              >
                Hapus
              </ActionButton>
            ) : null}
          </div>
        }
      />

      {service.suspendedAt ? (
        <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Ditangguhkan {formatDateTime(service.suspendedAt)}
          {service.suspendReason ? ` · ${service.suspendReason}` : ""}
        </p>
      ) : null}

      {service.syncError ? (
        <p className="mb-4 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {service.syncError}
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs text-slate-500">Status tagihan</p>
          <p className="mt-1">
            <Badge
              value={service.status}
              label={serviceStatusLabel[service.status]}
            />
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-slate-500">Keadaan di panel</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">
            {service.remoteRunning === null
              ? "Belum sinkron"
              : service.remoteRunning
                ? "Berjalan"
                : "Berhenti"}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-slate-500">Pemakaian disk</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">
            {formatBytes(service.diskUsedBytes)}
          </p>
          {service.diskQuotaBytes ? (
            <p className="text-xs text-slate-400">
              dari {formatBytes(service.diskQuotaBytes)}
            </p>
          ) : (
            <p className="text-xs text-slate-400">tanpa kuota</p>
          )}
        </Card>
        <Card className="p-4">
          <p className="text-xs text-slate-500">Sertifikat SSL</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">
            {service.sslExpiresAt ? formatDate(service.sslExpiresAt) : "-"}
          </p>
          <p className="text-xs text-slate-400">
            {service.sslIssuer ?? "tidak ada sertifikat"}
          </p>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader
              title="Penagihan"
              description="Invoice yang terbit dari langganan layanan ini"
            />
            {!service.recurringInvoice ? (
              <EmptyState
                title="Belum dihubungkan ke langganan"
                description="Hubungkan ke invoice berulang supaya penagihannya otomatis."
                action={
                  <LinkButton
                    href={`/services/${service.id}/edit`}
                    variant="secondary"
                    className="mt-2"
                  >
                    Hubungkan langganan
                  </LinkButton>
                }
              />
            ) : (
              <>
                <div className="border-b border-slate-100 px-5 py-3 text-sm">
                  <Link
                    href={`/recurring/${service.recurringInvoice.id}`}
                    className="font-medium text-slate-800 hover:underline"
                  >
                    {service.recurringInvoice.title}
                  </Link>
                  <p className="text-xs text-slate-500">
                    {service.recurringInvoice.active
                      ? `Terbit berikutnya ${formatDate(service.recurringInvoice.nextRunAt)}`
                      : "Langganan sedang dijeda"}
                  </p>
                </div>
                {invoices.length === 0 ? (
                  <EmptyState title="Belum ada invoice terbit" />
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {invoices.map((invoice) => (
                      <li
                        key={invoice.id}
                        className="flex items-center justify-between gap-3 px-5 py-3"
                      >
                        <div>
                          <Link
                            href={`/invoices/${invoice.id}`}
                            className="text-sm font-medium text-slate-800 hover:underline"
                          >
                            {invoice.number}
                          </Link>
                          <p className="text-xs text-slate-500">
                            Jatuh tempo {formatDate(invoice.dueDate)} · sisa{" "}
                            {formatMoney(invoiceBalance(invoice), invoice.currency)}
                          </p>
                        </div>
                        <Badge
                          value={invoice.status}
                          label={invoiceStatusLabel[invoice.status]}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </Card>

          {service.notes ? (
            <Card>
              <CardHeader title="Catatan" />
              <p className="px-5 py-4 text-sm whitespace-pre-wrap text-slate-600">
                {service.notes}
              </p>
            </Card>
          ) : null}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader
              title="Kendali layanan"
              description="Menghentikan situs hanya menonaktifkan vhost; file dan database tetap utuh"
            />
            <div className="space-y-3 px-5 py-4">
              {controllable ? (
                <div className="flex flex-wrap gap-2">
                  {service.remoteRunning === false ? (
                    <ActionButton
                      action={resume}
                      variant="secondary"
                      className="px-2 py-1 text-xs"
                      pendingLabel="Mengaktifkan..."
                    >
                      Aktifkan situs
                    </ActionButton>
                  ) : (
                    <ActionButton
                      action={suspend}
                      message={`Hentikan situs ${service.domain ?? service.name}? Pengunjung akan melihat halaman error sampai diaktifkan lagi.`}
                      variant="secondary"
                      className="px-2 py-1 text-xs"
                      pendingLabel="Menangguhkan..."
                    >
                      Tangguhkan situs
                    </ActionButton>
                  )}
                  <ActionButton
                    action={toggleExempt}
                    variant="ghost"
                    className="px-2 py-1 text-xs"
                    pendingLabel="..."
                  >
                    {service.autoSuspendExempt
                      ? "Ikutkan penangguhan otomatis"
                      : "Kecualikan dari penangguhan otomatis"}
                  </ActionButton>
                </div>
              ) : (
                <p className="text-xs text-slate-500">
                  Layanan ini belum dipetakan ke situs di panel, jadi belum bisa
                  dikendalikan dari sini.
                </p>
              )}

              <p className="text-xs text-slate-500">
                {service.autoSuspendExempt
                  ? "Dikecualikan dari penangguhan otomatis."
                  : profile.autoSuspendEnabled
                    ? `Akan ditangguhkan otomatis kalau tagihan lewat ${profile.autoSuspendAfterDays} hari dari jatuh tempo.`
                    : "Penangguhan otomatis sedang nonaktif di Pengaturan."}
              </p>
            </div>
          </Card>

          <Card>
            <CardHeader title="Detail panel" />
            <dl className="space-y-3 px-5 py-4 text-sm">
              <Row label="Klien">
                <Link href={`/clients/${service.client.id}`} className="underline">
                  {service.client.name}
                </Link>
              </Row>
              <Row label="Server">
                {service.serverNode ? (
                  <Link href="/settings/servers" className="underline">
                    {service.serverNode.name}
                  </Link>
                ) : (
                  "-"
                )}
              </Row>
              <Row label="Nama situs">{service.remoteName ?? "-"}</Row>
              <Row label="ID situs">{service.remoteId ?? "-"}</Row>
              <Row label="Versi PHP">{service.phpVersion ?? "-"}</Row>
              <Row label="Kedaluwarsa di panel">
                {service.remoteExpiresAt
                  ? formatDate(service.remoteExpiresAt)
                  : "tanpa batas"}
              </Row>
              <Row label="Sinkron terakhir">
                {service.lastSyncedAt
                  ? formatDateTime(service.lastSyncedAt)
                  : "belum pernah"}
              </Row>
            </dl>
            <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
              Data di atas dibaca dari panel. Aplikasi ini belum mengubah apa pun
              di server.
            </p>
          </Card>

          <CustomFieldsCard
            entity="CLIENT"
            entityId={service.clientId}
            revalidate={`/services/${service.id}`}
          />
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

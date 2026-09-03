import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatDate, formatDateTime } from "@/lib/format";
import { serviceStatusLabel } from "@/lib/labels";
import { formatBytes } from "@/lib/services";
import { startOfDaysFromToday } from "@/lib/time";
import { PAGE_SIZE, Pagination, readPage } from "@/components/pagination";
import {
  Badge,
  Card,
  EmptyState,
  LinkButton,
  PageHeader,
  Select,
  buttonClass,
} from "@/components/ui";
import type { Prisma, ServiceStatus } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

export default async function ServicesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const params = await searchParams;
  const page = readPage(params.page);
  const status = params.status ?? "";

  const where: Prisma.ServiceWhereInput = {};
  if (status && status in serviceStatusLabel) {
    where.status = status as ServiceStatus;
  }

  const sslCutoff = startOfDaysFromToday(21);
  const [total, services, expiringSoon] = await Promise.all([
    prisma.service.count({ where }),
    prisma.service.findMany({
      where,
      orderBy: [{ status: "asc" }, { name: "asc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        client: { select: { id: true, name: true } },
        serverNode: { select: { id: true, name: true } },
      },
    }),
    prisma.service.count({
      where: { deletedAt: null, sslExpiresAt: { not: null, lte: sslCutoff } },
    }),
  ]);

  return (
    <div>
      <PageHeader
        title="Layanan"
        description={`${total} layanan klien`}
        action={<LinkButton href="/services/new">+ Layanan baru</LinkButton>}
      />

      {expiringSoon > 0 ? (
        <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {expiringSoon} sertifikat SSL akan kedaluwarsa dalam 21 hari ke depan.
        </p>
      ) : null}

      <Card className="mb-4 p-4">
        <form className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Status
            </label>
            <Select name="status" defaultValue={status}>
              <option value="">Semua</option>
              {Object.entries(serviceStatusLabel).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </div>
          <button type="submit" className={buttonClass("secondary")}>
            Terapkan
          </button>
          {status ? (
            <Link href="/services" className={buttonClass("ghost")}>
              Reset
            </Link>
          ) : null}
        </form>
      </Card>

      <Card>
        {services.length === 0 ? (
          <EmptyState
            title="Belum ada layanan"
            description="Hubungkan situs yang sudah ada di aaPanel ke klien yang membayarnya."
            action={
              <LinkButton href="/services/new" className="mt-2">
                Tambah layanan
              </LinkButton>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-medium">Layanan</th>
                  <th className="px-5 py-3 font-medium">Klien</th>
                  <th className="px-5 py-3 font-medium">Server</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Di panel</th>
                  <th className="px-5 py-3 font-medium">Disk</th>
                  <th className="px-5 py-3 font-medium">SSL</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {services.map((service) => {
                  const sslSoon =
                    service.sslExpiresAt !== null &&
                    service.sslExpiresAt <= sslCutoff;

                  return (
                    <tr key={service.id} className="hover:bg-slate-50">
                      <td className="px-5 py-3">
                        <Link
                          href={`/services/${service.id}`}
                          className="font-medium text-slate-900 hover:underline"
                        >
                          {service.name}
                        </Link>
                        {service.domain ? (
                          <p className="text-xs text-slate-500">
                            {service.domain}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-5 py-3">
                        <Link
                          href={`/clients/${service.client.id}`}
                          className="text-slate-600 hover:underline"
                        >
                          {service.client.name}
                        </Link>
                      </td>
                      <td className="px-5 py-3 text-slate-600">
                        {service.serverNode?.name ?? (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <Badge
                          value={service.status}
                          label={serviceStatusLabel[service.status]}
                        />
                      </td>
                      <td className="px-5 py-3 text-xs">
                        {service.syncError ? (
                          <span className="text-rose-700">
                            {service.syncError}
                          </span>
                        ) : service.remoteRunning === null ? (
                          <span className="text-slate-400">belum sinkron</span>
                        ) : service.remoteRunning ? (
                          <span className="text-emerald-700">berjalan</span>
                        ) : (
                          <span className="text-amber-700">berhenti</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-slate-600">
                        {formatBytes(service.diskUsedBytes)}
                        {service.diskQuotaBytes ? (
                          <span className="text-slate-400">
                            {" "}
                            / {formatBytes(service.diskQuotaBytes)}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-5 py-3 text-xs">
                        {service.sslExpiresAt ? (
                          <span
                            className={
                              sslSoon ? "text-amber-700" : "text-slate-600"
                            }
                          >
                            {formatDate(service.sslExpiresAt)}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Pagination
        basePath="/services"
        params={{ status }}
        page={page}
        total={total}
      />

      {services.some((service) => service.lastSyncedAt) ? (
        <p className="mt-3 text-xs text-slate-400">
          Sinkron terakhir{" "}
          {formatDateTime(
            services
              .map((service) => service.lastSyncedAt)
              .filter((value): value is Date => value !== null)
              .sort((a, b) => b.getTime() - a.getTime())[0],
          )}
        </p>
      ) : null}
    </div>
  );
}

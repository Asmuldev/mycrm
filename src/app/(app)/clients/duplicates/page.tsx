import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/format";
import { findDuplicateGroups } from "@/lib/duplicates";
import { requireSession } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import { Card, CardHeader, EmptyState, PageHeader, Select } from "@/components/ui";
import { ConfirmButton } from "@/components/confirm-button";
import { mergeClients } from "../actions";

export const dynamic = "force-dynamic";

export default async function DuplicateClientsPage() {
  const session = await requireSession();
  const admin = isAdmin(session);

  const clients = await prisma.client.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      company: true,
      email: true,
      phone: true,
      createdAt: true,
    },
  });

  const groups = findDuplicateGroups(clients);

  return (
    <div className="max-w-4xl">
      <PageHeader
        title="Klien ganda"
        description={
          admin
            ? `${groups.length} kemungkinan duplikat. Menggabungkan memindahkan semua data ke klien tujuan.`
            : `${groups.length} kemungkinan duplikat. Hanya admin yang bisa menggabungkan.`
        }
      />

      {groups.length === 0 ? (
        <Card>
          <EmptyState
            title="Tidak ada duplikat terdeteksi"
            description="Dicek berdasarkan email, nomor telepon, dan kemiripan nama."
          />
        </Card>
      ) : (
        groups.map((group) => (
          <Card key={group.key} className="mb-4">
            <CardHeader
              title={group.reason}
              description={`${group.clients.length} klien`}
            />
            <ul className="divide-y divide-slate-100">
              {group.clients.map((client) => (
                <li key={client.id} className="px-5 py-3">
                  <Link
                    href={`/clients/${client.id}`}
                    className="text-sm font-medium text-slate-800 hover:underline"
                  >
                    {client.name}
                  </Link>
                  <p className="text-xs text-slate-500">
                    {[client.company, client.email, client.phone]
                      .filter(Boolean)
                      .join(" · ") || "-"}{" "}
                    · dibuat {formatDate(client.createdAt)}
                  </p>
                </li>
              ))}
            </ul>

            {admin ? (
              <form
                action={mergeClients}
                className="grid grid-cols-1 gap-3 border-t border-slate-100 px-5 py-4 sm:grid-cols-3"
              >
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-slate-600">
                    Gabungkan dari
                  </span>
                  <Select name="sourceId" required defaultValue="">
                    <option value="" disabled>
                      Pilih klien
                    </option>
                    {group.clients.map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.name}
                      </option>
                    ))}
                  </Select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-slate-600">
                    Ke klien
                  </span>
                  <Select name="targetId" required defaultValue="">
                    <option value="" disabled>
                      Pilih klien
                    </option>
                    {group.clients.map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.name}
                      </option>
                    ))}
                  </Select>
                </label>
                <div className="flex items-end">
                  <ConfirmButton
                    message="Gabungkan klien ini? Semua invoice, deal, dan data lain pindah ke klien tujuan, dan klien asal masuk sampah."
                    variant="secondary"
                  >
                    Gabungkan
                  </ConfirmButton>
                </div>
              </form>
            ) : null}
          </Card>
        ))
      )}
    </div>
  );
}

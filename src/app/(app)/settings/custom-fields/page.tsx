import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import { customFieldEntityLabel, customFieldTypeLabel } from "@/lib/labels";
import { Card, CardHeader, EmptyState, PageHeader } from "@/components/ui";
import { ConfirmButton } from "@/components/confirm-button";
import { SubmitButton } from "@/components/submit-button";
import { deleteCustomField, toggleCustomField } from "./actions";
import { CustomFieldForm } from "./field-form";

export const dynamic = "force-dynamic";

export default async function CustomFieldsPage() {
  const session = await requireSession();
  const admin = isAdmin(session);

  const defs = await prisma.customFieldDef.findMany({
    orderBy: [{ entity: "asc" }, { position: "asc" }, { label: "asc" }],
    include: { _count: { select: { values: true } } },
  });

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Kolom kustom"
        description="Tambahkan field khas usaha Anda ke klien, deal, proyek, atau invoice"
      />

      <Card>
        <CardHeader title="Kolom terdaftar" description={`${defs.length} kolom`} />
        {defs.length === 0 ? (
          <EmptyState title="Belum ada kolom kustom" />
        ) : (
          <ul className="divide-y divide-slate-100">
            {defs.map((def) => {
              const toggle = toggleCustomField.bind(null, def.id);
              const remove = deleteCustomField.bind(null, def.id);

              return (
                <li
                  key={def.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-800">
                      {def.label}
                      {def.active ? null : (
                        <span className="ml-2 text-xs text-slate-400">
                          (nonaktif)
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-slate-500">
                      {customFieldEntityLabel[def.entity]} ·{" "}
                      {customFieldTypeLabel[def.type]} · kunci{" "}
                      <code>{def.key}</code> · {def._count.values} terisi
                    </p>
                  </div>
                  {admin ? (
                    <div className="flex gap-2">
                      <form action={toggle}>
                        <SubmitButton
                          variant="ghost"
                          className="px-2 py-1 text-xs"
                          pendingLabel="..."
                        >
                          {def.active ? "Nonaktifkan" : "Aktifkan"}
                        </SubmitButton>
                      </form>
                      <form action={remove}>
                        <ConfirmButton
                          message={`Hapus kolom "${def.label}"? Semua isian di kolom ini ikut terhapus.`}
                          variant="ghost"
                          className="px-2 py-1 text-xs text-rose-600"
                        >
                          Hapus
                        </ConfirmButton>
                      </form>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {admin ? (
        <Card className="mt-4">
          <CardHeader title="Tambah kolom" />
          <CustomFieldForm />
        </Card>
      ) : null}
    </div>
  );
}

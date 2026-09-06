import { getCompanyProfile } from "@/lib/invoice";
import { isEmailConfigured } from "@/lib/email";
import { isPaymentGatewayConfigured } from "@/lib/payment";
import { requireSession } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import {
  Card,
  CardHeader,
  Field,
  Input,
  PageHeader,
  Select,
  Textarea,
  buttonClass,
} from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { updateCompanyProfile } from "./actions";
import {
  DEFAULT_INVOICE_TEMPLATE,
  DEFAULT_QUOTE_TEMPLATE,
  DEFAULT_REMINDER_TEMPLATE,
  TEMPLATE_PLACEHOLDERS,
} from "@/lib/whatsapp";
import { AccountCard } from "./account-card";
import { LogoCard } from "./logo-card";
import { UsersCard } from "./users-card";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await requireSession();
  const admin = isAdmin(session);

  const [profile, users] = await Promise.all([
    getCompanyProfile(),
    prisma.user.findMany({ orderBy: { createdAt: "asc" } }),
  ]);

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Pengaturan"
        description="Identitas perusahaan, invoice, notifikasi, dan pengguna"
      />

      <Card className="mb-4 p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <IntegrationStatus
            label="Pengiriman email"
            ready={isEmailConfigured()}
            readyHint="Resend aktif"
            missingHint="Isi RESEND_API_KEY dan EMAIL_FROM di .env"
          />
          <IntegrationStatus
            label="Payment link"
            ready={isPaymentGatewayConfigured()}
            readyHint="Midtrans aktif"
            missingHint="Isi MIDTRANS_SERVER_KEY di .env"
          />
        </div>
      </Card>

      {admin ? <LogoCard logoUrl={profile.logoUrl} /> : null}

      <Card className="mt-4">
        <CardHeader
          title="Profil perusahaan"
          description={admin ? undefined : "Hanya admin yang bisa mengubah"}
        />
        <fieldset disabled={!admin} className="disabled:opacity-70">
          <form action={updateCompanyProfile} className="space-y-4 px-5 py-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Nama perusahaan">
                <Input name="name" defaultValue={profile.name} required />
              </Field>
              <Field label="Email">
                <Input name="email" type="email" defaultValue={profile.email ?? ""} />
              </Field>
              <Field label="Telepon">
                <Input name="phone" defaultValue={profile.phone ?? ""} />
              </Field>
              <Field label="NPWP">
                <Input name="taxId" defaultValue={profile.taxId ?? ""} />
              </Field>
            </div>
            <Field label="Alamat">
              <Textarea name="address" rows={2} defaultValue={profile.address ?? ""} />
            </Field>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label="Bank">
                <Input name="bankName" defaultValue={profile.bankName ?? ""} />
              </Field>
              <Field label="No. rekening">
                <Input name="bankAccount" defaultValue={profile.bankAccount ?? ""} />
              </Field>
              <Field label="Atas nama">
                <Input name="bankHolder" defaultValue={profile.bankHolder ?? ""} />
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
              <Field label="Prefix invoice" hint="Contoh: INV/2026/0001">
                <Input name="invoicePrefix" defaultValue={profile.invoicePrefix} />
              </Field>
              <Field label="PPN default (%)">
                <Input
                  name="defaultTaxRate"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={Number(profile.defaultTaxRate)}
                />
              </Field>
              <Field label="PPh 23 default (%)" hint="0 kalau tidak dipotong">
                <Input
                  name="defaultWithholdingRate"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={Number(profile.defaultWithholdingRate)}
                />
              </Field>
              <Field label="Mata uang default">
                <Select name="currency" defaultValue={profile.currency}>
                  <option value="IDR">IDR</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="SGD">SGD</option>
                </Select>
              </Field>
            </div>

            <Field
              label="Warna aksen invoice"
              hint="Dipakai untuk garis atas, header tabel, dan kotak total"
              className="max-w-[200px]"
            >
              <Input
                name="accentColor"
                type="color"
                defaultValue={profile.accentColor}
                className="h-10 p-1"
              />
            </Field>

            <Field label="Syarat pembayaran default">
              <Textarea
                name="defaultTerms"
                rows={3}
                defaultValue={profile.defaultTerms ?? ""}
                placeholder="Pembayaran dilakukan maksimal 14 hari setelah invoice diterbitkan."
              />
            </Field>

            <div className="rounded-lg border border-slate-200 p-4">
              <p className="mb-1 text-xs font-medium text-slate-700">
                Pesan WhatsApp
              </p>
              <p className="mb-3 text-xs text-slate-500">
                Tombol WhatsApp membuka aplikasi Anda dengan pesan sudah terisi.
                Tidak ada yang terkirim otomatis. Kode yang tersedia:{" "}
                <span className="font-mono">
                  {TEMPLATE_PLACEHOLDERS.join(" ")}
                </span>
              </p>

              <Field
                label="Kode negara"
                hint="Untuk nomor yang ditulis diawali 0"
                className="max-w-[140px]"
              >
                <Input name="waCountryCode" defaultValue={profile.waCountryCode} />
              </Field>

              <div className="mt-3 space-y-3">
                <Field label="Pesan invoice baru">
                  <Textarea
                    name="waInvoiceTemplate"
                    rows={6}
                    defaultValue={
                      profile.waInvoiceTemplate ?? DEFAULT_INVOICE_TEMPLATE
                    }
                  />
                </Field>
                <Field label="Pesan pengingat tagihan">
                  <Textarea
                    name="waReminderTemplate"
                    rows={6}
                    defaultValue={
                      profile.waReminderTemplate ?? DEFAULT_REMINDER_TEMPLATE
                    }
                  />
                </Field>
                <Field label="Pesan penawaran">
                  <Textarea
                    name="waQuoteTemplate"
                    rows={6}
                    defaultValue={
                      profile.waQuoteTemplate ?? DEFAULT_QUOTE_TEMPLATE
                    }
                  />
                </Field>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 p-4">
              <p className="mb-3 text-xs font-medium text-slate-700">
                Penangguhan layanan otomatis
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field
                  label="Tangguhkan setelah lewat tempo (hari)"
                  hint="Dihitung dari jatuh tempo invoice langganannya"
                >
                  <Input
                    name="autoSuspendAfterDays"
                    type="number"
                    min="0"
                    defaultValue={profile.autoSuspendAfterDays}
                  />
                </Field>
              </div>
              <label className="mt-3 flex items-center gap-2 text-xs text-slate-600">
                <input
                  type="checkbox"
                  name="autoSuspendEnabled"
                  defaultChecked={profile.autoSuspendEnabled}
                  className="rounded"
                />
                Aktifkan penangguhan otomatis di server hosting
              </label>
              <label className="mt-2 flex items-center gap-2 text-xs text-slate-600">
                <input
                  type="checkbox"
                  name="autoResumeOnPayment"
                  defaultChecked={profile.autoResumeOnPayment}
                  className="rounded"
                />
                Aktifkan kembali otomatis begitu tagihan lunas
              </label>
              <p className="mt-2 text-xs text-slate-500">
                Selama tidak diaktifkan, aplikasi hanya melaporkan layanan mana
                yang akan ditangguhkan tanpa menyentuh server. Lihat daftarnya di
                halaman Layanan.
              </p>
            </div>

            <div className="rounded-lg border border-slate-200 p-4">
              <p className="mb-3 text-xs font-medium text-slate-700">
                Denda keterlambatan
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Denda per bulan (%)">
                  <Input
                    name="lateFeePercent"
                    type="number"
                    step="0.01"
                    min="0"
                    defaultValue={Number(profile.lateFeePercent)}
                  />
                </Field>
                <Field label="Masa tenggang (hari)">
                  <Input
                    name="lateFeeGraceDays"
                    type="number"
                    min="0"
                    defaultValue={profile.lateFeeGraceDays}
                  />
                </Field>
              </div>
              <label className="mt-3 flex items-center gap-2 text-xs text-slate-600">
                <input
                  type="checkbox"
                  name="lateFeeEnabled"
                  defaultChecked={profile.lateFeeEnabled}
                  className="rounded"
                />
                Aktifkan perhitungan denda keterlambatan
              </label>
              <p className="mt-2 text-xs text-slate-500">
                Denda tetap dikenakan manual per invoice, tidak otomatis.
              </p>
            </div>

            <div className="rounded-lg border border-slate-200 p-4">
              <p className="mb-3 text-xs font-medium text-slate-700">
                Email &amp; pengingat
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Nama pengirim email">
                  <Input
                    name="emailFromName"
                    defaultValue={profile.emailFromName ?? ""}
                    placeholder={profile.name}
                  />
                </Field>
                <Field label="Balas ke (reply-to)">
                  <Input
                    name="emailReplyTo"
                    type="email"
                    defaultValue={profile.emailReplyTo ?? ""}
                  />
                </Field>
                <Field label="Ingatkan H- (hari sebelum jatuh tempo)">
                  <Input
                    name="reminderDaysBefore"
                    type="number"
                    min="0"
                    defaultValue={profile.reminderDaysBefore}
                  />
                </Field>
                <Field label="Ingatkan lagi tiap (hari setelah lewat tempo)">
                  <Input
                    name="reminderDaysAfter"
                    type="number"
                    min="0"
                    defaultValue={profile.reminderDaysAfter}
                  />
                </Field>
              </div>
              <label className="mt-3 flex items-center gap-2 text-xs text-slate-600">
                <input
                  type="checkbox"
                  name="reminderEnabled"
                  defaultChecked={profile.reminderEnabled}
                  className="rounded"
                />
                Aktifkan pengingat jatuh tempo otomatis
              </label>
            </div>

            {admin ? <SubmitButton>Simpan pengaturan</SubmitButton> : null}
          </form>
        </fieldset>
      </Card>

      <Card className="mt-4">
        <CardHeader
          title="Kolom kustom"
          description="Tambahkan field khas usaha Anda ke klien, deal, proyek, atau invoice"
        />
        <div className="px-5 py-4">
          <Link
            href="/settings/custom-fields"
            className={buttonClass("secondary")}
          >
            Kelola kolom kustom
          </Link>
        </div>
      </Card>

      <Card className="mt-4">
        <CardHeader
          title="Server hosting"
          description="Hubungkan aaPanel untuk memantau layanan klien"
        />
        <div className="px-5 py-4">
          <Link href="/settings/servers" className={buttonClass("secondary")}>
            Kelola server
          </Link>
        </div>
      </Card>

      <AccountCard />

      {admin ? (
        <UsersCard
          currentUserId={session.userId}
          users={users.map((user) => ({
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            createdAt: user.createdAt.toISOString(),
          }))}
        />
      ) : (
        <Card className="mt-4">
          <CardHeader title="Pengguna" />
          <ul className="divide-y divide-slate-100">
            {users.map((user) => (
              <li
                key={user.id}
                className="flex items-center justify-between gap-3 px-5 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-slate-800">{user.name}</p>
                  <p className="text-xs text-slate-500">{user.email}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-medium text-slate-600">{user.role}</p>
                  <p className="text-xs text-slate-400">
                    {formatDate(user.createdAt)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function IntegrationStatus({
  label,
  ready,
  readyHint,
  missingHint,
}: {
  label: string;
  ready: boolean;
  readyHint: string;
  missingHint: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span
        className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
          ready ? "bg-emerald-500" : "bg-amber-400"
        }`}
      />
      <div>
        <p className="text-xs font-medium text-slate-700">{label}</p>
        <p className="text-xs text-slate-500">
          {ready ? readyHint : missingHint}
        </p>
      </div>
    </div>
  );
}

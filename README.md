# My CRM

CRM untuk manajemen klien, pipeline penjualan, penawaran, invoice, dan langganan.
Next.js 16 (App Router), TypeScript, Tailwind CSS 4, Prisma 7, PostgreSQL.

## Fitur

### Klien & penjualan
- **Klien & kontak** — CRUD, status (Lead/Aktif/Nonaktif), tag, catatan, banyak
  kontak per klien dengan penanda kontak utama, pencarian dan filter.
- **Impor & ekspor CSV** — impor klien dari spreadsheet (baris dengan email yang
  sudah ada diperbarui, bukan digandakan) dan ekspor ke CSV.
- **Deal / pipeline** — papan kanban enam tahap dengan **drag and drop**
  (dropdown tetap tersedia untuk keyboard dan sentuh), nilai deal, probabilitas,
  nilai tertimbang, target tutup.
- **Penawaran (quotation)** — nomor otomatis `QUO/2026/0001`, kirim ke klien,
  tandai diterima/ditolak, dan **konversi satu klik menjadi invoice**.
  Kedaluwarsa otomatis setelah tanggal berlaku lewat.
- **Tugas & aktivitas** — to-do dengan prioritas dan deadline, terhubung ke klien
  atau deal, log aktivitas (catatan/telepon/email/meeting).

### Pekerjaan & biaya
- **Proyek** — wadah antara deal yang menang dan invoicenya: anggaran nilai dan
  jam, tarif per jam, status, tugas, waktu, biaya, dan invoice dalam satu
  halaman.
- **Pencatatan waktu** — durasi ditulis apa adanya (`1:30`, `1,5`, `90m`),
  tarif dikunci saat dicatat, dan bisa ditandai tidak ditagihkan.
- **Tagih sekali klik** — semua waktu dan biaya billable yang belum ditagih
  disusun jadi satu invoice draft, lalu ditandai supaya tidak tertagih dua kali.
- **Biaya** — kategori, vendor, lampiran bukti, tautan ke klien dan proyek,
  serta penanda tagih ulang. Ini yang membuat margin bisa dihitung.
- **Margin** — per proyek di halaman proyek, per klien di laporan.

### Tagihan
- **Invoice** — nomor otomatis, item dinamis, diskon, **PPN dan PPh 23**
  (potongan PPh mengurangi total yang ditransfer klien), total live saat mengetik.
- **Status otomatis** — Draft → Terkirim → Sebagian → Lunas / Jatuh Tempo,
  dihitung ulang setiap kali item atau pembayaran berubah.
- **Kirim via email** — PDF dilampirkan otomatis, plus pesan tambahan opsional.
- **Pengingat otomatis** — cron harian mengirim pengingat H-<n> sebelum jatuh
  tempo dan mengulang tiap <n> hari setelah lewat tempo.
- **Termin pembayaran** — bagi satu invoice jadi beberapa jatuh tempo.
- **Payment link** — Midtrans Snap; webhook mencatat pembayaran otomatis dan
  menolak notifikasi dengan signature tidak sah maupun duplikat.
- **Langganan (invoice berulang)** — template mingguan/bulanan/kuartalan/tahunan,
  bisa kirim otomatis, mengejar periode yang terlewat kalau server sempat mati.
- **Nota kredit** — koreksi resmi atas invoice yang sudah terkirim. Draft dulu,
  baru diterbitkan; sisa tagihan berkurang saat terbit, dan bisa dibatalkan.
- **Uang muka** — uang yang diterima sebelum ada invoice, dipakai sebagian demi
  sebagian ke beberapa invoice.
- **Denda keterlambatan** — dihitung dari persentase per bulan setelah masa
  tenggang, tapi dikenakan manual per invoice, tidak diam-diam.
- **Aksi massal** — tandai terkirim, lunas, batal, atau buang beberapa invoice
  sekaligus dari daftar.
- **PDF & cetak** — file PDF asli via `@react-pdf/renderer` (tanpa Chromium,
  jalan di serverless) dengan logo dan warna aksen perusahaan; halaman
  `/invoices/[id]/print` untuk pratinjau dan cetak langsung.

### Layanan hosting (aaPanel)
- **Server** — daftarkan aaPanel di Pengaturan → Server. Kunci API disimpan
  terenkripsi AES-256-GCM, tidak pernah ditampilkan lagi setelah disimpan.
- **Layanan** — petakan situs yang sudah ada di panel ke klien yang membayarnya,
  dan hubungkan ke langganan yang menagihnya.
- **Sinkronisasi** — status berjalan/berhenti, pemakaian disk, versi PHP,
  penerbit dan masa berlaku SSL, serta tanggal kedaluwarsa di panel. Berjalan
  tiap 6 jam lewat cron, atau manual per server maupun per layanan.
- **Peringatan SSL** — notifikasi untuk sertifikat yang berakhir dalam 21 hari.

- **Penangguhan otomatis** — layanan yang tagihannya lewat jatuh tempo sekian
  hari dihentikan di panel, dan aktif lagi begitu tagihan lunas. **Nonaktif
  secara bawaan**: selama belum diaktifkan di Pengaturan, aplikasi hanya
  melaporkan layanan mana yang akan ditangguhkan tanpa menyentuh server.
- **Kendali manual** per layanan, plus penanda pengecualian untuk layanan yang
  tidak boleh ikut penangguhan otomatis.

Menghentikan situs hanya menonaktifkan vhost. File dan database tidak disentuh,
jadi mengaktifkan kembali memulihkan situs persis seperti semula.

Catatan penting: aaPanel mewajibkan **whitelist IP**. IP server tempat aplikasi
ini berjalan harus didaftarkan di Settings → API pada panel, jadi hosting dengan
IP keluar yang berubah-ubah (Vercel dan serverless lain) tidak cocok.

Diverifikasi terhadap aaPanel 8.0.6: permintaan memakai **POST** dengan
`request_time` dalam **detik**, dan cookie sesi panel harus dikirim balik.
Contoh Postman di situs aaPanel yang memakai milidetik lewat query string
ditolak panel.

### Portal klien
Dua cara masuk, dengan tampilan yang sama persis karena keduanya memakai
komponen dan pemuat data yang sama:

- **Akun portal** — klien login dengan email dan password di `/portal/login`.
  Sesinya memakai cookie, kunci tanda tangan, dan tabel pengguna yang **terpisah
  penuh** dari akun staf, sehingga kekeliruan di satu sisi tidak bisa melebarkan
  akses di sisi lain. Menonaktifkan akun langsung mematikan sesi yang berjalan.
- **Tautan pribadi** — untuk klien yang tidak mau punya akun. Token diacak,
  disimpan sebagai hash, ditampilkan sekali, bisa diberi masa berlaku dan
  dicabut.

Isinya: ringkasan tagihan dan saldo uang muka, daftar layanan hosting beserta
status dan masa berlaku SSL, daftar invoice, halaman rincian per invoice dengan
riwayat pembayaran dan jadwal termin, unduh PDF, tombol bayar, dan **unggah
bukti transfer** yang langsung memberi notifikasi ke staf.

Invoice draft tidak pernah terlihat, dan tidak ada jalur — halaman maupun PDF —
yang bisa dipakai satu klien untuk membuka data klien lain.

### Laporan & operasional
- **Dashboard** — klien, pipeline, deal menang, piutang, invoice belum lunas,
  tugas mendatang, aktivitas terbaru.
- **Laporan** — omzet, biaya, dan laba per bulan; aging piutang; proyeksi arus
  kas berdasarkan jatuh tempo; margin per klien; klien teratas; win rate deal;
  ekspor CSV.
- **Kalender** — jatuh tempo invoice, deadline tugas, masa berlaku penawaran,
  dan jadwal langganan dalam satu tampilan bulanan.
- **Notifikasi** — lonceng di header untuk invoice lewat tempo, pembayaran
  masuk, dan invoice langganan yang terbit.
- **Klien ganda** — deteksi berdasarkan email, telepon, dan kemiripan nama,
  dengan penggabungan yang memindahkan seluruh data ke klien tujuan.
- **Kolom kustom** — tambahkan field khas usaha Anda ke klien, deal, proyek,
  atau invoice tanpa mengubah kode.
- **Lampiran** — kontrak, PO, bukti transfer per klien atau invoice (maks 5 MB).
- **Pencarian global** — tekan `⌘K` / `Ctrl+K` untuk mencari klien, invoice,
  penawaran, deal, dan tugas.
- **Mode gelap** — terang, gelap, atau ikut sistem. Pratinjau invoice tetap putih.

### Ketahanan
- **Zona waktu perusahaan** — semua batas "hari ini" (jatuh tempo, pengingat,
  aging piutang) dihitung di `APP_TIMEZONE`, bukan zona server. Deploy ke server
  UTC tidak lagi menggeser awal hari tujuh jam.
- **Mata uang dasar** — tiap invoice, penawaran, deal, dan langganan menyimpan
  kurs ke mata uang dasar saat dibuat. Dashboard dan laporan menjumlahkan nilai
  yang sudah dikonversi, jadi invoice USD tidak lagi ditambahkan seolah rupiah.
- **Sampah** — klien, deal, penawaran, dan invoice yang dihapus masuk ke
  `/trash` dan bisa dipulihkan. Hapus permanen tersedia terpisah, admin saja.
- **Paginasi** — daftar klien, invoice, penawaran, dan tugas dipotong 25 baris
  per halaman. Papan kanban menampilkan 300 kartu terbaru dan menyebutkan
  sisanya.
- **Nomor dokumen aman dari balapan** — sekuens invoice dan penawaran diambil
  dari tabel penghitung yang dinaikkan secara atomik.
- **Retensi log** — cron mingguan membersihkan percobaan login (30 hari), log
  email (180 hari), log aktivitas (365 hari), dan token reset yang sudah mati.
- **Backup & restore** — `npm run db:backup` membuat dump `pg_dump` ke `backups/`
  dan menyimpan 14 file terakhir; `npm run db:restore` mengembalikannya.
- **Pemantauan error** — halaman error yang rapi plus `reportError` yang menulis
  log terstruktur dan mengirim ke `ERROR_WEBHOOK_URL` bila diisi.
- **Tes otomatis** — `npm test` menjalankan Vitest untuk kalkulasi uang, PPh 23,
  status invoice, konversi mata uang, zona waktu, jadwal langganan, CSV, dan
  verifikasi signature webhook.

### Pajak Indonesia
- **PPh 23** — dihitung di invoice, ditampilkan di PDF dan halaman cetak.
- **Bukti potong** — nomor dan tanggal bukti potong dicatat per invoice;
  halaman laporan menandai invoice yang bukti potongnya belum diterima.
- **Rekap pajak** — ekspor CSV rekap PPN keluaran (bahan input e-Faktur) dan
  rekap PPh 23 dipotong. Ini rekap untuk mempermudah input manual, bukan file
  impor e-Faktur resmi.

### Keamanan
- **Autentikasi** — sesi JWT httpOnly, middleware pelindung rute.
- **Pencabutan sesi** — mengubah peran, mengganti password, mereset password,
  atau menghapus pengguna langsung mematikan sesi yang sedang berjalan.
- **Peran** — `ADMIN` dapat mengubah pengaturan, mengelola pengguna, dan
  menghapus data; `MEMBER` hanya membuat dan mengubah.
- **Lupa password** — tautan sekali pakai berlaku 60 menit; permintaan untuk
  email yang tidak terdaftar tetap dibalas sama agar tidak bocor.
- **Ganti password** dari halaman pengaturan.
- **Rate limit login** — 5 kegagalan per email dan 20 per IP dalam 15 menit.
- **Log aktivitas** — siapa mengubah atau menghapus apa, bisa difilter.

## Prasyarat

- Node.js 20+
- PostgreSQL 14+ yang sedang berjalan

## Setup

```bash
npm install
```

Salin `.env.example` ke `.env` dan sesuaikan. Yang wajib hanya `DATABASE_URL`
dan `AUTH_SECRET`; sisanya opsional dan fiturnya menonaktifkan diri dengan pesan
jelas kalau kosong.

```bash
createdb my_crm
npm run db:migrate
npm run db:seed
npm run dev
```

Akun seed: `admin@mycrm.test` / `password123`. Buka http://localhost:3000.

## Variabel lingkungan

| Variabel | Wajib | Fungsi |
| --- | --- | --- |
| `DATABASE_URL` | ya | Koneksi PostgreSQL |
| `AUTH_SECRET` | ya | Kunci tanda tangan sesi (`openssl rand -base64 32`) |
| `APP_URL` | untuk email | Dipakai di tautan reset password dan footer email |
| `APP_TIMEZONE` | tidak | Zona waktu perusahaan, default `Asia/Jakarta` |
| `APP_ENCRYPTION_KEY` | untuk server hosting | Kunci enkripsi kredensial panel; jatuh ke `AUTH_SECRET` bila kosong |
| `ERROR_WEBHOOK_URL` | tidak | Endpoint JSON penerima laporan error |
| `BACKUP_DIR`, `BACKUP_KEEP` | tidak | Lokasi dan jumlah backup yang disimpan |
| `PG_DUMP_PATH`, `PG_RESTORE_PATH` | tidak | Isi kalau binari Postgres tidak ada di PATH |
| `RESEND_API_KEY`, `EMAIL_FROM` | untuk email | Tanpa ini, email dicatat sebagai `SKIPPED` dan aplikasi tetap jalan |
| `MIDTRANS_SERVER_KEY` | untuk payment link | Kosong berarti tombol payment link tidak muncul |
| `MIDTRANS_IS_PRODUCTION` | tidak | `true` untuk endpoint produksi Midtrans |
| `CRON_SECRET` | untuk cron | Dikirim sebagai header `x-cron-secret` atau `Authorization: Bearer` |

## Cron

Dua endpoint dijalankan terjadwal. `vercel.json` sudah berisi jadwalnya; di luar
Vercel panggil dengan cron biasa:

```bash
curl -H "x-cron-secret: $CRON_SECRET" https://domain-anda.com/api/cron/reminders
```

| Endpoint | Fungsi |
| --- | --- |
| `/api/cron/reminders` | Tandai invoice lewat tempo dan kirim pengingat |
| `/api/cron/recurring` | Terbitkan invoice langganan yang jatuh tempo, kedaluwarsakan penawaran |
| `/api/cron/cleanup` | Bersihkan log lama sesuai masa retensi |
| `/api/cron/services` | Sinkronkan layanan dari panel, peringatkan SSL kedaluwarsa, jalankan penangguhan otomatis |

Nomor dokumen (`INV`, `QUO`, `NK`) diambil dari tabel penghitung yang dinaikkan
atomik. Kalau penghitung tertinggal — misalnya data diimpor dari sistem lain —
penomoran otomatis melompati nomor yang sudah terpakai, bukan gagal terus.

## Webhook Midtrans

Arahkan Payment Notification URL di dashboard Midtrans ke:

```
https://domain-anda.com/api/webhooks/midtrans
```

Notifikasi diverifikasi dengan `sha512(order_id + status_code + gross_amount + serverKey)`.
Notifikasi berulang untuk transaksi yang sama diabaikan supaya pembayaran tidak dobel.

## Skrip

| Perintah | Fungsi |
| --- | --- |
| `npm run dev` | Server pengembangan |
| `npm run build` | Build produksi |
| `npm start` | Jalankan hasil build |
| `npm run db:migrate` | Buat dan terapkan migrasi (development) |
| `npm run db:deploy` | Terapkan migrasi (produksi) |
| `npm run db:seed` | Isi data contoh |
| `npm run db:studio` | Prisma Studio |
| `npm run db:reset` | Reset database dan migrasi ulang |
| `npm run db:backup` | Dump database ke `backups/` |
| `npm run db:restore -- <file>` | Kembalikan dari dump (butuh `CONFIRM_RESTORE=yes`) |
| `npm test` | Jalankan Vitest |
| `npm run test:watch` | Vitest mode watch |
| `npm run aapanel:probe` | Uji koneksi ke aaPanel dari mesin ini |

## Struktur

```
prisma/
  schema.prisma        model data
  seed.ts              data contoh
scripts/
  backup.ts            dump database
  restore.ts           kembalikan dump
tests/                 Vitest: uang, PPh 23, nota kredit, denda, zona waktu,
                       jadwal langganan, durasi, margin, duplikat, CSV, webhook
src/
  app/(auth)/          login, register, lupa/atur ulang password
  app/(app)/           area terproteksi: dashboard, clients, deals, projects,
                       quotes, invoices, credit-notes, recurring, expenses,
                       tasks, calendar, reports, notifications, audit, trash,
                       settings
  app/portal/          portal klien: login akun dan tautan token
  app/api/             pdf, ekspor CSV, lampiran, pencarian, cron, webhook
  components/          komponen UI bersama, command palette, theme toggle
  lib/
    prisma.ts          Prisma client (adapter pg)
    session.ts/auth.ts sesi JWT dan cookie
    permissions.ts     penjaga peran ADMIN/MEMBER
    rate-limit.ts      pembatas percobaan login
    audit.ts           pencatat log aktivitas
    email.ts           pengiriman via Resend + template HTML
    invoice.ts         nomor dokumen, kalkulasi total, sinkronisasi status
    invoice-view.ts    view model bersama untuk cetak dan PDF
    invoice-mailer.ts  email invoice dengan lampiran PDF
    recurring.ts       mesin invoice berulang
    payment.ts         Midtrans Snap dan verifikasi webhook
    reports.ts         agregasi laporan
    csv.ts             baca/tulis CSV
    projects.ts        durasi, nilai belum tertagih, margin proyek
    duplicates.ts      deteksi klien ganda
    schedule.ts        kadensi langganan (murni, teruji)
    notifications.ts   notifikasi dalam aplikasi
    portal.ts          token portal klien
    crypto.ts          enkripsi kredensial pihak ketiga
    services.ts        sinkronisasi layanan dan peringatan SSL
    suspension.ts      penangguhan dan pengaktifan kembali layanan
    client-session.ts  sesi portal klien, terpisah dari sesi staf
    portal-data.ts     pemuat data portal yang dipakai kedua jalur masuk
    providers/aapanel.ts  adapter aaPanel (baca-saja)
    custom-fields.ts   definisi dan nilai kolom kustom
    time.ts            batas hari di zona perusahaan
    money.ts           kalkulasi total, status, dan konversi mata uang
    schedule.ts        kadensi langganan (murni, teruji)
    observability.ts   pelaporan error
    pdf/               dokumen react-pdf
  middleware.ts        proteksi rute
```

## Catatan produksi

- Ganti `AUTH_SECRET` dan `CRON_SECRET` dengan nilai acak.
- Cookie sesi otomatis `secure` saat `NODE_ENV=production`; layani lewat HTTPS.
- Semua pengguna yang login melihat seluruh data (single-tenant). Untuk isolasi
  per pengguna, tambahkan filter `ownerId` pada query di `src/app/(app)`.
- Jadwalkan `npm run db:backup` di luar aplikasi (cron server atau layanan
  backup hosting). Endpoint cron aplikasi tidak menjalankan backup karena
  butuh akses ke `pg_dump`.
- Penyaringan sampah dipasang sebagai ekstensi query Prisma di
  `src/lib/prisma.ts`. Query `findUnique` tidak ikut tersaring, jadi halaman
  detail memeriksa `deletedAt` sendiri.
- Logo dan lampiran disimpan di database, bukan filesystem, supaya tetap jalan di
  hosting dengan filesystem read-only. Pertimbangkan object storage kalau volume
  lampiran besar.
- Route PDF dan lampiran berjalan di Node runtime (`runtime = "nodejs"`), tidak
  bisa dipindah ke Edge.
- Setelah mengubah `prisma/schema.prisma`, **restart `npm run dev`** — Prisma
  Client yang sudah dimuat proses lama tidak ikut ter-generate ulang.
- Tautan portal klien memberi akses baca ke seluruh invoice terbit milik klien
  itu tanpa login. Perlakukan seperti kata sandi: kirim lewat kanal tepercaya,
  beri masa berlaku bila perlu, dan cabut kalau bocor.

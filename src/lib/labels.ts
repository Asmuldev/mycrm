export const clientStatusLabel: Record<string, string> = {
  LEAD: "Lead",
  ACTIVE: "Aktif",
  INACTIVE: "Nonaktif",
};

export const dealStageLabel: Record<string, string> = {
  LEAD: "Lead",
  QUALIFIED: "Kualifikasi",
  PROPOSAL: "Proposal",
  NEGOTIATION: "Negosiasi",
  WON: "Menang",
  LOST: "Kalah",
};

export const dealStages = [
  "LEAD",
  "QUALIFIED",
  "PROPOSAL",
  "NEGOTIATION",
  "WON",
  "LOST",
] as const;

export const invoiceStatusLabel: Record<string, string> = {
  DRAFT: "Draft",
  SENT: "Terkirim",
  PARTIAL: "Sebagian",
  PAID: "Lunas",
  OVERDUE: "Jatuh Tempo",
  CANCELLED: "Batal",
};

export const taskStatusLabel: Record<string, string> = {
  TODO: "To Do",
  IN_PROGRESS: "Dikerjakan",
  DONE: "Selesai",
};

export const taskPriorityLabel: Record<string, string> = {
  LOW: "Rendah",
  MEDIUM: "Sedang",
  HIGH: "Tinggi",
};

export const activityTypeLabel: Record<string, string> = {
  NOTE: "Catatan",
  CALL: "Telepon",
  EMAIL: "Email",
  MEETING: "Meeting",
};

export const badgeTone: Record<string, string> = {
  LEAD: "bg-slate-100 text-slate-700 ring-slate-200",
  ACTIVE: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  INACTIVE: "bg-zinc-100 text-zinc-600 ring-zinc-200",
  QUALIFIED: "bg-sky-50 text-sky-700 ring-sky-200",
  PROPOSAL: "bg-violet-50 text-violet-700 ring-violet-200",
  NEGOTIATION: "bg-amber-50 text-amber-700 ring-amber-200",
  WON: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  LOST: "bg-rose-50 text-rose-700 ring-rose-200",
  DRAFT: "bg-slate-100 text-slate-700 ring-slate-200",
  SENT: "bg-sky-50 text-sky-700 ring-sky-200",
  PARTIAL: "bg-amber-50 text-amber-700 ring-amber-200",
  PAID: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  OVERDUE: "bg-rose-50 text-rose-700 ring-rose-200",
  CANCELLED: "bg-zinc-100 text-zinc-600 ring-zinc-200",
  TODO: "bg-slate-100 text-slate-700 ring-slate-200",
  IN_PROGRESS: "bg-sky-50 text-sky-700 ring-sky-200",
  DONE: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  ACCEPTED: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  REJECTED: "bg-rose-50 text-rose-700 ring-rose-200",
  EXPIRED: "bg-zinc-100 text-zinc-600 ring-zinc-200",
  PLANNING: "bg-slate-100 text-slate-700 ring-slate-200",
  ON_HOLD: "bg-amber-50 text-amber-700 ring-amber-200",
  ISSUED: "bg-sky-50 text-sky-700 ring-sky-200",
  HIGH: "bg-rose-50 text-rose-700 ring-rose-200",
  MEDIUM: "bg-amber-50 text-amber-700 ring-amber-200",
  LOW: "bg-slate-100 text-slate-600 ring-slate-200",
};

export const recurringFrequencyLabel: Record<string, string> = {
  WEEKLY: "Mingguan",
  MONTHLY: "Bulanan",
  QUARTERLY: "Kuartalan",
  YEARLY: "Tahunan",
};

export const quoteStatusLabel: Record<string, string> = {
  DRAFT: "Draft",
  SENT: "Terkirim",
  ACCEPTED: "Diterima",
  REJECTED: "Ditolak",
  EXPIRED: "Kedaluwarsa",
};

export const projectStatusLabel: Record<string, string> = {
  PLANNING: "Perencanaan",
  ACTIVE: "Berjalan",
  ON_HOLD: "Ditahan",
  DONE: "Selesai",
  CANCELLED: "Batal",
};

export const creditNoteStatusLabel: Record<string, string> = {
  DRAFT: "Draft",
  ISSUED: "Terbit",
  CANCELLED: "Batal",
};

export const expenseCategoryLabel: Record<string, string> = {
  GAJI: "Gaji & honor",
  SUBKONTRAK: "Subkontraktor",
  PERANGKAT_LUNAK: "Perangkat lunak",
  PERALATAN: "Peralatan",
  PERJALANAN: "Perjalanan",
  KANTOR: "Operasional kantor",
  PEMASARAN: "Pemasaran",
  PAJAK_BIAYA: "Pajak & administrasi",
  LAINNYA: "Lainnya",
};

export const customFieldTypeLabel: Record<string, string> = {
  TEXT: "Teks singkat",
  TEXTAREA: "Teks panjang",
  NUMBER: "Angka",
  DATE: "Tanggal",
  BOOLEAN: "Ya/Tidak",
  SELECT: "Pilihan",
};

export const customFieldEntityLabel: Record<string, string> = {
  CLIENT: "Klien",
  DEAL: "Deal",
  PROJECT: "Proyek",
  INVOICE: "Invoice",
};

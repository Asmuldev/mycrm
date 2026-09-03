import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { decryptSecret } from "../src/lib/crypto";
import { AapanelClient } from "../src/lib/providers/aapanel";

/**
 * One-off check that SiteStop and SiteStart behave as documented, before the
 * automatic suspension in Stage 2 is allowed to use them.
 *
 * This is the only script in the repository that changes a live server. It
 * stops the named site, reads the status back, and starts it again — restoring
 * the original state even if a step in between fails.
 *
 * Usage:
 *   CONFIRM_SUSPEND_TEST=yes npx tsx scripts/aapanel-suspend-test.ts panel.asmuldev.web.id
 */
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  const target = process.argv[2];

  if (!target) {
    console.error(
      "Sebutkan nama situs, misalnya:\n" +
        "  CONFIRM_SUSPEND_TEST=yes npx tsx scripts/aapanel-suspend-test.ts panel.asmuldev.web.id",
    );
    process.exit(1);
  }

  if (process.env.CONFIRM_SUSPEND_TEST !== "yes") {
    console.error(
      [
        `Skrip ini akan MENGHENTIKAN situs "${target}" di server sungguhan,`,
        "lalu menyalakannya kembali beberapa detik kemudian.",
        "",
        "Jangan arahkan ke situs yang sedang dipakai orang.",
        "",
        "Kalau sudah yakin, jalankan ulang dengan konfirmasi:",
        `  CONFIRM_SUSPEND_TEST=yes npx tsx scripts/aapanel-suspend-test.ts ${target}`,
      ].join("\n"),
    );
    process.exit(1);
  }

  const node = await prisma.serverNode.findFirst({ where: { active: true } });
  if (!node) {
    console.error(
      "Belum ada server aktif. Tambahkan dulu lewat Pengaturan → Server.",
    );
    process.exit(1);
  }

  const panel = new AapanelClient(node.baseUrl, decryptSecret(node.apiKeyEnc));

  const readSite = async () => {
    const sites = await panel.listSites();
    const site = sites.find((entry) => entry.name === target);
    if (!site) throw new Error(`Situs "${target}" tidak ditemukan di panel`);
    return site;
  };

  const label = (status: string) =>
    status === "1" ? "berjalan" : "berhenti";

  const before = await readSite();
  console.log(
    `Server  : ${node.name} (${node.baseUrl})\n` +
      `Situs   : ${target} (id ${before.id})\n` +
      `Sebelum : ${label(before.status)}\n`,
  );

  let stopped = false;
  try {
    const stop = await panel.suspendSite({
      id: String(before.id),
      name: target,
    });
    stopped = true;
    console.log(`SiteStop  → ${JSON.stringify(stop)}`);
    console.log(`Terbaca   → ${label((await readSite()).status)}`);
  } finally {
    if (stopped) {
      const start = await panel.resumeSite({
        id: String(before.id),
        name: target,
      });
      console.log(`SiteStart → ${JSON.stringify(start)}`);

      const after = await readSite();
      console.log(`Terbaca   → ${label(after.status)}`);
      console.log(
        after.status === before.status
          ? "\nSitus kembali ke keadaan semula."
          : "\nStatus akhir BERBEDA dari awal. Periksa panel sekarang.",
      );
    }
    await prisma.$disconnect();
  }
}

void main();

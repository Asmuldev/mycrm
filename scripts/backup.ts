import "dotenv/config";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from "node:fs";
import path from "node:path";

/** Homebrew keeps libpq keg-only, so pg_dump is often installed but not on PATH. */
const COMMON_PATHS = [
  "/opt/homebrew/opt/libpq/bin/pg_dump",
  "/usr/local/opt/libpq/bin/pg_dump",
  "/usr/lib/postgresql/16/bin/pg_dump",
  "/usr/bin/pg_dump",
];

function resolveBinary() {
  if (process.env.PG_DUMP_PATH) return process.env.PG_DUMP_PATH;
  return COMMON_PATHS.find((candidate) => existsSync(candidate)) ?? "pg_dump";
}

/**
 * Dumps the database with pg_dump into ./backups, then prunes old files.
 * Uses the custom format so `pg_restore` can restore selectively.
 */
const BACKUP_DIR = process.env.BACKUP_DIR ?? "backups";
const KEEP = Number(process.env.BACKUP_KEEP ?? 14);

function fail(message: string): never {
  console.error(`\n${message}\n`);
  process.exit(1);
}

/** Prisma-only query params that libpq rejects. */
const PRISMA_ONLY_PARAMS = [
  "schema",
  "connection_limit",
  "pool_timeout",
  "connect_timeout",
  "socket_timeout",
  "pgbouncer",
  "statement_cache_size",
];

function toLibpqUrl(databaseUrl: string) {
  const url = new URL(databaseUrl);
  const schema = url.searchParams.get("schema");
  for (const key of PRISMA_ONLY_PARAMS) url.searchParams.delete(key);
  return { url: url.toString(), schema };
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) fail("DATABASE_URL belum diisi di .env");

  const binary = resolveBinary();
  const { url: connectionUrl, schema } = toLibpqUrl(url);
  mkdirSync(BACKUP_DIR, { recursive: true });

  const stamp = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\..+$/, "");
  const target = path.join(BACKUP_DIR, `my-crm-${stamp}.dump`);

  await new Promise<void>((resolve) => {
    const args = ["--format=custom", "--no-owner", "--file", target];
    if (schema) args.push("--schema", schema);
    args.push(connectionUrl);

    const child = spawn(binary, args, {
      stdio: ["ignore", "inherit", "inherit"],
    });

    child.on("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") {
        fail(
          [
            `Tidak menemukan "${binary}".`,
            "",
            "macOS  : brew install libpq && brew link --force libpq",
            "Ubuntu : sudo apt install postgresql-client",
            "",
            "Atau set PG_DUMP_PATH ke lokasi pg_dump, misalnya:",
            '  PG_DUMP_PATH="/opt/homebrew/opt/libpq/bin/pg_dump" npm run db:backup',
          ].join("\n"),
        );
      }
      fail(`pg_dump gagal: ${error.message}`);
    });

    child.on("close", (code) => {
      if (code !== 0) {
        // Leave no half-written file behind to be mistaken for a real backup.
        if (existsSync(target)) unlinkSync(target);
        fail(`pg_dump keluar dengan kode ${code}`);
      }
      resolve();
    });
  });

  const size = statSync(target).size;
  console.log(`Backup selesai: ${target} (${(size / 1024 / 1024).toFixed(2)} MB)`);

  const stale = readdirSync(BACKUP_DIR)
    .filter((name) => name.startsWith("my-crm-") && name.endsWith(".dump"))
    .sort()
    .slice(0, -KEEP);

  for (const name of stale) {
    unlinkSync(path.join(BACKUP_DIR, name));
    console.log(`Menghapus backup lama: ${name}`);
  }

  if (!existsSync(target)) fail("File backup tidak terbentuk");
}

void main();

import "dotenv/config";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

const COMMON_PATHS = [
  "/opt/homebrew/opt/libpq/bin/pg_restore",
  "/usr/local/opt/libpq/bin/pg_restore",
  "/usr/lib/postgresql/16/bin/pg_restore",
  "/usr/bin/pg_restore",
];

/**
 * Restores a dump created by `npm run db:backup`.
 * Destructive: `--clean` drops existing objects before recreating them.
 */
async function main() {
  const file = process.argv[2];
  const url = process.env.DATABASE_URL;

  if (!file) {
    console.error("Pakai: npm run db:restore -- backups/my-crm-XXXX.dump");
    process.exit(1);
  }
  if (!existsSync(file)) {
    console.error(`File tidak ditemukan: ${file}`);
    process.exit(1);
  }
  if (!url) {
    console.error("DATABASE_URL belum diisi di .env");
    process.exit(1);
  }
  if (process.env.CONFIRM_RESTORE !== "yes") {
    console.error(
      [
        "Restore menimpa seluruh isi database saat ini.",
        "Jalankan ulang dengan konfirmasi eksplisit:",
        `  CONFIRM_RESTORE=yes npm run db:restore -- ${file}`,
      ].join("\n"),
    );
    process.exit(1);
  }

  const clean = new URL(url);
  for (const key of [
    "schema",
    "connection_limit",
    "pool_timeout",
    "connect_timeout",
    "socket_timeout",
    "pgbouncer",
    "statement_cache_size",
  ]) {
    clean.searchParams.delete(key);
  }

  const binary =
    process.env.PG_RESTORE_PATH ??
    COMMON_PATHS.find((candidate) => existsSync(candidate)) ??
    "pg_restore";
  const child = spawn(
    binary,
    ["--clean", "--if-exists", "--no-owner", "--dbname", clean.toString(), file],
    { stdio: ["ignore", "inherit", "inherit"] },
  );

  child.on("error", (error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") {
      console.error(
        `Tidak menemukan "${binary}". Pasang postgresql-client atau set PG_RESTORE_PATH.`,
      );
    } else {
      console.error(`pg_restore gagal: ${error.message}`);
    }
    process.exit(1);
  });

  child.on("close", (code) => {
    if (code !== 0) process.exit(code ?? 1);
    console.log("Restore selesai.");
  });
}

void main();

import "dotenv/config";
import { createHash } from "node:crypto";

/**
 * Read-only probe against an aaPanel server.
 *
 * The official PDF and the website's Postman example disagree on two points:
 * the PDF says POST with a seconds timestamp, the Postman script uses a
 * milliseconds timestamp in the query string. Rather than guess, this tries
 * each combination against /system?action=GetSystemTotal — which only reads
 * status — and reports which one the panel actually accepts.
 */
const BASE = (process.env.AAPANEL_URL ?? "").replace(/\/$/, "");
const KEY = process.env.AAPANEL_API_KEY ?? "";
const TIMEOUT_MS = 15_000;

function md5(value: string) {
  return createHash("md5").update(value).digest("hex");
}

function signature(unit: "seconds" | "milliseconds") {
  const now =
    unit === "seconds" ? Math.floor(Date.now() / 1000) : Date.now();
  return { request_time: String(now), request_token: md5(`${now}${md5(KEY)}`) };
}

type Attempt = {
  method: "POST" | "GET";
  unit: "seconds" | "milliseconds";
};

const ATTEMPTS: Attempt[] = [
  { method: "POST", unit: "seconds" },
  { method: "POST", unit: "milliseconds" },
  { method: "GET", unit: "seconds" },
  { method: "GET", unit: "milliseconds" },
];

/** aaPanel asks callers to keep the session cookie across requests. */
let cookieJar = "";

function rememberCookies(response: Response) {
  const cookies = response.headers.getSetCookie?.() ?? [];
  if (cookies.length === 0) return;
  cookieJar = cookies.map((cookie) => cookie.split(";")[0]).join("; ");
}

async function call(attempt: Attempt, path: string, params: Record<string, string> = {}) {
  const auth = signature(attempt.unit);
  const url = new URL(`${BASE}${path}`);
  const body = new URLSearchParams({ ...auth, ...params });

  if (attempt.method === "GET") {
    for (const [key, value] of body) url.searchParams.set(key, value);
  }

  const response = await fetch(url, {
    method: attempt.method,
    headers: {
      ...(attempt.method === "POST"
        ? { "Content-Type": "application/x-www-form-urlencoded" }
        : {}),
      ...(cookieJar ? { Cookie: cookieJar } : {}),
      "User-Agent": "my-crm-probe",
    },
    body: attempt.method === "POST" ? body : undefined,
    signal: AbortSignal.timeout(TIMEOUT_MS),
    redirect: "manual",
  });

  rememberCookies(response);
  const text = await response.text();
  return { status: response.status, text };
}

/** The panel answers a rejected signature with 200 and a JSON error body. */
function looksAuthenticated(text: string) {
  const lowered = text.toLowerCase();
  if (lowered.includes("cpurealused") || lowered.includes("memtotal")) return true;
  if (lowered.includes("request_token") || lowered.includes("checktoken")) return false;
  if (lowered.includes("<html")) return false;
  return null;
}

async function main() {
  if (!BASE || !KEY) {
    console.error(
      [
        "Isi dulu di .env:",
        '  AAPANEL_URL="http://alamat-panel:port"',
        '  AAPANEL_API_KEY="api_sk dari Settings → API"',
      ].join("\n"),
    );
    process.exit(1);
  }

  console.log(`Menghubungi ${BASE}\n`);

  for (const attempt of ATTEMPTS) {
    const label = `${attempt.method} + timestamp ${attempt.unit}`;
    try {
      cookieJar = "";
      const { status, text } = await call(attempt, "/system?action=GetSystemTotal");
      const ok = looksAuthenticated(text);

      if (ok === true) {
        console.log(`✅ BERHASIL — ${label} (HTTP ${status})`);
        console.log(`   Cookie dikirim balik: ${cookieJar ? "ya" : "tidak"}`);
        try {
          const data = JSON.parse(text) as Record<string, unknown>;
          console.log(
            `   Sistem : ${data.system ?? "-"}\n` +
              `   Panel  : versi ${data.version ?? "-"}\n` +
              `   CPU    : ${data.cpuNum ?? "-"} core, terpakai ${data.cpuRealUsed ?? "-"}%\n` +
              `   Memori : ${data.memRealUsed ?? "-"} / ${data.memTotal ?? "-"} MB`,
          );
        } catch {
          console.log(`   Respons: ${text.slice(0, 200)}`);
        }
        console.log(`\nPakai kombinasi ini untuk adapter: ${label}.`);
        return;
      }

      console.log(
        `❌ ${label} — HTTP ${status}: ${text.slice(0, 160).replace(/\s+/g, " ")}`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(`❌ ${label} — ${message}`);
    }
  }

  console.error(
    [
      "",
      "Tidak ada kombinasi yang diterima. Periksa berurutan:",
      "  1. IP publik komputer ini sudah masuk whitelist di Settings → API?",
      "     Cek IP sekarang: curl -s https://api.ipify.org",
      "  2. AAPANEL_URL sudah termasuk http:// atau https:// dan portnya benar?",
      "  3. Kalau panel pakai HTTPS dengan sertifikat sendiri, jalankan dengan:",
      "     NODE_TLS_REJECT_UNAUTHORIZED=0 npm run aapanel:probe",
      "  4. api_sk masih yang terbaru? Menekan tombol regenerate mengubahnya.",
    ].join("\n"),
  );
  process.exit(1);
}

void main();

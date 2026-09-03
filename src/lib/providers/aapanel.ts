import { createHash } from "node:crypto";

/**
 * Adapter for the aaPanel HTTP API.
 *
 * Verified against aaPanel 8.0.6: requests are POST with the signature in the
 * form body, `request_time` in whole seconds, and the panel expects its session
 * cookie back on later calls. The vendor's Postman sample uses milliseconds and
 * query parameters; that combination is rejected.
 *
 * Every method here is read-only. Nothing in this file changes server state.
 */
const TIMEOUT_MS = 15_000;

function md5(value: string) {
  return createHash("md5").update(value).digest("hex");
}

export type AapanelSite = {
  id: number;
  name: string;
  path: string;
  /** "1" means the site is serving; "0" means stopped. */
  status: string;
  addtime: string;
  edate: string;
  php_version?: string;
  project_type?: string;
  quota?: { size?: number; used?: number; free?: number };
  ssl?: { issuer?: string; issuer_O?: string; notAfter?: string; notBefore?: string } | number;
};

export type AapanelSystem = {
  system?: string;
  version?: string;
  cpuNum?: number;
  cpuRealUsed?: number;
  memTotal?: number;
  memRealUsed?: number;
};

export class AapanelError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "AapanelError";
  }
}

export class AapanelClient {
  private cookie = "";

  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
  ) {}

  private async call<T>(path: string, params: Record<string, string> = {}) {
    const now = Math.floor(Date.now() / 1000);
    const body = new URLSearchParams({
      request_time: String(now),
      request_token: md5(`${now}${md5(this.apiKey)}`),
      ...params,
    });

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl.replace(/\/$/, "")}${path}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          ...(this.cookie ? { Cookie: this.cookie } : {}),
        },
        body,
        signal: AbortSignal.timeout(TIMEOUT_MS),
        redirect: "manual",
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new AapanelError(
        `Tidak bisa menghubungi panel: ${reason}. Periksa alamat, port, dan whitelist IP.`,
      );
    }

    const cookies = response.headers.getSetCookie?.() ?? [];
    if (cookies.length > 0) {
      this.cookie = cookies.map((entry) => entry.split(";")[0]).join("; ");
    }

    const text = await response.text();

    // A rejected signature still answers 200 with an HTML login page or a JSON
    // error, so the body decides whether the call really succeeded.
    if (text.trimStart().startsWith("<")) {
      throw new AapanelError(
        "Panel membalas halaman HTML, bukan JSON. Biasanya berarti IP belum di-whitelist atau kunci API salah.",
        response.status,
      );
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new AapanelError(
        `Respons panel tidak bisa dibaca: ${text.slice(0, 160)}`,
        response.status,
      );
    }

    if (
      parsed &&
      typeof parsed === "object" &&
      "status" in parsed &&
      (parsed as { status?: unknown }).status === false
    ) {
      const message = (parsed as { msg?: string }).msg ?? "Permintaan ditolak panel";
      throw new AapanelError(message, response.status);
    }

    return parsed as T;
  }

  /** Panel version and load. Also the cheapest way to test a connection. */
  async getSystemTotal() {
    return this.call<AapanelSystem>("/system?action=GetSystemTotal");
  }

  async getDiskInfo() {
    return this.call<
      Array<{ filesystem: string; path: string; size: string[] }>
    >("/system?action=GetDiskInfo");
  }

  /**
   * Lists sites. The panel filters to PHP and WordPress projects by default and
   * requires an explicit `limit`.
   */
  async listSites(limit = 500) {
    const result = await this.call<{ data?: AapanelSite[] }>(
      "/data?action=getData&table=sites",
      { limit: String(limit), p: "1" },
    );
    return result.data ?? [];
  }
}

/** Normalises the SSL block, which is `-1` when no certificate is installed. */
export function readSsl(site: AapanelSite) {
  if (!site.ssl || typeof site.ssl !== "object") return null;
  const expires = site.ssl.notAfter ? new Date(site.ssl.notAfter) : null;
  return {
    issuer: site.ssl.issuer_O ?? site.ssl.issuer ?? null,
    expiresAt: expires && !Number.isNaN(expires.getTime()) ? expires : null,
  };
}

/** aaPanel reports `0000-00-00` for "never expires". */
export function readExpiry(value: string | undefined) {
  if (!value || value.startsWith("0000")) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

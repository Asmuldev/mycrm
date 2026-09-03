import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "node:crypto";

/**
 * Symmetric encryption for third-party credentials kept in the database, such
 * as control panel API keys. A leaked database dump alone must not hand over
 * control of the servers.
 *
 * The key comes from APP_ENCRYPTION_KEY when set. It falls back to a value
 * derived from AUTH_SECRET so an existing install keeps working, but the two
 * should be separated in production: rotating the session secret would
 * otherwise make every stored credential unreadable.
 */
function encryptionKey() {
  const source = process.env.APP_ENCRYPTION_KEY || process.env.AUTH_SECRET;
  if (!source) {
    throw new Error("APP_ENCRYPTION_KEY atau AUTH_SECRET harus diisi");
  }
  return scryptSync(source, "my-crm-secret-store", 32);
}

export function encryptSecret(plain: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(plain, "utf8"),
    cipher.final(),
  ]);
  // iv:tag:ciphertext, all base64, so the whole thing fits one text column.
  return [
    iv.toString("base64"),
    cipher.getAuthTag().toString("base64"),
    encrypted.toString("base64"),
  ].join(":");
}

export function decryptSecret(payload: string) {
  const [ivPart, tagPart, dataPart] = payload.split(":");
  if (!ivPart || !tagPart || !dataPart) {
    throw new Error("Format ciphertext tidak dikenal");
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(ivPart, "base64"),
  );
  decipher.setAuthTag(Buffer.from(tagPart, "base64"));

  return Buffer.concat([
    decipher.update(Buffer.from(dataPart, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

/** Shows enough of a key to recognise it without revealing it. */
export function maskSecret(plain: string) {
  if (plain.length <= 8) return "••••";
  return `${plain.slice(0, 4)}••••${plain.slice(-4)}`;
}

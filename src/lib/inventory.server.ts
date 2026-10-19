// Server only. Encrypts voucher codes before they touch the database.
import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto";

function key(): Buffer {
  const raw = process.env["INVENTORY_ENCRYPTION_KEY"];
  if (!raw) throw new Error("INVENTORY_ENCRYPTION_KEY is not set. Generate one with: openssl rand -base64 32");
  const k = Buffer.from(raw, "base64");
  if (k.length !== 32) throw new Error("INVENTORY_ENCRYPTION_KEY must be 32 bytes, base64 encoded.");
  return k;
}

/** AES-256-GCM. Output = base64(iv[12] | authTag[16] | ciphertext). */
export function encryptCode(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), ct]).toString("base64");
}

export function decryptCode(encrypted: string): string {
  const buf = Buffer.from(encrypted, "base64");
  const d = createDecipheriv("aes-256-gcm", key(), buf.subarray(0, 12));
  d.setAuthTag(buf.subarray(12, 28));
  return Buffer.concat([d.update(buf.subarray(28)), d.final()]).toString("utf8");
}

/** Keyed hash used only to reject duplicate uploads without storing plaintext. */
export function hashCode(plain: string): string {
  return createHmac("sha256", key()).update(`code-hash:${plain}`).digest("hex");
}

/**
 * Encrypts sign-in tokens into a cookie value (AES-256-GCM). The cookie is httpOnly, so the page's
 * JavaScript can't read it, and only this server (which knows ACCOUNTS_SECRET) can open it.
 * Nothing is stored on the server: there's no database.
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

function key(secret: string): Buffer {
  return createHash("sha256").update(`companion-accounts:${secret}`).digest();
}

export function seal(data: unknown, secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(secret), iv);
  const body = Buffer.concat([cipher.update(JSON.stringify(data), "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64url");
}

/** Returns null for anything tampered with, expired keys, or rubbish. */
export function unseal<T>(value: string | undefined, secret: string): T | null {
  if (!value) return null;
  try {
    const raw = Buffer.from(value, "base64url");
    if (raw.length < 29) return null;
    const decipher = createDecipheriv("aes-256-gcm", key(secret), raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    const text = Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8");
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

/** PKCE code challenge (S256). */
export function challenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

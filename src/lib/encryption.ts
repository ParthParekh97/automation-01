import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";

function getKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error(
      "ENCRYPTION_KEY must be a 64-character hex string. Generate with: openssl rand -hex 32"
    );
  }
  return Buffer.from(hex, "hex");
}

/**
 * Encrypts a plaintext string with AES-256-GCM.
 * Output format: base64url(iv) . base64url(authTag) . base64url(ciphertext)
 */
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(12); // 96-bit IV — recommended for GCM
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag(); // 128-bit tag
  return [
    iv.toString("base64url"),
    authTag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

/**
 * Decrypts a value produced by encrypt().
 */
export function decrypt(encoded: string): string {
  const parts = encoded.split(".");
  if (parts.length !== 3) throw new Error("Invalid encrypted token format");
  const [ivB64, tagB64, encB64] = parts;
  const key = getKey();
  const decipher = createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(ivB64, "base64url")
  );
  decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encB64, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

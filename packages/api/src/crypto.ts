/**
 * Token encryption/decryption utilities for connected platform credentials.
 *
 * Uses AES-256-GCM (authenticated encryption) so any tampering with the
 * ciphertext is detected before decryption.
 *
 * Ciphertext format (colon-delimited, all hex):
 *   <12-byte IV>:<16-byte GCM auth tag>:<ciphertext>
 *
 * Required env var:
 *   TOKEN_ENCRYPTION_KEY — 64 hex characters (= 32 bytes for AES-256)
 *   Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 */

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // bytes – recommended for GCM
const KEY_LENGTH = 32; // bytes – AES-256

function getEncryptionKey(): Buffer {
  const keyHex = process.env.TOKEN_ENCRYPTION_KEY;
  if (!keyHex) {
    throw new Error("TOKEN_ENCRYPTION_KEY environment variable is not set");
  }
  const key = Buffer.from(keyHex, "hex");
  if (key.length !== KEY_LENGTH) {
    throw new Error(
      `TOKEN_ENCRYPTION_KEY must be ${KEY_LENGTH * 2} hex characters (${KEY_LENGTH} bytes)`
    );
  }
  return key;
}

/**
 * Encrypts a plaintext token string.
 * Returns a colon-delimited hex string: iv:authTag:ciphertext
 */
export function encryptToken(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return [iv.toString("hex"), authTag.toString("hex"), encrypted.toString("hex")].join(":");
}

/**
 * Validates that TOKEN_ENCRYPTION_KEY is present and correctly formatted.
 * Call this at application startup to catch misconfiguration before any user
 * traffic hits the encryption/decryption paths.
 *
 * Throws with a descriptive message if the key is missing or invalid.
 */
export function validateEncryptionKey(): void {
  getEncryptionKey(); // throws with a clear message if misconfigured
}

/**
 * Decrypts a token string previously produced by encryptToken.
 * Throws if the key is wrong or the ciphertext has been tampered with.
 */
export function decryptToken(ciphertext: string): string {
  const key = getEncryptionKey();
  const parts = ciphertext.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid ciphertext format");
  }
  const [ivHex, authTagHex, encryptedHex] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const encrypted = Buffer.from(encryptedHex, "hex");
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return (
    decipher.update(encrypted).toString("utf8") + decipher.final("utf8")
  );
}

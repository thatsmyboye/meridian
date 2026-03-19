/**
 * encryptToken / decryptToken — Unit Tests
 *
 * Verifies that the AES-256-GCM token encryption utilities in @meridian/api
 * correctly encrypt and decrypt OAuth tokens that are persisted to the
 * connected_platforms table.
 *
 * Required env var:
 *   TOKEN_ENCRYPTION_KEY — 64 hex chars (32 bytes). Tests set this via
 *   process.env before each test and restore it afterward.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { encryptToken, decryptToken, validateEncryptionKey } from "@meridian/api";

// A valid 64-hex-character (32-byte) test key. Never use this in production.
const TEST_KEY = "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2";

// ─── encryptToken ─────────────────────────────────────────────────────────────

describe("encryptToken", () => {
  beforeEach(() => {
    process.env.TOKEN_ENCRYPTION_KEY = TEST_KEY;
  });

  afterEach(() => {
    delete process.env.TOKEN_ENCRYPTION_KEY;
  });

  it("returns a string in iv:authTag:ciphertext hex format", () => {
    const ct = encryptToken("ya29.some_access_token");
    const parts = ct.split(":");
    expect(parts).toHaveLength(3);
    // Each part must be a non-empty hex string (only 0-9a-f characters)
    for (const part of parts) {
      expect(part.length).toBeGreaterThan(0);
      expect(part).toMatch(/^[0-9a-f]+$/);
    }
  });

  it("produces a 24-char IV (12 bytes) and 32-char auth tag (16 bytes)", () => {
    const ct = encryptToken("test_token");
    const [ivHex, authTagHex] = ct.split(":");
    expect(ivHex).toHaveLength(24);   // 12 bytes × 2 hex chars/byte
    expect(authTagHex).toHaveLength(32); // 16 bytes × 2 hex chars/byte
  });

  it("uses a fresh random IV on every call (probabilistic)", () => {
    const token = "same_token_value";
    const ct1 = encryptToken(token);
    const ct2 = encryptToken(token);
    // Two encryptions of the same plaintext must produce different ciphertexts
    expect(ct1).not.toBe(ct2);
    // IVs must differ
    const iv1 = ct1.split(":")[0];
    const iv2 = ct2.split(":")[0];
    expect(iv1).not.toBe(iv2);
  });

  it("handles a typical Google OAuth access token", () => {
    const token = "ya29.a0AfH6SMBx-real-looking-google-token_with_underscores-and-dashes";
    expect(() => encryptToken(token)).not.toThrow();
  });

  it("handles a typical Google OAuth refresh token", () => {
    const token = "1//0gYour-refresh-token-here_some-long-opaque-string";
    expect(() => encryptToken(token)).not.toThrow();
  });

  it("throws if TOKEN_ENCRYPTION_KEY is not set", () => {
    delete process.env.TOKEN_ENCRYPTION_KEY;
    expect(() => encryptToken("token")).toThrow(
      "TOKEN_ENCRYPTION_KEY environment variable is not set"
    );
  });

  it("throws if TOKEN_ENCRYPTION_KEY is too short", () => {
    process.env.TOKEN_ENCRYPTION_KEY = "deadbeef"; // 8 chars = 4 bytes, not 32
    expect(() => encryptToken("token")).toThrow();
  });

  it("throws if TOKEN_ENCRYPTION_KEY is too long", () => {
    process.env.TOKEN_ENCRYPTION_KEY = TEST_KEY + "00"; // 66 chars = 33 bytes
    expect(() => encryptToken("token")).toThrow();
  });

  it("accepts a key with leading/trailing whitespace (trims it)", () => {
    process.env.TOKEN_ENCRYPTION_KEY = `  ${TEST_KEY}  `;
    expect(() => encryptToken("token")).not.toThrow();
  });

  it("accepts a key with a trailing newline (trims it)", () => {
    process.env.TOKEN_ENCRYPTION_KEY = `${TEST_KEY}\n`;
    expect(() => encryptToken("token")).not.toThrow();
  });

  it("throws if TOKEN_ENCRYPTION_KEY contains non-hex characters", () => {
    // Replace last 2 chars with 'zz' (not valid hex)
    process.env.TOKEN_ENCRYPTION_KEY = TEST_KEY.slice(0, -2) + "zz";
    expect(() => encryptToken("token")).toThrow(/non-hex/);
  });
});

// ─── decryptToken ─────────────────────────────────────────────────────────────

describe("decryptToken", () => {
  beforeEach(() => {
    process.env.TOKEN_ENCRYPTION_KEY = TEST_KEY;
  });

  afterEach(() => {
    delete process.env.TOKEN_ENCRYPTION_KEY;
  });

  it("throws on a ciphertext with fewer than 3 colon-separated parts", () => {
    expect(() => decryptToken("onlyone")).toThrow("Invalid ciphertext format");
    expect(() => decryptToken("only:two")).toThrow("Invalid ciphertext format");
  });

  it("throws on a ciphertext with more than 3 colon-separated parts", () => {
    expect(() => decryptToken("a:b:c:d")).toThrow("Invalid ciphertext format");
  });

  it("throws if the auth tag has been tampered with", () => {
    const ct = encryptToken("sensitive_token");
    const [iv, , ciphertext] = ct.split(":");
    const tamperedAuthTag = "0".repeat(32); // 16 zero bytes
    const tampered = [iv, tamperedAuthTag, ciphertext].join(":");
    expect(() => decryptToken(tampered)).toThrow();
  });

  it("throws if the ciphertext body has been tampered with", () => {
    const ct = encryptToken("sensitive_token");
    const [iv, authTag] = ct.split(":");
    const tamperedCiphertext = "ff".repeat(20);
    const tampered = [iv, authTag, tamperedCiphertext].join(":");
    expect(() => decryptToken(tampered)).toThrow();
  });

  it("throws if TOKEN_ENCRYPTION_KEY is not set", () => {
    const ct = encryptToken("token");
    delete process.env.TOKEN_ENCRYPTION_KEY;
    expect(() => decryptToken(ct)).toThrow(
      "TOKEN_ENCRYPTION_KEY environment variable is not set"
    );
  });

  it("throws if a different key is used for decryption", () => {
    const ct = encryptToken("token");
    // Switch to a different valid key
    process.env.TOKEN_ENCRYPTION_KEY = "b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3";
    expect(() => decryptToken(ct)).toThrow();
  });
});

// ─── validateEncryptionKey ────────────────────────────────────────────────────

describe("validateEncryptionKey", () => {
  it("does not throw when TOKEN_ENCRYPTION_KEY is valid", () => {
    process.env.TOKEN_ENCRYPTION_KEY = TEST_KEY;
    expect(() => validateEncryptionKey()).not.toThrow();
    delete process.env.TOKEN_ENCRYPTION_KEY;
  });

  it("throws when TOKEN_ENCRYPTION_KEY is not set", () => {
    const original = process.env.TOKEN_ENCRYPTION_KEY;
    delete process.env.TOKEN_ENCRYPTION_KEY;
    expect(() => validateEncryptionKey()).toThrow(
      "TOKEN_ENCRYPTION_KEY environment variable is not set"
    );
    if (original !== undefined) process.env.TOKEN_ENCRYPTION_KEY = original;
  });

  it("throws when TOKEN_ENCRYPTION_KEY has wrong length", () => {
    process.env.TOKEN_ENCRYPTION_KEY = "tooshort";
    expect(() => validateEncryptionKey()).toThrow();
    delete process.env.TOKEN_ENCRYPTION_KEY;
  });
});

// ─── Round-trip ───────────────────────────────────────────────────────────────

describe("encryptToken / decryptToken round-trip", () => {
  beforeEach(() => {
    process.env.TOKEN_ENCRYPTION_KEY = TEST_KEY;
  });

  afterEach(() => {
    delete process.env.TOKEN_ENCRYPTION_KEY;
  });

  const tokens = [
    "ya29.a0AfH6SMBxample_Google_access_token",
    "1//0gRefreshToken_example",
    "short",
    "a",
    "token with spaces",
    "token\twith\ttabs",
    "unicode: café résumé 日本語",
    "special chars: !@#$%^&*()_+-=[]{}|;':\",./<>?",
    // Simulate a JWT-like token (contains dots and base64url chars)
    "eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiIxMjM0In0.signature",
  ];

  tokens.forEach((token) => {
    it(`round-trips: ${token.slice(0, 40)}${token.length > 40 ? "…" : ""}`, () => {
      const ciphertext = encryptToken(token);
      const decrypted = decryptToken(ciphertext);
      expect(decrypted).toBe(token);
    });
  });

  it("each encryption produces a unique ciphertext but decrypts to the same value", () => {
    const token = "ya29.consistent_token";
    const ct1 = encryptToken(token);
    const ct2 = encryptToken(token);
    expect(ct1).not.toBe(ct2); // different IVs → different ciphertexts
    expect(decryptToken(ct1)).toBe(token);
    expect(decryptToken(ct2)).toBe(token);
  });
});

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

function getKey(): Buffer {
  return crypto.randomBytes(32);
}

function encrypt(plaintext: string, key: Buffer): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const result = Buffer.concat([iv, authTag, encrypted]);
  return result.toString("base64");
}

function decrypt(encoded: string, key: Buffer): string {
  const data = Buffer.from(encoded, "base64");
  const iv = data.subarray(0, IV_LENGTH);
  const authTag = data.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const encrypted = data.subarray(IV_LENGTH + TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString("utf8");
}

function maskValue(plaintext: string): string {
  if (plaintext.length <= 4) return "****";
  return (
    plaintext.substring(0, 2) +
    "*".repeat(Math.min(plaintext.length - 4, 8)) +
    plaintext.substring(plaintext.length - 2)
  );
}

const TEST_KEY = getKey();

describe("AES-256-GCM Encryption/Decryption", () => {
  it("should encrypt and decrypt a simple string", () => {
    const plaintext = "hello world";
    const encrypted = encrypt(plaintext, TEST_KEY);
    const decrypted = decrypt(encrypted, TEST_KEY);
    expect(decrypted).toBe(plaintext);
  });

  it("should produce different ciphertext for same plaintext (random IV)", () => {
    const plaintext = "same input";
    const e1 = encrypt(plaintext, TEST_KEY);
    const e2 = encrypt(plaintext, TEST_KEY);
    expect(e1).not.toBe(e2);
  });

  it("should handle empty string", () => {
    const encrypted = encrypt("", TEST_KEY);
    const decrypted = decrypt(encrypted, TEST_KEY);
    expect(decrypted).toBe("");
  });

  it("should handle unicode characters", () => {
    const plaintext = "日本語テスト 🔐 émojis";
    const encrypted = encrypt(plaintext, TEST_KEY);
    const decrypted = decrypt(encrypted, TEST_KEY);
    expect(decrypted).toBe(plaintext);
  });

  it("should handle very long strings", () => {
    const plaintext = "x".repeat(100_000);
    const encrypted = encrypt(plaintext, TEST_KEY);
    const decrypted = decrypt(encrypted, TEST_KEY);
    expect(decrypted).toBe(plaintext);
  });

  it("should produce base64-encoded output", () => {
    const encrypted = encrypt("test", TEST_KEY);
    expect(/^[A-Za-z0-9+/]+=*$/.test(encrypted)).toBe(true);
  });

  it("should fail decryption with wrong key", () => {
    const encrypted = encrypt("secret", TEST_KEY);
    const wrongKey = getKey();
    expect(() => decrypt(encrypted, wrongKey)).toThrow();
  });

  it("should fail decryption with tampered data", () => {
    const encrypted = encrypt("secret", TEST_KEY);
    const tampered = encrypted.slice(0, -2) + "AA";
    expect(() => decrypt(tampered, TEST_KEY)).toThrow();
  });

  it("should fail decryption with truncated ciphertext", () => {
    const encrypted = encrypt("secret", TEST_KEY);
    expect(() => decrypt(encrypted.substring(0, 10), TEST_KEY)).toThrow();
  });

  it("encrypted output should be larger than plaintext", () => {
    const plaintext = "small";
    const encrypted = encrypt(plaintext, TEST_KEY);
    expect(encrypted.length).toBeGreaterThan(plaintext.length);
  });

  it("encrypted size should grow with plaintext size", () => {
    const e1 = encrypt("a", TEST_KEY);
    const e2 = encrypt("a".repeat(1000), TEST_KEY);
    expect(e2.length).toBeGreaterThan(e1.length);
  });
});

describe("Key Validation", () => {
  it("should require a 32-byte key for AES-256", () => {
    const key = getKey();
    expect(key.length).toBe(32);
  });

  it("should fail with a short key", () => {
    const shortKey = crypto.randomBytes(16);
    expect(() => encrypt("test", shortKey)).toThrow();
  });
});

describe("Value Masking", () => {
  it("should mask values showing first 2 and last 2 characters", () => {
    const masked = maskValue("SuperSecret123");
    expect(masked.startsWith("Su")).toBe(true);
    expect(masked.endsWith("23")).toBe(true);
    expect(masked).toContain("*");
  });

  it("should mask very short values with ****", () => {
    expect(maskValue("ab")).toBe("****");
    expect(maskValue("a")).toBe("****");
    expect(maskValue("")).toBe("****");
  });

  it("should mask values of 4 characters with stars", () => {
    const masked = maskValue("abcd");
    expect(masked).toBe("****");
  });

  it("should cap the mask at 8 asterisks", () => {
    const longValue = "A".repeat(20);
    const masked = maskValue(longValue);
    const starCount = (masked.match(/\*/g) || []).length;
    expect(starCount).toBeLessThanOrEqual(8);
  });
});

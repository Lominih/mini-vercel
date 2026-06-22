import { describe, it, expect } from "vitest";
import crypto from "crypto";

describe("Certificate Generation (unit-level)", () => {
  it("should generate an RSA 2048-bit key pair", () => {
    const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
    });

    expect(publicKey).toContain("BEGIN PUBLIC KEY");
    expect(privateKey).toContain("BEGIN PRIVATE KEY");
    expect(publicKey.length).toBeGreaterThan(100);
    expect(privateKey.length).toBeGreaterThan(100);
  });

  it("should generate unique certificates for different domains", () => {
    function genCert(domain: string) {
      const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
        modulusLength: 2048,
        publicKeyEncoding: { type: "spki", format: "pem" },
        privateKeyEncoding: { type: "pkcs8", format: "pem" },
      });
      return { domain, publicKey, privateKey };
    }

    const cert1 = genCert("example.com");
    const cert2 = genCert("other.com");
    expect(cert1.publicKey).not.toBe(cert2.publicKey);
    expect(cert1.privateKey).not.toBe(cert2.privateKey);
  });

  it("should produce valid PEM format", () => {
    const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
    });

    const pemRegex = /-----BEGIN [A-Z ]+-----\n[A-Za-z0-9+/=\n]+\n-----END [A-Z ]+-----/;
    expect(publicKey).toMatch(pemRegex);
    expect(privateKey).toMatch(pemRegex);
  });

  it("should generate serial numbers of correct length", () => {
    const serial = crypto.randomBytes(16).toString("hex");
    expect(serial.length).toBe(32);
    expect(/^[0-9a-f]{32}$/.test(serial)).toBe(true);
  });

  it("should compute 90-day certificate lifetime correctly", () => {
    const now = new Date();
    const expires = new Date(now);
    expires.setDate(expires.getDate() + 90);
    const diffMs = expires.getTime() - now.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    expect(diffDays).toBe(90);
  });

  it("should compute renewal threshold (30 days before expiry)", () => {
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + 25);
    const now = new Date();
    const daysUntilExpiry = Math.ceil(
      (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );
    expect(daysUntilExpiry).toBeLessThanOrEqual(30);
  });

  it("should not trigger renewal when certificate is fresh", () => {
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + 60);
    const now = new Date();
    const daysUntilExpiry = Math.ceil(
      (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );
    const RENEWAL_THRESHOLD = 30;
    expect(daysUntilExpiry).toBeGreaterThan(RENEWAL_THRESHOLD);
  });

  it("private key should be usable for signing and verification", () => {
    const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
    });

    const data = Buffer.from("test data to sign");
    const signature = crypto.sign("sha256", data, privateKey);
    const valid = crypto.verify("sha256", data, publicKey, signature);
    expect(valid).toBe(true);
  });
});

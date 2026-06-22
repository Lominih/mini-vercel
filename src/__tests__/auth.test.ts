import { describe, it, expect, beforeEach } from "vitest";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import {
  generateToken,
  generateRefreshToken,
  verifyToken,
  JWT_SECRET,
  JWT_EXPIRES_IN,
  JWT_REFRESH_EXPIRES_IN,
} from "@/services/auth";
import type { JwtPayload } from "@/services/auth";

function makePayload(overrides: Partial<JwtPayload> = {}): JwtPayload {
  return { userId: "user-123", email: "test@example.com", ...overrides };
}

describe("JWT Token Generation", () => {
  it("should generate a valid access token string", () => {
    const token = generateToken(makePayload());
    expect(typeof token).toBe("string");
    expect(token.split(".")).toHaveLength(3);
  });

  it("should generate a valid refresh token string", () => {
    const token = generateRefreshToken(makePayload());
    expect(typeof token).toBe("string");
    expect(token.split(".")).toHaveLength(3);
  });

  it("should produce different tokens for different payloads", () => {
    const t1 = generateToken(makePayload({ userId: "a" }));
    const t2 = generateToken(makePayload({ userId: "b" }));
    expect(t1).not.toBe(t2);
  });

  it("should include userId and email in the token payload", () => {
    const payload = makePayload({ userId: "u-1", email: "a@b.com" });
    const token = generateToken(payload);
    const decoded = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;
    expect(decoded.userId).toBe("u-1");
    expect(decoded.email).toBe("a@b.com");
  });

  it("should set expiration from JWT_EXPIRES_IN for access tokens", () => {
    const token = generateToken(makePayload());
    const decoded = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;
    expect(decoded.exp).toBeDefined();
    expect(decoded.iat).toBeDefined();
    expect(decoded.exp! - decoded.iat!).toBeGreaterThan(0);
  });

  it("should set longer expiration for refresh tokens", () => {
    const access = generateToken(makePayload());
    const refresh = generateRefreshToken(makePayload());
    const accessDecoded = jwt.verify(access, JWT_SECRET) as jwt.JwtPayload;
    const refreshDecoded = jwt.verify(refresh, JWT_SECRET) as jwt.JwtPayload;
    expect(refreshDecoded.exp!).toBeGreaterThan(accessDecoded.exp!);
  });

  it("should use the configured JWT secret", () => {
    const payload = makePayload();
    const token = generateToken(payload);
    const decoded = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;
    expect(decoded.userId).toBe(payload.userId);
  });
});

describe("JWT Token Verification", () => {
  it("should verify a valid token and return the payload", () => {
    const payload = makePayload();
    const token = generateToken(payload);
    const decoded = verifyToken(token);
    expect(decoded.userId).toBe(payload.userId);
    expect(decoded.email).toBe(payload.email);
  });

  it("should throw on an invalid token", () => {
    expect(() => verifyToken("invalid.token.here")).toThrow();
  });

  it("should throw on an expired token", () => {
    const token = jwt.sign(makePayload(), JWT_SECRET, { expiresIn: "0s" });
    expect(() => verifyToken(token)).toThrow();
  });

  it("should throw when verified with wrong secret", () => {
    const token = jwt.sign(makePayload(), "wrong-secret");
    expect(() => verifyToken(token)).toThrow();
  });

  it("should verify refresh tokens the same way", () => {
    const payload = makePayload();
    const refreshToken = generateRefreshToken(payload);
    const decoded = verifyToken(refreshToken);
    expect(decoded.userId).toBe(payload.userId);
  });
});

describe("Password Hashing", () => {
  const password = "SuperSecret123!";

  it("should hash a password to a bcrypt string", async () => {
    const hash = await bcrypt.hash(password, 12);
    expect(hash).toMatch(/^\$2[aby]?\$/);
    expect(hash).not.toBe(password);
  });

  it("should produce different hashes for the same input", async () => {
    const h1 = await bcrypt.hash(password, 12);
    const h2 = await bcrypt.hash(password, 12);
    expect(h1).not.toBe(h2);
  });

  it("should verify a correct password against its hash", async () => {
    const hash = await bcrypt.hash(password, 12);
    const result = await bcrypt.compare(password, hash);
    expect(result).toBe(true);
  });

  it("should reject an incorrect password", async () => {
    const hash = await bcrypt.hash(password, 12);
    const result = await bcrypt.compare("WrongPassword!", hash);
    expect(result).toBe(false);
  });

  it("should handle empty string password", async () => {
    const hash = await bcrypt.hash("", 12);
    const result = await bcrypt.compare("", hash);
    expect(result).toBe(true);
  });

  it("should handle very long passwords", async () => {
    const longPw = "a".repeat(72);
    const hash = await bcrypt.hash(longPw, 12);
    const result = await bcrypt.compare(longPw, hash);
    expect(result).toBe(true);
  });
});

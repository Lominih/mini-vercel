import { randomBytes, timingSafeEqual } from "crypto";
export function generateCsrfToken(): string { return randomBytes(32).toString("hex"); }
export function validateCsrfToken(token: string, secret: string): boolean {
  if (!token || !secret || token.length !== secret.length) return false;
  try { return timingSafeEqual(Buffer.from(token, "utf8"), Buffer.from(secret, "utf8")); } catch { return false; }
}
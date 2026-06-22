import { describe, it, expect } from "vitest";
import { generateCsrfToken, validateCsrfToken } from "@/lib/csrf";
describe("csrf", () => {
  it("generates 64-char hex", () => { expect(generateCsrfToken()).toHaveLength(64); });
  it("validates correct", () => { const t = generateCsrfToken(); expect(validateCsrfToken(t, t)).toBe(true); });
  it("rejects tampered", () => { expect(validateCsrfToken(generateCsrfToken() + "a", "x")).toBe(false); });
  it("rejects empty", () => { expect(validateCsrfToken("", "s")).toBe(false); });
});
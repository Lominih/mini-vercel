import { describe, it, expect } from "vitest";
import { sanitizeHtml, sanitizeInput } from "@/lib/sanitize";
describe("sanitize", () => {
  it("escapes HTML", () => { expect(sanitizeHtml('<b>x</b>')).toContain("&lt;b&gt;"); });
  it("trims input", () => { expect(sanitizeInput("  hi  ")).toBe("hi"); });
  it("limits length", () => { expect(sanitizeInput("x".repeat(15000))).toHaveLength(10000); });
});
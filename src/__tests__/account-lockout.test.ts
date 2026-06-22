import { describe, it, expect } from "vitest";
import { recordFailedAttempt, isLocked, resetAttempts } from "@/lib/account-lockout";
describe("account-lockout", () => {
  it("tracks attempts", () => { expect(recordFailedAttempt("a@b.com").locked).toBe(false); });
  it("locks after 5", () => { for (let i = 0; i < 5; i++) recordFailedAttempt("lock@b.com"); expect(isLocked("lock@b.com")).toBe(true); });
  it("resets", () => { for (let i = 0; i < 3; i++) recordFailedAttempt("r@b.com"); resetAttempts("r@b.com"); expect(isLocked("r@b.com")).toBe(false); });
});
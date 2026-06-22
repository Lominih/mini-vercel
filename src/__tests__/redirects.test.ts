import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    redirectRule: {
      create: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

import {
  createRedirectRule,
  getRedirectRules,
  updateRedirectRule,
  deleteRedirectRule,
  resolveRedirect,
} from "@/services/redirects";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createRedirectRule", () => {
  it("creates a rule with default 301 status", async () => {
    mockPrisma.redirectRule.create.mockResolvedValue({ id: "r1" });
    const result = await createRedirectRule("proj-1", "/old", "/new");
    expect(result).toEqual({ id: "r1" });
    expect(mockPrisma.redirectRule.create).toHaveBeenCalledWith({
      data: { projectId: "proj-1", source: "/old", target: "/new", statusCode: 301, regex: false, preserveQuery: true },
    });
  });

  it("creates a regex rule", async () => {
    mockPrisma.redirectRule.create.mockResolvedValue({ id: "r2" });
    await createRedirectRule("proj-1", "/blog/(.*)", "/posts/$1", 302, true, false);
    expect(mockPrisma.redirectRule.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ regex: true, statusCode: 302 }),
      })
    );
  });

  it("throws on invalid regex pattern", async () => {
    await expect(
      createRedirectRule("proj-1", "[invalid", "/target", 301, true)
    ).rejects.toThrow("Invalid regex pattern");
  });

  it("throws on invalid status code", async () => {
    await expect(
      createRedirectRule("proj-1", "/a", "/b", 200 as any)
    ).rejects.toThrow("Invalid status code");
  });

  it("accepts status code 307", async () => {
    mockPrisma.redirectRule.create.mockResolvedValue({ id: "r3" });
    await createRedirectRule("proj-1", "/a", "/b", 307);
    expect(mockPrisma.redirectRule.create).toHaveBeenCalled();
  });

  it("accepts status code 308", async () => {
    mockPrisma.redirectRule.create.mockResolvedValue({ id: "r4" });
    await createRedirectRule("proj-1", "/a", "/b", 308);
    expect(mockPrisma.redirectRule.create).toHaveBeenCalled();
  });
});

describe("getRedirectRules", () => {
  it("returns rules for a project", async () => {
    const rules = [{ id: "r1" }, { id: "r2" }];
    mockPrisma.redirectRule.findMany.mockResolvedValue(rules);
    const result = await getRedirectRules("proj-1");
    expect(result).toEqual(rules);
    expect(mockPrisma.redirectRule.findMany).toHaveBeenCalledWith({
      where: { projectId: "proj-1" },
      orderBy: { createdAt: "desc" },
    });
  });

  it("returns empty array when no rules exist", async () => {
    mockPrisma.redirectRule.findMany.mockResolvedValue([]);
    const result = await getRedirectRules("proj-empty");
    expect(result).toEqual([]);
  });
});

describe("updateRedirectRule", () => {
  it("updates rule fields", async () => {
    mockPrisma.redirectRule.update.mockResolvedValue({ id: "r1", source: "/new-src" });
    const result = await updateRedirectRule("r1", { source: "/new-src" });
    expect(result).toEqual({ id: "r1", source: "/new-src" });
    expect(mockPrisma.redirectRule.update).toHaveBeenCalledWith({
      where: { id: "r1" },
      data: { source: "/new-src" },
    });
  });

  it("validates regex when updating source with regex=true", async () => {
    await expect(
      updateRedirectRule("r1", { source: "[bad", regex: true })
    ).rejects.toThrow("Invalid regex pattern");
    expect(mockPrisma.redirectRule.update).not.toHaveBeenCalled();
  });

  it("validates status code on update", async () => {
    await expect(
      updateRedirectRule("r1", { statusCode: 500 as any })
    ).rejects.toThrow("Invalid status code");
  });

  it("allows valid status code update", async () => {
    mockPrisma.redirectRule.update.mockResolvedValue({ id: "r1" });
    await updateRedirectRule("r1", { statusCode: 302 });
    expect(mockPrisma.redirectRule.update).toHaveBeenCalled();
  });
});

describe("deleteRedirectRule", () => {
  it("deletes a rule by id", async () => {
    mockPrisma.redirectRule.delete.mockResolvedValue({ id: "r1" });
    await deleteRedirectRule("r1");
    expect(mockPrisma.redirectRule.delete).toHaveBeenCalledWith({ where: { id: "r1" } });
  });
});

describe("resolveRedirect", () => {
  it("returns not redirected when no rules match", async () => {
    mockPrisma.redirectRule.findMany.mockResolvedValue([
      { source: "/blog", target: "/posts", statusCode: 301, regex: false, preserveQuery: true },
    ]);
    const result = await resolveRedirect("proj-1", "/about");
    expect(result.redirected).toBe(false);
  });

  it("redirects exact match with 301", async () => {
    mockPrisma.redirectRule.findMany.mockResolvedValue([
      { source: "/old", target: "/new", statusCode: 301, regex: false, preserveQuery: true },
    ]);
    const result = await resolveRedirect("proj-1", "/old");
    expect(result.redirected).toBe(true);
    expect(result.target).toBe("/new");
    expect(result.statusCode).toBe(301);
  });

  it("preserves query string when preserveQuery is true", async () => {
    mockPrisma.redirectRule.findMany.mockResolvedValue([
      { source: "/old", target: "/new", statusCode: 302, regex: false, preserveQuery: true },
    ]);
    const result = await resolveRedirect("proj-1", "/old", "foo=bar&baz=1");
    expect(result.target).toContain("foo=bar");
  });

  it("does not preserve query when preserveQuery is false", async () => {
    mockPrisma.redirectRule.findMany.mockResolvedValue([
      { source: "/old", target: "/new", statusCode: 302, regex: false, preserveQuery: false },
    ]);
    const result = await resolveRedirect("proj-1", "/old", "foo=bar");
    expect(result.target).toBe("/new");
  });

  it("resolves regex-based redirect", async () => {
    mockPrisma.redirectRule.findMany.mockResolvedValue([
      { source: "/blog/(.*)", target: "/posts/$1", statusCode: 301, regex: true, preserveQuery: false },
    ]);
    const result = await resolveRedirect("proj-1", "/blog/hello-world");
    expect(result.redirected).toBe(true);
    expect(result.target).toBe("/posts/hello-world");
  });

  it("matches prefix paths", async () => {
    mockPrisma.redirectRule.findMany.mockResolvedValue([
      { source: "/docs", target: "/documentation", statusCode: 301, regex: false, preserveQuery: true },
    ]);
    const result = await resolveRedirect("proj-1", "/docs/api/v2");
    expect(result.redirected).toBe(true);
    expect(result.target).toBe("/documentation/api/v2");
  });

  it("returns the first matching rule", async () => {
    mockPrisma.redirectRule.findMany.mockResolvedValue([
      { source: "/a", target: "/b", statusCode: 301, regex: false, preserveQuery: false },
      { source: "/a", target: "/c", statusCode: 302, regex: false, preserveQuery: false },
    ]);
    const result = await resolveRedirect("proj-1", "/a");
    expect(result.target).toBe("/b");
    expect(result.statusCode).toBe(301);
  });
});

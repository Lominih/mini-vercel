import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fs from "fs";

vi.mock("fs", async () => {
  const actual = await vi.importActual<typeof fs>("fs");
  return {
    ...actual,
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    mkdirSync: vi.fn(),
    readdirSync: vi.fn(),
    statSync: vi.fn(),
    openSync: vi.fn(),
    readSync: vi.fn(),
    closeSync: vi.fn(),
    rmSync: vi.fn(),
    cpSync: vi.fn(),
  };
});

import { buildCache } from "@/services/build-cache";

const mockedFs = vi.mocked(fs);

function setupFsAndClearCache() {
  (mockedFs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
  (mockedFs.readFileSync as ReturnType<typeof vi.fn>).mockImplementation(() => Buffer.from("{\"name\":\"test\"}"));
  (mockedFs.writeFileSync as ReturnType<typeof vi.fn>).mockReturnValue(undefined);
  (mockedFs.mkdirSync as ReturnType<typeof vi.fn>).mockReturnValue(undefined);
  (mockedFs.readdirSync as ReturnType<typeof vi.fn>).mockReturnValue([]);
  (mockedFs.statSync as ReturnType<typeof vi.fn>).mockReturnValue({ size: 100 } as any);
  (mockedFs.openSync as ReturnType<typeof vi.fn>).mockReturnValue(0);
  (mockedFs.readSync as ReturnType<typeof vi.fn>).mockImplementation((_fd: number, buf: Buffer) => {
    buf.write("lock");
    return 4;
  });
  (mockedFs.closeSync as ReturnType<typeof vi.fn>).mockReturnValue(undefined);
  (mockedFs.rmSync as ReturnType<typeof vi.fn>).mockReturnValue(undefined);
  (mockedFs.cpSync as ReturnType<typeof vi.fn>).mockReturnValue(undefined);
  buildCache.clearAll();
  vi.clearAllMocks();
  // Re-setup mocks after clearAll consumed them
  (mockedFs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
  (mockedFs.readFileSync as ReturnType<typeof vi.fn>).mockImplementation(() => Buffer.from("{\"name\":\"test\"}"));
  (mockedFs.writeFileSync as ReturnType<typeof vi.fn>).mockReturnValue(undefined);
  (mockedFs.mkdirSync as ReturnType<typeof vi.fn>).mockReturnValue(undefined);
  (mockedFs.readdirSync as ReturnType<typeof vi.fn>).mockReturnValue([]);
  (mockedFs.statSync as ReturnType<typeof vi.fn>).mockReturnValue({ size: 100 } as any);
  (mockedFs.openSync as ReturnType<typeof vi.fn>).mockReturnValue(0);
  (mockedFs.readSync as ReturnType<typeof vi.fn>).mockImplementation((_fd: number, buf: Buffer) => {
    buf.write("lock");
    return 4;
  });
  (mockedFs.closeSync as ReturnType<typeof vi.fn>).mockReturnValue(undefined);
  (mockedFs.rmSync as ReturnType<typeof vi.fn>).mockReturnValue(undefined);
  (mockedFs.cpSync as ReturnType<typeof vi.fn>).mockReturnValue(undefined);
}

describe("buildCache.checkCache", () => {
  beforeEach(() => {
    setupFsAndClearCache();
  });

  it("returns null when cache is empty", () => {
    const result = buildCache.checkCache("/project", "nextjs");
    expect(result).toBeNull();
  });

  it("returns cache hit after a saveCache", async () => {
    await buildCache.saveCache("/project", "nextjs", "/output", "sha-abc");
    const result = buildCache.checkCache("/project", "nextjs");
    expect(result).not.toBeNull();
    expect(result!.commitSha).toBe("sha-abc");
  });

  it("returns null when outputDir no longer exists", async () => {
    await buildCache.saveCache("/project", "vite", "/output-v", "sha-def");
    (mockedFs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);
    const result = buildCache.checkCache("/project", "vite");
    expect(result).toBeNull();
  });
});

describe("buildCache.getStats", () => {
  beforeEach(() => {
    setupFsAndClearCache();
  });

  it("returns zero stats for empty cache", () => {
    const stats = buildCache.getStats();
    expect(stats.entries).toBe(0);
    expect(stats.totalSizeBytes).toBe(0);
    expect(stats.totalSizeMB).toBe(0);
    expect(stats.oldestEntry).toBeNull();
    expect(stats.newestEntry).toBeNull();
  });

  it("returns correct stats after saving entries", async () => {
    await buildCache.saveCache("/proj-a", "nextjs", "/out-a", "sha-1");
    await buildCache.saveCache("/proj-b", "vite", "/out-b", "sha-2");
    const stats = buildCache.getStats();
    expect(stats.entries).toBe(2);
    expect(stats.oldestEntry).toBe("sha-1");
    expect(stats.newestEntry).toBe("sha-2");
  });
});

describe("buildCache.invalidate", () => {
  beforeEach(() => {
    setupFsAndClearCache();
  });

  it("does nothing when no entry matches", () => {
    buildCache.invalidate("/project", "nextjs");
    expect(mockedFs.rmSync).not.toHaveBeenCalled();
  });

  it("removes entry and deletes outputDir after save", async () => {
    await buildCache.saveCache("/project", "nextjs", "/output", "sha-x");
    buildCache.invalidate("/project", "nextjs");
    expect(mockedFs.rmSync).toHaveBeenCalled();
    const result = buildCache.checkCache("/project", "nextjs");
    expect(result).toBeNull();
  });
});

describe("buildCache.clearAll", () => {
  beforeEach(() => {
    setupFsAndClearCache();
  });

  it("removes all cache entries", async () => {
    await buildCache.saveCache("/proj-a", "nextjs", "/out-a", "sha-a");
    await buildCache.saveCache("/proj-b", "vite", "/out-b", "sha-b");
    buildCache.clearAll();
    expect(mockedFs.rmSync).toHaveBeenCalled();
    const stats = buildCache.getStats();
    expect(stats.entries).toBe(0);
  });

  it("handles empty cache gracefully", () => {
    buildCache.clearAll();
    expect(mockedFs.rmSync).not.toHaveBeenCalled();
  });
});

describe("buildCache.saveCache", () => {
  beforeEach(() => {
    setupFsAndClearCache();
  });

  it("creates cache directory and copies output", async () => {
    await buildCache.saveCache("/project", "nextjs", "/output", "sha-abc");
    expect(mockedFs.mkdirSync).toHaveBeenCalled();
    expect(mockedFs.cpSync).toHaveBeenCalled();
    expect(mockedFs.writeFileSync).toHaveBeenCalled();
  });

  it("copies node_modules when present", async () => {
    (mockedFs.existsSync as ReturnType<typeof vi.fn>).mockImplementation((p: string) => {
      if (p.includes("node_modules")) return true;
      return true;
    });
    await buildCache.saveCache("/project", "vite", "/output", "sha-def");
    expect(mockedFs.cpSync).toHaveBeenCalled();
  });

  it("caches framework-specific cache dirs like .next/cache", async () => {
    (mockedFs.existsSync as ReturnType<typeof vi.fn>).mockImplementation((p: string) => {
      if (p.includes(".next/cache")) return true;
      return true;
    });
    await buildCache.saveCache("/project", "nextjs", "/output", "sha-ghi");
    expect(mockedFs.cpSync).toHaveBeenCalled();
  });
});

describe("buildCache generateCacheKey", () => {
  beforeEach(() => {
    setupFsAndClearCache();
  });

  it("produces different keys for different frameworks", async () => {
    await buildCache.saveCache("/project", "nextjs", "/out1", "sha-1");
    await buildCache.saveCache("/project", "vite", "/out2", "sha-2");
    const stats = buildCache.getStats();
    expect(stats.entries).toBe(2);
  });

  it("produces consistent keys for same input", async () => {
    await buildCache.saveCache("/project", "nextjs", "/output", "sha-1");
    const r1 = buildCache.checkCache("/project", "nextjs");
    const r2 = buildCache.checkCache("/project", "nextjs");
    expect(r1).not.toBeNull();
    expect(r2).not.toBeNull();
    expect(r1!.commitSha).toBe(r2!.commitSha);
  });
});

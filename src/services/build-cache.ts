import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { Framework } from "../types";

const CACHE_ROOT = path.resolve(process.cwd(), "build-cache");
const MAX_CACHE_SIZE_BYTES = 1 * 1024 * 1024 * 1024; // 1 GB

// 鈹€鈹€鈹€ Cache metadata store (in-memory with persistence) 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

interface CacheEntry {
  key: string;
  commitSha: string;
  framework: Framework;
  outputDir: string;
  sizeBytes: number;
  lastAccessedAt: number;
  createdAt: number;
}

let cacheIndex: Map<string, CacheEntry> = new Map();

const CACHE_INDEX_PATH = path.join(CACHE_ROOT, ".cache-index.json");

// 鈹€鈹€鈹€ Initialization 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

function ensureCacheDir(): void {
  fs.mkdirSync(CACHE_ROOT, { recursive: true });
}

function loadCacheIndex(): void {
  ensureCacheDir();

  if (fs.existsSync(CACHE_INDEX_PATH)) {
    try {
      const raw = fs.readFileSync(CACHE_INDEX_PATH, "utf-8");
      const entries: [string, CacheEntry][] = JSON.parse(raw);
      cacheIndex = new Map(entries);
    } catch {
      cacheIndex = new Map();
    }
  }
}

function saveCacheIndex(): void {
  ensureCacheDir();
  const entries = Array.from(cacheIndex.entries());
  fs.writeFileSync(CACHE_INDEX_PATH, JSON.stringify(entries, null, 2), "utf-8");
}

// Initialize on import
loadCacheIndex();

// 鈹€鈹€鈹€ Cache Key Generation 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

function generateCacheKey(projectDir: string, framework: Framework): string {
  const hash = crypto.createHash("sha256");

  // Hash package.json (dependencies)
  const pkgJsonPath = path.join(projectDir, "package.json");
  if (fs.existsSync(pkgJsonPath)) {
    hash.update(fs.readFileSync(pkgJsonPath));
  }

  // Hash lock files for dependency fingerprinting
  for (const lockFile of ["package-lock.json", "yarn.lock", "pnpm-lock.yaml"]) {
    const lockPath = path.join(projectDir, lockFile);
    if (fs.existsSync(lockPath)) {
      // Only hash first 4KB of lock file for speed
      const fd = fs.openSync(lockPath, "r");
      const buf = Buffer.alloc(4096);
      const bytesRead = fs.readSync(fd, buf, 0, 4096, 0);
      fs.closeSync(fd);
      hash.update(buf.subarray(0, bytesRead));
    }
  }

  hash.update(framework);
  return hash.digest("hex");
}

// 鈹€鈹€鈹€ Cache Operations 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

interface CacheHit {
  commitSha: string;
  outputDir: string;
}

export const buildCache = {
  /**
   * Check if a cached build exists for the given project directory + framework.
   * Uses dependency fingerprint (not just commit SHA) for more accurate hits.
   */
  checkCache(projectDir: string, framework: Framework): CacheHit | null {
    const key = generateCacheKey(projectDir, framework);
    const entry = cacheIndex.get(key);

    if (!entry) return null;

    // Verify the cached output directory still exists
    if (!fs.existsSync(entry.outputDir)) {
      cacheIndex.delete(key);
      saveCacheIndex();
      return null;
    }

    // Update LRU access time
    entry.lastAccessedAt = Date.now();
    saveCacheIndex();

    return {
      commitSha: entry.commitSha,
      outputDir: entry.outputDir,
    };
  },

  /**
   * Save build output to cache.
   */
  async saveCache(
    projectDir: string,
    framework: Framework,
    outputDir: string,
    commitSha: string
  ): Promise<void> {
    ensureCacheDir();

    const key = generateCacheKey(projectDir, framework);
    const cacheDir = path.join(CACHE_ROOT, key);

    // Calculate output size before copying
    const sizeBytes = getDirSize(outputDir);

    // Ensure we stay within max cache size 鈥?evict if needed
    await enforceMaxCacheSize(sizeBytes);

    // Copy output to cache directory
    if (fs.existsSync(cacheDir)) {
      fs.rmSync(cacheDir, { recursive: true, force: true });
    }
    fs.cpSync(outputDir, cacheDir, { recursive: true });

    // Layer caching: also cache node_modules separately if present
    const nodeModulesDir = path.join(projectDir, "node_modules");
    const nmCacheDir = path.join(cacheDir, "__node_modules__");
    if (fs.existsSync(nodeModulesDir)) {
      try {
        fs.cpSync(nodeModulesDir, nmCacheDir, { recursive: true });
      } catch {
        // node_modules can be huge; skip if it fails
      }
    }

    // Cache .next/cache or similar framework caches
    for (const cacheLayer of [".next/cache", ".nuxt/cache", ".astro/cache"]) {
      const layerDir = path.join(projectDir, cacheLayer);
      if (fs.existsSync(layerDir)) {
        const layerCacheDir = path.join(cacheDir, `__${cacheLayer.replace(/[/\\]/g, "_")}__`);
        try {
          fs.cpSync(layerDir, layerCacheDir, { recursive: true });
        } catch {
          // Skip on failure
        }
      }
    }

    const finalSize = getDirSize(cacheDir);

    const entry: CacheEntry = {
      key,
      commitSha,
      framework,
      outputDir: cacheDir,
      sizeBytes: finalSize,
      lastAccessedAt: Date.now(),
      createdAt: Date.now(),
    };

    cacheIndex.set(key, entry);
    saveCacheIndex();
  },

  /**
   * Invalidate cache for a specific project.
   */
  invalidate(projectDir: string, framework: Framework): void {
    const key = generateCacheKey(projectDir, framework);
    const entry = cacheIndex.get(key);

    if (entry) {
      try {
        if (fs.existsSync(entry.outputDir)) {
          fs.rmSync(entry.outputDir, { recursive: true, force: true });
        }
      } catch {
        // Best-effort cleanup
      }
      cacheIndex.delete(key);
      saveCacheIndex();
    }
  },

  /**
   * Get cache statistics.
   */
  getStats(): {
    entries: number;
    totalSizeBytes: number;
    totalSizeMB: number;
    oldestEntry: string | null;
    newestEntry: string | null;
  } {
    const entries = Array.from(cacheIndex.values());
    const totalSizeBytes = entries.reduce((sum, e) => sum + e.sizeBytes, 0);

    if (entries.length === 0) {
      return {
        entries: 0,
        totalSizeBytes: 0,
        totalSizeMB: 0,
        oldestEntry: null,
        newestEntry: null,
      };
    }

    entries.sort((a, b) => a.createdAt - b.createdAt);

    return {
      entries: entries.length,
      totalSizeBytes,
      totalSizeMB: Math.round((totalSizeBytes / (1024 * 1024)) * 100) / 100,
      oldestEntry: entries[0].commitSha,
      newestEntry: entries[entries.length - 1].commitSha,
    };
  },

  /**
   * Clear entire cache.
   */
  clearAll(): void {
    for (const entry of cacheIndex.values()) {
      try {
        if (fs.existsSync(entry.outputDir)) {
          fs.rmSync(entry.outputDir, { recursive: true, force: true });
        }
      } catch {
        // Best-effort
      }
    }
    cacheIndex.clear();
    saveCacheIndex();
  },
};

// 鈹€鈹€鈹€ Helpers 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

function getDirSize(dirPath: string): number {
  let totalSize = 0;

  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        totalSize += getDirSize(fullPath);
      } else {
        const stat = fs.statSync(fullPath);
        totalSize += stat.size;
      }
    }
  } catch {
    // Directory doesn't exist or can't be read
  }

  return totalSize;
}

/**
 * LRU eviction: remove oldest entries until we have room for newCacheSize.
 */
async function enforceMaxCacheSize(newCacheSize: number): Promise<void> {
  const entries = Array.from(cacheIndex.values());
  const totalCurrentSize = entries.reduce((sum, e) => sum + e.sizeBytes, 0);

  if (totalCurrentSize + newCacheSize <= MAX_CACHE_SIZE_BYTES) {
    return; // We have room
  }

  // Sort by lastAccessedAt ascending (oldest first)
  entries.sort((a, b) => a.lastAccessedAt - b.lastAccessedAt);

  let freedBytes = 0;
  const targetToFree = totalCurrentSize + newCacheSize - MAX_CACHE_SIZE_BYTES;

  for (const entry of entries) {
    if (freedBytes >= targetToFree) break;

    try {
      if (fs.existsSync(entry.outputDir)) {
        fs.rmSync(entry.outputDir, { recursive: true, force: true });
      }
    } catch {
      // Best-effort
    }

    freedBytes += entry.sizeBytes;
    cacheIndex.delete(entry.key);
  }

  saveCacheIndex();
}

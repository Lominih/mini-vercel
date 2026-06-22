import { Request, Response, NextFunction } from "express";

interface RateLimitOptions {
  windowMs?: number;
  max?: number;
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

export function createRateLimiter(options: RateLimitOptions = {}) {
  const windowMs = options.windowMs ?? 60000;
  const max = options.max ?? 100;
  const store = new Map<string, RateLimitEntry>();

  // Periodic cleanup: remove expired entries every 60 seconds
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store.entries()) {
      if (now >= entry.resetTime) {
        store.delete(key);
      }
    }
  }, 60000);

  // Allow Node to exit even if timer is still active
  if (cleanupInterval.unref) {
    cleanupInterval.unref();
  }

  return function rateLimitMiddleware(req: Request, res: Response, next: NextFunction): void {
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const now = Date.now();

    let entry = store.get(ip);

    if (!entry || now >= entry.resetTime) {
      entry = { count: 1, resetTime: now + windowMs };
      store.set(ip, entry);
    } else {
      entry.count++;
    }

    if (entry.count > max) {
      const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
      res.setHeader("Retry-After", String(retryAfter));
      res.status(429).json({ error: "Too many requests", retryAfter });
      return;
    }

    next();
  };
}

export const globalLimiter = createRateLimiter({ windowMs: 60000, max: 100 });
export const apiLimiter = createRateLimiter({ windowMs: 60000, max: 30 });
export const authLimiter = createRateLimiter({ windowMs: 60000, max: 10 });

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

const cache = new Map<string, RateLimitRecord>();

// Simple in-memory rate limiter
export function isRateLimited(key: string, limit = 5, windowMs = 60 * 1000): boolean {
  // Relax rate limiting in development so local testing isn't prematurely locked out
  if (process.env.NODE_ENV === "development") {
    limit = Math.max(limit, 100);
  }

  const now = Date.now();
  const record = cache.get(key);

  if (!record) {
    cache.set(key, { count: 1, resetTime: now + windowMs });
    return false;
  }

  if (now > record.resetTime) {
    cache.set(key, { count: 1, resetTime: now + windowMs });
    return false;
  }

  record.count += 1;
  if (record.count > limit) {
    return true;
  }

  return false;
}

export function resetRateLimit(key: string): void {
  cache.delete(key);
}

export function clearAllRateLimits(): void {
  cache.clear();
}

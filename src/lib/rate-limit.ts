/** 进程内滑动窗口限流（单实例 PM2 足够；多实例需换 Redis） */
const buckets = new Map<string, number[]>();

export function checkRateLimit(
  key: string,
  limit = Number(process.env.RATE_LIMIT_GENERATE || 8),
  windowMs = 60_000,
): { ok: true } | { ok: false; retryAfterSec: number } {
  const now = Date.now();
  const prev = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (prev.length >= limit) {
    const retryAfterSec = Math.ceil((prev[0]! + windowMs - now) / 1000);
    return { ok: false, retryAfterSec: Math.max(retryAfterSec, 1) };
  }
  prev.push(now);
  buckets.set(key, prev);
  return { ok: true };
}

export function clientKeyFromRequest(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return req.headers.get("x-real-ip") || "local";
}

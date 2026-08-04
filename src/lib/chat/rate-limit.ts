import "server-only";

/**
 * Fixed-window rate limiter held in module memory.
 *
 * The guest endpoints are unauthenticated, so they need *some* brake on abuse.
 * This one is per-instance: a serverless deployment running N warm instances
 * effectively allows N times the limit, and a cold start resets the window.
 * That is fine as a first line of defence — it stops a single browser tab
 * hammering the Anthropic bill — but it is not a security control. Move to
 * Upstash Redis or Vercel KV before this carries real traffic.
 */

type Window = { count: number; resetAt: number };

const windows = new Map<string, Window>();
let lastSweep = 0;

function sweep(now: number) {
  // Amortised cleanup so the map cannot grow without bound.
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  windows.forEach((window, key) => {
    if (window.resetAt <= now) windows.delete(key);
  });
}

export type RateLimitResult = {
  allowed: boolean;
  retryAfterSeconds: number;
};

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const existing = windows.get(key);

  if (!existing || existing.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  existing.count += 1;

  if (existing.count > limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  return { allowed: true, retryAfterSeconds: 0 };
}

/** Best-effort client identity behind Vercel's proxy. */
export function clientKey(request: Request, scope: string): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || "unknown";
  return `${scope}:${ip}`;
}

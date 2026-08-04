import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Two-layer rate limiting for the unauthenticated guest endpoints.
 *
 * Layer 1 is a fixed window in module memory. It is per-instance — N warm
 * serverless instances allow N× the limit and a cold start resets it — so on
 * its own it only stops a single runaway browser tab.
 *
 * Layer 2 is `public.consume_rate_limit` in Postgres, which every instance
 * shares. That is the one that actually bounds spend on a paid API.
 *
 * **On a database failure this fails open to layer 1.** That is deliberate:
 * a Supabase blip should degrade the brake, not take the concierge offline
 * for a guest standing in an apartment at 3am. It does mean a sustained
 * database outage weakens the limit to per-instance — acceptable, because the
 * chat endpoint cannot answer anything during such an outage anyway.
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

/** Layer 1. Synchronous, per-process, free. */
function localLimit(
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

export async function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  // Check the cheap layer first. If this instance alone has already seen too
  // many requests, there is nothing the shared counter can add.
  const local = localLimit(key, limit, windowMs);
  if (!local.allowed) return local;

  try {
    const { data, error } = await createAdminClient().rpc("consume_rate_limit", {
      p_key: key,
      p_limit: limit,
      p_window_ms: windowMs,
    });

    if (error) throw error;

    // The function returns a single row; PostgREST gives it back as an array.
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return local;

    return {
      allowed: Boolean(row.allowed),
      retryAfterSeconds: Number(row.retry_after_seconds) || 1,
    };
  } catch (error) {
    // Fail open to layer 1 — see the note at the top of this file.
    console.error("[rate-limit] shared counter unavailable", error);
    return local;
  }
}

/** Best-effort client identity behind a proxy. */
export function clientKey(request: Request, scope: string): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || "unknown";
  return `${scope}:${ip}`;
}

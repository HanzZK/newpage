/**
 * Small typed accessors for environment variables.
 *
 * Public vars must be referenced as literal `process.env.NEXT_PUBLIC_*`
 * expressions so Next.js can inline them into the client bundle at build time.
 */

function required(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(
      `Missing environment variable ${name}. Copy .env.example to .env.local and fill it in.`,
    );
  }
  return value;
}

export const publicEnv = {
  supabaseUrl: () =>
    required(process.env.NEXT_PUBLIC_SUPABASE_URL, "NEXT_PUBLIC_SUPABASE_URL"),
  supabaseAnonKey: () =>
    required(
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    ),
  siteUrl: () =>
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
    "http://localhost:3000",
};

/** Server-only. Importing this from a client component will throw at runtime. */
export const serverEnv = {
  supabaseServiceRoleKey: () =>
    required(
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      "SUPABASE_SERVICE_ROLE_KEY",
    ),
  geminiApiKey: () =>
    required(process.env.GEMINI_API_KEY, "GEMINI_API_KEY"),
  geminiModel: () => process.env.GEMINI_MODEL ?? "gemini-3.6-flash",
  cronSecret: () => required(process.env.CRON_SECRET, "CRON_SECRET"),
  /**
   * Days a guest photo is kept before the cleanup job removes it.
   *
   * Fractional values are allowed (0.5 = twelve hours) — useful for testing
   * the delete path without waiting a day. Zero and negative values fall back
   * to the default rather than being honoured: "delete everything immediately"
   * is never what a mistyped env var should mean.
   */
  uploadRetentionDays: () => {
    const raw = Number(process.env.UPLOAD_RETENTION_DAYS);
    return Number.isFinite(raw) && raw > 0 ? raw : 30;
  },
  stripeSecretKey: () =>
    required(process.env.STRIPE_SECRET_KEY, "STRIPE_SECRET_KEY"),
};

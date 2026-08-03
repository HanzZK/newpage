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
  anthropicApiKey: () =>
    required(process.env.ANTHROPIC_API_KEY, "ANTHROPIC_API_KEY"),
  anthropicModel: () => process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5",
  stripeSecretKey: () =>
    required(process.env.STRIPE_SECRET_KEY, "STRIPE_SECRET_KEY"),
};

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Reports whether the deployment has what it needs to actually work.
 *
 * Reports presence only — never a value, never a prefix. A health endpoint
 * that echoes configuration is a configuration disclosure endpoint.
 */
export async function GET() {
  const required = {
    supabaseUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    supabaseAnonKey: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    supabaseServiceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    anthropicApiKey: Boolean(process.env.ANTHROPIC_API_KEY),
    siteUrl: Boolean(process.env.NEXT_PUBLIC_SITE_URL),
  };

  const missing = Object.entries(required)
    .filter(([, present]) => !present)
    .map(([name]) => name);

  return NextResponse.json(
    { ok: missing.length === 0, missing },
    { status: missing.length === 0 ? 200 : 503 },
  );
}

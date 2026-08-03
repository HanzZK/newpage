import "server-only";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import type { Property } from "@/types/database";

/** Returns the signed-in host, or bounces to /login. */
export async function requireUser() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/dashboard");
  return { supabase, user };
}

/**
 * Loads a property the current host owns.
 *
 * RLS already blocks cross-tenant reads, so a missing row means either
 * "does not exist" or "not yours" — both should look identical to the caller.
 */
export async function requireProperty(propertyId: string) {
  const { supabase, user } = await requireUser();

  const { data, error } = await supabase
    .from("properties")
    .select("*")
    .eq("id", propertyId)
    .maybeSingle();

  if (error || !data) return null;
  return { supabase, user, property: data as Property };
}

import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

/**
 * What the guest page is allowed to know before a conversation starts.
 *
 * Deliberately narrow: the guest client never receives wifi_password,
 * host_phone or alert_webhook_url. Those stay server-side and only surface
 * through the AI's answers, which the API route composes.
 */
export type GuestProperty = {
  id: string;
  name: string;
  is_active: boolean;
  default_language: string;
  host_name: string | null;
};

export async function loadGuestProperty(
  propertyId: string,
): Promise<GuestProperty | null> {
  if (!isUuid(propertyId)) return null;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("properties")
    .select("id, name, is_active, default_language, host_name")
    .eq("id", propertyId)
    .maybeSingle();

  if (error || !data) return null;
  return data as GuestProperty;
}

/** Returns the property only when guests are allowed to talk to it. */
export async function requireActiveProperty(
  propertyId: unknown,
): Promise<GuestProperty | null> {
  if (!isUuid(propertyId)) return null;
  const property = await loadGuestProperty(propertyId);
  if (!property || !property.is_active) return null;
  return property;
}

import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type {
  Appliance,
  ChatMessage,
  LocalGuide,
  Property,
  Upsell,
} from "@/types/database";

/**
 * Everything the concierge knows about one apartment.
 *
 * This never leaves the server. It contains the wifi password, the host's
 * phone number and the alert webhook — the guest client only ever receives
 * the AI's prose answer, composed from this.
 */
export type PropertyContext = {
  property: Property;
  appliances: Appliance[];
  guides: LocalGuide[];
  upsells: Upsell[];
};

/** How many prior turns to replay to the model. */
export const HISTORY_TURNS = 20;

export async function loadPropertyContext(
  propertyId: string,
): Promise<PropertyContext | null> {
  const supabase = createAdminClient();

  const { data: property, error } = await supabase
    .from("properties")
    .select("*")
    .eq("id", propertyId)
    .maybeSingle();

  if (error || !property) return null;

  const [appliances, guides, upsells] = await Promise.all([
    supabase
      .from("appliances")
      .select("*")
      .eq("property_id", propertyId)
      .order("sort_order", { ascending: true }),
    supabase
      .from("local_guides")
      .select("*")
      .eq("property_id", propertyId)
      .order("sort_order", { ascending: true }),
    supabase
      .from("upsells")
      .select("*")
      .eq("property_id", propertyId)
      .eq("is_active", true)
      .order("created_at", { ascending: true }),
  ]);

  return {
    property: property as Property,
    appliances: (appliances.data ?? []) as Appliance[],
    guides: (guides.data ?? []) as LocalGuide[],
    upsells: (upsells.data ?? []) as Upsell[],
  };
}

/** Prior turns, oldest first, for replay into the model. */
export async function loadRecentMessages(
  sessionId: string,
  limit = HISTORY_TURNS,
): Promise<ChatMessage[]> {
  const supabase = createAdminClient();

  const { data } = await supabase
    .from("chat_messages")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(limit);

  return ((data ?? []) as ChatMessage[]).reverse();
}

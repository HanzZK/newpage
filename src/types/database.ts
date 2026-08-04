/**
 * Hand-written mirror of supabase/schema.sql.
 *
 * Once your Supabase project is live you can regenerate this instead:
 *   npx supabase gen types typescript --project-id <ref> > src/types/database.ts
 */

export type Plan = "free" | "pro";

export type GuideCategory =
  | "restaurant"
  | "cafe"
  | "bar"
  | "grocery"
  | "pharmacy"
  | "transport"
  | "attraction"
  | "beach"
  | "emergency"
  | "other";

export type Sentiment = "positive" | "neutral" | "negative" | "critical";
export type AlertKind = "sentiment" | "escalation";
export type AlertSeverity = "low" | "medium" | "high" | "critical";
export type ChatRole = "user" | "assistant";

export type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  plan: Plan;
  /** Signing secret from the host's own Stripe webhook endpoint. */
  stripe_webhook_secret: string | null;
  /** Opaque path segment for that endpoint, so the host's user id stays private. */
  stripe_webhook_token: string;
  created_at: string;
  updated_at: string;
};

export type UpsellPurchase = {
  id: string;
  host_id: string;
  property_id: string | null;
  upsell_id: string | null;
  session_id: string | null;
  stripe_event_id: string;
  stripe_checkout_session_id: string | null;
  amount_cents: number;
  currency: string;
  guest_email: string | null;
  created_at: string;
};

export type Property = {
  id: string;
  host_id: string;
  name: string;
  address: string | null;
  timezone: string;
  default_language: string;
  is_active: boolean;
  wifi_ssid: string | null;
  wifi_password: string | null;
  checkin_time: string | null;
  checkout_time: string | null;
  checkin_instructions: string | null;
  checkout_instructions: string | null;
  parking_info: string | null;
  trash_info: string | null;
  house_rules: string | null;
  quiet_hours: string | null;
  smoking_policy: string | null;
  pet_policy: string | null;
  host_name: string | null;
  host_phone: string | null;
  emergency_contact: string | null;
  emergency_notes: string | null;
  alert_webhook_url: string | null;
  alert_email: string | null;
  created_at: string;
  updated_at: string;
};

export type Appliance = {
  id: string;
  property_id: string;
  name: string;
  brand: string | null;
  model: string | null;
  location: string | null;
  instructions: string;
  image_url: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type LocalGuide = {
  id: string;
  property_id: string;
  category: GuideCategory;
  title: string;
  description: string | null;
  address: string | null;
  url: string | null;
  walking_time: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type Upsell = {
  id: string;
  property_id: string;
  title: string;
  description: string | null;
  price_cents: number;
  currency: string;
  stripe_payment_link: string | null;
  trigger_keywords: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type ChatSession = {
  id: string;
  property_id: string;
  guest_label: string | null;
  language: string | null;
  started_at: string;
  last_seen_at: string;
};

export type ChatMessage = {
  id: string;
  session_id: string;
  property_id: string;
  role: ChatRole;
  content: string;
  image_url: string | null;
  sentiment: Sentiment | null;
  tokens_in: number | null;
  tokens_out: number | null;
  created_at: string;
};

export type Alert = {
  id: string;
  property_id: string;
  session_id: string | null;
  kind: AlertKind;
  severity: AlertSeverity;
  trigger_term: string | null;
  summary: string;
  guest_message: string | null;
  delivered: boolean;
  delivery_error: string | null;
  acknowledged_at: string | null;
  created_at: string;
};

/** Shape expected by `createClient<Database>()`. */
type Row<T> = {
  Row: T;
  Insert: Partial<T>;
  Update: Partial<T>;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      profiles: Row<Profile>;
      properties: Row<Property>;
      appliances: Row<Appliance>;
      local_guides: Row<LocalGuide>;
      upsells: Row<Upsell>;
      chat_sessions: Row<ChatSession>;
      chat_messages: Row<ChatMessage>;
      alerts: Row<Alert>;
      upsell_purchases: Row<UpsellPurchase>;
    };
    // Note the `{ [_ in never]: never }` idiom — `Record<string, never>`
    // would make `keyof Views` equal `string`, and PostgREST's select-query
    // parser would then resolve every table as an empty view (`never`).
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

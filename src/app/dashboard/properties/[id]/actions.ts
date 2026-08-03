"use server";

import { revalidatePath } from "next/cache";

import { requireProperty } from "@/lib/dashboard/guard";
import type { ActionState } from "@/lib/dashboard/action-state";
import type { Property } from "@/types/database";
import {
  applianceSchema,
  firstIssue,
  guideSchema,
  propertyEmergencySchema,
  propertyEssentialsSchema,
  propertyRulesSchema,
  upsellSchema,
} from "@/lib/validation";

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function checkbox(formData: FormData, key: string): boolean {
  return formData.get(key) === "on" || formData.get(key) === "true";
}

function propertyId(formData: FormData): string {
  return text(formData, "propertyId");
}

const NOT_FOUND: ActionState = {
  ok: false,
  message: "Property not found, or it is not yours.",
};

// ---------------------------------------------------------------------
// Property tabs
// ---------------------------------------------------------------------

async function updateProperty(
  formData: FormData,
  values: Partial<Property>,
): Promise<ActionState> {
  const id = propertyId(formData);
  const context = await requireProperty(id);
  if (!context) return NOT_FOUND;

  const { error } = await context.supabase
    .from("properties")
    .update(values)
    .eq("id", id);

  if (error) return { ok: false, message: error.message };

  revalidatePath(`/dashboard/properties/${id}`);
  revalidatePath("/dashboard");
  return { ok: true, message: "Saved." };
}

export async function saveEssentials(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = propertyEssentialsSchema.safeParse({
    name: text(formData, "name"),
    address: text(formData, "address"),
    default_language: text(formData, "default_language") || "en",
    is_active: checkbox(formData, "is_active"),
    wifi_ssid: text(formData, "wifi_ssid"),
    wifi_password: text(formData, "wifi_password"),
    checkin_time: text(formData, "checkin_time"),
    checkout_time: text(formData, "checkout_time"),
    checkin_instructions: text(formData, "checkin_instructions"),
    checkout_instructions: text(formData, "checkout_instructions"),
    parking_info: text(formData, "parking_info"),
    trash_info: text(formData, "trash_info"),
  });

  if (!parsed.success) return { ok: false, message: firstIssue(parsed.error) };
  return updateProperty(formData, parsed.data);
}

export async function saveRules(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = propertyRulesSchema.safeParse({
    house_rules: text(formData, "house_rules"),
    quiet_hours: text(formData, "quiet_hours"),
    smoking_policy: text(formData, "smoking_policy"),
    pet_policy: text(formData, "pet_policy"),
  });

  if (!parsed.success) return { ok: false, message: firstIssue(parsed.error) };
  return updateProperty(formData, parsed.data);
}

export async function saveEmergency(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = propertyEmergencySchema.safeParse({
    host_name: text(formData, "host_name"),
    host_phone: text(formData, "host_phone"),
    emergency_contact: text(formData, "emergency_contact"),
    emergency_notes: text(formData, "emergency_notes"),
    alert_email: text(formData, "alert_email"),
    alert_webhook_url: text(formData, "alert_webhook_url"),
  });

  if (!parsed.success) return { ok: false, message: firstIssue(parsed.error) };
  return updateProperty(formData, parsed.data);
}

// ---------------------------------------------------------------------
// Appliances
// ---------------------------------------------------------------------

export async function saveAppliance(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = propertyId(formData);
  const context = await requireProperty(id);
  if (!context) return NOT_FOUND;

  const parsed = applianceSchema.safeParse({
    name: text(formData, "name"),
    brand: text(formData, "brand"),
    model: text(formData, "model"),
    location: text(formData, "location"),
    instructions: text(formData, "instructions"),
  });

  if (!parsed.success) return { ok: false, message: firstIssue(parsed.error) };

  const applianceId = text(formData, "applianceId");
  const { error } = applianceId
    ? await context.supabase
        .from("appliances")
        .update(parsed.data)
        .eq("id", applianceId)
        .eq("property_id", id)
    : await context.supabase
        .from("appliances")
        .insert({ ...parsed.data, property_id: id });

  if (error) return { ok: false, message: error.message };

  revalidatePath(`/dashboard/properties/${id}`);
  return { ok: true, message: applianceId ? "Saved." : "Appliance added." };
}

export async function deleteAppliance(formData: FormData): Promise<void> {
  const id = propertyId(formData);
  const context = await requireProperty(id);
  if (!context) return;

  await context.supabase
    .from("appliances")
    .delete()
    .eq("id", text(formData, "applianceId"))
    .eq("property_id", id);

  revalidatePath(`/dashboard/properties/${id}`);
}

// ---------------------------------------------------------------------
// Local guide
// ---------------------------------------------------------------------

export async function saveGuide(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = propertyId(formData);
  const context = await requireProperty(id);
  if (!context) return NOT_FOUND;

  const parsed = guideSchema.safeParse({
    category: text(formData, "category") || "other",
    title: text(formData, "title"),
    description: text(formData, "description"),
    address: text(formData, "address"),
    url: text(formData, "url"),
    walking_time: text(formData, "walking_time"),
  });

  if (!parsed.success) return { ok: false, message: firstIssue(parsed.error) };

  const guideId = text(formData, "guideId");
  const { error } = guideId
    ? await context.supabase
        .from("local_guides")
        .update(parsed.data)
        .eq("id", guideId)
        .eq("property_id", id)
    : await context.supabase
        .from("local_guides")
        .insert({ ...parsed.data, property_id: id });

  if (error) return { ok: false, message: error.message };

  revalidatePath(`/dashboard/properties/${id}`);
  return { ok: true, message: guideId ? "Saved." : "Place added." };
}

export async function deleteGuide(formData: FormData): Promise<void> {
  const id = propertyId(formData);
  const context = await requireProperty(id);
  if (!context) return;

  await context.supabase
    .from("local_guides")
    .delete()
    .eq("id", text(formData, "guideId"))
    .eq("property_id", id);

  revalidatePath(`/dashboard/properties/${id}`);
}

// ---------------------------------------------------------------------
// Upsells
// ---------------------------------------------------------------------

export async function saveUpsell(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = propertyId(formData);
  const context = await requireProperty(id);
  if (!context) return NOT_FOUND;

  const parsed = upsellSchema.safeParse({
    title: text(formData, "title"),
    description: text(formData, "description"),
    price: text(formData, "price") || "0",
    currency: (text(formData, "currency") || "EUR").toUpperCase(),
    stripe_payment_link: text(formData, "stripe_payment_link"),
    trigger_keywords: text(formData, "trigger_keywords"),
    is_active: checkbox(formData, "is_active"),
  });

  if (!parsed.success) return { ok: false, message: firstIssue(parsed.error) };

  const { price, ...rest } = parsed.data;
  const values = { ...rest, price_cents: price };

  const upsellId = text(formData, "upsellId");
  const { error } = upsellId
    ? await context.supabase
        .from("upsells")
        .update(values)
        .eq("id", upsellId)
        .eq("property_id", id)
    : await context.supabase
        .from("upsells")
        .insert({ ...values, property_id: id });

  if (error) return { ok: false, message: error.message };

  revalidatePath(`/dashboard/properties/${id}`);
  return { ok: true, message: upsellId ? "Saved." : "Offer added." };
}

export async function deleteUpsell(formData: FormData): Promise<void> {
  const id = propertyId(formData);
  const context = await requireProperty(id);
  if (!context) return;

  await context.supabase
    .from("upsells")
    .delete()
    .eq("id", text(formData, "upsellId"))
    .eq("property_id", id);

  revalidatePath(`/dashboard/properties/${id}`);
}

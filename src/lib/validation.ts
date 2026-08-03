import { z } from "zod";

/** Trims, and turns "" into null so empty inputs don't write empty strings. */
const optionalText = z
  .string()
  .trim()
  .transform((value) => (value.length === 0 ? null : value))
  .nullable();

export const propertyCreateSchema = z.object({
  name: z.string().trim().min(2, "Give the property a name.").max(120),
  address: optionalText,
});

export const propertyEssentialsSchema = z.object({
  name: z.string().trim().min(2, "Give the property a name.").max(120),
  address: optionalText,
  default_language: z.string().trim().min(2).max(8),
  is_active: z.boolean(),
  wifi_ssid: optionalText,
  wifi_password: optionalText,
  checkin_time: optionalText,
  checkout_time: optionalText,
  checkin_instructions: optionalText,
  checkout_instructions: optionalText,
  parking_info: optionalText,
  trash_info: optionalText,
});

export const propertyRulesSchema = z.object({
  house_rules: optionalText,
  quiet_hours: optionalText,
  smoking_policy: optionalText,
  pet_policy: optionalText,
});

export const propertyEmergencySchema = z.object({
  host_name: optionalText,
  host_phone: optionalText,
  emergency_contact: optionalText,
  emergency_notes: optionalText,
  alert_email: z
    .string()
    .trim()
    .transform((value) => (value.length === 0 ? null : value))
    .nullable()
    .refine((value) => value === null || z.email().safeParse(value).success, {
      message: "Enter a valid email address.",
    }),
  alert_webhook_url: z
    .string()
    .trim()
    .transform((value) => (value.length === 0 ? null : value))
    .nullable()
    .refine(
      (value) => value === null || z.url().safeParse(value).success,
      { message: "Enter a valid URL (https://…)." },
    ),
});

export const applianceSchema = z.object({
  name: z.string().trim().min(2, "Name the appliance.").max(120),
  brand: optionalText,
  model: optionalText,
  location: optionalText,
  instructions: z
    .string()
    .trim()
    .min(5, "Explain how it works — this is what the AI tells guests."),
});

export const guideSchema = z.object({
  category: z.enum([
    "restaurant",
    "cafe",
    "bar",
    "grocery",
    "pharmacy",
    "transport",
    "attraction",
    "beach",
    "emergency",
    "other",
  ]),
  title: z.string().trim().min(2, "Give the place a name.").max(160),
  description: optionalText,
  address: optionalText,
  url: z
    .string()
    .trim()
    .transform((value) => (value.length === 0 ? null : value))
    .nullable()
    .refine(
      (value) => value === null || z.url().safeParse(value).success,
      { message: "Enter a valid URL (https://…)." },
    ),
  walking_time: optionalText,
});

export const upsellSchema = z.object({
  title: z.string().trim().min(2, "Name the offer.").max(160),
  description: optionalText,
  // Accepts "25" or "25.50"; stored as integer cents.
  price: z
    .string()
    .trim()
    .refine((value) => /^\d+([.,]\d{1,2})?$/.test(value), {
      message: "Use a number like 25 or 25.50.",
    })
    .transform((value) => Math.round(Number(value.replace(",", ".")) * 100)),
  currency: z.string().trim().length(3, "Use a 3-letter code, e.g. EUR."),
  stripe_payment_link: z
    .string()
    .trim()
    .transform((value) => (value.length === 0 ? null : value))
    .nullable()
    .refine(
      (value) => value === null || z.url().safeParse(value).success,
      { message: "Paste the full Stripe Payment Link URL." },
    ),
  // "late checkout, extra night" -> ["late checkout", "extra night"]
  trigger_keywords: z
    .string()
    .trim()
    .transform((value) =>
      value
        .split(",")
        .map((term) => term.trim().toLowerCase())
        .filter(Boolean),
    ),
  is_active: z.boolean(),
});

/** Formats the first Zod issue into a single human-readable line. */
export function firstIssue(error: z.ZodError): string {
  const issue = error.issues[0];
  return issue?.message ?? "Please check the form and try again.";
}

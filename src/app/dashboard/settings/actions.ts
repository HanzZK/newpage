"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { ActionState } from "@/lib/dashboard/action-state";
import { requireUser } from "@/lib/dashboard/guard";

/**
 * Hand-entered sale. Georgian banks have no Stripe-style webhook, so a host
 * banking with BOG, TBC or unipay confirms the payment in their own banking
 * app and ticks it off here.
 *
 * RLS only lets a host insert rows with source = 'manual', so this cannot be
 * used to forge a bank-verified Stripe row.
 */
const manualPurchaseSchema = z.object({
  amount: z
    .string()
    .trim()
    .refine((value) => /^\d+([.,]\d{1,2})?$/.test(value), {
      message: "ჩაწერე თანხა, მაგალითად 30 ან 30.50.",
    })
    .transform((value) => Math.round(Number(value.replace(",", ".")) * 100)),
  currency: z
    .string()
    .trim()
    .length(3, "სამასოიანი კოდი, მაგალითად GEL.")
    .transform((value) => value.toUpperCase()),
  note: z
    .string()
    .trim()
    .max(200)
    .transform((value) => (value.length === 0 ? null : value)),
});

export async function recordManualSale(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase, user } = await requireUser();

  const parsed = manualPurchaseSchema.safeParse({
    amount: formData.get("amount") ?? "",
    currency: formData.get("currency") ?? "GEL",
    note: formData.get("note") ?? "",
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "შეამოწმე ველები.",
    };
  }

  const { error } = await supabase.from("upsell_purchases").insert({
    host_id: user.id,
    source: "manual",
    stripe_event_id: null,
    amount_cents: parsed.data.amount,
    currency: parsed.data.currency,
    note: parsed.data.note,
  });

  if (error) return { ok: false, message: error.message };

  revalidatePath("/dashboard/settings");
  return { ok: true, message: "გაყიდვა ჩაიწერა." };
}

export async function deleteManualSale(formData: FormData): Promise<void> {
  const { supabase, user } = await requireUser();

  const id = formData.get("purchaseId");
  if (typeof id !== "string" || !id) return;

  // The source filter is belt and braces — RLS already blocks deleting a
  // Stripe-sourced row.
  await supabase
    .from("upsell_purchases")
    .delete()
    .eq("id", id)
    .eq("host_id", user.id)
    .eq("source", "manual");

  revalidatePath("/dashboard/settings");
}

/**
 * A blank field leaves the stored secret alone.
 *
 * The secret is write-only in the UI — the host cannot read back what is
 * saved, so treating "blank" as "clear it" would silently disconnect their
 * payments the first time they opened this form and pressed Save. Clearing is
 * a separate, explicit action.
 */
export async function saveStripeSettings(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase, user } = await requireUser();

  const raw = formData.get("stripe_webhook_secret");
  const secret = typeof raw === "string" ? raw.trim() : "";

  if (!secret) {
    return { ok: true, message: "შესაცვლელი არაფერია." };
  }

  if (!secret.startsWith("whsec_")) {
    return { ok: false, message: "Stripe-ის ხელმოწერის კოდი whsec_-ით იწყება." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ stripe_webhook_secret: secret })
    .eq("id", user.id);

  if (error) return { ok: false, message: error.message };

  revalidatePath("/dashboard/settings");
  return { ok: true, message: "შენახულია. გამოგზავნე სატესტო მოვლენა Stripe-იდან." };
}

export async function disconnectStripe(): Promise<void> {
  const { supabase, user } = await requireUser();

  await supabase
    .from("profiles")
    .update({ stripe_webhook_secret: null })
    .eq("id", user.id);

  revalidatePath("/dashboard/settings");
}

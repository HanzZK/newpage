"use server";

import { revalidatePath } from "next/cache";

import type { ActionState } from "@/lib/dashboard/action-state";
import { requireUser } from "@/lib/dashboard/guard";

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
    return { ok: true, message: "Nothing to change." };
  }

  if (!secret.startsWith("whsec_")) {
    return { ok: false, message: "Stripe signing secrets start with whsec_." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ stripe_webhook_secret: secret })
    .eq("id", user.id);

  if (error) return { ok: false, message: error.message };

  revalidatePath("/dashboard/settings");
  return { ok: true, message: "Saved. Send a test event from Stripe." };
}

export async function disconnectStripe(): Promise<void> {
  const { supabase, user } = await requireUser();

  await supabase
    .from("profiles")
    .update({ stripe_webhook_secret: null })
    .eq("id", user.id);

  revalidatePath("/dashboard/settings");
}

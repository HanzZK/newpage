import { NextResponse } from "next/server";
import Stripe from "stripe";

import { isUuid } from "@/lib/chat/property";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * Receives `checkout.session.completed` from the HOST's own Stripe account.
 *
 * Payment Links belong to the host, not to us, so there is no platform Stripe
 * account and no Connect onboarding. The host adds this URL as a webhook
 * endpoint in their own dashboard and pastes the signing secret into their
 * settings. The token in the path identifies which host to verify against —
 * it is a random uuid rather than their user id, so the URL leaks nothing.
 *
 * Attribution comes from `client_reference_id`, which the chat route appends
 * to the payment link as "<upsellId>_<sessionId>". Stripe passes it through
 * untouched, so a completed payment maps back to the exact offer and the exact
 * conversation that produced it.
 */
export async function POST(
  request: Request,
  { params }: { params: { token: string } },
) {
  if (!isUuid(params.token)) {
    return NextResponse.json({ error: "Unknown endpoint." }, { status: 404 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature." }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: host } = await supabase
    .from("profiles")
    .select("id, stripe_webhook_secret")
    .eq("stripe_webhook_token", params.token)
    .maybeSingle();

  if (!host?.stripe_webhook_secret) {
    // Either the token is wrong or the host has not finished setup. Both are
    // "we cannot verify this", and neither should reveal which.
    return NextResponse.json({ error: "Unknown endpoint." }, { status: 404 });
  }

  // The raw body is required — any re-serialisation breaks the signature.
  const payload = await request.text();

  let event: Stripe.Event;
  try {
    event = Stripe.webhooks.constructEvent(
      payload,
      signature,
      host.stripe_webhook_secret,
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Signature verification failed.",
      },
      { status: 400 },
    );
  }

  if (event.type !== "checkout.session.completed") {
    // Acknowledge everything else so Stripe stops retrying it.
    return NextResponse.json({ received: true });
  }

  const session = event.data.object as Stripe.Checkout.Session;

  const [upsellId, chatSessionId] = (session.client_reference_id ?? "").split(
    "_",
  );

  // Resolve the offer, and confirm it really belongs to this host. Without
  // this check a host could replay another host's reference id.
  let propertyId: string | null = null;
  let resolvedUpsellId: string | null = null;

  if (isUuid(upsellId)) {
    const { data: upsell } = await supabase
      .from("upsells")
      .select("id, property_id")
      .eq("id", upsellId)
      .maybeSingle();

    if (upsell) {
      // Two plain queries rather than a PostgREST embed: an embed on a
      // many-to-one can come back as an object or an array depending on how
      // the relationship is inferred, and guessing wrong here would silently
      // drop the attribution instead of failing loudly.
      const { data: owner } = await supabase
        .from("properties")
        .select("id, host_id")
        .eq("id", upsell.property_id)
        .maybeSingle();

      if (owner?.host_id === host.id) {
        resolvedUpsellId = upsell.id;
        propertyId = owner.id;
      }
    }
  }

  const { error } = await supabase.from("upsell_purchases").insert({
    host_id: host.id,
    property_id: propertyId,
    upsell_id: resolvedUpsellId,
    session_id: isUuid(chatSessionId) ? chatSessionId : null,
    stripe_event_id: event.id,
    stripe_checkout_session_id: session.id,
    amount_cents: session.amount_total ?? 0,
    currency: (session.currency ?? "eur").toUpperCase(),
    guest_email: session.customer_details?.email ?? null,
  });

  // A duplicate event id means Stripe retried one we already stored. That is
  // expected — acknowledge it rather than letting Stripe retry forever.
  if (error && error.code !== "23505") {
    console.error("[stripe] could not record purchase", error);
    return NextResponse.json({ error: "Storage failed." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

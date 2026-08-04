import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

import { raiseAlert, shouldAlert } from "@/lib/chat/alerts";
import { loadPropertyContext, loadRecentMessages } from "@/lib/chat/context";
import { MAX_MESSAGE_CHARS } from "@/lib/chat/limits";
import { isUuid } from "@/lib/chat/property";
import { clientKey, rateLimit } from "@/lib/chat/rate-limit";
import { generateReply } from "@/lib/chat/reply";
import { publicEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Upsell } from "@/types/database";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Only accept image URLs we minted ourselves, in this property's folder.
 *
 * Without this a guest could hand us any URL on the internet and — since we
 * pass it straight to the vision API — turn the concierge into a fetch proxy.
 */
function isOwnUpload(url: string, propertyId: string): boolean {
  const prefix = `${publicEnv.supabaseUrl()}/storage/v1/object/public/guest-uploads/${propertyId}/`;
  return url.startsWith(prefix);
}

function formatPrice(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en", { style: "currency", currency }).format(
      cents / 100,
    );
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`;
  }
}

/**
 * Belt and braces: the prompt tells the model never to write a payment URL,
 * but a guest must never be shown one we did not mint. Strip anything that
 * looks like a Stripe link out of the model's prose. Other URLs (a restaurant
 * the host listed, a map link) are left alone — those are legitimate.
 */
const FABRICATED_PAYMENT_URL =
  /\bhttps?:\/\/(?:[a-z0-9-]+\.)*stripe\.com\/\S*/gi;

/**
 * Attaches the host's real Stripe link.
 *
 * The model picks an offer id; it never writes a URL. That way a hallucinated
 * link cannot reach a guest — the worst bug this product could ship.
 */
function attachPaymentLink(
  reply: string,
  upsell: Upsell | undefined,
  chatSessionId: string,
): string {
  const clean = reply.replace(FABRICATED_PAYMENT_URL, "").trim();
  if (!upsell?.stripe_payment_link) return clean;

  // Stripe passes client_reference_id straight through to the completed
  // checkout session, so this is what turns a payment into attributed revenue:
  // which offer, and which conversation sold it.
  let link = upsell.stripe_payment_link;
  try {
    const url = new URL(link);
    url.searchParams.set("client_reference_id", `${upsell.id}_${chatSessionId}`);
    link = url.toString();
  } catch {
    // Host pasted something that is not a URL; send it unchanged rather than
    // dropping the offer entirely.
  }

  return `${clean}\n\n${upsell.title} — ${formatPrice(
    upsell.price_cents,
    upsell.currency,
  )}\n${link}`;
}

export async function POST(request: Request) {
  const limit = rateLimit(clientKey(request, "chat"), 30, 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "You're sending messages very fast. Give me a second." },
      { status: 429, headers: { "retry-after": String(limit.retryAfterSeconds) } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 });
  }

  const { propertyId, sessionId, message, imageUrl } = (body ?? {}) as Record<
    string,
    unknown
  >;

  if (!isUuid(propertyId)) {
    return NextResponse.json(
      { error: "This concierge is not available." },
      { status: 404 },
    );
  }

  const context = await loadPropertyContext(propertyId);
  if (!context || !context.property.is_active) {
    return NextResponse.json(
      { error: "This concierge is not available." },
      { status: 404 },
    );
  }

  const property = context.property;
  const text = typeof message === "string" ? message.trim() : "";
  const image = typeof imageUrl === "string" && imageUrl ? imageUrl : null;

  if (!text && !image) {
    return NextResponse.json({ error: "Say something first." }, { status: 400 });
  }

  if (text.length > MAX_MESSAGE_CHARS) {
    return NextResponse.json(
      { error: `Keep messages under ${MAX_MESSAGE_CHARS} characters.` },
      { status: 413 },
    );
  }

  if (image && !isOwnUpload(image, property.id)) {
    return NextResponse.json({ error: "Unrecognised image." }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Reuse the caller's session only if it really belongs to this property.
  let activeSessionId: string | null = null;
  if (isUuid(sessionId)) {
    const { data } = await supabase
      .from("chat_sessions")
      .select("id")
      .eq("id", sessionId)
      .eq("property_id", property.id)
      .maybeSingle();
    activeSessionId = data?.id ?? null;
  }

  if (!activeSessionId) {
    const { data, error } = await supabase
      .from("chat_sessions")
      .insert({ property_id: property.id, language: property.default_language })
      .select("id")
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: "Could not start the conversation." },
        { status: 502 },
      );
    }
    activeSessionId = data.id;
  }

  // Read history before storing the new turn, so it is not duplicated.
  const history = await loadRecentMessages(activeSessionId);

  const { error: userMessageError } = await supabase
    .from("chat_messages")
    .insert({
      session_id: activeSessionId,
      property_id: property.id,
      role: "user",
      content: text,
      image_url: image,
    });

  if (userMessageError) {
    return NextResponse.json(
      { error: "Could not save your message." },
      { status: 502 },
    );
  }

  let reply;
  try {
    reply = await generateReply({
      context,
      history,
      message: text,
      imageUrl: image,
    });
  } catch (error) {
    const overloaded =
      error instanceof Anthropic.APIError &&
      (error.status === 429 || error.status === 529);

    console.error("[chat] generateReply failed", error);

    return NextResponse.json(
      {
        error: overloaded
          ? "I'm a bit overloaded right now — try again in a few seconds."
          : "Something went wrong on my side. Please try again.",
      },
      { status: 502 },
    );
  }

  const upsell = reply.upsellId
    ? context.upsells.find((candidate) => candidate.id === reply.upsellId)
    : undefined;

  const guestText = attachPaymentLink(reply.text, upsell, activeSessionId);

  await supabase.from("chat_messages").insert({
    session_id: activeSessionId,
    property_id: property.id,
    role: "assistant",
    content: guestText,
    sentiment: reply.sentiment,
    tokens_in: reply.tokensIn,
    tokens_out: reply.tokensOut,
  });

  await supabase
    .from("chat_sessions")
    .update({
      last_seen_at: new Date().toISOString(),
      language: reply.language ?? property.default_language,
    })
    .eq("id", activeSessionId);

  const alertInput = {
    property,
    sessionId: activeSessionId,
    sentiment: reply.sentiment,
    escalate: reply.escalate,
    escalationReason: reply.escalationReason,
    guestMessage: text || "(photo only)",
  };

  if (shouldAlert(alertInput)) {
    // Awaited so it completes before the serverless function is frozen, but
    // never allowed to fail the guest's reply.
    try {
      await raiseAlert(alertInput);
    } catch (error) {
      console.error("[chat] alert dispatch failed", error);
    }
  }

  return NextResponse.json({ sessionId: activeSessionId, reply: guestText });
}

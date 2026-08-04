import { NextResponse } from "next/server";

import { MAX_MESSAGE_CHARS } from "@/lib/chat/limits";
import { isUuid, requireActiveProperty } from "@/lib/chat/property";
import { clientKey, rateLimit } from "@/lib/chat/rate-limit";
import { generateReply } from "@/lib/chat/reply";
import { publicEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * Only accept image URLs we minted ourselves, in this property's folder.
 *
 * Without this a guest could hand us any URL on the internet and — once
 * Phase 4 passes it to the vision API — turn the concierge into a fetch proxy.
 */
function isOwnUpload(url: string, propertyId: string): boolean {
  const prefix = `${publicEnv.supabaseUrl()}/storage/v1/object/public/guest-uploads/${propertyId}/`;
  return url.startsWith(prefix);
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

  const {
    propertyId,
    sessionId,
    message,
    imageUrl,
  } = (body ?? {}) as Record<string, unknown>;

  const property = await requireActiveProperty(propertyId);
  if (!property) {
    return NextResponse.json(
      { error: "This concierge is not available." },
      { status: 404 },
    );
  }

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

  const reply = await generateReply({
    property,
    message: text,
    imageUrl: image,
  });

  await supabase.from("chat_messages").insert({
    session_id: activeSessionId,
    property_id: property.id,
    role: "assistant",
    content: reply.text,
    sentiment: reply.sentiment,
  });

  await supabase
    .from("chat_sessions")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", activeSessionId);

  return NextResponse.json({ sessionId: activeSessionId, reply: reply.text });
}

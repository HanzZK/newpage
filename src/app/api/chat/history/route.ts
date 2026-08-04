import { NextResponse } from "next/server";

import { isUuid, requireActiveProperty } from "@/lib/chat/property";
import { clientKey, rateLimit } from "@/lib/chat/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * Restores a conversation after the guest refreshes or reopens the link.
 *
 * The session id is effectively a bearer token: whoever holds it can read that
 * conversation. It is a v4 UUID kept in the guest's own localStorage and is
 * never listed anywhere, so guessing one is not practical — but it is worth
 * knowing that this is the security model rather than assuming an account
 * check happens here. There is no account; that is the product.
 */
export async function GET(request: Request) {
  const limit = await rateLimit(clientKey(request, "history"), 60, 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Slow down a moment." },
      { status: 429, headers: { "retry-after": String(limit.retryAfterSeconds) } },
    );
  }

  const { searchParams } = new URL(request.url);
  const propertyId = searchParams.get("propertyId");
  const sessionId = searchParams.get("sessionId");

  const property = await requireActiveProperty(propertyId);
  if (!property || !isUuid(sessionId)) {
    return NextResponse.json({ messages: [] });
  }

  const supabase = createAdminClient();

  const { data: session } = await supabase
    .from("chat_sessions")
    .select("id")
    .eq("id", sessionId)
    .eq("property_id", property.id)
    .maybeSingle();

  if (!session) return NextResponse.json({ messages: [] });

  const { data: messages } = await supabase
    .from("chat_messages")
    .select("id, role, content, image_url, created_at")
    .eq("session_id", session.id)
    .order("created_at", { ascending: true })
    .limit(200);

  return NextResponse.json({ messages: messages ?? [] });
}

import "server-only";

import type { GuestProperty } from "@/lib/chat/property";

export type ReplyInput = {
  property: GuestProperty;
  message: string;
  imageUrl: string | null;
};

export type ReplyOutput = {
  text: string;
  /** Populated by the real engine in Phase 4. */
  sentiment: null;
};

/**
 * PLACEHOLDER — replaced in Phase 4 by the Claude call.
 *
 * Phase 3 ships the whole guest transport: session handling, persistence,
 * image upload and the mobile UI. This stub keeps that loop end-to-end
 * testable without an Anthropic key, and is the single function Phase 4
 * swaps out. It deliberately does not try to answer anything — pretending to
 * be the concierge here would hide gaps the real prompt has to cover.
 */
export async function generateReply({
  property,
  message,
  imageUrl,
}: ReplyInput): Promise<ReplyOutput> {
  const received = imageUrl
    ? `your photo${message ? ` and the message “${message}”` : ""}`
    : `“${message}”`;

  return {
    text:
      `Hi! I'm the concierge for ${property.name}. I received ${received}.\n\n` +
      `I'm not connected to my brain yet — Claude gets wired in at Phase 4. ` +
      `Once that lands I'll answer from this apartment's Wi-Fi details, house ` +
      `rules, appliance guides and local recommendations, in whatever language ` +
      `you write to me.`,
    sentiment: null,
  };
}

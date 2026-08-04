import "server-only";

import Anthropic from "@anthropic-ai/sdk";

import type { PropertyContext } from "@/lib/chat/context";
import { buildSystemPrompt } from "@/lib/chat/prompt";
import { serverEnv } from "@/lib/env";
import type { ChatMessage, Sentiment } from "@/types/database";

/**
 * The model returns structured data, not prose, so the reply and its metadata
 * arrive in one call. Two calls (answer, then classify) would double both the
 * latency a guest waits and the bill.
 */
const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    reply: {
      type: "string",
      description: "The message shown to the guest, in the guest's language.",
    },
    language: {
      type: "string",
      description: "ISO 639-1 code of the language you replied in.",
    },
    sentiment: {
      type: "string",
      enum: ["positive", "neutral", "negative", "critical"],
    },
    escalate: {
      type: "boolean",
      description: "True when the host needs to be alerted immediately.",
    },
    escalation_reason: {
      type: ["string", "null"],
      description: "One factual line for the host. Null unless escalate.",
    },
    upsell_id: {
      type: ["string", "null"],
      description:
        "The id of a listed paid extra that fits this message, else null.",
    },
  },
  required: [
    "reply",
    "language",
    "sentiment",
    "escalate",
    "escalation_reason",
    "upsell_id",
  ],
  additionalProperties: false,
} as const;

export type ReplyResult = {
  text: string;
  language: string | null;
  sentiment: Sentiment;
  escalate: boolean;
  escalationReason: string | null;
  upsellId: string | null;
  tokensIn: number;
  tokensOut: number;
};

export type ReplyInput = {
  context: PropertyContext;
  history: ChatMessage[];
  message: string;
  imageUrl: string | null;
};

let client: Anthropic | null = null;

function anthropic(): Anthropic {
  client ??= new Anthropic({ apiKey: serverEnv.anthropicApiKey() });
  return client;
}

/** Replays stored turns. Past images are dropped — only the current one is sent. */
function toModelMessages(history: ChatMessage[]): Anthropic.MessageParam[] {
  return history
    .filter((message) => message.content.trim().length > 0)
    .map((message) => ({
      role: message.role,
      content: message.content,
    }));
}

function buildUserContent(
  message: string,
  imageUrl: string | null,
): Anthropic.MessageParam["content"] {
  if (!imageUrl) return message;

  const blocks: Anthropic.ContentBlockParam[] = [
    { type: "image", source: { type: "url", url: imageUrl } },
  ];

  blocks.push({
    type: "text",
    text: message || "(The guest sent this photo without a message.)",
  });

  return blocks;
}

function coerceSentiment(value: unknown): Sentiment {
  return value === "positive" ||
    value === "negative" ||
    value === "critical" ||
    value === "neutral"
    ? value
    : "neutral";
}

/**
 * One call to Claude: answers the guest, judges sentiment, decides whether to
 * escalate, and picks a paid extra if one genuinely fits.
 *
 * Note what this function deliberately does NOT do: build a payment URL. It
 * returns an offer id and the caller attaches the host's real Stripe link. A
 * hallucinated payment link would be the worst possible bug in this product.
 */
export async function generateReply({
  context,
  history,
  message,
  imageUrl,
}: ReplyInput): Promise<ReplyResult> {
  const response = await anthropic().messages.create({
    model: serverEnv.anthropicModel(),
    max_tokens: 1500,
    system: [
      {
        type: "text",
        text: buildSystemPrompt(context),
        // The property brief is identical across a conversation's turns, so
        // it is worth caching. Short briefs fall under the minimum cacheable
        // prefix and simply won't cache — no error, no harm.
        cache_control: { type: "ephemeral" },
      },
    ],
    // A guest is staring at a typing indicator on hotel wifi. Latency is the
    // feature here; low effort keeps replies fast and cheap, and this task is
    // retrieval and tone rather than hard reasoning.
    output_config: { effort: "low", format: { type: "json_schema", schema: RESPONSE_SCHEMA } },
    messages: [
      ...toModelMessages(history),
      { role: "user", content: buildUserContent(message, imageUrl) },
    ],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  const raw = textBlock && textBlock.type === "text" ? textBlock.text : "";

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    // Structured outputs make this near-impossible, but a truncated response
    // (stop_reason "max_tokens") can still produce invalid JSON. Degrade to a
    // safe, honest message rather than showing the guest a parse error.
    return {
      text: "Sorry — I lost my train of thought there. Could you ask me that again?",
      language: null,
      sentiment: "neutral",
      escalate: false,
      escalationReason: null,
      upsellId: null,
      tokensIn: response.usage.input_tokens,
      tokensOut: response.usage.output_tokens,
    };
  }

  const reply =
    typeof parsed.reply === "string" && parsed.reply.trim()
      ? parsed.reply.trim()
      : "Sorry, I didn't catch that. Could you say it another way?";

  const sentiment = coerceSentiment(parsed.sentiment);

  return {
    text: reply,
    language: typeof parsed.language === "string" ? parsed.language : null,
    sentiment,
    // A critical message always alerts the host, whatever the model set.
    escalate: parsed.escalate === true || sentiment === "critical",
    escalationReason:
      typeof parsed.escalation_reason === "string"
        ? parsed.escalation_reason
        : null,
    upsellId: typeof parsed.upsell_id === "string" ? parsed.upsell_id : null,
    tokensIn: response.usage.input_tokens,
    tokensOut: response.usage.output_tokens,
  };
}

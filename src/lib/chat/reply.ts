import "server-only";

import { GoogleGenAI } from "@google/genai";

import type { PropertyContext } from "@/lib/chat/context";
import { buildSystemPrompt } from "@/lib/chat/prompt";
import { serverEnv } from "@/lib/env";
import type { ChatMessage, Sentiment } from "@/types/database";

/**
 * The model returns structured data, not prose, so the reply and its metadata
 * arrive in one call. Two calls (answer, then classify) would double both the
 * latency a guest waits and the bill.
 *
 * Note what is NOT here: a nullable type union. `escalation_reason` and
 * `upsell_id` are plain required strings and the empty string means "none".
 * Nullable unions are the least portable corner of every JSON-schema dialect,
 * and this costs six characters to sidestep.
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
      type: "string",
      description:
        "One factual line for the host. Empty string unless escalate is true.",
    },
    upsell_id: {
      type: "string",
      description:
        "The id of a listed paid extra that fits this message, else an empty string.",
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

let client: GoogleGenAI | null = null;

function gemini(): GoogleGenAI {
  client ??= new GoogleGenAI({ apiKey: serverEnv.geminiApiKey() });
  return client;
}

/** One turn of the conversation as the Interactions API models it. */
type Step = {
  type: "user_input" | "model_output";
  status?: "done";
  content: ContentPart[];
};

type ContentPart =
  | { type: "text"; text: string }
  | { type: "image"; data: string; mime_type: string };

/** Replays stored turns. Past images are dropped — only the current one is sent. */
function toSteps(history: ChatMessage[]): Step[] {
  return history
    .filter((message) => message.content.trim().length > 0)
    .map((message) =>
      message.role === "assistant"
        ? {
            type: "model_output" as const,
            status: "done" as const,
            content: [{ type: "text" as const, text: message.content }],
          }
        : {
            type: "user_input" as const,
            content: [{ type: "text" as const, text: message.content }],
          },
    );
}

/**
 * Gemini takes image bytes inline, not a URL, so we fetch our own storage
 * object and forward the bytes.
 *
 * This is only ever reached for URLs `isOwnUpload` has already accepted, so it
 * is not a fetch proxy — see the caller in `src/app/api/chat/route.ts`. Keep
 * that check in front of this function.
 */
async function fetchImagePart(imageUrl: string): Promise<ContentPart | null> {
  try {
    const response = await fetch(imageUrl, {
      redirect: "error",
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return null;

    const mimeType = response.headers.get("content-type")?.split(";")[0]?.trim();
    if (!mimeType?.startsWith("image/")) return null;

    const bytes = Buffer.from(await response.arrayBuffer());
    return { type: "image", data: bytes.toString("base64"), mime_type: mimeType };
  } catch {
    // A photo we cannot fetch should not sink the whole reply — the guest's
    // text still gets answered, just without the picture.
    return null;
  }
}

async function buildUserStep(
  message: string,
  imageUrl: string | null,
): Promise<Step> {
  const content: ContentPart[] = [];

  if (imageUrl) {
    const image = await fetchImagePart(imageUrl);
    if (image) content.push(image);
  }

  content.push({
    type: "text",
    text:
      message ||
      (content.length > 0
        ? "(The guest sent this photo without a message.)"
        : ""),
  });

  return { type: "user_input", content };
}

function coerceSentiment(value: unknown): Sentiment {
  return value === "positive" ||
    value === "negative" ||
    value === "critical" ||
    value === "neutral"
    ? value
    : "neutral";
}

/** Empty string is the schema's stand-in for null — see RESPONSE_SCHEMA. */
function orNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/**
 * One call to Gemini: answers the guest, judges sentiment, decides whether to
 * escalate, and picks a paid extra if one genuinely fits.
 *
 * Note what this function deliberately does NOT do: build a payment URL. It
 * returns an offer id and the caller attaches the host's real link. A
 * hallucinated payment link would be the worst possible bug in this product.
 */
export async function generateReply({
  context,
  history,
  message,
  imageUrl,
}: ReplyInput): Promise<ReplyResult> {
  const interaction = await gemini().interactions.create({
    model: serverEnv.geminiModel(),
    system_instruction: buildSystemPrompt(context),
    // The conversation lives in our own database, not Google's. `store: false`
    // opts out of server-side retention, so we replay the history ourselves
    // and nothing about a guest's stay is kept by the provider.
    store: false,
    input: [...toSteps(history), await buildUserStep(message, imageUrl)],
    response_format: {
      type: "text",
      mime_type: "application/json",
      schema: RESPONSE_SCHEMA,
    },
    // gemini-3.6-flash thinks at "medium" by default, which on a lookup like
    // "what's the wifi password" burned ~320 thinking tokens to produce a 70
    // token answer. "minimal" takes that to zero with no measured quality loss
    // on this workload — appliance steps, escalation and grounding all still
    // land. Thinking cannot be disabled outright on this model.
    generation_config: { thinking_level: "minimal" },
  } as never);

  // Field names verified against a live response — the migration guide's
  // prompt_tokens/completion_tokens are not what this endpoint returns.
  const usage = (interaction as { usage?: Record<string, number> }).usage ?? {};
  const tokensIn = usage.total_input_tokens ?? 0;
  const tokensOut =
    (usage.total_output_tokens ?? 0) + (usage.total_thought_tokens ?? 0);

  const raw = (interaction as { output_text?: string }).output_text ?? "";

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    // Structured outputs make this near-impossible, but a truncated response
    // can still produce invalid JSON. Degrade to a safe, honest message rather
    // than showing the guest a parse error.
    return {
      text: "Sorry — I lost my train of thought there. Could you ask me that again?",
      language: null,
      sentiment: "neutral",
      escalate: false,
      escalationReason: null,
      upsellId: null,
      tokensIn,
      tokensOut,
    };
  }

  const reply =
    typeof parsed.reply === "string" && parsed.reply.trim()
      ? parsed.reply.trim()
      : "Sorry, I didn't catch that. Could you say it another way?";

  const sentiment = coerceSentiment(parsed.sentiment);

  return {
    text: reply,
    language: orNull(parsed.language),
    sentiment,
    // A critical message always alerts the host, whatever the model set.
    escalate: parsed.escalate === true || sentiment === "critical",
    escalationReason: orNull(parsed.escalation_reason),
    upsellId: orNull(parsed.upsell_id),
    tokensIn,
    tokensOut,
  };
}

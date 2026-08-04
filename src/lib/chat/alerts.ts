import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { AlertKind, AlertSeverity, Property, Sentiment } from "@/types/database";

const WEBHOOK_TIMEOUT_MS = 5000;

export type AlertInput = {
  property: Property;
  sessionId: string;
  sentiment: Sentiment;
  escalate: boolean;
  escalationReason: string | null;
  guestMessage: string;
};

/** Nothing to tell the host about an ordinary question. */
export function shouldAlert({ sentiment, escalate }: AlertInput): boolean {
  return escalate || sentiment === "negative" || sentiment === "critical";
}

function classify(input: AlertInput): {
  kind: AlertKind;
  severity: AlertSeverity;
} {
  if (input.escalate) {
    return {
      kind: "escalation",
      severity: input.sentiment === "critical" ? "critical" : "high",
    };
  }
  return {
    kind: "sentiment",
    severity: input.sentiment === "critical" ? "critical" : "medium",
  };
}

/**
 * Posts the alert to the host's webhook.
 *
 * The URL is host-supplied, so this is a deliberate outbound request to an
 * address we do not control: no redirects are followed, the timeout is short,
 * and the response body is ignored. A failure is recorded and never thrown —
 * the guest's reply must not depend on the host's Slack being up.
 */
async function dispatchWebhook(
  url: string,
  payload: Record<string, unknown>,
): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      redirect: "manual",
      signal: controller.signal,
    });

    if (!response.ok) return `Webhook responded ${response.status}`;
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : "Webhook request failed";
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Records the alert, then tries to deliver it. Recording first means a failed
 * webhook still leaves a trail the host can see in the dashboard.
 */
export async function raiseAlert(input: AlertInput): Promise<void> {
  const { kind, severity } = classify(input);
  const summary =
    input.escalationReason?.trim() ||
    (input.sentiment === "critical"
      ? "Guest is very unhappy."
      : "Guest sounds unhappy.");

  const supabase = createAdminClient();

  const { data: alert } = await supabase
    .from("alerts")
    .insert({
      property_id: input.property.id,
      session_id: input.sessionId,
      kind,
      severity,
      summary,
      guest_message: input.guestMessage.slice(0, 2000),
      delivered: false,
    })
    .select("id")
    .single();

  const webhookUrl = input.property.alert_webhook_url;
  if (!webhookUrl || !alert) return;

  const error = await dispatchWebhook(webhookUrl, {
    type: "hostai.alert",
    kind,
    severity,
    property: { id: input.property.id, name: input.property.name },
    summary,
    guest_message: input.guestMessage.slice(0, 500),
    session_id: input.sessionId,
    raised_at: new Date().toISOString(),
  });

  await supabase
    .from("alerts")
    .update({ delivered: error === null, delivery_error: error })
    .eq("id", alert.id);
}

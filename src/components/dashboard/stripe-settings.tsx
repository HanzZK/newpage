"use client";

import { useState } from "react";
import { useFormState } from "react-dom";
import { Check, Copy } from "lucide-react";

import {
  disconnectStripe,
  saveStripeSettings,
} from "@/app/dashboard/settings/actions";
import { Field, FormStatus, SubmitButton } from "@/components/dashboard/form-parts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { idleState } from "@/lib/dashboard/action-state";

export function StripeSettings({
  webhookUrl,
  hasSecret,
}: {
  webhookUrl: string;
  hasSecret: boolean;
}) {
  const [state, formAction] = useFormState(saveStripeSettings, idleState);
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(webhookUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="webhook-url">Your webhook URL</Label>
        <div className="flex gap-2">
          <Input id="webhook-url" readOnly value={webhookUrl} />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={copy}
            aria-label="Copy webhook URL"
          >
            {copied ? (
              <Check className="h-4 w-4" aria-hidden />
            ) : (
              <Copy className="h-4 w-4" aria-hidden />
            )}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          In Stripe: Developers → Webhooks → Add endpoint. Paste this URL and
          subscribe to <code>checkout.session.completed</code> only.
        </p>
      </div>

      <form action={formAction} className="space-y-4">
        <Field
          name="stripe_webhook_secret"
          label="Signing secret"
          placeholder={hasSecret ? "•••••••• (saved)" : "whsec_…"}
          hint="Shown once when you create the endpoint, under 'Signing secret'. Leave blank to keep the current one."
        />
        <div className="flex items-center gap-3">
          <SubmitButton>Save</SubmitButton>
          <FormStatus state={state} />
        </div>
      </form>

      {hasSecret ? (
        <form action={disconnectStripe}>
          <SubmitButton variant="outline" size="sm">
            Disconnect Stripe
          </SubmitButton>
        </form>
      ) : null}
    </div>
  );
}

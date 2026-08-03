"use client";

import { useFormState } from "react-dom";
import { Trash2 } from "lucide-react";

import {
  Field,
  FormStatus,
  SubmitButton,
  TextField,
} from "@/components/dashboard/form-parts";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  deleteUpsell,
  saveUpsell,
} from "@/app/dashboard/properties/[id]/actions";
import { idleState } from "@/lib/dashboard/action-state";
import type { Upsell } from "@/types/database";

export function formatPrice(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
    }).format(cents / 100);
  } catch {
    // Unknown currency code — fall back to a plain number.
    return `${(cents / 100).toFixed(2)} ${currency}`;
  }
}

function UpsellForm({
  propertyId,
  upsell,
}: {
  propertyId: string;
  upsell?: Upsell;
}) {
  const [state, formAction] = useFormState(saveUpsell, idleState);
  const switchId = `upsell-active-${upsell?.id ?? "new"}`;

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="propertyId" value={propertyId} />
      {upsell ? <input type="hidden" name="upsellId" value={upsell.id} /> : null}

      <Field
        name="title"
        label="Offer"
        required
        defaultValue={upsell?.title}
        placeholder="Late check-out until 18:00"
      />

      <TextField
        name="description"
        label="Description"
        rows={2}
        defaultValue={upsell?.description}
        placeholder="Keep the apartment for the afternoon. Subject to availability."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Field
          name="price"
          label="Price"
          required
          defaultValue={
            upsell ? (upsell.price_cents / 100).toFixed(2) : undefined
          }
          placeholder="25.00"
        />
        <Field
          name="currency"
          label="Currency"
          required
          defaultValue={upsell?.currency ?? "EUR"}
          placeholder="EUR"
        />
        <div className="flex items-center gap-3 pt-6">
          <Switch
            id={switchId}
            name="is_active"
            defaultChecked={upsell?.is_active ?? true}
          />
          <Label htmlFor={switchId} className="font-normal">
            Offer this
          </Label>
        </div>
      </div>

      <Field
        name="stripe_payment_link"
        label="Stripe Payment Link"
        defaultValue={upsell?.stripe_payment_link}
        placeholder="https://buy.stripe.com/…"
        hint="Stripe Dashboard → Payment Links → create one → paste the URL. The AI sends this when a guest accepts."
      />

      <Field
        name="trigger_keywords"
        label="Trigger phrases"
        defaultValue={upsell?.trigger_keywords.join(", ")}
        placeholder="late checkout, stay longer, leave later"
        hint="Comma-separated. When a guest's message matches, the AI brings this offer up."
      />

      <div className="flex items-center gap-3">
        <SubmitButton>{upsell ? "Save" : "Add offer"}</SubmitButton>
        <FormStatus state={state} />
      </div>
    </form>
  );
}

function DeleteButton({
  propertyId,
  upsellId,
}: {
  propertyId: string;
  upsellId: string;
}) {
  return (
    <form action={deleteUpsell}>
      <input type="hidden" name="propertyId" value={propertyId} />
      <input type="hidden" name="upsellId" value={upsellId} />
      <SubmitButton variant="ghost" size="sm">
        <Trash2 className="h-4 w-4" aria-hidden />
        <span className="sr-only">Delete offer</span>
      </SubmitButton>
    </form>
  );
}

export function UpsellEditor({
  propertyId,
  upsells,
}: {
  propertyId: string;
  upsells: Upsell[];
}) {
  return (
    <div className="space-y-4">
      {upsells.map((upsell) => (
        <Card key={upsell.id}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base">{upsell.title}</CardTitle>
              <Badge variant="secondary">
                {formatPrice(upsell.price_cents, upsell.currency)}
              </Badge>
              {upsell.is_active ? null : (
                <Badge variant="outline">paused</Badge>
              )}
              {upsell.stripe_payment_link ? null : (
                <Badge variant="destructive">no payment link</Badge>
              )}
            </div>
            <DeleteButton propertyId={propertyId} upsellId={upsell.id} />
          </CardHeader>
          <CardContent>
            <UpsellForm propertyId={propertyId} upsell={upsell} />
          </CardContent>
        </Card>
      ))}

      <Card className="border-dashed">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Add an offer</CardTitle>
        </CardHeader>
        <CardContent>
          <UpsellForm key={`new-${upsells.length}`} propertyId={propertyId} />
        </CardContent>
      </Card>
    </div>
  );
}

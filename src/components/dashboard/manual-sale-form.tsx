"use client";

import { useFormState } from "react-dom";
import { Trash2 } from "lucide-react";

import {
  deleteManualSale,
  recordManualSale,
} from "@/app/dashboard/settings/actions";
import { Field, FormStatus, SubmitButton } from "@/components/dashboard/form-parts";
import { idleState } from "@/lib/dashboard/action-state";

/**
 * Hand-entered sales. This is the path for hosts whose bank has no webhook —
 * every Georgian bank, since Stripe does not operate here. The host confirms
 * the payment in their own banking app and records it.
 */
export function ManualSaleForm() {
  const [state, formAction] = useFormState(recordManualSale, idleState);

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          name="amount"
          label="თანხა"
          required
          placeholder="30.00"
        />
        <Field
          name="currency"
          label="ვალუტა"
          required
          defaultValue="GEL"
          placeholder="GEL"
        />
      </div>

      <Field
        name="note"
        label="შენიშვნა"
        placeholder="გვიანი გასვლა — ბინა ვაკეზე"
        hint="არასავალდებულო. დაგეხმარება მოგვიანებით გაიხსენო რა იყო."
      />

      <div className="flex items-center gap-3">
        <SubmitButton>ჩაწერა</SubmitButton>
        <FormStatus state={state} />
      </div>
    </form>
  );
}

export function DeleteManualSaleButton({ purchaseId }: { purchaseId: string }) {
  return (
    <form action={deleteManualSale}>
      <input type="hidden" name="purchaseId" value={purchaseId} />
      <SubmitButton variant="ghost" size="sm">
        <Trash2 className="h-4 w-4" aria-hidden />
        <span className="sr-only">ჩანაწერის წაშლა</span>
      </SubmitButton>
    </form>
  );
}

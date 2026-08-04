"use client";

import { useFormState } from "react-dom";

import { Field, FormStatus, SubmitButton } from "@/components/dashboard/form-parts";
import { createProperty } from "@/app/dashboard/actions";
import { idleState } from "@/lib/dashboard/action-state";

export function NewPropertyForm() {
  const [state, formAction] = useFormState(createProperty, idleState);

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          name="name"
          label="ბინის სახელი"
          required
          placeholder="ზღვისპირა სტუდიო, ბათუმი"
        />
        <Field name="address" label="მისამართი" placeholder="რუსთაველის 12" />
      </div>
      <div className="flex items-center gap-3">
        <SubmitButton>ბინის შექმნა</SubmitButton>
        <FormStatus state={state} />
      </div>
    </form>
  );
}

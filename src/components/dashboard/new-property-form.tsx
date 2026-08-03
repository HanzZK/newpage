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
          label="Property name"
          required
          placeholder="Seaside Studio, Batumi"
        />
        <Field name="address" label="Address" placeholder="12 Rustaveli Ave" />
      </div>
      <div className="flex items-center gap-3">
        <SubmitButton>Create property</SubmitButton>
        <FormStatus state={state} />
      </div>
    </form>
  );
}

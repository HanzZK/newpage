"use client";

import { useFormState } from "react-dom";
import { Trash2 } from "lucide-react";

import {
  Field,
  FormStatus,
  SubmitButton,
  TextField,
} from "@/components/dashboard/form-parts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  deleteAppliance,
  saveAppliance,
} from "@/app/dashboard/properties/[id]/actions";
import { idleState } from "@/lib/dashboard/action-state";
import type { Appliance } from "@/types/database";

function ApplianceForm({
  propertyId,
  appliance,
}: {
  propertyId: string;
  appliance?: Appliance;
}) {
  const [state, formAction] = useFormState(saveAppliance, idleState);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="propertyId" value={propertyId} />
      {appliance ? (
        <input type="hidden" name="applianceId" value={appliance.id} />
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          name="name"
          label="ტექნიკა"
          required
          defaultValue={appliance?.name}
          placeholder="სარეცხი მანქანა"
        />
        <Field
          name="location"
          label="სად არის"
          defaultValue={appliance?.location}
          placeholder="სამზარეულოს კუთხეში"
        />
        <Field
          name="brand"
          label="ბრენდი"
          defaultValue={appliance?.brand}
          placeholder="Candy"
        />
        <Field
          name="model"
          label="მოდელი"
          defaultValue={appliance?.model}
          placeholder="CBW 27D1S"
        />
      </div>

      <TextField
        name="instructions"
        label="როგორ მუშაობს"
        required
        rows={4}
        defaultValue={appliance?.instructions}
        placeholder="დაატრიალე მე-3 პროგრამაზე (40°C ბამბა). ფხვნილი მარცხენა განყოფილებაში. დააჭირე start-ს და გეჭიროს 2 წამი."
        hint="დაწერე ისე, როგორც სტუმარს აუხსნიდი. AI ამას კითხულობს იმ ფოტოსთან ერთად, რომელსაც სტუმარი გამოგზავნის."
      />

      <div className="flex items-center gap-3">
        <SubmitButton>{appliance ? "შენახვა" : "ტექნიკის დამატება"}</SubmitButton>
        <FormStatus state={state} />
      </div>
    </form>
  );
}

function DeleteButton({
  propertyId,
  applianceId,
}: {
  propertyId: string;
  applianceId: string;
}) {
  return (
    <form action={deleteAppliance}>
      <input type="hidden" name="propertyId" value={propertyId} />
      <input type="hidden" name="applianceId" value={applianceId} />
      <SubmitButton variant="ghost" size="sm">
        <Trash2 className="h-4 w-4" aria-hidden />
        <span className="sr-only">ტექნიკის წაშლა</span>
      </SubmitButton>
    </form>
  );
}

export function ApplianceEditor({
  propertyId,
  appliances,
}: {
  propertyId: string;
  appliances: Appliance[];
}) {
  return (
    <div className="space-y-4">
      {appliances.map((appliance) => (
        <Card key={appliance.id}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base">{appliance.name}</CardTitle>
            <DeleteButton propertyId={propertyId} applianceId={appliance.id} />
          </CardHeader>
          <CardContent>
            <ApplianceForm propertyId={propertyId} appliance={appliance} />
          </CardContent>
        </Card>
      ))}

      <Card className="border-dashed">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">ტექნიკის დამატება</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Remount on list growth so the blank form clears after a save. */}
          <ApplianceForm
            key={`new-${appliances.length}`}
            propertyId={propertyId}
          />
        </CardContent>
      </Card>
    </div>
  );
}

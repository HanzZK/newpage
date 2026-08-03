"use client";

import { useFormState } from "react-dom";

import {
  Field,
  FormStatus,
  SubmitButton,
  TextField,
} from "@/components/dashboard/form-parts";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  saveEmergency,
  saveEssentials,
  saveRules,
} from "@/app/dashboard/properties/[id]/actions";
import type { ActionState } from "@/lib/dashboard/action-state";
import { idleState } from "@/lib/dashboard/action-state";
import type { Property } from "@/types/database";

function Footer({ state }: { state: ActionState }) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <SubmitButton />
      <FormStatus state={state} />
    </div>
  );
}

export function EssentialsForm({ property }: { property: Property }) {
  const [state, formAction] = useFormState(saveEssentials, idleState);

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="propertyId" value={property.id} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          name="name"
          label="Property name"
          required
          defaultValue={property.name}
          placeholder="Seaside Studio, Batumi"
        />
        <Field
          name="address"
          label="Address"
          defaultValue={property.address}
          placeholder="12 Rustaveli Ave, Batumi"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          name="wifi_ssid"
          label="Wi-Fi network"
          defaultValue={property.wifi_ssid}
          placeholder="Seaside_5G"
        />
        <Field
          name="wifi_password"
          label="Wi-Fi password"
          defaultValue={property.wifi_password}
          hint="Shown to guests in chat. Never exposed to the public client."
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          name="checkin_time"
          label="Check-in from"
          defaultValue={property.checkin_time}
          placeholder="15:00"
        />
        <Field
          name="checkout_time"
          label="Check-out by"
          defaultValue={property.checkout_time}
          placeholder="11:00"
        />
      </div>

      <TextField
        name="checkin_instructions"
        label="Check-in instructions"
        defaultValue={property.checkin_instructions}
        placeholder="Key safe is left of the door, code 4417. Lift to floor 4."
      />
      <TextField
        name="checkout_instructions"
        label="Check-out instructions"
        defaultValue={property.checkout_instructions}
        placeholder="Leave keys on the table, close the windows."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          name="parking_info"
          label="Parking"
          rows={3}
          defaultValue={property.parking_info}
          placeholder="Free street parking on the north side after 18:00."
        />
        <TextField
          name="trash_info"
          label="Rubbish & recycling"
          rows={3}
          defaultValue={property.trash_info}
          placeholder="Bins in the courtyard. Glass goes in the green container."
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          name="default_language"
          label="Default language"
          defaultValue={property.default_language}
          hint="Two-letter code. The AI still replies in whatever language the guest writes."
          placeholder="en"
        />
        <div className="flex items-center gap-3 pt-6">
          <Switch
            id="is_active"
            name="is_active"
            defaultChecked={property.is_active}
          />
          <Label htmlFor="is_active" className="font-normal">
            Concierge is live for guests
          </Label>
        </div>
      </div>

      <Footer state={state} />
    </form>
  );
}

export function RulesForm({ property }: { property: Property }) {
  const [state, formAction] = useFormState(saveRules, idleState);

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="propertyId" value={property.id} />

      <TextField
        name="house_rules"
        label="House rules"
        rows={5}
        defaultValue={property.house_rules}
        placeholder="No parties. Shoes off indoors. Max 4 guests."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Field
          name="quiet_hours"
          label="Quiet hours"
          defaultValue={property.quiet_hours}
          placeholder="22:00 – 08:00"
        />
        <Field
          name="smoking_policy"
          label="Smoking"
          defaultValue={property.smoking_policy}
          placeholder="Balcony only"
        />
        <Field
          name="pet_policy"
          label="Pets"
          defaultValue={property.pet_policy}
          placeholder="Small dogs welcome"
        />
      </div>

      <Footer state={state} />
    </form>
  );
}

export function EmergencyForm({ property }: { property: Property }) {
  const [state, formAction] = useFormState(saveEmergency, idleState);

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="propertyId" value={property.id} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          name="host_name"
          label="Host name"
          defaultValue={property.host_name}
          placeholder="Nino"
        />
        <Field
          name="host_phone"
          label="Host phone"
          defaultValue={property.host_phone}
          placeholder="+995 555 12 34 56"
        />
      </div>

      <Field
        name="emergency_contact"
        label="Emergency contact"
        defaultValue={property.emergency_contact}
        hint="Plumber, building manager, local emergency number."
        placeholder="Building manager Giorgi — +995 555 99 88 77"
      />

      <TextField
        name="emergency_notes"
        label="Emergency protocol"
        defaultValue={property.emergency_notes}
        placeholder="Water shut-off valve is under the kitchen sink. Fuse box is by the entrance."
        hint="The AI reads this out when a guest reports a leak, outage or similar."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          name="alert_email"
          label="Alert email"
          type="email"
          defaultValue={property.alert_email}
          placeholder="you@example.com"
        />
        <Field
          name="alert_webhook_url"
          label="Alert webhook URL"
          defaultValue={property.alert_webhook_url}
          hint="Slack, Make.com or an SMS gateway. Wired up in Phase 4."
          placeholder="https://hooks.slack.com/services/…"
        />
      </div>

      <Footer state={state} />
    </form>
  );
}

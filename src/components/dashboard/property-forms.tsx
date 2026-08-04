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
          label="ბინის სახელი"
          required
          defaultValue={property.name}
          placeholder="ზღვისპირა სტუდიო, ბათუმი"
        />
        <Field
          name="address"
          label="მისამართი"
          defaultValue={property.address}
          placeholder="რუსთაველის 12, ბათუმი"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          name="wifi_ssid"
          label="Wi-Fi ქსელი"
          defaultValue={property.wifi_ssid}
          placeholder="Seaside_5G"
        />
        <Field
          name="wifi_password"
          label="Wi-Fi პაროლი"
          defaultValue={property.wifi_password}
          hint="სტუმარს ჩატში ეუბნება. ბრაუზერში არასდროს ჩანს."
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          name="checkin_time"
          label="შემოსვლა"
          defaultValue={property.checkin_time}
          placeholder="15:00"
        />
        <Field
          name="checkout_time"
          label="გასვლა"
          defaultValue={property.checkout_time}
          placeholder="11:00"
        />
      </div>

      <TextField
        name="checkin_instructions"
        label="შემოსვლის ინსტრუქცია"
        defaultValue={property.checkin_instructions}
        placeholder="გასაღების ყუთი კარის მარცხნივ, კოდი 4417. ლიფტით მე-4 სართულზე."
      />
      <TextField
        name="checkout_instructions"
        label="გასვლის ინსტრუქცია"
        defaultValue={property.checkout_instructions}
        placeholder="გასაღები მაგიდაზე დატოვე, ფანჯრები დახურე."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          name="parking_info"
          label="პარკინგი"
          rows={3}
          defaultValue={property.parking_info}
          placeholder="უფასო პარკინგი ჩრდილოეთ მხარეს 18:00-ის შემდეგ."
        />
        <TextField
          name="trash_info"
          label="ნაგავი"
          rows={3}
          defaultValue={property.trash_info}
          placeholder="ურნები ეზოში. მინა მწვანე კონტეინერში."
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          name="default_language"
          label="ძირითადი ენა"
          defaultValue={property.default_language}
          hint="ორასოიანი კოდი. AI მაინც იმ ენაზე პასუხობს, რომელზეც სტუმარი წერს."
          placeholder="ka"
        />
        <div className="flex items-center gap-3 pt-6">
          <Switch
            id="is_active"
            name="is_active"
            defaultChecked={property.is_active}
          />
          <Label htmlFor="is_active" className="font-normal">
            კონსიერჟი სტუმრებისთვის ჩართულია
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
        label="სახლის წესები"
        rows={5}
        defaultValue={property.house_rules}
        placeholder="წვეულებები აკრძალულია. ფეხსაცმელი კარებთან. მაქსიმუმ 4 სტუმარი."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Field
          name="quiet_hours"
          label="სიჩუმის საათები"
          defaultValue={property.quiet_hours}
          placeholder="22:00 – 08:00"
        />
        <Field
          name="smoking_policy"
          label="მოწევა"
          defaultValue={property.smoking_policy}
          placeholder="მხოლოდ აივანზე"
        />
        <Field
          name="pet_policy"
          label="შინაური ცხოველები"
          defaultValue={property.pet_policy}
          placeholder="პატარა ძაღლები დასაშვებია"
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
          label="მასპინძლის სახელი"
          defaultValue={property.host_name}
          placeholder="ნინო"
        />
        <Field
          name="host_phone"
          label="მასპინძლის ტელეფონი"
          defaultValue={property.host_phone}
          placeholder="+995 555 12 34 56"
        />
      </div>

      <Field
        name="emergency_contact"
        label="საგანგებო კონტაქტი"
        defaultValue={property.emergency_contact}
        hint="სანტექნიკოსი, კორპუსის მმართველი, გადაუდებელი ნომერი."
        placeholder="კორპუსის მმართველი გიორგი — +995 555 99 88 77"
      />

      <TextField
        name="emergency_notes"
        label="საგანგებო ინსტრუქცია"
        defaultValue={property.emergency_notes}
        placeholder="წყლის ონკანი სამზარეულოს ნიჟარის ქვეშ. ელექტროფარი შესასვლელთან."
        hint="AI ამას ეტყვის სტუმარს, როცა წყალდიდობას, დენის გათიშვას ან მსგავსს შეატყობინებს."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          name="alert_email"
          label="შეტყობინების ელფოსტა"
          type="email"
          defaultValue={property.alert_email}
          placeholder="you@example.com"
        />
        <Field
          name="alert_webhook_url"
          label="შეტყობინების webhook"
          defaultValue={property.alert_webhook_url}
          hint="Slack, Make.com ან SMS სერვისი. არასავალდებულო."
          placeholder="https://hooks.slack.com/services/…"
        />
      </div>

      <Footer state={state} />
    </form>
  );
}

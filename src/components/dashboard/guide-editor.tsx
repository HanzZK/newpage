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
import { Label } from "@/components/ui/label";
import { deleteGuide, saveGuide } from "@/app/dashboard/properties/[id]/actions";
import { idleState } from "@/lib/dashboard/action-state";
import type { GuideCategory, LocalGuide } from "@/types/database";

const CATEGORIES: { value: GuideCategory; label: string }[] = [
  { value: "restaurant", label: "რესტორანი" },
  { value: "cafe", label: "კაფე" },
  { value: "bar", label: "ბარი" },
  { value: "grocery", label: "მაღაზია" },
  { value: "pharmacy", label: "აფთიაქი" },
  { value: "transport", label: "ტრანსპორტი" },
  { value: "attraction", label: "ღირსშესანიშნაობა" },
  { value: "beach", label: "პლაჟი" },
  { value: "emergency", label: "გადაუდებელი" },
  { value: "other", label: "სხვა" },
];

function GuideForm({
  propertyId,
  guide,
}: {
  propertyId: string;
  guide?: LocalGuide;
}) {
  const [state, formAction] = useFormState(saveGuide, idleState);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="propertyId" value={propertyId} />
      {guide ? <input type="hidden" name="guideId" value={guide.id} /> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          name="title"
          label="დასახელება"
          required
          defaultValue={guide?.title}
          placeholder="კაფე ლიტერა"
        />
        <div className="space-y-1.5">
          <Label htmlFor={`category-${guide?.id ?? "new"}`}>კატეგორია</Label>
          <select
            id={`category-${guide?.id ?? "new"}`}
            name="category"
            defaultValue={guide?.category ?? "restaurant"}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            {CATEGORIES.map((category) => (
              <option key={category.value} value={category.value}>
                {category.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <TextField
        name="description"
        label="რატომ გირჩევ"
        rows={3}
        defaultValue={guide?.description}
        placeholder="უბანში საუკეთესო ხინკალი. შაბათ-კვირას ჯობია წინასწარ დაჯავშნა."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Field
          name="address"
          label="მისამართი"
          defaultValue={guide?.address}
          placeholder="მაჩაბლის 13"
        />
        <Field
          name="walking_time"
          label="მანძილი"
          defaultValue={guide?.walking_time}
          placeholder="6 წუთის სავალი"
        />
        <Field
          name="url"
          label="ბმული"
          defaultValue={guide?.url}
          placeholder="https://maps.app.goo.gl/…"
        />
      </div>

      <div className="flex items-center gap-3">
        <SubmitButton>{guide ? "შენახვა" : "ადგილის დამატება"}</SubmitButton>
        <FormStatus state={state} />
      </div>
    </form>
  );
}

function DeleteButton({
  propertyId,
  guideId,
}: {
  propertyId: string;
  guideId: string;
}) {
  return (
    <form action={deleteGuide}>
      <input type="hidden" name="propertyId" value={propertyId} />
      <input type="hidden" name="guideId" value={guideId} />
      <SubmitButton variant="ghost" size="sm">
        <Trash2 className="h-4 w-4" aria-hidden />
        <span className="sr-only">ადგილის წაშლა</span>
      </SubmitButton>
    </form>
  );
}

export function GuideEditor({
  propertyId,
  guides,
}: {
  propertyId: string;
  guides: LocalGuide[];
}) {
  return (
    <div className="space-y-4">
      {guides.map((guide) => (
        <Card key={guide.id}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base">{guide.title}</CardTitle>
            <DeleteButton propertyId={propertyId} guideId={guide.id} />
          </CardHeader>
          <CardContent>
            <GuideForm propertyId={propertyId} guide={guide} />
          </CardContent>
        </Card>
      ))}

      <Card className="border-dashed">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Add a place</CardTitle>
        </CardHeader>
        <CardContent>
          <GuideForm key={`new-${guides.length}`} propertyId={propertyId} />
        </CardContent>
      </Card>
    </div>
  );
}

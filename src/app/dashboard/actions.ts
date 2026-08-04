"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/dashboard/guard";
import type { ActionState } from "@/lib/dashboard/action-state";
import { firstIssue, propertyCreateSchema } from "@/lib/validation";

export async function createProperty(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase, user } = await requireUser();

  const parsed = propertyCreateSchema.safeParse({
    name: formData.get("name") ?? "",
    address: formData.get("address") ?? "",
  });

  if (!parsed.success) {
    return { ok: false, message: firstIssue(parsed.error) };
  }

  const { data, error } = await supabase
    .from("properties")
    .insert({ ...parsed.data, host_id: user.id })
    .select("id")
    .single();

  if (error || !data) {
    return {
      ok: false,
      message: error?.message ?? "ბინა ვერ შეიქმნა.",
    };
  }

  revalidatePath("/dashboard");
  redirect(`/dashboard/properties/${data.id}`);
}

export async function deleteProperty(formData: FormData): Promise<void> {
  const { supabase } = await requireUser();
  const id = String(formData.get("propertyId") ?? "");
  if (!id) return;

  await supabase.from("properties").delete().eq("id", id);
  revalidatePath("/dashboard");
  redirect("/dashboard");
}

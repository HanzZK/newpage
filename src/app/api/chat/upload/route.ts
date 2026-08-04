import { NextResponse } from "next/server";

import {
  ALLOWED_IMAGE_TYPES,
  MAX_IMAGE_BYTES,
  extensionFor,
} from "@/lib/chat/limits";
import { requireActiveProperty } from "@/lib/chat/property";
import { clientKey, rateLimit } from "@/lib/chat/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const BUCKET = "guest-uploads";

/**
 * Public, unauthenticated endpoint — a guest scanning a QR code has no account.
 * Every input is therefore treated as hostile: the property must exist and be
 * live, the MIME type must be one Claude's vision API accepts, the size is
 * capped, and the stored filename is generated rather than taken from the
 * client.
 */
export async function POST(request: Request) {
  const limit = rateLimit(clientKey(request, "upload"), 20, 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many uploads. Wait a moment and try again." },
      { status: 429, headers: { "retry-after": String(limit.retryAfterSeconds) } },
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Malformed upload." }, { status: 400 });
  }

  const propertyId = formData.get("propertyId");
  const property = await requireActiveProperty(propertyId);
  if (!property) {
    return NextResponse.json(
      { error: "This concierge is not available." },
      { status: 404 },
    );
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No image received." }, { status: 400 });
  }

  if (!ALLOWED_IMAGE_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_TYPES)[number])) {
    return NextResponse.json(
      { error: "Send a JPEG, PNG, WebP or GIF image." },
      { status: 415 },
    );
  }

  if (file.size > MAX_IMAGE_BYTES) {
    return NextResponse.json(
      { error: "That image is too large. Keep it under 8 MB." },
      { status: 413 },
    );
  }

  // Filename is generated — never trust the client's, which can contain
  // path separators or a misleading extension.
  const path = `${property.id}/${crypto.randomUUID()}.${extensionFor(file.type)}`;

  const supabase = createAdminClient();
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, await file.arrayBuffer(), {
      contentType: file.type,
      cacheControl: "3600",
      upsert: false,
    });

  if (error) {
    return NextResponse.json(
      { error: "Could not store the image. Try again." },
      { status: 502 },
    );
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET).getPublicUrl(path);

  return NextResponse.json({ url: publicUrl, path });
}

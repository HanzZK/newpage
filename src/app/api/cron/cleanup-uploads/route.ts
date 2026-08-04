import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { serverEnv } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BUCKET = "guest-uploads";

/**
 * Deletes guest photos older than the retention window.
 *
 * Two reasons this exists, in order of how soon they bite:
 *
 * 1. **Cost.** Supabase's free tier gives 1 GB of storage — roughly 2,000
 *    guest photos. Nothing else in this product grows anywhere near as fast,
 *    so photo retention is what decides how long the free tier lasts.
 * 2. **Privacy.** A guest photographs an appliance, but also sometimes a
 *    passport, a child, a mess. Keeping those forever is a liability nobody
 *    asked for. The chat transcript keeps the conversation; the image itself
 *    stops being useful within hours.
 *
 * Deliberately done through the Storage API rather than SQL against
 * `storage.objects` — deleting that row does not reliably remove the
 * underlying file.
 */
export async function GET(request: Request) {
  const expected = serverEnv.cronSecret();
  const provided = request.headers.get("authorization");

  if (provided !== `Bearer ${expected}`) {
    // 404 rather than 401: an unauthenticated caller should not learn that
    // this endpoint exists.
    return new NextResponse(null, { status: 404 });
  }

  const days = serverEnv.uploadRetentionDays();
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const supabase = createAdminClient();

  // Uploads are stored as `<propertyId>/<uuid>.<ext>`, so one level of folders
  // then the files inside each.
  const { data: folders, error: folderError } = await supabase.storage
    .from(BUCKET)
    .list("", { limit: 1000 });

  if (folderError) {
    console.error("[cleanup-uploads] could not list bucket", folderError);
    return NextResponse.json({ error: "list failed" }, { status: 502 });
  }

  const stale: string[] = [];
  let scanned = 0;

  for (const folder of folders ?? []) {
    // A folder entry has no id; a file at the root would, and there should not
    // be any.
    if (folder.id) continue;

    let offset = 0;
    for (;;) {
      const { data: files, error } = await supabase.storage
        .from(BUCKET)
        .list(folder.name, { limit: 1000, offset });

      if (error) {
        console.error("[cleanup-uploads] could not list", folder.name, error);
        break;
      }
      if (!files || files.length === 0) break;

      for (const file of files) {
        scanned += 1;
        const created = Date.parse(file.created_at ?? "");
        if (Number.isFinite(created) && created < cutoff) {
          stale.push(`${folder.name}/${file.name}`);
        }
      }

      if (files.length < 1000) break;
      offset += files.length;
    }
  }

  let deleted = 0;
  // remove() takes a batch; chunk it so one enormous sweep cannot time out.
  for (let i = 0; i < stale.length; i += 100) {
    const batch = stale.slice(i, i + 100);
    const { data, error } = await supabase.storage.from(BUCKET).remove(batch);
    if (error) {
      console.error("[cleanup-uploads] batch delete failed", error);
      continue;
    }
    // Count what came back, not what was asked for. Removing an object that
    // is already gone succeeds silently, and listing lags deletion by a
    // moment — so `batch.length` reports phantom deletions on a re-run.
    deleted += data?.length ?? 0;
  }

  return NextResponse.json({ ok: true, retentionDays: days, scanned, deleted });
}

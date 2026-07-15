"use server";

import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { media, stories, storyVersions, type Section } from "@/db/schema";
import { requireUserId } from "@/lib/auth";
import { deleteBlobs } from "@/lib/blob";
import { completeJson } from "@/lib/claude";
import { PHOTO_MATCHER_SYSTEM, photoMatcherPrompt } from "@/lib/prompts";

export type MediaRow = typeof media.$inferSelect;

async function assertStoryOwner(storyId: string, userId: string) {
  const [row] = await db
    .select({ id: stories.id, selectedVersion: stories.selectedVersion })
    .from(stories)
    .where(and(eq(stories.id, storyId), eq(stories.ownerId, userId)));
  if (!row) throw new Error("Story not found or not yours.");
  return row;
}

async function assertMediaOwner(mediaId: string, userId: string) {
  const [row] = await db
    .select({ media, ownerId: stories.ownerId })
    .from(media)
    .innerJoin(stories, eq(media.storyId, stories.id))
    .where(eq(media.id, mediaId));
  if (!row || row.ownerId !== userId) {
    throw new Error("Photo not found or not yours.");
  }
  return row.media;
}

async function nextPosition(storyId: string): Promise<number> {
  const [last] = await db
    .select({ pos: media.position })
    .from(media)
    .where(eq(media.storyId, storyId))
    .orderBy(desc(media.position))
    .limit(1);
  return last ? last.pos + 1 : 0;
}

/** Persist an uploaded photo/clip (blob already uploaded client-side). */
export async function addMedia(input: {
  storyId: string;
  url: string;
  type: "photo" | "clip";
  exifDatetime?: string | null;
}): Promise<MediaRow> {
  const userId = await requireUserId();
  await assertStoryOwner(input.storyId, userId);

  const [row] = await db
    .insert(media)
    .values({
      storyId: input.storyId,
      type: input.type,
      storagePath: input.url,
      position: await nextPosition(input.storyId),
      exifDatetime: input.exifDatetime ? new Date(input.exifDatetime) : null,
    })
    .returning();
  return row;
}

export async function updateCaption(
  mediaId: string,
  caption: string,
): Promise<void> {
  const userId = await requireUserId();
  await assertMediaOwner(mediaId, userId);
  await db
    .update(media)
    .set({ caption: caption.trim() || null })
    .where(eq(media.id, mediaId));
}

export async function assignMediaSection(
  mediaId: string,
  sectionId: string | null,
): Promise<void> {
  const userId = await requireUserId();
  await assertMediaOwner(mediaId, userId);
  await db.update(media).set({ sectionId }).where(eq(media.id, mediaId));
}

export async function deleteMedia(mediaId: string): Promise<void> {
  const userId = await requireUserId();
  const row = await assertMediaOwner(mediaId, userId);
  try {
    await deleteBlobs([row.storagePath]);
  } catch (err) {
    console.error("deleteMedia: blob cleanup failed", err);
  }
  await db.delete(media).where(eq(media.id, mediaId));
}

/** Persist a new order (array of media ids in display order). */
export async function reorderMedia(
  storyId: string,
  orderedIds: string[],
): Promise<void> {
  const userId = await requireUserId();
  await assertStoryOwner(storyId, userId);
  await Promise.all(
    orderedIds.map((id, position) =>
      db
        .update(media)
        .set({ position })
        .where(and(eq(media.id, id), eq(media.storyId, storyId))),
    ),
  );
}

/**
 * Suggest a section for each photo (spec F6) and apply it — a suggestion the
 * user can override in the UI, never a locked assignment. Uses the selected
 * version's sections plus each photo's caption and EXIF date.
 */
export async function suggestPhotoAssignments(
  storyId: string,
): Promise<Record<string, string | null>> {
  const userId = await requireUserId();
  const story = await assertStoryOwner(storyId, userId);

  const [version] = await db
    .select()
    .from(storyVersions)
    .where(
      and(
        eq(storyVersions.storyId, storyId),
        eq(storyVersions.kind, story.selectedVersion ?? "exact"),
      ),
    );
  const sections: Section[] = version?.sectionsJson ?? [];
  if (sections.length === 0) return {};

  const photos = await db
    .select()
    .from(media)
    .where(eq(media.storyId, storyId))
    .orderBy(asc(media.position));
  if (photos.length === 0) return {};

  const validIds = new Set(sections.map((s) => s.id));
  const result: Record<string, string | null> = {};

  try {
    const out = await completeJson<{
      assignments?: Array<{ media_id: string; section_id: string | null }>;
    }>({
      system: PHOTO_MATCHER_SYSTEM,
      prompt: photoMatcherPrompt(
        sections.map((s) => ({ id: s.id, text: s.text })),
        photos.map((p) => ({
          media_id: p.id,
          caption: p.caption ?? undefined,
          exif_datetime: p.exifDatetime?.toISOString(),
        })),
      ),
      maxTokens: 1000,
    });

    for (const a of out.assignments ?? []) {
      const sectionId = a.section_id && validIds.has(a.section_id) ? a.section_id : null;
      result[a.media_id] = sectionId;
      await db
        .update(media)
        .set({ sectionId })
        .where(and(eq(media.id, a.media_id), eq(media.storyId, storyId)));
    }
  } catch (err) {
    console.error("suggestPhotoAssignments failed", err);
  }

  return result;
}

"use server";

import { and, count, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { media, reactions, recordings, stories } from "@/db/schema";
import { deleteBlobs } from "@/lib/blob";
import { ensureProfile, requireUserId } from "@/lib/auth";
import { logEvent } from "@/lib/analytics";

/**
 * Step 1 of the creator flow: capture the working title and create a draft
 * story, then move the teller into the recording screen. ensureProfile first
 * because stories.owner_id references profiles.id.
 */
export async function createDraftStory(formData: FormData): Promise<void> {
  const userId = await ensureProfile();
  const rawTitle = String(formData.get("title") ?? "").trim();

  // Is this the teller's second (or later) story? The strongest signal (spec §11).
  const [{ value: priorCount }] = await db
    .select({ value: count() })
    .from(stories)
    .where(eq(stories.ownerId, userId));

  const [story] = await db
    .insert(stories)
    .values({
      ownerId: userId,
      title: rawTitle.length > 0 ? rawTitle : null,
      status: "draft",
    })
    .returning({ id: stories.id });

  if (priorCount >= 1) {
    await logEvent("second_story_started", { storyId: story.id, ownerId: userId });
  }

  redirect(`/new/${story.id}`);
}

/** Autosave the title as it's edited on the recording screen. */
export async function updateStoryTitle(
  storyId: string,
  title: string,
): Promise<void> {
  const userId = await requireUserId();
  const trimmed = title.trim();

  await db
    .update(stories)
    .set({ title: trimmed.length > 0 ? trimmed : null, updatedAt: new Date() })
    .where(and(eq(stories.id, storyId), eq(stories.ownerId, userId)));
}

/**
 * Delete a story completely: every DB row AND every stored object.
 *
 * Row cleanup is handled by ON DELETE CASCADE (recordings, questions,
 * story_versions, media, share_links, reactions all reference the story). But
 * the DB knows nothing about Vercel Blob, so we must gather and remove the
 * audio + media objects ourselves BEFORE deleting the story — otherwise the
 * paths are gone and the blobs are orphaned forever.
 */
export async function deleteStory(storyId: string): Promise<void> {
  const userId = await requireUserId();

  // Ownership check — never delete someone else's story.
  const [story] = await db
    .select({ id: stories.id })
    .from(stories)
    .where(and(eq(stories.id, storyId), eq(stories.ownerId, userId)));

  if (!story) {
    throw new Error("Story not found or not yours to delete.");
  }

  // Collect every stored object URL tied to this story.
  const [audioRows, mediaRows, reactionRows] = await Promise.all([
    db
      .select({ url: recordings.audioPath })
      .from(recordings)
      .where(eq(recordings.storyId, storyId)),
    db
      .select({ url: media.storagePath })
      .from(media)
      .where(eq(media.storyId, storyId)),
    db
      .select({ url: reactions.audioPath })
      .from(reactions)
      .where(eq(reactions.storyId, storyId)),
  ]);

  const urls = [
    ...audioRows.map((r) => r.url),
    ...mediaRows.map((r) => r.url),
    ...reactionRows.map((r) => r.url),
  ];

  // Best-effort storage cleanup; log but don't block the row delete if Blob
  // hiccups, so a story can always be removed.
  try {
    await deleteBlobs(urls);
  } catch (err) {
    console.error(`deleteStory: blob cleanup failed for ${storyId}`, err);
  }

  await db.delete(stories).where(eq(stories.id, storyId));

  revalidatePath("/stories");
}

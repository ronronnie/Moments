"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { stories } from "@/db/schema";
import { requireUserId } from "@/lib/auth";
import { findMusicTrack } from "@/lib/music";

/**
 * Choose (or clear) the music bed for a story from the owner's preview
 * (spec §4 step 7). `null` turns music off. An unknown id is rejected rather
 * than stored, so the experience page never references a missing track.
 */
export async function selectMusicTrack(
  storyId: string,
  trackId: string | null,
): Promise<void> {
  const userId = await requireUserId();

  if (trackId !== null && !findMusicTrack(trackId)) {
    throw new Error("Unknown music track.");
  }

  const [row] = await db
    .update(stories)
    .set({ musicTrackId: trackId, updatedAt: new Date() })
    .where(and(eq(stories.id, storyId), eq(stories.ownerId, userId)))
    .returning({ id: stories.id });

  if (!row) throw new Error("Story not found or not yours.");
  revalidatePath(`/story/${storyId}/preview`);
}

"use server";

import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { recordings, stories } from "@/db/schema";
import { requireUserId } from "@/lib/auth";
import { deleteBlobs } from "@/lib/blob";
import { transcribeUrl } from "@/lib/deepgram";

export type RecordingRow = typeof recordings.$inferSelect;

/** Throw unless the story exists and belongs to the current user. */
async function assertStoryOwner(storyId: string, userId: string) {
  const [row] = await db
    .select({ id: stories.id })
    .from(stories)
    .where(and(eq(stories.id, storyId), eq(stories.ownerId, userId)));
  if (!row) throw new Error("Story not found or not yours.");
}

async function nextSegmentIndex(storyId: string): Promise<number> {
  const [last] = await db
    .select({ idx: recordings.segmentIndex })
    .from(recordings)
    .where(eq(recordings.storyId, storyId))
    .orderBy(desc(recordings.segmentIndex))
    .limit(1);
  return last ? last.idx + 1 : 0;
}

/**
 * "Type it instead" — a segment with no audio. The typed text is the transcript
 * directly; there are no word timings (captions fall back to section-level sync
 * on the experience page).
 */
export async function addTextSegment(
  storyId: string,
  text: string,
  source: "initial" | "followup" = "initial",
  questionId?: string,
): Promise<RecordingRow> {
  const userId = await requireUserId();
  await assertStoryOwner(storyId, userId);

  const [row] = await db
    .insert(recordings)
    .values({
      storyId,
      segmentIndex: await nextSegmentIndex(storyId),
      transcriptText: text.trim(),
      source,
      questionId: questionId ?? null,
    })
    .returning();

  return row;
}

/**
 * A recorded segment. The audio is already uploaded to Blob (client upload);
 * we persist the row immediately so the audio is never lost, then transcribe
 * with Deepgram and update the row. If transcription fails, the row keeps its
 * audio with an empty transcript the teller can fill in or retype.
 */
export async function transcribeAndSaveSegment(input: {
  storyId: string;
  audioUrl: string;
  durationS?: number;
  source?: "initial" | "followup";
  questionId?: string;
}): Promise<RecordingRow> {
  const userId = await requireUserId();
  await assertStoryOwner(input.storyId, userId);

  const [row] = await db
    .insert(recordings)
    .values({
      storyId: input.storyId,
      segmentIndex: await nextSegmentIndex(input.storyId),
      audioPath: input.audioUrl,
      durationS: input.durationS ?? null,
      source: input.source ?? "initial",
      questionId: input.questionId ?? null,
    })
    .returning();

  try {
    const { transcript, words } = await transcribeUrl(input.audioUrl);
    const [updated] = await db
      .update(recordings)
      .set({ transcriptText: transcript, wordsJson: words })
      .where(eq(recordings.id, row.id))
      .returning();
    return updated;
  } catch (err) {
    console.error("transcribeAndSaveSegment: transcription failed", err);
    return row; // audio preserved; transcript empty and editable
  }
}

/** Edit a segment's transcript (review step). */
export async function updateTranscript(
  recordingId: string,
  text: string,
): Promise<void> {
  const userId = await requireUserId();

  const [row] = await db
    .select({ ownerId: stories.ownerId })
    .from(recordings)
    .innerJoin(stories, eq(recordings.storyId, stories.id))
    .where(eq(recordings.id, recordingId));

  if (!row || row.ownerId !== userId) {
    throw new Error("Recording not found or not yours.");
  }

  await db
    .update(recordings)
    .set({ transcriptText: text })
    .where(eq(recordings.id, recordingId));
}

/** Remove a segment and its audio blob. */
export async function deleteSegment(recordingId: string): Promise<void> {
  const userId = await requireUserId();

  const [row] = await db
    .select({ ownerId: stories.ownerId, audioPath: recordings.audioPath })
    .from(recordings)
    .innerJoin(stories, eq(recordings.storyId, stories.id))
    .where(eq(recordings.id, recordingId));

  if (!row || row.ownerId !== userId) {
    throw new Error("Recording not found or not yours.");
  }

  try {
    await deleteBlobs([row.audioPath]);
  } catch (err) {
    console.error("deleteSegment: blob cleanup failed", err);
  }

  await db.delete(recordings).where(eq(recordings.id, recordingId));
}

"use server";

import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { reactions, shareLinks, stories } from "@/db/schema";
import { notifyReaction } from "@/lib/email";

/**
 * A recipient's response (spec F8): a written message, an emoji pinned to a
 * moment, or a voice reply. No account — possession of a valid, un-revoked share
 * token is the grant. Everything is validated server-side; the client never
 * supplies a story id, only the token it was given (standing rule 3).
 */

export type SubmitReactionInput = {
  token: string;
  kind: "text" | "emoji" | "voice";
  /** message text, or the emoji character */
  body?: string;
  /** blob URL of an uploaded voice reply (≤60s), for kind="voice" */
  audioUrl?: string;
  /** seconds into the story this was pinned to, if mid-playback */
  timestampOffsetS?: number;
  /** first name only — optional */
  reactorName?: string;
};

const MAX_BODY = 2000;

export async function submitReaction(
  input: SubmitReactionInput,
): Promise<{ ok: boolean }> {
  const [link] = await db
    .select({ id: shareLinks.id, storyId: shareLinks.storyId })
    .from(shareLinks)
    .where(and(eq(shareLinks.token, input.token), isNull(shareLinks.revokedAt)));
  if (!link) throw new Error("This story is no longer available.");

  // Validate the payload for the given kind.
  const body = input.body?.trim() ?? "";
  if (input.kind === "text" && body.length === 0) {
    throw new Error("Write a little something first.");
  }
  if (input.kind === "emoji" && body.length === 0) {
    throw new Error("Pick a reaction first.");
  }
  if (input.kind === "voice" && !input.audioUrl) {
    throw new Error("No voice reply to send.");
  }

  const reactorName = input.reactorName?.trim().slice(0, 60) || null;
  const timestampOffsetS =
    typeof input.timestampOffsetS === "number" && input.timestampOffsetS >= 0
      ? +input.timestampOffsetS.toFixed(2)
      : null;

  await db.insert(reactions).values({
    storyId: link.storyId,
    shareLinkId: link.id,
    kind: input.kind,
    body: input.kind === "voice" ? null : body.slice(0, MAX_BODY),
    audioPath: input.kind === "voice" ? (input.audioUrl ?? null) : null,
    timestampOffsetS,
    reactorName,
  });

  // Tell the owner — best effort, never blocks the response.
  try {
    const [story] = await db
      .select({ ownerId: stories.ownerId, title: stories.title })
      .from(stories)
      .where(eq(stories.id, link.storyId));
    if (story) {
      await notifyReaction({
        ownerId: story.ownerId,
        storyTitle: story.title ?? "",
        storyId: link.storyId,
        reactorName,
        kind: input.kind,
      });
    }
  } catch (err) {
    console.error("submitReaction: owner notify failed", err);
  }

  return { ok: true };
}

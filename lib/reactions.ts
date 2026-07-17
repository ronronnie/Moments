import "server-only";

import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { reactions, shareLinks, stories } from "@/db/schema";
import { notifyFirstView } from "@/lib/email";

/**
 * Server-only reads for the reaction loop (spec F8). Recipient writes go through
 * the token-validated action in lib/actions/reactions.ts; these are the owner's
 * side (listing responses) plus the view counter that the recipient page trips.
 */

export type ReactionRow = typeof reactions.$inferSelect;

/** Every response to a story, oldest first. Owner-scoped. */
export async function listReactions(
  storyId: string,
  ownerId: string,
): Promise<ReactionRow[]> {
  const [story] = await db
    .select({ id: stories.id })
    .from(stories)
    .where(and(eq(stories.id, storyId), eq(stories.ownerId, ownerId)));
  if (!story) return [];

  return db
    .select()
    .from(reactions)
    .where(eq(reactions.storyId, storyId))
    .orderBy(asc(reactions.createdAt));
}

/** Just the pinned timestamps (seconds) for scrub-bar ticks in the owner preview. */
export async function listReactionPins(
  storyId: string,
  ownerId: string,
): Promise<number[]> {
  const rows = await listReactions(storyId, ownerId);
  return rows
    .map((r) => r.timestampOffsetS)
    .filter((t): t is number => typeof t === "number");
}

/**
 * Count a recipient view when the shared page is served, and email the owner the
 * first time a story is opened. Best-effort and non-throwing — a counter or a
 * notification must never break playback. Called from the /s/[token] page.
 */
export async function recordShareView(token: string): Promise<void> {
  try {
    const [link] = await db
      .select({ id: shareLinks.id, storyId: shareLinks.storyId })
      .from(shareLinks)
      .where(and(eq(shareLinks.token, token), isNull(shareLinks.revokedAt)));
    if (!link) return;

    const [updated] = await db
      .update(shareLinks)
      .set({ viewCount: sql`${shareLinks.viewCount} + 1` })
      .where(eq(shareLinks.id, link.id))
      .returning({ viewCount: shareLinks.viewCount });

    if (updated?.viewCount === 1) {
      const [story] = await db
        .select({ ownerId: stories.ownerId, title: stories.title })
        .from(stories)
        .where(eq(stories.id, link.storyId));
      if (story) {
        await notifyFirstView({
          ownerId: story.ownerId,
          storyTitle: story.title ?? "",
          storyId: link.storyId,
        });
      }
    }
  } catch (err) {
    console.error("recordShareView failed", err);
  }
}

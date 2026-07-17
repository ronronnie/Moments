"use server";

import { randomBytes } from "node:crypto";
import { and, desc, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { shareLinks, stories } from "@/db/schema";
import { requireUserId } from "@/lib/auth";
import { logEvent } from "@/lib/analytics";

/**
 * Private sharing (spec F8). A story is shared through an unguessable, revocable
 * token → /s/{token}. Owners can turn a link off (revoke) or swap it for a fresh
 * one (regenerate). Recipients never touch these tables — they reach the story
 * only through the token-validated loader in lib/experience.ts (standing rule 3).
 */

export type ShareState = {
  token: string | null; // the active (un-revoked) token, if any
  viewCount: number;
};

/** 24 url-safe characters of entropy — unguessable, not sequential. */
function newToken(): string {
  return randomBytes(18).toString("base64url");
}

async function assertOwner(storyId: string, userId: string) {
  const [row] = await db
    .select({ id: stories.id })
    .from(stories)
    .where(and(eq(stories.id, storyId), eq(stories.ownerId, userId)));
  if (!row) throw new Error("Story not found or not yours.");
}

/** The current active link for a story (owner view), or null. */
export async function getShareState(storyId: string): Promise<ShareState> {
  const userId = await requireUserId();
  await assertOwner(storyId, userId);

  const [link] = await db
    .select({ token: shareLinks.token, viewCount: shareLinks.viewCount })
    .from(shareLinks)
    .where(and(eq(shareLinks.storyId, storyId), isNull(shareLinks.revokedAt)))
    .orderBy(desc(shareLinks.createdAt))
    .limit(1);

  return { token: link?.token ?? null, viewCount: link?.viewCount ?? 0 };
}

/**
 * Get the story's active share token, creating one on first share. Marks the
 * story as shared. Idempotent — returns the existing token if already shared.
 */
export async function ensureShareLink(storyId: string): Promise<string> {
  const userId = await requireUserId();
  await assertOwner(storyId, userId);

  const [existing] = await db
    .select({ token: shareLinks.token })
    .from(shareLinks)
    .where(and(eq(shareLinks.storyId, storyId), isNull(shareLinks.revokedAt)))
    .orderBy(desc(shareLinks.createdAt))
    .limit(1);
  if (existing) return existing.token;

  const token = newToken();
  await db.insert(shareLinks).values({ storyId, token });
  await db
    .update(stories)
    .set({ status: "shared", updatedAt: new Date() })
    .where(eq(stories.id, storyId));

  await logEvent("shared", { storyId, ownerId: userId });
  revalidatePath(`/story/${storyId}/share`);
  return token;
}

/** Turn off every active link for a story. Existing links stop working at once. */
export async function revokeShareLink(storyId: string): Promise<void> {
  const userId = await requireUserId();
  await assertOwner(storyId, userId);

  await db
    .update(shareLinks)
    .set({ revokedAt: new Date() })
    .where(and(eq(shareLinks.storyId, storyId), isNull(shareLinks.revokedAt)));

  revalidatePath(`/story/${storyId}/share`);
}

/** Revoke the current link and issue a fresh one. Returns the new token. */
export async function regenerateShareLink(storyId: string): Promise<string> {
  const userId = await requireUserId();
  await assertOwner(storyId, userId);

  await db
    .update(shareLinks)
    .set({ revokedAt: new Date() })
    .where(and(eq(shareLinks.storyId, storyId), isNull(shareLinks.revokedAt)));

  const token = newToken();
  await db.insert(shareLinks).values({ storyId, token });

  revalidatePath(`/story/${storyId}/share`);
  return token;
}

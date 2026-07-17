import "server-only";

import { db } from "@/db";
import { events } from "@/db/schema";

/**
 * Success-metric logging (spec §11). Every call is BEST-EFFORT: analytics must
 * never break a user action, so a failed insert is swallowed with a log. Server
 * call sites use logEvent directly; client-triggered events go through the
 * whitelisted trackEvent server action.
 */

export type EventName =
  | "recording_started"
  | "recording_completed"
  | "question_answered"
  | "preview_reached"
  | "shared"
  | "recipient_viewed"
  | "recipient_completed"
  | "reaction_left"
  | "second_story_started";

export async function logEvent(
  name: EventName,
  opts: {
    storyId?: string | null;
    ownerId?: string | null;
    meta?: Record<string, string | number>;
  } = {},
): Promise<void> {
  try {
    await db.insert(events).values({
      name,
      storyId: opts.storyId ?? null,
      ownerId: opts.ownerId ?? null,
      meta: opts.meta,
    });
  } catch (err) {
    console.error(`logEvent(${name}) failed`, err);
  }
}

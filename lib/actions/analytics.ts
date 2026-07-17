"use server";

import { logEvent, type EventName } from "@/lib/analytics";

/**
 * Client-callable event logging. Only the events a browser legitimately knows
 * about are accepted — the recipient has no account, so this is unauthenticated
 * and deliberately narrow. Everything else is logged server-side at its source.
 */
const CLIENT_EVENTS = new Set<EventName>([
  "recording_started",
  "recipient_completed",
]);

export async function trackEvent(
  name: EventName,
  storyId?: string | null,
): Promise<void> {
  if (!CLIENT_EVENTS.has(name)) return;
  await logEvent(name, { storyId: storyId ?? null });
}

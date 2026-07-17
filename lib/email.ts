import "server-only";

import { headers } from "next/headers";
import { clerkClient } from "@clerk/nextjs/server";

/**
 * Owner notifications (spec F8): a gentle email when a story is first opened and
 * when a response arrives. Sent through Resend's HTTP API so we add no
 * dependency. Every send is BEST-EFFORT — if RESEND_API_KEY isn't set, or the
 * call fails, we log and move on; a notification must never block a view or a
 * reaction. Copy follows the product voice: warm, plain, no jargon.
 */

const FROM = process.env.EMAIL_FROM ?? "Moments <onboarding@resend.dev>";

/** The absolute origin of the current request (for links in emails). */
async function baseUrl(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.includes("localhost") ? "http" : "https");
  return host ? `${proto}://${host}` : (process.env.NEXT_PUBLIC_SITE_URL ?? "");
}

/** The story owner's email, via Clerk. Null if unavailable. */
async function ownerEmail(ownerId: string): Promise<string | null> {
  try {
    const client = await clerkClient();
    const user = await client.users.getUser(ownerId);
    return user.primaryEmailAddress?.emailAddress ?? null;
  } catch (err) {
    console.error("ownerEmail: lookup failed", err);
    return null;
  }
}

async function send(to: string, subject: string, text: string): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.info(`[email] skipped (no RESEND_API_KEY): "${subject}" → ${to}`);
    return;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: FROM, to, subject, text }),
    });
    if (!res.ok) {
      console.error("[email] send failed", res.status, await res.text());
    }
  } catch (err) {
    console.error("[email] send threw", err);
  }
}

export async function notifyFirstView(input: {
  ownerId: string;
  storyTitle: string;
  storyId: string;
}): Promise<void> {
  const to = await ownerEmail(input.ownerId);
  if (!to) return;
  const link = `${await baseUrl()}/story/${input.storyId}/share`;
  const title = input.storyTitle || "your story";
  await send(
    to,
    `Someone opened “${title}”`,
    `Your story “${title}” was just opened by someone you shared it with.\n\n` +
      `You can see who responds here:\n${link}\n\n— Moments`,
  );
}

export async function notifyReaction(input: {
  ownerId: string;
  storyTitle: string;
  storyId: string;
  reactorName: string | null;
  kind: "text" | "emoji" | "voice";
}): Promise<void> {
  const to = await ownerEmail(input.ownerId);
  if (!to) return;
  const link = `${await baseUrl()}/story/${input.storyId}/share`;
  const title = input.storyTitle || "your story";
  const who = input.reactorName?.trim() || "Someone";
  const what =
    input.kind === "voice"
      ? "left a voice reply to"
      : input.kind === "emoji"
        ? "reacted to"
        : "wrote back about";
  await send(
    to,
    `${who} responded to “${title}”`,
    `${who} just ${what} your story “${title}”.\n\n` +
      `Listen and read their response here:\n${link}\n\n— Moments`,
  );
}

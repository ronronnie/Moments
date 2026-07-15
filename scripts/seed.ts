/**
 * Seed one fake, real-shaped story so downstream phases have data to build
 * against: 1 story, 2 recordings (with word-level timestamps), 1 exact story
 * version with sections, and 3 photos.
 *
 * Run: `npm run db:seed`
 *
 * Idempotent — it removes any prior seed story for the seed user first (which
 * cascades its recordings, versions, and media) before inserting fresh.
 *
 * To see this story in the /stories UI, set SEED_USER_ID in .env.local to YOUR
 * Clerk user id (Clerk dashboard → Users). Otherwise it uses a placeholder id
 * that no signed-in session will match — still fine for direct DB development.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { and, eq } from "drizzle-orm";
import * as schema from "../db/schema";
import type { Word } from "../db/schema";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set. Add it to .env.local first.");
  process.exit(1);
}

const db = drizzle(neon(process.env.DATABASE_URL), { schema });

const SEED_USER_ID = process.env.SEED_USER_ID ?? "user_seed_dev";
const SEED_TITLE = "The day we almost missed the ferry";

/** Build simple word-timestamp data from a sentence for a given time window. */
function words(sentence: string, startAt: number, perWord = 0.42): Word[] {
  return sentence.split(" ").map((w, i) => ({
    w,
    start: +(startAt + i * perWord).toFixed(2),
    end: +(startAt + (i + 1) * perWord - 0.06).toFixed(2),
    conf: 0.98,
  }));
}

async function main() {
  console.log(`Seeding as user "${SEED_USER_ID}"…`);

  // Profile (upsert).
  await db
    .insert(schema.profiles)
    .values({ id: SEED_USER_ID, displayName: "Seed Teller" })
    .onConflictDoUpdate({
      target: schema.profiles.id,
      set: { displayName: "Seed Teller" },
    });

  // Remove any prior seed story (cascades children) so re-runs stay clean.
  await db
    .delete(schema.stories)
    .where(
      and(
        eq(schema.stories.ownerId, SEED_USER_ID),
        eq(schema.stories.title, SEED_TITLE),
      ),
    );

  // Story.
  const [story] = await db
    .insert(schema.stories)
    .values({
      ownerId: SEED_USER_ID,
      title: SEED_TITLE,
      status: "ready",
      occasion: "A summer we still talk about",
      storyDateText: "Summer 1998",
      locationText: "Tsawwassen, British Columbia",
      selectedVersion: "exact",
    })
    .returning();

  const line1 =
    "We were so sure we had time, so we stopped for coffee at the little stand by the terminal.";
  const line2 =
    "Then the horn went, and your grandmother just started running, hat in one hand, tickets in the other.";

  // Two recordings with word-level timing (source: initial, then followup).
  const [rec1, rec2] = await db
    .insert(schema.recordings)
    .values([
      {
        storyId: story.id,
        segmentIndex: 0,
        audioPath: null, // real audio arrives from the capture flow (Prompt 2)
        durationS: line1.split(" ").length * 0.42,
        transcriptText: line1,
        wordsJson: words(line1, 0),
        source: "initial",
      },
      {
        storyId: story.id,
        segmentIndex: 1,
        audioPath: null,
        durationS: line2.split(" ").length * 0.42,
        transcriptText: line2,
        wordsJson: words(line2, 0),
        source: "followup",
      },
    ])
    .returning();

  // One exact story version split into two sections.
  await db.insert(schema.storyVersions).values({
    storyId: story.id,
    kind: "exact",
    title: SEED_TITLE,
    pullQuote: "hat in one hand, tickets in the other",
    sectionsJson: [
      { id: "s1", text: line1, start_s: 0, end_s: rec1.durationS ?? 8 },
      { id: "s2", text: line2, start_s: 0, end_s: rec2.durationS ?? 9 },
    ],
  });

  // Three photos. Placeholder URLs render in dev; real uploads (Prompt 5) will
  // store Vercel Blob URLs here instead.
  await db.insert(schema.media).values([
    {
      storyId: story.id,
      type: "photo",
      storagePath: "https://picsum.photos/seed/moments-ferry-1/1200/800",
      caption: "The coffee stand by the terminal",
      position: 0,
      sectionId: "s1",
    },
    {
      storyId: story.id,
      type: "photo",
      storagePath: "https://picsum.photos/seed/moments-ferry-2/1200/800",
      caption: "Grandmother, mid-run",
      position: 1,
      sectionId: "s2",
    },
    {
      storyId: story.id,
      type: "photo",
      storagePath: "https://picsum.photos/seed/moments-ferry-3/1200/800",
      caption: "The boat pulling away from the dock",
      position: 2,
      sectionId: "s2",
    },
  ]);

  console.log(`✓ Seeded story ${story.id} with 2 recordings and 3 photos.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });

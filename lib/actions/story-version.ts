"use server";

import { and, asc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import {
  recordings,
  stories,
  storyVersions,
  type Section,
  type Word,
} from "@/db/schema";
import { requireUserId } from "@/lib/auth";
import { completeJson } from "@/lib/claude";
import {
  POLISHER_SYSTEM,
  STRUCTURER_SYSTEM,
  polisherPrompt,
  structurerPrompt,
} from "@/lib/prompts";

export type VersionRow = typeof storyVersions.$inferSelect;

const SYNTH_WORD_S = 0.42; // nominal per-word timing for typed segments

async function assertStoryOwner(storyId: string, userId: string) {
  const [row] = await db
    .select()
    .from(stories)
    .where(and(eq(stories.id, storyId), eq(stories.ownerId, userId)));
  if (!row) throw new Error("Story not found or not yours.");
  return row;
}

/**
 * Flatten every segment into one continuous-timeline word array. Voice segment
 * timings are offset by the cumulative duration of prior segments; typed
 * segments (no audio) get synthetic timing so the whole story shares one clock.
 */
async function buildCombinedWords(
  storyId: string,
): Promise<{ words: Word[]; totalS: number }> {
  const rows = await db
    .select()
    .from(recordings)
    .where(eq(recordings.storyId, storyId))
    .orderBy(asc(recordings.segmentIndex));

  const words: Word[] = [];
  let offset = 0;

  for (const r of rows) {
    if (r.wordsJson && r.wordsJson.length > 0) {
      for (const w of r.wordsJson) {
        words.push({
          w: w.w,
          start: +(w.start + offset).toFixed(2),
          end: +(w.end + offset).toFixed(2),
          conf: w.conf,
        });
      }
      const last = r.wordsJson[r.wordsJson.length - 1];
      offset += r.durationS ?? last.end;
    } else if (r.transcriptText?.trim()) {
      const toks = r.transcriptText.trim().split(/\s+/);
      toks.forEach((t, i) =>
        words.push({
          w: t,
          start: +(offset + i * SYNTH_WORD_S).toFixed(2),
          end: +(offset + (i + 1) * SYNTH_WORD_S - 0.06).toFixed(2),
        }),
      );
      offset += toks.length * SYNTH_WORD_S;
    }
  }

  return { words, totalS: offset };
}

/** Build exact section text from word boundaries, guaranteeing full coverage. */
function sectionsFromBoundaries(
  words: Word[],
  boundaries: Array<{ start_s: number }>,
  totalS: number,
): Section[] {
  const sorted = [...boundaries].sort((a, b) => a.start_s - b.start_s);
  return sorted.map((b, i) => {
    const start = i === 0 ? 0 : b.start_s;
    const end = i < sorted.length - 1 ? sorted[i + 1].start_s : totalS + 1;
    const text = words
      .filter((w) => w.start >= start - 0.001 && w.start < end - 0.001)
      .map((w) => w.w)
      .join(" ")
      .trim();
    return { id: `s${i + 1}`, text, start_s: +start.toFixed(2), end_s: +end.toFixed(2) };
  });
}

/** Fallback structuring with no LLM: one section per recorded segment. */
async function fallbackExactSections(storyId: string): Promise<Section[]> {
  const { words, totalS } = await buildCombinedWords(storyId);
  if (words.length === 0) return [];
  // Split into ~3 roughly-equal time chunks so it reads as a story, not a wall.
  const chunkCount = Math.min(3, Math.max(1, Math.round(totalS / 45)));
  const boundaries = Array.from({ length: chunkCount }, (_, i) => ({
    start_s: (totalS / chunkCount) * i,
  }));
  return sectionsFromBoundaries(words, boundaries, totalS);
}

/**
 * Generate both versions once (spec F5). Structurer → exact (verbatim text
 * derived from word boundaries), Polisher → polished (rewritten, same section
 * ids). Idempotent: returns existing versions if already generated. Degrades
 * gracefully — exact always exists (local fallback); polished may be absent if
 * the LLM is unavailable.
 */
export async function generateVersions(storyId: string): Promise<{
  exact: VersionRow | null;
  polished: VersionRow | null;
}> {
  const userId = await requireUserId();
  const story = await assertStoryOwner(storyId, userId);

  const existing = await db
    .select()
    .from(storyVersions)
    .where(eq(storyVersions.storyId, storyId));
  let exact = existing.find((v) => v.kind === "exact") ?? null;
  let polished = existing.find((v) => v.kind === "polished") ?? null;
  if (exact) return { exact, polished };

  const { words, totalS } = await buildCombinedWords(storyId);
  if (words.length === 0) return { exact: null, polished: null };

  // ---- Exact (Structurer, with local fallback) ----
  let title = story.title ?? "Untitled story";
  let pullQuote = "";
  let sections: Section[] = [];

  try {
    const out = await completeJson<{
      title?: string;
      pull_quote?: string;
      sections?: Array<{ start_s: number; end_s: number }>;
    }>({
      system: STRUCTURER_SYSTEM,
      prompt: structurerPrompt(words.map(({ w, start, end }) => ({ w, start, end }))),
      maxTokens: 1500,
    });
    if (out.sections && out.sections.length > 0) {
      sections = sectionsFromBoundaries(words, out.sections, totalS);
      if (out.title?.trim()) title = out.title.trim();
      if (out.pull_quote?.trim()) pullQuote = out.pull_quote.trim();
    }
  } catch (err) {
    console.error("generateVersions: structurer failed, using fallback", err);
  }

  if (sections.length === 0) sections = await fallbackExactSections(storyId);
  if (sections.length === 0) return { exact: null, polished: null };

  [exact] = await db
    .insert(storyVersions)
    .values({ storyId, kind: "exact", title, pullQuote: pullQuote || null, sectionsJson: sections })
    .returning();

  // ---- Polished (Polisher; skipped if unavailable) ----
  try {
    const out = await completeJson<{
      title?: string;
      pull_quote?: string;
      sections?: Array<{ id: string; text: string }>;
    }>({
      system: POLISHER_SYSTEM,
      prompt: polisherPrompt(sections.map((s) => ({ id: s.id, text: s.text }))),
      maxTokens: 2000,
    });
    if (out.sections && out.sections.length > 0) {
      const byId = new Map(out.sections.map((s) => [s.id, s.text]));
      const polishedSections: Section[] = sections.map((s) => ({
        ...s,
        text: byId.get(s.id)?.trim() || s.text,
      }));
      [polished] = await db
        .insert(storyVersions)
        .values({
          storyId,
          kind: "polished",
          title: out.title?.trim() || title,
          pullQuote: out.pull_quote?.trim() || pullQuote || null,
          sectionsJson: polishedSections,
        })
        .returning();
    }
  } catch (err) {
    console.error("generateVersions: polisher failed, exact only", err);
  }

  // Default the selection to exact so the story is ready to preview.
  if (!story.selectedVersion) {
    await db
      .update(stories)
      .set({ selectedVersion: "exact", updatedAt: new Date() })
      .where(eq(stories.id, storyId));
  }

  return { exact, polished };
}

async function assertVersionOwner(versionId: string, userId: string) {
  const [row] = await db
    .select({
      version: storyVersions,
      ownerId: stories.ownerId,
    })
    .from(storyVersions)
    .innerJoin(stories, eq(storyVersions.storyId, stories.id))
    .where(eq(storyVersions.id, versionId));
  if (!row || row.ownerId !== userId) {
    throw new Error("Version not found or not yours.");
  }
  return row.version;
}

/** Inline-edit one section's text (either version). */
export async function updateSectionText(
  versionId: string,
  sectionId: string,
  text: string,
): Promise<void> {
  const userId = await requireUserId();
  const version = await assertVersionOwner(versionId, userId);

  const sections = (version.sectionsJson ?? []).map((s) =>
    s.id === sectionId ? { ...s, text } : s,
  );
  await db
    .update(storyVersions)
    .set({ sectionsJson: sections })
    .where(eq(storyVersions.id, versionId));
}

/** Edit a version's title. */
export async function updateVersionTitle(
  versionId: string,
  title: string,
): Promise<void> {
  const userId = await requireUserId();
  await assertVersionOwner(versionId, userId);
  await db
    .update(storyVersions)
    .set({ title: title.trim() || null })
    .where(eq(storyVersions.id, versionId));
}

/** Persist the chosen version on the story. */
export async function selectVersion(
  storyId: string,
  kind: "exact" | "polished",
): Promise<void> {
  const userId = await requireUserId();
  await assertStoryOwner(storyId, userId);
  await db
    .update(stories)
    .set({ selectedVersion: kind, status: "ready", updatedAt: new Date() })
    .where(and(eq(stories.id, storyId), eq(stories.ownerId, userId)));
  revalidatePath(`/story/${storyId}`);
}

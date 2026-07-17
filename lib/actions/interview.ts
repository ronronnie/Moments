"use server";

import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { questions, recordings, stories, type StoryContext } from "@/db/schema";
import { requireUserId } from "@/lib/auth";
import { logEvent } from "@/lib/analytics";
import { completeJson } from "@/lib/claude";
import {
  CONTEXT_EXTRACTION_SYSTEM,
  INTERVIEWER_SYSTEM,
  contextExtractionPrompt,
  interviewerPrompt,
} from "@/lib/prompts";

export type QuestionRow = typeof questions.$inferSelect;

async function assertStoryOwner(storyId: string, userId: string) {
  const [row] = await db
    .select({ context: stories.contextJson })
    .from(stories)
    .where(and(eq(stories.id, storyId), eq(stories.ownerId, userId)));
  if (!row) throw new Error("Story not found or not yours.");
  return row;
}

/** The combined transcript so far, in segment order. */
async function buildTranscript(storyId: string): Promise<string> {
  const rows = await db
    .select({ text: recordings.transcriptText })
    .from(recordings)
    .where(eq(recordings.storyId, storyId))
    .orderBy(asc(recordings.segmentIndex));
  return rows
    .map((r) => r.text?.trim())
    .filter(Boolean)
    .join("\n\n");
}

function formatContext(ctx: StoryContext | null | undefined): string {
  if (!ctx) return "";
  const parts: string[] = [];
  if (ctx.people?.length) parts.push(`People: ${ctx.people.join(", ")}`);
  if (ctx.places?.length) parts.push(`Places: ${ctx.places.join(", ")}`);
  if (ctx.timeframe) parts.push(`Timeframe: ${ctx.timeframe}`);
  if (ctx.occasion) parts.push(`Occasion: ${ctx.occasion}`);
  if (ctx.emotionalTone) parts.push(`Tone: ${ctx.emotionalTone}`);
  return parts.join("\n");
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

async function assertQuestionOwner(questionId: string, userId: string) {
  const [row] = await db
    .select({ storyId: questions.storyId, ownerId: stories.ownerId })
    .from(questions)
    .innerJoin(stories, eq(questions.storyId, stories.id))
    .where(eq(questions.id, questionId));
  if (!row || row.ownerId !== userId) {
    throw new Error("Question not found or not yours.");
  }
  return row;
}

/**
 * Return the story's pending questions, generating them once from the
 * transcript if none exist yet. Up to 3, warm and non-repeating (spec F4).
 */
export async function getOrGenerateQuestions(
  storyId: string,
): Promise<QuestionRow[]> {
  const userId = await requireUserId();
  const story = await assertStoryOwner(storyId, userId);

  const existing = await db
    .select()
    .from(questions)
    .where(and(eq(questions.storyId, storyId), eq(questions.status, "pending")))
    .orderBy(asc(questions.createdAt));
  if (existing.length > 0) return existing;

  const transcript = await buildTranscript(storyId);
  if (!transcript) return [];

  let generated: string[] = [];
  try {
    const out = await completeJson<{ questions?: string[] }>({
      system: INTERVIEWER_SYSTEM,
      prompt: interviewerPrompt(transcript, formatContext(story.context)),
    });
    generated = (out.questions ?? []).slice(0, 3).map((q) => q.trim()).filter(Boolean);
  } catch (err) {
    console.error("getOrGenerateQuestions: Claude call failed", err);
    return [];
  }

  if (generated.length === 0) return [];

  return db
    .insert(questions)
    .values(generated.map((text) => ({ storyId, text })))
    .returning();
}

/** "Ask me something else" — replace one question with a fresh, non-repeating one. */
export async function regenerateQuestion(
  questionId: string,
): Promise<QuestionRow | null> {
  const userId = await requireUserId();
  const { storyId } = await assertQuestionOwner(questionId, userId);
  const story = await assertStoryOwner(storyId, userId);

  const siblings = await db
    .select({ text: questions.text })
    .from(questions)
    .where(eq(questions.storyId, storyId));
  const transcript = await buildTranscript(storyId);

  try {
    const out = await completeJson<{ questions?: string[] }>({
      system: INTERVIEWER_SYSTEM,
      prompt: interviewerPrompt(
        transcript,
        formatContext(story.context),
        siblings.map((s) => s.text),
      ),
    });
    const next = (out.questions ?? [])[0]?.trim();
    if (!next) return null;
    const [updated] = await db
      .update(questions)
      .set({ text: next, status: "pending" })
      .where(eq(questions.id, questionId))
      .returning();
    return updated;
  } catch (err) {
    console.error("regenerateQuestion failed", err);
    return null;
  }
}

/** Skip a question — it won't be asked again. */
export async function skipQuestion(questionId: string): Promise<void> {
  const userId = await requireUserId();
  await assertQuestionOwner(questionId, userId);
  await db
    .update(questions)
    .set({ status: "skipped" })
    .where(eq(questions.id, questionId));
}

/** Answer a question by typing — saved as a follow-up segment. */
export async function answerQuestionText(
  questionId: string,
  text: string,
): Promise<void> {
  const userId = await requireUserId();
  const { storyId } = await assertQuestionOwner(questionId, userId);

  await db.insert(recordings).values({
    storyId,
    segmentIndex: await nextSegmentIndex(storyId),
    transcriptText: text.trim(),
    source: "followup",
    questionId,
  });

  await db
    .update(questions)
    .set({ status: "answered" })
    .where(eq(questions.id, questionId));

  await logEvent("question_answered", { storyId, ownerId: userId, meta: { mode: "typed" } });
}

/** Mark a question answered after a voice reply was uploaded + transcribed. */
export async function markQuestionAnswered(questionId: string): Promise<void> {
  const userId = await requireUserId();
  const { storyId } = await assertQuestionOwner(questionId, userId);
  await db
    .update(questions)
    .set({ status: "answered" })
    .where(eq(questions.id, questionId));

  await logEvent("question_answered", { storyId, ownerId: userId, meta: { mode: "voice" } });
}

/**
 * Extract suggested context (people/places/timeframe/occasion/tone) from the
 * transcript. NOT saved — the UI presents these as chips the user confirms.
 */
export async function extractContext(storyId: string): Promise<StoryContext> {
  const userId = await requireUserId();
  await assertStoryOwner(storyId, userId);

  const transcript = await buildTranscript(storyId);
  if (!transcript) return {};

  try {
    const raw = await completeJson<{
      people?: string[];
      places?: string[];
      timeframe?: string;
      occasion?: string;
      emotional_tone?: string;
      notable_objects?: string[];
    }>({
      system: CONTEXT_EXTRACTION_SYSTEM,
      prompt: contextExtractionPrompt(transcript),
    });
    return {
      people: raw.people ?? [],
      places: raw.places ?? [],
      timeframe: raw.timeframe || undefined,
      occasion: raw.occasion || undefined,
      emotionalTone: raw.emotional_tone || undefined,
      notableObjects: raw.notable_objects ?? [],
    };
  } catch (err) {
    console.error("extractContext failed", err);
    return {};
  }
}

/** Persist the context the user confirmed, mirroring key fields to columns. */
export async function saveContext(
  storyId: string,
  context: StoryContext,
): Promise<void> {
  const userId = await requireUserId();
  await assertStoryOwner(storyId, userId);

  await db
    .update(stories)
    .set({
      contextJson: context,
      occasion: context.occasion ?? null,
      storyDateText: context.timeframe ?? null,
      locationText: context.places?.[0] ?? null,
      updatedAt: new Date(),
    })
    .where(and(eq(stories.id, storyId), eq(stories.ownerId, userId)));
}

import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { stories } from "@/db/schema";
import { requireUserId } from "@/lib/auth";
import { extractContext, getOrGenerateQuestions } from "@/lib/actions/interview";
import { InterviewFlow } from "@/components/interview/InterviewFlow";

// The guided interviewer (spec §4 step 3–4, F4). Questions are generated once
// and persisted; context suggestions are extracted fresh until the user has
// confirmed a set. Both degrade gracefully to empty if the LLM is unavailable.
export default async function InterviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const userId = await requireUserId();

  const [story] = await db
    .select()
    .from(stories)
    .where(and(eq(stories.id, id), eq(stories.ownerId, userId)));
  if (!story) notFound();

  // Idempotent: returns existing pending questions or generates up to 3.
  const questionRows = await getOrGenerateQuestions(story.id);

  // Use the confirmed context if the user already saved one; otherwise suggest.
  const suggested = story.contextJson ?? (await extractContext(story.id));

  return (
    <InterviewFlow
      storyId={story.id}
      initialQuestions={questionRows.map((q) => ({ id: q.id, text: q.text }))}
      initialContext={suggested}
      alreadyConfirmed={Boolean(story.contextJson)}
    />
  );
}

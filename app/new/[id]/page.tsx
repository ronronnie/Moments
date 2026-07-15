import { and, asc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { recordings, stories } from "@/db/schema";
import { requireUserId } from "@/lib/auth";
import { CaptureFlow } from "@/components/capture/CaptureFlow";
import type { ClientSegment } from "@/components/capture/types";

// Recording screen (spec §4 step 2). Loads whatever has already been saved so a
// refresh or a returning visit restores every part and the title exactly.
export default async function CaptureStepPage({
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

  const rows = await db
    .select()
    .from(recordings)
    .where(eq(recordings.storyId, id))
    .orderBy(asc(recordings.segmentIndex));

  const initialSegments: ClientSegment[] = rows.map((r) => ({
    id: r.id,
    transcriptText: r.transcriptText ?? "",
    wordsJson: r.wordsJson ?? null,
    source: r.source,
    durationS: r.durationS ?? null,
    status: "ready",
    hasAudio: Boolean(r.audioPath),
  }));

  return (
    <CaptureFlow
      storyId={story.id}
      initialTitle={story.title ?? ""}
      initialSegments={initialSegments}
    />
  );
}

import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { stories } from "@/db/schema";
import { requireUserId } from "@/lib/auth";
import { getShareState } from "@/lib/actions/share";
import { listReactions } from "@/lib/reactions";
import { SharePanel } from "@/components/share/SharePanel";

// The owner's sharing hub (spec §4 step 8, F8): create/copy/turn-off the private
// link and read every response that comes back. Reached from the preview.
export default async function SharePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const userId = await requireUserId();

  const [story] = await db
    .select({ id: stories.id, title: stories.title })
    .from(stories)
    .where(and(eq(stories.id, id), eq(stories.ownerId, userId)));
  if (!story) notFound();

  const share = await getShareState(id);
  const rows = await listReactions(id, userId);

  return (
    <SharePanel
      storyId={id}
      title={story.title ?? "your story"}
      initialToken={share.token}
      viewCount={share.viewCount}
      reactions={rows.map((r) => ({
        id: r.id,
        kind: r.kind,
        body: r.body,
        audioUrl: r.audioPath,
        timestampOffsetS: r.timestampOffsetS,
        reactorName: r.reactorName,
        createdAt: r.createdAt.toISOString(),
      }))}
    />
  );
}

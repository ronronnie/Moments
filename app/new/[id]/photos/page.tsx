import { and, asc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { media, stories, storyVersions } from "@/db/schema";
import { requireUserId } from "@/lib/auth";
import { PhotosFlow } from "@/components/photos/PhotosFlow";

function label(text: string): string {
  const words = text.trim().split(/\s+/).slice(0, 6).join(" ");
  return words.length < text.trim().length ? `${words}…` : words;
}

// Media step (spec §4 step 5, F6). The story stays fully valid with zero photos.
export default async function PhotosPage({
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

  const [version] = await db
    .select()
    .from(storyVersions)
    .where(
      and(
        eq(storyVersions.storyId, id),
        eq(storyVersions.kind, story.selectedVersion ?? "exact"),
      ),
    );
  const sections = (version?.sectionsJson ?? []).map((s) => ({
    id: s.id,
    label: label(s.text) || "Untitled part",
  }));

  const rows = await db
    .select()
    .from(media)
    .where(eq(media.storyId, id))
    .orderBy(asc(media.position));

  return (
    <PhotosFlow
      storyId={story.id}
      sections={sections}
      initialMedia={rows.map((m) => ({
        id: m.id,
        url: m.storagePath,
        type: m.type,
        caption: m.caption ?? "",
        sectionId: m.sectionId,
      }))}
    />
  );
}

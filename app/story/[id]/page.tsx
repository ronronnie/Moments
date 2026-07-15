import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { stories, storyVersions } from "@/db/schema";
import { requireUserId } from "@/lib/auth";
import { generateVersions } from "@/lib/actions/story-version";
import { ReviewFlow } from "@/components/review/ReviewFlow";

// Story review (spec F5). Generates the exact + polished versions once, then
// lets the teller flip between them, edit any line, and choose one.
export default async function StoryPage({
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

  // Idempotent — generates on first visit, returns existing after.
  await generateVersions(story.id);

  const versions = await db
    .select()
    .from(storyVersions)
    .where(eq(storyVersions.storyId, story.id));
  const exact = versions.find((v) => v.kind === "exact") ?? null;
  const polished = versions.find((v) => v.kind === "polished") ?? null;

  if (!exact) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-4 px-6 py-16 text-center">
        <h1 className="font-serif text-2xl font-medium tracking-tight">
          Nothing to shape yet
        </h1>
        <p className="font-sans text-ink-soft">
          Record or type a little of your story first, then come back.
        </p>
      </main>
    );
  }

  return (
    <ReviewFlow
      storyId={story.id}
      selected={story.selectedVersion ?? "exact"}
      exact={{
        id: exact.id,
        title: exact.title ?? "",
        pullQuote: exact.pullQuote ?? "",
        sections: exact.sectionsJson ?? [],
      }}
      polished={
        polished
          ? {
              id: polished.id,
              title: polished.title ?? "",
              pullQuote: polished.pullQuote ?? "",
              sections: polished.sectionsJson ?? [],
            }
          : null
      }
    />
  );
}

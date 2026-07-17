import { UserButton } from "@clerk/nextjs";
import { count, desc, eq, inArray, sql } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db";
import { reactions, shareLinks, stories } from "@/db/schema";
import { ensureProfile } from "@/lib/auth";
import { Button } from "@/components/ui";
import { StoryCard } from "@/components/stories/StoryCard";

// My stories (/stories) — a warm shelf of keepsakes (spec Prompt 8), each with
// its shared/draft state and view + response counts. Deliberately not a
// calendar, timeline, or streak — a bookshelf, not a dashboard.
export default async function StoriesPage() {
  const userId = await ensureProfile();

  const myStories = await db
    .select()
    .from(stories)
    .where(eq(stories.ownerId, userId))
    .orderBy(desc(stories.updatedAt));

  const ids = myStories.map((s) => s.id);

  // Views (summed across a story's links) and response counts, in two grouped
  // queries then merged — cheap for a personal shelf.
  const [viewRows, reactionRows] = ids.length
    ? await Promise.all([
        db
          .select({
            storyId: shareLinks.storyId,
            views: sql<number>`coalesce(sum(${shareLinks.viewCount}), 0)::int`,
          })
          .from(shareLinks)
          .where(inArray(shareLinks.storyId, ids))
          .groupBy(shareLinks.storyId),
        db
          .select({ storyId: reactions.storyId, responses: count() })
          .from(reactions)
          .where(inArray(reactions.storyId, ids))
          .groupBy(reactions.storyId),
      ])
    : [[], []];

  const views = new Map(viewRows.map((r) => [r.storyId, r.views]));
  const responses = new Map(reactionRows.map((r) => [r.storyId, Number(r.responses)]));

  return (
    <main className="mx-auto w-full max-w-md px-6 py-10">
      <header className="mb-8 flex items-center justify-between">
        <h1 className="font-serif text-2xl font-medium tracking-tight">
          Your stories
        </h1>
        <UserButton />
      </header>

      {myStories.length === 0 ? (
        <div className="mt-16 text-center">
          <p className="font-serif text-xl text-ink">
            The moments you keep will live here.
          </p>
          <p className="mt-2 font-sans text-sm text-ink-soft">
            Nothing yet — start with the one you can’t forget.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {myStories.map((s) => (
            <StoryCard
              key={s.id}
              id={s.id}
              title={s.title}
              status={s.status}
              dateText={s.storyDateText}
              views={views.get(s.id) ?? 0}
              responses={responses.get(s.id) ?? 0}
            />
          ))}
        </ul>
      )}

      <div className="mt-10">
        <Link href="/new">
          <Button>Tell a story</Button>
        </Link>
      </div>
    </main>
  );
}

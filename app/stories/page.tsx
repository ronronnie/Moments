import { UserButton } from "@clerk/nextjs";
import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db";
import { stories } from "@/db/schema";
import { ensureProfile } from "@/lib/auth";
import { Button } from "@/components/ui";

// My stories (/stories) — the post-sign-in landing. Prompt 8 turns this into a
// warm shelf of keepsake cards; for now it lists real rows so downstream phases
// have something to build against.
export default async function StoriesPage() {
  const userId = await ensureProfile();

  const myStories = await db
    .select()
    .from(stories)
    .where(eq(stories.ownerId, userId))
    .orderBy(desc(stories.updatedAt));

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
            <li key={s.id}>
              <Link
                href={`/story/${s.id}`}
                className="block rounded-card border border-hairline bg-paper-raised p-6 shadow-soft transition-colors duration-300 ease-keepsake hover:border-ink-soft"
              >
                <p className="font-serif text-xl text-ink">
                  {s.title ?? "Untitled story"}
                </p>
                <p className="mt-1 font-sans text-xs uppercase tracking-[0.12em] text-ink-soft">
                  {s.status}
                  {s.storyDateText ? ` · ${s.storyDateText}` : ""}
                </p>
              </Link>
            </li>
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

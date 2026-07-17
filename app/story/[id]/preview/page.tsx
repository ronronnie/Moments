import Link from "next/link";
import { requireUserId } from "@/lib/auth";
import { getExperienceForOwner } from "@/lib/experience";
import { listReactionPins } from "@/lib/reactions";
import { ExperiencePlayer } from "@/components/experience/ExperiencePlayer";

// The owner's preview of the experience (spec §4 step 7, F7): the story played
// exactly as a recipient will see it, plus owner-only chrome (a music picker and
// a way back to editing). Sharing itself is Prompt 7.
export default async function PreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const userId = await requireUserId();

  // Returns null both when the story isn't the user's and when there's nothing
  // to play yet. Either way we show the same gentle, no-leak fallback.
  const data = await getExperienceForOwner(id, userId);
  if (!data) return <NothingToPlay storyId={id} />;

  const pins = await listReactionPins(id, userId);

  return <ExperiencePlayer data={data} mode="owner" pins={pins} />;
}

function NothingToPlay({ storyId }: { storyId: string }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <h1 className="font-serif text-2xl font-medium tracking-tight">
        Not ready to play yet
      </h1>
      <p className="font-sans text-ink-soft">
        Tell a little of your story and shape it first, then come back to watch it.
      </p>
      <Link
        href={`/story/${storyId}`}
        className="font-sans text-sm text-accent-strong underline-offset-4 hover:underline"
      >
        Back to your story
      </Link>
    </main>
  );
}

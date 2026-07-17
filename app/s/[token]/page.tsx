import { getExperienceByToken } from "@/lib/experience";
import { recordShareView } from "@/lib/reactions";
import { ExperiencePlayer } from "@/components/experience/ExperiencePlayer";

// Recipient view (/s/[token]) — no account, no signup wall (spec F8). Access is
// authorized only by a valid, un-revoked share token, resolved server-side
// (standing rule 3). Renders the same experience player as the owner preview,
// with the reaction loop enabled. Counts the view and emails the owner on the
// first open (best-effort, inside recordShareView).
export default async function SharedStoryPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const data = await getExperienceByToken(token);

  if (!data) return <Unavailable />;

  await recordShareView(token);

  return <ExperiencePlayer data={data} mode="recipient" token={token} />;
}

function Unavailable() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <h1 className="font-serif text-2xl font-medium tracking-tight">
        This story is no longer available
      </h1>
      <p className="font-sans text-ink-soft">
        The link may have been turned off, or it isn’t quite ready yet.
      </p>
    </main>
  );
}

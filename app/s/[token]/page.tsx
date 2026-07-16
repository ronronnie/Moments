import { getExperienceByToken } from "@/lib/experience";
import { ExperiencePlayer } from "@/components/experience/ExperiencePlayer";

// Recipient view (/s/[token]) — no account, no signup wall (spec F8). Access is
// authorized only by a valid, un-revoked share token, resolved server-side
// (standing rule 3). This renders the same experience player as the owner
// preview. Reactions, view counting, and owner notifications arrive in Prompt 7.
export default async function SharedStoryPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const data = await getExperienceByToken(token);

  if (!data) return <Unavailable />;

  return <ExperiencePlayer data={data} mode="recipient" />;
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

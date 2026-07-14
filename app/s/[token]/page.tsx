// Recipient view (/s/[token]). Placeholder — Prompt 7 makes this server-validate
// the share token and serve the experience page with NO account or signup wall.
// Access must go through a server route that validates the token (standing rule 3).
export default async function SharedStoryPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <h1 className="text-2xl font-medium tracking-tight">A story for you</h1>
      <p className="text-foreground/70">
        This shared story will play here soon.
      </p>
      <p className="text-sm text-foreground/50">Share token: {token}</p>
    </main>
  );
}

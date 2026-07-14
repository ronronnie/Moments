// Story edit/preview (/story/[id]). Placeholder — Prompt 4 builds structuring &
// review here; Prompt 6 adds the /story/[id]/preview experience player.
export default async function StoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-4 px-6 py-16">
      <h1 className="text-2xl font-medium tracking-tight">Your story</h1>
      <p className="text-foreground/70">Editing and preview arrive later.</p>
      <p className="text-sm text-foreground/50">Story id: {id}</p>
    </main>
  );
}

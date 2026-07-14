// My stories (/stories). Placeholder — Prompt 8 renders this as a warm shelf of
// keepsake cards (title, date, shared/draft state, view + reaction counts).
export default function StoriesPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-4 px-6 py-16">
      <h1 className="text-2xl font-medium tracking-tight">Your stories</h1>
      <p className="text-foreground/70">
        The moments you have kept will live here.
      </p>
    </main>
  );
}

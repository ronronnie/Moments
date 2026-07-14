// Create flow (/new). Placeholder — Prompt 2 builds title + voice capture here,
// Prompt 3 the guided interviewer, Prompt 5 photos.
export default function NewStoryPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-4 px-6 py-16">
      <h1 className="text-2xl font-medium tracking-tight">Tell a story</h1>
      <p className="text-foreground/70">
        What is the moment you want to remember?
      </p>
      <p className="text-sm text-foreground/50">
        Capture and the guided interviewer arrive in a later phase.
      </p>
    </main>
  );
}

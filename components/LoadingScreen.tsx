/**
 * A calm, warm waiting screen for the moments the app is thinking (transcription,
 * structuring, questions — each takes a few seconds). Copy speaks of listening
 * and shaping, never "processing." A single breathing mark, nothing spinny.
 */
export function LoadingScreen({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-5 px-6 text-center">
      <span
        aria-hidden
        className="size-3 rounded-full bg-accent motion-safe:animate-breathe"
      />
      <p className="font-serif text-xl text-ink" role="status" aria-live="polite">
        {title}
      </p>
      {subtitle && <p className="font-sans text-sm text-ink-soft">{subtitle}</p>}
    </main>
  );
}

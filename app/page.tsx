import Link from "next/link";

// Landing (/). Placeholder — Prompt 8 leads this with an embedded sample story
// experience and a single "Tell a story" call to action.
export default function LandingPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-8 px-6 py-16 text-center">
      <div className="space-y-3">
        <h1 className="text-4xl font-medium tracking-tight">Moments</h1>
        <p className="text-lg text-foreground/70">
          Tell a story someone else can experience.
        </p>
      </div>
      <Link
        href="/new"
        className="w-full rounded-2xl bg-foreground px-6 py-4 text-base font-medium text-background"
      >
        Tell a story
      </Link>
      <Link href="/stories" className="text-sm text-foreground/60 underline">
        View your stories
      </Link>
    </main>
  );
}

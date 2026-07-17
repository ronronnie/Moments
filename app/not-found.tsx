import Link from "next/link";

// A page (or story) that isn't here. Kept quiet and kind.
export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-5 px-6 text-center">
      <h1 className="font-serif text-2xl font-medium tracking-tight text-ink">
        We couldn’t find that
      </h1>
      <p className="font-sans text-sm text-ink-soft">
        The page may have moved, or the story is no longer here.
      </p>
      <Link
        href="/stories"
        className="font-sans text-sm text-accent-strong underline-offset-4 hover:underline"
      >
        Back to your stories
      </Link>
    </main>
  );
}

"use client";

// Global error boundary. Warm and plain — never a stack trace or "something went
// wrong" shout. Offers a gentle retry; the teller's words are always saved.
export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-5 px-6 text-center">
      <h1 className="font-serif text-2xl font-medium tracking-tight text-ink">
        Something interrupted us
      </h1>
      <p className="font-sans text-sm text-ink-soft">
        Your story is safe. Let’s try that again.
      </p>
      <button
        type="button"
        onClick={reset}
        className="inline-flex min-h-[48px] items-center rounded-button bg-accent-strong px-7 font-sans text-base font-medium text-paper shadow-soft transition-colors duration-300 ease-keepsake hover:bg-accent active:bg-accent-press"
      >
        Try again
      </button>
    </main>
  );
}

import { TitleForm } from "@/components/capture/TitleForm";

// Create flow — step 1 (spec §4, creator step 1). "What is the moment you want
// to remember?" Recording happens next, at /new/[id].
export default function NewStoryPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-8 px-6 py-16">
      <div className="space-y-3">
        <h1 className="font-serif text-3xl font-medium leading-tight tracking-tight">
          What is the moment you want to remember?
        </h1>
        <p className="font-sans text-ink-soft">
          Give it a working title to begin.
        </p>
      </div>
      <TitleForm />
    </main>
  );
}

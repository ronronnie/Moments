import { SignUp } from "@clerk/nextjs";

// The recipient growth loop lands here ("Have a story of your own to tell?").
export default function SignUpPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-8 px-6 py-16">
      <div className="text-center">
        <h1 className="font-serif text-3xl font-medium tracking-tight">
          Tell a story of your own
        </h1>
        <p className="mt-2 font-sans text-ink-soft">
          Keep a moment, and let someone else experience it.
        </p>
      </div>
      <SignUp />
    </main>
  );
}

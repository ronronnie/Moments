import { SignIn } from "@clerk/nextjs";

// Minimal sign-in. Magic-link ("email verification link") is configured as the
// method in the Clerk dashboard. After sign-in Clerk redirects to /stories
// (NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL).
export default function SignInPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-8 px-6 py-16">
      <div className="text-center">
        <h1 className="font-serif text-3xl font-medium tracking-tight">
          Welcome back
        </h1>
        <p className="mt-2 font-sans text-ink-soft">
          Sign in to keep telling your stories.
        </p>
      </div>
      <SignIn />
    </main>
  );
}

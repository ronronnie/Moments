import Link from "next/link";
import { SAMPLE_STORY } from "@/lib/sample-story";
import { ExperiencePlayer } from "@/components/experience/ExperiencePlayer";

// Landing (/). Leads with a finished story experience — never with "record your
// memories" (spec §12) — then a single call to action. No feature grid.
export default function LandingPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-9 px-6 py-14 text-center">
      <div className="space-y-4">
        <p className="small-caps text-ink-soft">Moments</p>
        <h1 className="text-balance font-serif text-[clamp(1.75rem,7vw,2.5rem)] font-medium leading-tight tracking-tight text-ink">
          Turn a moment you remember into a story someone else can experience.
        </h1>
      </div>

      {/* The sample, framed like a phone playing a keepsake. */}
      <div className="aspect-[9/17] w-full max-w-[300px] overflow-hidden rounded-[28px] border border-hairline shadow-soft">
        <ExperiencePlayer data={SAMPLE_STORY} mode="recipient" embedded />
      </div>

      <div className="w-full space-y-4">
        <Link
          href="/new"
          className="inline-flex min-h-[52px] w-full items-center justify-center rounded-button bg-accent-strong px-6 font-sans text-base font-medium text-paper shadow-soft transition-colors duration-300 ease-keepsake hover:bg-accent active:bg-accent-press"
        >
          Tell a story
        </Link>
        <Link
          href="/stories"
          className="inline-block font-sans text-sm text-ink-soft underline-offset-4 hover:text-ink hover:underline"
        >
          I already have one
        </Link>
      </div>
    </main>
  );
}

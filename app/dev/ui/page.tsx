"use client";

import { useState } from "react";
import {
  Button,
  Card,
  Chip,
  Input,
  ProgressBar,
  RecordButton,
  Textarea,
  TextLink,
  Toast,
} from "@/components/ui";

/**
 * /dev/ui — design system review surface. Every primitive rendered in its
 * states so we can inspect the whole kit in isolation before any feature uses
 * it. Not linked from the product; a workbench, not a page.
 */
export default function DevUiPage() {
  const [recording, setRecording] = useState(false);
  const [progress, setProgress] = useState(38);
  const [confirmed, setConfirmed] = useState<Record<string, boolean>>({
    grandmother: true,
    lisbon: false,
    "summer 1998": false,
  });
  const [chips, setChips] = useState(["a green door", "the harbour"]);
  const [toasts, setToasts] = useState([
    { id: 1, variant: "neutral" as const, text: "Your story is saved." },
    { id: 2, variant: "success" as const, text: "Shared privately with Mum." },
    { id: 3, variant: "error" as const, text: "That upload didn’t finish. We kept your place." },
  ]);

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-16">
      <header className="mb-14">
        <p className="font-sans text-xs uppercase tracking-[0.18em] text-ink-soft">
          Moments · design system
        </p>
        <h1 className="mt-2 font-serif text-4xl font-semibold tracking-tight">
          The component kit
        </h1>
        <p className="mt-3 max-w-[60ch] font-sans text-ink-soft">
          Paper &amp; ink, quiet cinema. Every primitive and state, in isolation,
          before a single feature depends on it.
        </p>
      </header>

      {/* -------------------------------------------------- Color */}
      <Section title="Color — paper &amp; ink">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Swatch name="paper" hex="#FAF7F2" className="bg-paper" ring />
          <Swatch name="paper-raised" hex="#FEFCF8" className="bg-paper-raised" ring />
          <Swatch name="ink" hex="#211D18" className="bg-ink" text="text-paper" />
          <Swatch name="ink-soft" hex="#6B645A" className="bg-ink-soft" text="text-paper" />
          <Swatch name="hairline" hex="#E8E1D6" className="bg-hairline" ring />
          <Swatch name="accent" hex="#C4643B" className="bg-accent" text="text-paper" />
          <Swatch name="success" hex="#5E6B4A" className="bg-success" text="text-paper" />
          <Swatch name="error" hex="#A34531" className="bg-error" text="text-paper" />
        </div>
      </Section>

      {/* -------------------------------------------------- Typography */}
      <Section title="Typography — two faces">
        <div className="space-y-6">
          <div>
            <Label>Fraunces · story &amp; display (400–600)</Label>
            <h2 className="mt-2 font-serif text-4xl font-semibold tracking-tight">
              The day my daughter was born
            </h2>
            <p className="mt-3 max-w-[60ch] font-serif text-xl leading-relaxed">
              It was raining the whole drive to the hospital, and your mother
              kept laughing at how slowly I was taking the corners.
            </p>
          </div>
          <div>
            <Label>Inter · UI chrome only</Label>
            <p className="mt-2 font-sans text-base">
              Labels, buttons, and meta text — never story content.
            </p>
          </div>
        </div>
      </Section>

      {/* -------------------------------------------------- Buttons */}
      <Section title="Button — the one warm action">
        <div className="grid gap-4 sm:grid-cols-2">
          <StateCell label="primary · default">
            <Button>Tell a story</Button>
          </StateCell>
          <StateCell label="primary · loading">
            <Button loading>Listening to your story</Button>
          </StateCell>
          <StateCell label="primary · disabled">
            <Button disabled>Tell a story</Button>
          </StateCell>
          <StateCell label="quiet · default">
            <Button variant="quiet">Add more</Button>
          </StateCell>
        </div>
        <p className="mt-3 font-sans text-xs text-ink-soft">
          Hover and active states are live — point at the default button.
        </p>
      </Section>

      {/* -------------------------------------------------- TextLink */}
      <Section title="TextLink — quiet secondary actions">
        <div className="flex flex-wrap items-center gap-6">
          <TextLink href="#">Type it instead</TextLink>
          <TextLink href="#" muted={false}>
            Keep my exact words
          </TextLink>
        </div>
      </Section>

      {/* -------------------------------------------------- Card */}
      <Section title="Card">
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <h3 className="font-serif text-xl font-medium">Keep my exact words</h3>
            <p className="mt-2 font-sans text-sm text-ink-soft">
              Your story, verbatim — just the pauses tidied.
            </p>
          </Card>
          <Card raised={false}>
            <h3 className="font-serif text-xl font-medium">Polish into a story</h3>
            <p className="mt-2 font-sans text-sm text-ink-soft">
              Refined for flow — your meaning, your voice.
            </p>
          </Card>
        </div>
      </Section>

      {/* -------------------------------------------------- Input */}
      <Section title="Input">
        <div className="grid gap-5 sm:grid-cols-2">
          <Input
            label="What is the moment you want to remember?"
            placeholder="The day my daughter was born"
            serif
            hint="This becomes your working title."
          />
          <Input
            label="Your name"
            placeholder="Ronold"
            defaultValue="Ronold"
          />
          <Input
            label="Email"
            type="email"
            defaultValue="not-an-email"
            error="That doesn’t look like an email address."
          />
          <Input label="Disabled" placeholder="Unavailable" disabled />
        </div>
      </Section>

      {/* -------------------------------------------------- Textarea */}
      <Section title="Textarea">
        <div className="space-y-5">
          <Textarea
            serif
            label="Your story"
            rows={4}
            defaultValue="We almost missed the ferry. I remember your grandmother standing at the rail, holding her hat against the wind."
          />
          <Textarea
            label="A note to include (UI chrome)"
            rows={3}
            placeholder="Optional"
          />
        </div>
      </Section>

      {/* -------------------------------------------------- RecordButton */}
      <Section title="RecordButton — it should feel alive">
        <div className="flex flex-wrap items-end gap-10">
          <StateCell label={recording ? "recording · ripple" : "idle · breathing"}>
            <RecordButton
              recording={recording}
              onClick={() => setRecording((r) => !r)}
            />
          </StateCell>
          <StateCell label="disabled">
            <RecordButton disabled />
          </StateCell>
        </div>
        <p className="mt-3 font-sans text-xs text-ink-soft">
          Tap the first button to toggle between the resting breath and the
          recording ripple.
        </p>
      </Section>

      {/* -------------------------------------------------- ProgressBar */}
      <Section title="ProgressBar">
        <div className="space-y-6">
          <div>
            <Label>Determinate · playback / upload</Label>
            <div className="mt-3">
              <ProgressBar value={progress} />
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={progress}
              onChange={(e) => setProgress(Number(e.target.value))}
              className="mt-3 w-full accent-[#C4643B]"
              aria-label="Demo progress value"
            />
          </div>
          <div>
            <Label>Indeterminate · “Listening to your story…”</Label>
            <div className="mt-3">
              <ProgressBar indeterminate />
            </div>
          </div>
        </div>
      </Section>

      {/* -------------------------------------------------- Chip */}
      <Section title="Chip — context is a suggestion, never a fact">
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {Object.entries(confirmed).map(([key, isOn]) => (
              <Chip
                key={key}
                selected={isOn}
                onClick={() =>
                  setConfirmed((c) => ({ ...c, [key]: !c[key] }))
                }
              >
                {key}
              </Chip>
            ))}
          </div>
          <p className="font-sans text-xs text-ink-soft">
            Tap to confirm or unconfirm. Removable chips:
          </p>
          <div className="flex flex-wrap gap-2">
            {chips.map((c) => (
              <Chip
                key={c}
                selected
                onRemove={() => setChips((prev) => prev.filter((x) => x !== c))}
              >
                {c}
              </Chip>
            ))}
            {chips.length === 0 && (
              <span className="font-sans text-sm text-ink-faint">
                All removed — refresh to reset.
              </span>
            )}
          </div>
        </div>
      </Section>

      {/* -------------------------------------------------- Toast */}
      <Section title="Toast">
        <div className="max-w-md space-y-3">
          {toasts.map((t) => (
            <Toast
              key={t.id}
              variant={t.variant}
              onDismiss={() =>
                setToasts((prev) => prev.filter((x) => x.id !== t.id))
              }
            >
              {t.text}
            </Toast>
          ))}
          {toasts.length === 0 && (
            <span className="font-sans text-sm text-ink-faint">
              Dismissed — refresh to reset.
            </span>
          )}
        </div>
      </Section>

      {/* -------------------------------------------------- Cinema preview */}
      <Section title="Quiet cinema — playback surface">
        <div className="overflow-hidden rounded-card border border-hairline">
          <div className="flex min-h-64 flex-col justify-end gap-3 bg-cinema p-8">
            <p className="font-serif text-cinema-dim">
              I remember the smell of the rain on the pavement,
            </p>
            <p
              className="font-serif leading-snug text-cinema-text"
              style={{ fontSize: "var(--text-story)" }}
            >
              and how quiet the whole street went, just for a moment.
            </p>
            <p className="font-serif text-cinema-dim">
              Then somewhere a door opened, and the noise came back.
            </p>
            <div className="mt-4">
              <ProgressBar value={54} aria-label="Story progress" />
            </div>
          </div>
        </div>
        <p className="mt-3 font-sans text-xs text-ink-soft">
          The current phrase at full warmth; neighbors dimmed to ~40%. When play
          begins, all chrome fades — the story owns the screen.
        </p>
      </Section>
    </main>
  );
}

/* ---- Small review-page-only helpers ---- */

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-14 border-t border-hairline pt-8">
      <h2
        className="mb-6 font-sans text-sm font-medium uppercase tracking-[0.14em] text-ink-soft"
        dangerouslySetInnerHTML={{ __html: title }}
      />
      {children}
    </section>
  );
}

function StateCell({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      <span className="font-sans text-xs text-ink-soft">{label}</span>
      <div className="flex items-center">{children}</div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-sans text-xs uppercase tracking-[0.14em] text-ink-faint">
      {children}
    </span>
  );
}

function Swatch({
  name,
  hex,
  className,
  text = "text-ink",
  ring = false,
}: {
  name: string;
  hex: string;
  className: string;
  text?: string;
  ring?: boolean;
}) {
  return (
    <div
      className={`${className} ${text} ${ring ? "ring-1 ring-inset ring-hairline" : ""} flex h-20 flex-col justify-end rounded-card p-3`}
    >
      <span className="font-sans text-xs font-medium">{name}</span>
      <span className="font-sans text-[10px] opacity-70">{hex}</span>
    </div>
  );
}

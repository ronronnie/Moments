"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { Button, Toast } from "@/components/ui";
import { cn } from "@/lib/cn";
import type { Section } from "@/db/schema";
import {
  selectVersion,
  updateSectionText,
  updateVersionTitle,
} from "@/lib/actions/story-version";

type VersionView = {
  id: string;
  title: string;
  pullQuote: string;
  sections: Section[];
};
type Kind = "exact" | "polished";
type ToastState = { variant: "success" | "error" | "neutral"; text: string };

function snippet(sections: Section[], max = 120): string {
  const text = sections.map((s) => s.text).join(" ").trim();
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
}

function ChoiceCard({
  title,
  preview,
  selected,
  disabled,
  onClick,
}: {
  title: string;
  preview: string;
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      className={cn(
        "w-full rounded-card border p-5 text-left transition-all duration-300 ease-keepsake",
        "disabled:cursor-not-allowed disabled:opacity-45",
        selected
          ? "border-accent bg-accent/5 shadow-soft"
          : "border-hairline bg-paper-raised hover:border-ink-soft",
      )}
    >
      <p className="font-sans text-sm font-medium text-ink">{title}</p>
      <p className="mt-2 line-clamp-2 font-serif text-base leading-snug text-ink-soft">
        {preview || "…"}
      </p>
    </button>
  );
}

/**
 * The review step (spec F5). Flip between the teller's exact words and a
 * polished rewrite, edit any line, and the choice persists. Polished text is a
 * rewrite the user approves — never new facts.
 */
export function ReviewFlow({
  storyId,
  selected,
  exact,
  polished,
}: {
  storyId: string;
  selected: Kind;
  exact: VersionView;
  polished: VersionView | null;
}) {
  const router = useRouter();
  const [kind, setKind] = useState<Kind>(
    selected === "polished" && polished ? "polished" : "exact",
  );
  const [exactState, setExactState] = useState(exact);
  const [polishedState, setPolishedState] = useState(polished);
  const [continuing, setContinuing] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  const current = kind === "polished" && polishedState ? polishedState : exactState;
  const setCurrent =
    kind === "polished" && polishedState
      ? (setPolishedState as (v: VersionView) => void)
      : (setExactState as (v: VersionView) => void);

  const choose = useCallback(
    async (next: Kind) => {
      if (next === "polished" && !polishedState) return;
      setKind(next);
      try {
        await selectVersion(storyId, next);
      } catch (err) {
        console.error(err);
        setToast({ variant: "error", text: "Couldn’t save your choice." });
      }
    },
    [storyId, polishedState],
  );

  const saveTitle = useCallback(
    async (value: string) => {
      if (value === current.title) return;
      setCurrent({ ...current, title: value });
      try {
        await updateVersionTitle(current.id, value);
      } catch (err) {
        console.error(err);
      }
    },
    [current, setCurrent],
  );

  const saveSection = useCallback(
    async (sectionId: string, value: string) => {
      const existing = current.sections.find((s) => s.id === sectionId);
      if (!existing || existing.text === value) return;
      setCurrent({
        ...current,
        sections: current.sections.map((s) =>
          s.id === sectionId ? { ...s, text: value } : s,
        ),
      });
      try {
        await updateSectionText(current.id, sectionId, value);
      } catch (err) {
        console.error(err);
        setToast({ variant: "error", text: "That edit didn’t save." });
      }
    },
    [current, setCurrent],
  );

  const exactPreview = useMemo(() => snippet(exactState.sections), [exactState]);
  const polishedPreview = useMemo(
    () => (polishedState ? snippet(polishedState.sections) : ""),
    [polishedState],
  );

  return (
    <main className="mx-auto w-full max-w-md px-6 py-10">
      <header className="mb-8">
        <h1 className="font-serif text-2xl font-medium tracking-tight">
          How should it read?
        </h1>
        <p className="mt-2 font-sans text-sm text-ink-soft">
          Your words as you told them, or gently shaped into a story.
        </p>
      </header>

      {/* ---- Two choices ---- */}
      <div className="space-y-3">
        <ChoiceCard
          title="Keep my exact words"
          preview={exactPreview}
          selected={kind === "exact"}
          onClick={() => choose("exact")}
        />
        <ChoiceCard
          title="Polish into a story"
          preview={
            polishedState
              ? polishedPreview
              : "Not available for this story yet."
          }
          selected={kind === "polished"}
          disabled={!polishedState}
          onClick={() => choose("polished")}
        />
      </div>

      {kind === "polished" && (
        <p className="mt-4 font-sans text-sm italic text-ink-soft">
          Refined for flow — your meaning, your voice.
        </p>
      )}

      {/* ---- Editable version ---- */}
      <section className="mt-10 space-y-6">
        <input
          key={`title-${current.id}`}
          defaultValue={current.title}
          onBlur={(e) => saveTitle(e.target.value)}
          placeholder="Untitled story"
          aria-label="Story title"
          className="w-full bg-transparent font-serif text-3xl font-medium leading-tight tracking-tight text-ink placeholder:text-ink-faint focus:outline-none"
        />

        {current.sections.map((s, i) => (
          <textarea
            key={`${current.id}-${s.id}`}
            defaultValue={s.text}
            onBlur={(e) => saveSection(s.id, e.target.value)}
            rows={Math.max(3, Math.ceil((s.text.length || 1) / 44))}
            aria-label={`Section ${i + 1}`}
            className="w-full resize-none rounded-md border border-transparent bg-transparent font-serif text-xl leading-relaxed text-ink focus:outline-none focus-visible:border-hairline"
          />
        ))}
      </section>

      {/* ---- Continue ---- */}
      <div className="mt-12 border-t border-hairline pt-8">
        <Button
          loading={continuing}
          onClick={() => {
            setContinuing(true);
            router.push(`/new/${storyId}/photos`);
          }}
        >
          Continue
        </Button>
        <p className="mt-3 text-center font-sans text-sm text-ink-soft">
          Next: add photos to your story.
        </p>
      </div>

      {toast && (
        <div className="fixed inset-x-0 bottom-6 mx-auto max-w-md px-6">
          <Toast variant={toast.variant} onDismiss={() => setToast(null)}>
            {toast.text}
          </Toast>
        </div>
      )}
    </main>
  );
}

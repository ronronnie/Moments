"use client";

import { useMemo, useState } from "react";
import { Chip } from "@/components/ui";
import type { StoryContext } from "@/db/schema";

type Group = "people" | "places" | "notableObjects" | "single";
type ChipItem = {
  key: string;
  group: Group;
  field?: "timeframe" | "occasion" | "emotionalTone";
  label: string;
  display: string;
  selected: boolean;
};

const GROUP_LABEL: Record<string, string> = {
  people: "Who was there",
  places: "Where",
  when: "When",
  occasion: "The occasion",
  tone: "The feeling",
  notableObjects: "Things that mattered",
};

function buildChips(ctx: StoryContext, selected: boolean): ChipItem[] {
  const chips: ChipItem[] = [];
  (ctx.people ?? []).forEach((p, i) =>
    chips.push({ key: `people-${i}`, group: "people", label: p, display: p, selected }),
  );
  (ctx.places ?? []).forEach((p, i) =>
    chips.push({ key: `places-${i}`, group: "places", label: p, display: p, selected }),
  );
  if (ctx.timeframe)
    chips.push({ key: "when", group: "single", field: "timeframe", label: ctx.timeframe, display: ctx.timeframe, selected });
  if (ctx.occasion)
    chips.push({ key: "occasion", group: "single", field: "occasion", label: ctx.occasion, display: ctx.occasion, selected });
  if (ctx.emotionalTone)
    chips.push({ key: "tone", group: "single", field: "emotionalTone", label: ctx.emotionalTone, display: ctx.emotionalTone, selected });
  (ctx.notableObjects ?? []).forEach((o, i) =>
    chips.push({ key: `object-${i}`, group: "notableObjects", label: o, display: o, selected }),
  );
  return chips;
}

function toContext(chips: ChipItem[]): StoryContext {
  const on = chips.filter((c) => c.selected);
  const ctx: StoryContext = {
    people: on.filter((c) => c.group === "people").map((c) => c.label),
    places: on.filter((c) => c.group === "places").map((c) => c.label),
    notableObjects: on.filter((c) => c.group === "notableObjects").map((c) => c.label),
  };
  for (const c of on) {
    if (c.group === "single" && c.field) ctx[c.field] = c.label;
  }
  return ctx;
}

/**
 * Extracted context shown as suggestion chips. Nothing is treated as fact:
 * chips start unconfirmed (unless the user already saved a set) and only the
 * ones they confirm are kept. Calls onChange with the confirmed context.
 */
export function ContextChips({
  initial,
  defaultSelected,
  onChange,
}: {
  initial: StoryContext;
  defaultSelected: boolean;
  onChange: (ctx: StoryContext) => void;
}) {
  const [chips, setChips] = useState<ChipItem[]>(() =>
    buildChips(initial, defaultSelected),
  );

  const groups = useMemo(
    () => ({
      people: chips.filter((c) => c.group === "people"),
      places: chips.filter((c) => c.group === "places"),
      when: chips.filter((c) => c.field === "timeframe"),
      occasion: chips.filter((c) => c.field === "occasion"),
      tone: chips.filter((c) => c.field === "emotionalTone"),
      notableObjects: chips.filter((c) => c.group === "notableObjects"),
    }),
    [chips],
  );

  function toggle(key: string) {
    setChips((prev) => {
      const next = prev.map((c) =>
        c.key === key ? { ...c, selected: !c.selected } : c,
      );
      onChange(toContext(next));
      return next;
    });
  }

  function remove(key: string) {
    setChips((prev) => {
      const next = prev.filter((c) => c.key !== key);
      onChange(toContext(next));
      return next;
    });
  }

  if (chips.length === 0) {
    return (
      <p className="font-sans text-sm text-ink-soft">
        No details to confirm yet.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      {Object.entries(groups).map(([g, items]) =>
        items.length === 0 ? null : (
          <div key={g}>
            <p className="mb-2 font-sans text-xs uppercase tracking-[0.12em] text-ink-faint">
              {GROUP_LABEL[g]}
            </p>
            <div className="flex flex-wrap gap-2">
              {items.map((c) => (
                <Chip
                  key={c.key}
                  selected={c.selected}
                  onClick={() => toggle(c.key)}
                  onRemove={() => remove(c.key)}
                >
                  {c.display}
                </Chip>
              ))}
            </div>
          </div>
        ),
      )}
      <p className="font-sans text-xs text-ink-soft">
        Tap to confirm what’s right. Remove anything that isn’t.
      </p>
    </div>
  );
}

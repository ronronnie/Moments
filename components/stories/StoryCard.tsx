"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { deleteStory } from "@/lib/actions/stories";

type Status = "draft" | "ready" | "shared";

const STATUS_LABEL: Record<Status, string> = {
  draft: "Draft",
  ready: "Ready to share",
  shared: "Shared",
};

/**
 * One keepsake on the shelf. Tapping opens the story; a quiet menu holds the
 * one destructive action, gated behind an inline confirm (no blocking dialog).
 * Deleting cascades every row and stored object (see deleteStory).
 */
export function StoryCard({
  id,
  title,
  status,
  dateText,
  views,
  responses,
}: {
  id: string;
  title: string | null;
  status: Status;
  dateText: string | null;
  views: number;
  responses: number;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const meta = [STATUS_LABEL[status], dateText].filter(Boolean).join(" · ");
  const counts: string[] = [];
  if (views > 0) counts.push(`${views} ${views === 1 ? "view" : "views"}`);
  if (responses > 0)
    counts.push(`${responses} ${responses === 1 ? "response" : "responses"}`);

  async function onDelete() {
    setDeleting(true);
    try {
      await deleteStory(id);
      router.refresh();
    } catch {
      setDeleting(false);
      setConfirming(false);
    }
  }

  return (
    <li className="relative rounded-card border border-hairline bg-paper-raised shadow-soft transition-colors duration-300 ease-keepsake hover:border-ink-soft">
      <Link href={`/story/${id}`} className="block p-6 pr-12">
        <p className="font-serif text-xl text-ink">{title ?? "Untitled story"}</p>
        <p className="mt-1 font-sans text-xs uppercase tracking-[0.12em] text-ink-soft">
          {meta}
        </p>
        {counts.length > 0 && (
          <p className="mt-2 font-sans text-sm text-ink-soft">
            {counts.join(" · ")}
          </p>
        )}
      </Link>

      {/* Quiet delete affordance in the corner. */}
      {!confirming ? (
        <button
          type="button"
          aria-label="Delete story"
          onClick={() => setConfirming(true)}
          className="absolute right-3 top-5 grid size-8 place-items-center rounded-full text-ink-faint transition-colors duration-200 hover:bg-paper hover:text-ink-soft"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
            <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" />
          </svg>
        </button>
      ) : (
        <div className="flex items-center justify-end gap-3 border-t border-hairline px-6 py-3">
          <span className="mr-auto font-sans text-sm text-ink-soft">
            Delete this story forever?
          </span>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            disabled={deleting}
            className="font-sans text-sm text-ink-soft underline-offset-4 hover:text-ink hover:underline disabled:opacity-50"
          >
            Keep
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={deleting}
            className={cn(
              "font-sans text-sm text-error underline-offset-4 hover:underline disabled:opacity-50",
            )}
          >
            {deleting ? "Deleting…" : "Delete"}
          </button>
        </div>
      )}
    </li>
  );
}

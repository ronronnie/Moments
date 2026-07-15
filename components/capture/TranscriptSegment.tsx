"use client";

import { useState } from "react";
import { ProgressBar } from "@/components/ui";
import { updateTranscript } from "@/lib/actions/recordings";
import type { ClientSegment } from "./types";

/**
 * One segment's transcript, shown for review and editing. While the audio is
 * uploading or transcribing, the text area is replaced with a gentle wait
 * ("Listening to your story…"). Edits autosave on blur.
 */
export function TranscriptSegment({
  segment,
  index,
  onDelete,
  onEdited,
}: {
  segment: ClientSegment;
  index: number;
  onDelete: (id: string) => void;
  onEdited: (id: string, text: string) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const busy = segment.status === "uploading" || segment.status === "transcribing";

  async function handleBlur(text: string) {
    if (text === segment.transcriptText) return;
    onEdited(segment.id, text);
    try {
      setSaving(true);
      setSaved(false);
      await updateTranscript(segment.id, text);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-card border border-hairline bg-paper-raised p-5">
      <div className="mb-3 flex items-center justify-between">
        <p className="font-sans text-xs uppercase tracking-[0.12em] text-ink-soft">
          Part {index + 1}
          {segment.source === "followup" && " · follow-up"}
          {!segment.hasAudio && " · typed"}
        </p>
        {!busy && (
          <button
            type="button"
            onClick={() => onDelete(segment.id)}
            className="font-sans text-xs text-ink-soft underline decoration-hairline underline-offset-4 transition-colors duration-300 ease-keepsake hover:text-error"
          >
            Remove
          </button>
        )}
      </div>

      {busy ? (
        <div className="space-y-3 py-2">
          <ProgressBar indeterminate />
          <p className="font-serif text-lg text-ink-soft">
            {segment.status === "uploading"
              ? "Saving your voice…"
              : "Listening to your story…"}
          </p>
        </div>
      ) : segment.status === "error" ? (
        <p className="font-sans text-sm text-error">
          Something interrupted this part. You can remove it and try again.
        </p>
      ) : (
        <>
          <textarea
            defaultValue={segment.transcriptText}
            onBlur={(e) => handleBlur(e.target.value)}
            rows={Math.max(3, Math.ceil((segment.transcriptText.length || 1) / 48))}
            className="w-full resize-none rounded-md border border-transparent bg-transparent font-serif text-lg leading-relaxed text-ink focus:outline-none focus-visible:border-hairline"
            aria-label={`Transcript for part ${index + 1}`}
          />
          <p className="mt-1 h-4 font-sans text-xs text-ink-soft">
            {saving ? "Saving…" : saved ? "Saved" : ""}
          </p>
        </>
      )}
    </div>
  );
}

"use client";

import { upload } from "@vercel/blob/client";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { Button, Textarea, Toast } from "@/components/ui";
import {
  addTextSegment,
  deleteSegment,
  transcribeAndSaveSegment,
  type RecordingRow,
} from "@/lib/actions/recordings";
import { updateStoryTitle } from "@/lib/actions/stories";
import { Recorder } from "./Recorder";
import { TranscriptSegment } from "./TranscriptSegment";
import type { ClientSegment } from "./types";
import type { RecordingResult } from "./useRecorder";

const MAX_TOTAL_SECONDS = 600; // ~10 min of audio (spec F2)

function rowToClient(
  row: RecordingRow,
  status: ClientSegment["status"] = "ready",
): ClientSegment {
  return {
    id: row.id,
    transcriptText: row.transcriptText ?? "",
    wordsJson: row.wordsJson ?? null,
    source: row.source,
    durationS: row.durationS ?? null,
    status,
    hasAudio: Boolean(row.audioPath),
  };
}

type ToastState = { variant: "success" | "error" | "neutral"; text: string };

/**
 * The recording screen (spec §4 step 2, F2–F3). Everything here is already
 * persisted server-side the moment it happens — segments are DB rows, the title
 * autosaves — so a refresh or a closed tab never loses work; the parent server
 * component re-hydrates from the database.
 */
export function CaptureFlow({
  storyId,
  initialTitle,
  initialSegments,
}: {
  storyId: string;
  initialTitle: string;
  initialSegments: ClientSegment[];
}) {
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle);
  const [segments, setSegments] = useState<ClientSegment[]>(initialSegments);
  const [typing, setTyping] = useState(false);
  const [typedText, setTypedText] = useState("");
  const [submittingText, setSubmittingText] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  const totalDuration = useMemo(
    () => segments.reduce((sum, s) => sum + (s.durationS ?? 0), 0),
    [segments],
  );
  const remainingS = Math.max(15, MAX_TOTAL_SECONDS - totalDuration);
  const readyCount = segments.filter((s) => s.status === "ready").length;
  const atCap = totalDuration >= MAX_TOTAL_SECONDS;

  const patchSegment = useCallback(
    (id: string, patch: Partial<ClientSegment>) =>
      setSegments((prev) =>
        prev.map((s) => (s.id === id ? { ...s, ...patch } : s)),
      ),
    [],
  );

  const handleRecordingComplete = useCallback(
    async (result: RecordingResult) => {
      const tempId = `temp-${Date.now()}`;
      setSegments((prev) => [
        ...prev,
        {
          id: tempId,
          transcriptText: "",
          wordsJson: null,
          source: "initial",
          durationS: result.durationS,
          status: "uploading",
          hasAudio: true,
        },
      ]);

      try {
        const blob = await upload(
          `audio/${storyId}/${result.file.name}`,
          result.file,
          {
            access: "public",
            handleUploadUrl: "/api/blob/upload",
            clientPayload: JSON.stringify({ storyId }),
            contentType: result.mimeType,
          },
        );

        patchSegment(tempId, { status: "transcribing" });

        const row = await transcribeAndSaveSegment({
          storyId,
          audioUrl: blob.url,
          durationS: result.durationS,
          source: "initial",
        });

        setSegments((prev) =>
          prev.map((s) => (s.id === tempId ? rowToClient(row) : s)),
        );
      } catch (err) {
        console.error("recording upload/transcribe failed", err);
        patchSegment(tempId, { status: "error" });
        setToast({
          variant: "error",
          text: "That part didn’t save. Your other parts are safe.",
        });
      }
    },
    [storyId, patchSegment],
  );

  const handleAddText = useCallback(async () => {
    const text = typedText.trim();
    if (!text) return;
    setSubmittingText(true);
    try {
      const row = await addTextSegment(storyId, text);
      setSegments((prev) => [...prev, rowToClient(row)]);
      setTypedText("");
      setTyping(false);
    } catch (err) {
      console.error("addTextSegment failed", err);
      setToast({ variant: "error", text: "Couldn’t save that. Try again." });
    } finally {
      setSubmittingText(false);
    }
  }, [storyId, typedText]);

  const handleDelete = useCallback(async (id: string) => {
    const isTemp = id.startsWith("temp-");
    setSegments((prev) => prev.filter((s) => s.id !== id));
    if (isTemp) return;
    try {
      await deleteSegment(id);
    } catch (err) {
      console.error("deleteSegment failed", err);
      setToast({ variant: "error", text: "Couldn’t remove that part." });
    }
  }, []);

  const handleTitleBlur = useCallback(async () => {
    if (title === initialTitle) return;
    try {
      await updateStoryTitle(storyId, title);
    } catch (err) {
      console.error("updateStoryTitle failed", err);
    }
  }, [storyId, title, initialTitle]);

  return (
    <main className="mx-auto w-full max-w-md px-6 py-10">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={handleTitleBlur}
        placeholder="Untitled story"
        aria-label="Story title"
        className="w-full bg-transparent font-serif text-2xl font-medium tracking-tight text-ink placeholder:text-ink-faint focus:outline-none"
      />

      <p className="mt-6 font-serif text-lg text-ink-soft">
        Tell it however you remember it. You can refine it later.
      </p>

      {segments.length > 0 && (
        <div className="mt-8 space-y-3">
          {segments.map((segment, i) => (
            <TranscriptSegment
              key={segment.id}
              segment={segment}
              index={i}
              onDelete={handleDelete}
              onEdited={(id, text) => patchSegment(id, { transcriptText: text })}
            />
          ))}
        </div>
      )}

      {/* Record / add-more, unless the teller chose to type. */}
      {!typing && (
        <div className="mt-10 flex flex-col items-center gap-4">
          {segments.length > 0 && (
            <p className="font-sans text-sm text-ink-soft">
              {atCap ? "You’ve reached the length limit." : "Add another part"}
            </p>
          )}
          {!atCap && (
            <Recorder
              onComplete={handleRecordingComplete}
              onError={(text) => setToast({ variant: "error", text })}
              remainingS={remainingS}
            />
          )}
          <button
            type="button"
            onClick={() => setTyping(true)}
            className="font-sans text-sm text-ink-soft underline decoration-hairline underline-offset-4 transition-colors duration-300 ease-keepsake hover:text-ink"
          >
            Type it instead
          </button>
        </div>
      )}

      {/* Type-it-instead composer. */}
      {typing && (
        <div className="mt-10 space-y-4">
          <Textarea
            serif
            autoFocus
            rows={6}
            value={typedText}
            onChange={(e) => setTypedText(e.target.value)}
            aria-label="Type your story"
            placeholder="Tell it however you remember it…"
          />
          <div className="flex items-center gap-4">
            <Button
              onClick={handleAddText}
              loading={submittingText}
              disabled={typedText.trim().length === 0}
            >
              Add this part
            </Button>
            <button
              type="button"
              onClick={() => {
                setTyping(false);
                setTypedText("");
              }}
              className="shrink-0 font-sans text-sm text-ink-soft underline decoration-hairline underline-offset-4 hover:text-ink"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Continue to the next step (interviewer / review, later phases). */}
      <div className="mt-14 border-t border-hairline pt-8">
        <Button
          variant={readyCount > 0 ? "primary" : "quiet"}
          disabled={readyCount === 0}
          onClick={() => router.push(`/new/${storyId}/interview`)}
        >
          Continue
        </Button>
        {readyCount === 0 && (
          <p className="mt-3 text-center font-sans text-sm text-ink-soft">
            Record or type at least one part to continue.
          </p>
        )}
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

"use client";

import { RecordButton } from "@/components/ui";
import {
  useRecorder,
  type RecordingResult,
  type RecorderStatus,
} from "./useRecorder";

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// Fixed weights give the meter a natural, uneven shape.
const BAR_WEIGHTS = [0.4, 0.7, 1, 0.85, 1, 0.7, 0.4];

function LevelMeter({
  level,
  status,
}: {
  level: number;
  status: RecorderStatus;
}) {
  const active = status === "recording";
  return (
    <div className="flex h-10 items-center justify-center gap-1.5" aria-hidden>
      {BAR_WEIGHTS.map((w, i) => {
        const h = active ? 12 + level * 28 * w : 6;
        return (
          <span
            key={i}
            className="w-1.5 rounded-full bg-accent transition-[height] duration-150 ease-keepsake"
            style={{ height: `${h}px`, opacity: active ? 1 : 0.35 }}
          />
        );
      })}
    </div>
  );
}

/**
 * A single recording session. Renders the breathing/rippling record button, a
 * running timer, a live level meter, and pause/resume. Hands the finished audio
 * up to the parent, which uploads and transcribes it.
 */
export function Recorder({
  onComplete,
  onError,
  remainingS = 600,
}: {
  onComplete: (result: RecordingResult) => void;
  onError?: (message: string) => void;
  remainingS?: number;
}) {
  const { status, elapsedS, level, supported, start, pause, resume, stop } =
    useRecorder({ onComplete, onError, maxSeconds: remainingS });

  const recording = status !== "idle";

  return (
    <div className="flex flex-col items-center gap-6">
      <LevelMeter level={level} status={status} />

      <RecordButton
        recording={recording}
        disabled={!supported}
        onClick={() => (recording ? stop() : start())}
        aria-label={recording ? "Finish this part" : "Start recording"}
      />

      <div className="flex min-h-[2.5rem] flex-col items-center gap-2">
        {recording ? (
          <>
            <p
              className="font-sans text-sm tabular-nums text-ink-soft"
              aria-live="polite"
            >
              {formatTime(elapsedS)}
              {status === "paused" && " · paused"}
            </p>
            <button
              type="button"
              onClick={() => (status === "paused" ? resume() : pause())}
              className="font-sans text-sm text-ink-soft underline decoration-hairline underline-offset-4 transition-colors duration-300 ease-keepsake hover:text-ink"
            >
              {status === "paused" ? "Resume" : "Pause"}
            </button>
          </>
        ) : (
          <p className="font-sans text-sm text-ink-soft">
            {supported ? "Tap to start" : "Recording isn’t available here"}
          </p>
        )}
      </div>
    </div>
  );
}

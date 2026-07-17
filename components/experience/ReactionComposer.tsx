"use client";

import Link from "next/link";
import { upload } from "@vercel/blob/client";
import { useCallback, useState } from "react";
import { cn } from "@/lib/cn";
import { useRecorder } from "@/components/capture/useRecorder";
import { submitReaction } from "@/lib/actions/reactions";

/**
 * A recipient's response (spec F8), composed over the cinematic view: a written
 * message, an emoji pinned to the moment that moved them, or a voice reply
 * (≤60s). No account — only a first name, optional. After sending, a soft
 * invitation to tell a story of their own (the growth loop).
 */

const EMOJI = ["❤️", "🥹", "😊", "🙏", "✨", "😢"];
const clock = (s: number) => `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, "0")}`;

type Phase = "compose" | "sending" | "sent";

export function ReactionComposer({
  token,
  timestampOffsetS,
  onClose,
}: {
  token: string;
  timestampOffsetS: number | null;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [phase, setPhase] = useState<Phase>("compose");
  const [error, setError] = useState<string | null>(null);

  const send = useCallback(
    async (payload: {
      kind: "text" | "emoji" | "voice";
      body?: string;
      audioUrl?: string;
    }) => {
      setPhase("sending");
      setError(null);
      try {
        await submitReaction({
          token,
          kind: payload.kind,
          body: payload.body,
          audioUrl: payload.audioUrl,
          timestampOffsetS: timestampOffsetS ?? undefined,
          reactorName: name.trim() || undefined,
        });
        setPhase("sent");
      } catch (err) {
        setError((err as Error).message || "Couldn’t send that. Try again.");
        setPhase("compose");
      }
    },
    [token, timestampOffsetS, name],
  );

  const recorder = useRecorder({
    maxSeconds: 60,
    onError: (m) => setError(m),
    onComplete: async ({ file }) => {
      setPhase("sending");
      setError(null);
      try {
        const blob = await upload(`reactions/${token}/${file.name}`, file, {
          access: "public",
          handleUploadUrl: "/api/reactions/upload",
          clientPayload: JSON.stringify({ token }),
          contentType: file.type,
        });
        await send({ kind: "voice", audioUrl: blob.url });
      } catch {
        setError("Couldn’t send your voice reply. You can write a note instead.");
        setPhase("compose");
      }
    },
  });

  const pinnedAt =
    typeof timestampOffsetS === "number" ? ` · at ${clock(timestampOffsetS)}` : "";

  return (
    <div className="absolute inset-0 z-50 flex items-end" role="dialog" aria-label="Leave a response">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-cinema/70" />

      <div className="relative w-full rounded-t-[20px] bg-cinema-raised px-5 pb-[calc(env(safe-area-inset-bottom)+20px)] pt-5 shadow-soft animate-[titleIn_400ms_var(--ease-keepsake)_both]">
        {phase === "sent" ? (
          <div className="flex flex-col items-center gap-5 py-4 text-center">
            <p className="font-serif text-xl text-cinema-text">
              Thank you — they’ll hear from you.
            </p>
            <p className="font-sans text-sm text-cinema-text/60">
              Have a story of your own to tell?
            </p>
            <Link
              href="/sign-up"
              className="inline-flex min-h-[48px] items-center rounded-full bg-accent-strong px-7 py-3 font-sans text-base font-medium text-paper transition-colors duration-300 ease-keepsake hover:bg-accent"
            >
              Tell a story
            </Link>
            <button
              type="button"
              onClick={onClose}
              className="font-sans text-sm text-cinema-text/60 underline-offset-4 hover:text-cinema-text hover:underline"
            >
              Close
            </button>
          </div>
        ) : (
          <>
            <p className="mb-4 font-sans text-sm text-cinema-text/60">
              Leave them a note{pinnedAt}
            </p>

            {/* first name (optional) */}
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your first name (optional)"
              aria-label="Your first name"
              maxLength={60}
              className="mb-4 w-full rounded-button border border-cinema-text/15 bg-transparent px-4 py-3 font-sans text-base text-cinema-text placeholder:text-cinema-text/40 focus:border-cinema-text/40 focus:outline-none"
            />

            {/* emoji — taps send immediately */}
            <div className="mb-4 flex justify-between gap-1">
              {EMOJI.map((e) => (
                <button
                  key={e}
                  type="button"
                  disabled={phase === "sending"}
                  onClick={() => send({ kind: "emoji", body: e })}
                  className="grid size-12 place-items-center rounded-full text-2xl transition-transform duration-200 hover:scale-110 disabled:opacity-50"
                  aria-label={`React ${e}`}
                >
                  {e}
                </button>
              ))}
            </div>

            {/* written message */}
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Write something…"
              aria-label="Write a message"
              rows={3}
              className="w-full resize-none rounded-card border border-cinema-text/15 bg-transparent px-4 py-3 font-serif text-lg text-cinema-text placeholder:text-cinema-text/40 focus:border-cinema-text/40 focus:outline-none"
            />

            <div className="mt-4 flex items-center gap-3">
              <button
                type="button"
                disabled={phase === "sending" || text.trim().length === 0}
                onClick={() => send({ kind: "text", body: text })}
                className="inline-flex min-h-[48px] flex-1 items-center justify-center rounded-button bg-accent-strong px-6 font-sans text-base font-medium text-paper transition-colors duration-300 ease-keepsake hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
              >
                {phase === "sending" ? "Sending…" : "Send note"}
              </button>

              {recorder.supported && (
                <button
                  type="button"
                  disabled={phase === "sending"}
                  onClick={() =>
                    recorder.status === "recording" ? recorder.stop() : recorder.start()
                  }
                  className={cn(
                    "inline-flex min-h-[48px] items-center gap-2 rounded-button border px-5 font-sans text-base transition-colors duration-300",
                    recorder.status === "recording"
                      ? "border-accent text-accent"
                      : "border-cinema-text/20 text-cinema-text/80 hover:text-cinema-text",
                    "disabled:opacity-50",
                  )}
                >
                  {recorder.status === "recording"
                    ? `Stop · ${clock(recorder.elapsedS)}`
                    : "Record"}
                </button>
              )}
            </div>

            {error && (
              <p className="mt-3 font-sans text-sm text-[color:var(--color-error)]">
                {error}
              </p>
            )}

            <button
              type="button"
              onClick={onClose}
              className="mt-4 w-full text-center font-sans text-sm text-cinema-text/50 underline-offset-4 hover:text-cinema-text/80 hover:underline"
            >
              Not now
            </button>
          </>
        )}
      </div>
    </div>
  );
}

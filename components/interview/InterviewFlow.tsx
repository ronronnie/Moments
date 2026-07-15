"use client";

import { upload } from "@vercel/blob/client";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { Button, Card, Textarea, Toast } from "@/components/ui";
import { Recorder } from "@/components/capture/Recorder";
import type { RecordingResult } from "@/components/capture/useRecorder";
import { transcribeAndSaveSegment } from "@/lib/actions/recordings";
import {
  answerQuestionText,
  markQuestionAnswered,
  regenerateQuestion,
  saveContext,
  skipQuestion,
} from "@/lib/actions/interview";
import { ContextChips } from "./ContextChips";
import type { StoryContext } from "@/db/schema";

type QA = { id: string; text: string };
type ToastState = { variant: "success" | "error" | "neutral"; text: string };

/**
 * The interviewer, presented one calm question at a time (spec F4). Answers are
 * saved as follow-up segments (voice or typed). Below, extracted context is
 * confirmed via chips. Continue persists the context and moves to review.
 */
export function InterviewFlow({
  storyId,
  initialQuestions,
  initialContext,
  alreadyConfirmed,
}: {
  storyId: string;
  initialQuestions: QA[];
  initialContext: StoryContext;
  alreadyConfirmed: boolean;
}) {
  const router = useRouter();
  const [questions, setQuestions] = useState<QA[]>(initialQuestions);
  const [index, setIndex] = useState(0);
  const [mode, setMode] = useState<"idle" | "text">("idle");
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [context, setContext] = useState<StoryContext>(
    alreadyConfirmed ? initialContext : {},
  );
  const [continuing, setContinuing] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  const current = questions[index];
  const done = index >= questions.length;

  const advance = useCallback(() => {
    setMode("idle");
    setTyped("");
    setIndex((i) => i + 1);
  }, []);

  const handleText = useCallback(async () => {
    if (!current || typed.trim().length === 0) return;
    setBusy(true);
    try {
      await answerQuestionText(current.id, typed);
      advance();
    } catch (err) {
      console.error(err);
      setToast({ variant: "error", text: "Couldn’t save that answer." });
    } finally {
      setBusy(false);
    }
  }, [current, typed, advance]);

  const handleVoice = useCallback(
    async (result: RecordingResult) => {
      if (!current) return;
      setBusy(true);
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
        await transcribeAndSaveSegment({
          storyId,
          audioUrl: blob.url,
          durationS: result.durationS,
          source: "followup",
          questionId: current.id,
        });
        await markQuestionAnswered(current.id);
        advance();
      } catch (err) {
        console.error(err);
        setToast({ variant: "error", text: "That answer didn’t save." });
      } finally {
        setBusy(false);
      }
    },
    [current, storyId, advance],
  );

  const handleSkip = useCallback(async () => {
    if (!current) return;
    setBusy(true);
    try {
      await skipQuestion(current.id);
      advance();
    } catch (err) {
      console.error(err);
    } finally {
      setBusy(false);
    }
  }, [current, advance]);

  const handleRegenerate = useCallback(async () => {
    if (!current) return;
    setBusy(true);
    try {
      const updated = await regenerateQuestion(current.id);
      if (updated) {
        setQuestions((prev) =>
          prev.map((q, i) => (i === index ? { id: updated.id, text: updated.text } : q)),
        );
        setMode("idle");
        setTyped("");
      } else {
        setToast({ variant: "neutral", text: "No other question came to mind." });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setBusy(false);
    }
  }, [current, index]);

  const handleContinue = useCallback(async () => {
    setContinuing(true);
    try {
      await saveContext(storyId, context);
      router.push(`/story/${storyId}`);
    } catch (err) {
      console.error(err);
      setToast({ variant: "error", text: "Couldn’t save your details." });
      setContinuing(false);
    }
  }, [storyId, context, router]);

  return (
    <main className="mx-auto w-full max-w-md px-6 py-10">
      <header className="mb-8">
        <h1 className="font-serif text-2xl font-medium tracking-tight">
          A few more moments
        </h1>
        <p className="mt-2 font-sans text-sm text-ink-soft">
          Small questions to help the story breathe. Answer, or skip any of them.
        </p>
      </header>

      {/* ---- Question, one at a time ---- */}
      {questions.length === 0 ? (
        <Card>
          <p className="font-serif text-lg text-ink-soft">
            No questions this time — your story already says a lot.
          </p>
        </Card>
      ) : done ? (
        <Card>
          <p className="font-serif text-xl text-ink">
            Thank you — that’s everything.
          </p>
        </Card>
      ) : (
        <Card>
          <p className="font-sans text-xs uppercase tracking-[0.12em] text-ink-soft">
            Question {index + 1} of {questions.length}
          </p>
          <p className="mt-3 font-serif text-2xl leading-snug text-ink">
            {current.text}
          </p>

          <div className="mt-6">
            {mode === "text" ? (
              <div className="space-y-4">
                <Textarea
                  serif
                  autoFocus
                  rows={4}
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  aria-label="Your answer"
                  placeholder="However you remember it…"
                />
                <div className="flex items-center gap-4">
                  <Button
                    onClick={handleText}
                    loading={busy}
                    disabled={typed.trim().length === 0}
                  >
                    Add this answer
                  </Button>
                  <button
                    type="button"
                    onClick={() => setMode("idle")}
                    className="shrink-0 font-sans text-sm text-ink-soft underline decoration-hairline underline-offset-4 hover:text-ink"
                  >
                    Back
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-5">
                <Recorder onComplete={handleVoice} onError={(t) => setToast({ variant: "error", text: t })} />
                <button
                  type="button"
                  onClick={() => setMode("text")}
                  className="font-sans text-sm text-ink-soft underline decoration-hairline underline-offset-4 hover:text-ink"
                >
                  Type your answer instead
                </button>
              </div>
            )}
          </div>

          <div className="mt-6 flex items-center justify-between border-t border-hairline pt-4">
            <button
              type="button"
              onClick={handleSkip}
              disabled={busy}
              className="font-sans text-sm text-ink-soft underline decoration-hairline underline-offset-4 hover:text-ink disabled:opacity-50"
            >
              Skip
            </button>
            <button
              type="button"
              onClick={handleRegenerate}
              disabled={busy}
              className="font-sans text-sm text-ink-soft underline decoration-hairline underline-offset-4 hover:text-ink disabled:opacity-50"
            >
              Ask me something else
            </button>
          </div>
        </Card>
      )}

      {/* ---- Context confirmation ---- */}
      <section className="mt-10">
        <h2 className="mb-4 font-serif text-xl font-medium text-ink">
          A few details from your story
        </h2>
        <ContextChips
          initial={initialContext}
          defaultSelected={alreadyConfirmed}
          onChange={setContext}
        />
      </section>

      {/* ---- Continue ---- */}
      <div className="mt-12 border-t border-hairline pt-8">
        <Button onClick={handleContinue} loading={continuing}>
          Continue
        </Button>
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

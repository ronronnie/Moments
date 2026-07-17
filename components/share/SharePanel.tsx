"use client";

import Link from "next/link";
import { useCallback, useState, useSyncExternalStore } from "react";
import { Button, Toast } from "@/components/ui";
import { cn } from "@/lib/cn";
import {
  ensureShareLink,
  regenerateShareLink,
  revokeShareLink,
} from "@/lib/actions/share";

type ReactionView = {
  id: string;
  kind: "text" | "emoji" | "voice";
  body: string | null;
  audioUrl: string | null;
  timestampOffsetS: number | null;
  reactorName: string | null;
  createdAt: string;
};
type ToastState = { variant: "success" | "error" | "neutral"; text: string };

function timecode(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

/**
 * The owner's private-sharing surface (spec F8): make or turn off the link, and
 * read the responses. Paper-and-ink like the rest of the creation flow — this is
 * the teller's side, not the cinematic recipient view.
 */
export function SharePanel({
  storyId,
  title,
  initialToken,
  viewCount,
  reactions,
}: {
  storyId: string;
  title: string;
  initialToken: string | null;
  viewCount: number;
  reactions: ReactionView[];
}) {
  const [token, setToken] = useState(initialToken);
  const [busy, setBusy] = useState<null | "create" | "revoke" | "regen">(null);
  const [toast, setToast] = useState<ToastState | null>(null);

  // Origin, SSR-safe: "" on the server/first paint, real value on the client.
  const origin = useSyncExternalStore(
    () => () => {},
    () => window.location.origin,
    () => "",
  );
  const link = token ? `${origin}/s/${token}` : null;

  const create = useCallback(async () => {
    setBusy("create");
    try {
      setToken(await ensureShareLink(storyId));
    } catch {
      setToast({ variant: "error", text: "Couldn’t create a link. Try again." });
    } finally {
      setBusy(null);
    }
  }, [storyId]);

  const copy = useCallback(async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setToast({ variant: "success", text: "Link copied." });
    } catch {
      setToast({ variant: "neutral", text: "Press and hold the link to copy." });
    }
  }, [link]);

  const share = useCallback(async () => {
    if (!link) return;
    if (navigator.share) {
      try {
        await navigator.share({ title, text: `A story for you: ${title}`, url: link });
      } catch {
        /* user dismissed the sheet — nothing to do */
      }
    } else {
      copy();
    }
  }, [link, title, copy]);

  const revoke = useCallback(async () => {
    setBusy("revoke");
    try {
      await revokeShareLink(storyId);
      setToken(null);
      setToast({ variant: "neutral", text: "The link is off. No one new can open it." });
    } catch {
      setToast({ variant: "error", text: "Couldn’t turn the link off." });
    } finally {
      setBusy(null);
    }
  }, [storyId]);

  const regen = useCallback(async () => {
    setBusy("regen");
    try {
      setToken(await regenerateShareLink(storyId));
      setToast({ variant: "success", text: "A fresh link is ready. The old one no longer works." });
    } catch {
      setToast({ variant: "error", text: "Couldn’t make a new link." });
    } finally {
      setBusy(null);
    }
  }, [storyId]);

  return (
    <main className="mx-auto w-full max-w-md px-6 py-10">
      <header className="mb-8">
        <h1 className="font-serif text-2xl font-medium tracking-tight">
          Share privately
        </h1>
        <p className="mt-2 font-sans text-sm text-ink-soft">
          Only people with the link can open your story. You can turn it off at
          any time.
        </p>
      </header>

      {/* ---- Link management ---- */}
      {!token ? (
        <Button loading={busy === "create"} onClick={create}>
          Create a private link
        </Button>
      ) : (
        <div className="space-y-4">
          <div className="rounded-card border border-hairline bg-paper-raised p-4">
            <p className="break-all font-sans text-sm text-ink-soft">
              {link ?? "…"}
            </p>
          </div>
          <div className="flex gap-3">
            <Button onClick={copy}>Copy link</Button>
            <Button variant="quiet" onClick={share}>
              Share…
            </Button>
          </div>
          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={regen}
              disabled={busy !== null}
              className="font-sans text-sm text-ink-soft underline-offset-4 hover:text-ink hover:underline disabled:opacity-50"
            >
              {busy === "regen" ? "Making a new link…" : "Make a new link"}
            </button>
            <button
              type="button"
              onClick={revoke}
              disabled={busy !== null}
              className="font-sans text-sm text-error underline-offset-4 hover:underline disabled:opacity-50"
            >
              {busy === "revoke" ? "Turning off…" : "Turn off link"}
            </button>
          </div>
          {viewCount > 0 && (
            <p className="pt-1 font-sans text-sm text-ink-soft">
              Opened {viewCount} {viewCount === 1 ? "time" : "times"}.
            </p>
          )}
        </div>
      )}

      {/* ---- Responses ---- */}
      <section className="mt-12 border-t border-hairline pt-8">
        <h2 className="font-serif text-xl font-medium tracking-tight">Responses</h2>
        {reactions.length === 0 ? (
          <p className="mt-3 font-sans text-sm text-ink-soft">
            When someone responds to your story, you’ll see it here.
          </p>
        ) : (
          <ul className="mt-5 space-y-5">
            {reactions.map((r) => (
              <ReactionItem key={r.id} r={r} />
            ))}
          </ul>
        )}
      </section>

      <div className="mt-12">
        <Link
          href={`/story/${storyId}/preview`}
          className="font-sans text-sm text-ink-soft underline-offset-4 hover:text-ink hover:underline"
        >
          ← Back to your story
        </Link>
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

function ReactionItem({ r }: { r: ReactionView }) {
  const name = r.reactorName?.trim() || "Someone";
  const at =
    typeof r.timestampOffsetS === "number"
      ? ` · at ${timecode(r.timestampOffsetS)}`
      : "";
  return (
    <li className="rounded-card border border-hairline bg-paper-raised p-4">
      <p className="font-sans text-xs uppercase tracking-wider text-ink-faint">
        {name}
        {at}
      </p>
      {r.kind === "text" && (
        <p className="mt-2 font-serif text-lg leading-snug text-ink">{r.body}</p>
      )}
      {r.kind === "emoji" && (
        <p className="mt-1 text-3xl" aria-label="reaction">
          {r.body}
        </p>
      )}
      {r.kind === "voice" && r.audioUrl && (
        <audio
          className={cn("mt-2 w-full")}
          controls
          preload="none"
          src={r.audioUrl}
        />
      )}
    </li>
  );
}

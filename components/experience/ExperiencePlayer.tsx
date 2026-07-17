"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  ExperienceData,
  ExperienceSection,
} from "@/lib/experience";
import { MUSIC_TRACKS } from "@/lib/music";
import { selectMusicTrack } from "@/lib/actions/experience";
import { trackEvent } from "@/lib/actions/analytics";
import { cn } from "@/lib/cn";
import { ReactionComposer } from "./ReactionComposer";
import { useMusic } from "./useMusic";
import { useTimeline } from "./useTimeline";

/**
 * The experience page (spec F7) — the product's heart. One player, two surfaces:
 * the owner preview (mode="owner", with a music picker and a way back to editing)
 * and the recipient view (mode="recipient"). Voice + word-synced captions +
 * slow-moving photos + a ducked music bed, with all chrome falling away once the
 * story is playing. Reactions and sharing are wired in Prompt 7.
 */

type Mode = "owner" | "recipient";

export function ExperiencePlayer({
  data,
  mode,
  token,
  pins = [],
  embedded = false,
}: {
  data: ExperienceData;
  mode: Mode;
  /** Recipient share token — enables the reaction loop (recipient mode only). */
  token?: string;
  /** Pinned reaction timestamps (seconds) shown as scrub-bar ticks (owner). */
  pins?: number[];
  /** Fill the parent (for the landing sample) instead of the full viewport. */
  embedded?: boolean;
}) {
  const timeline = useTimeline(data.segments, data.totalS);
  const { t, playing, started, ended } = timeline;
  const canReact = mode === "recipient" && !!token;

  const [composerOpen, setComposerOpen] = useState(false);
  const [pinAt, setPinAt] = useState<number | null>(null);

  const [musicId, setMusicId] = useState<string | null>(data.music?.id ?? null);
  const musicUrl = useMemo(
    () => MUSIC_TRACKS.find((tk) => tk.id === musicId)?.src ?? null,
    [musicId],
  );
  const [muted, setMuted] = useState(false);
  const { unlock } = useMusic(musicUrl, started && playing && !ended, muted);

  const [revealed, setRevealed] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasPlaying = useRef(false);

  // A discrete gesture (tap/play/scrub) reveals the chrome and re-arms a 3s
  // fade. Deliberately NOT wired to pointer-move: the Ken Burns and caption
  // animations move under a resting desktop cursor and would fire pointer-move
  // endlessly, pinning the chrome open. The spec returns chrome on tap anyway.
  const reveal = useCallback(() => {
    setRevealed(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setRevealed(false), 3000);
  }, []);

  useEffect(() => {
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, []);

  // A recipient reaching the closing card is the watch-to-end signal (spec §11).
  const completedRef = useRef(false);
  useEffect(() => {
    if (ended && canReact && !completedRef.current) {
      completedRef.current = true;
      trackEvent("recipient_completed", data.storyId).catch(() => {});
    }
  }, [ended, canReact, data.storyId]);

  // Chrome is always present when idle, paused, ended, or the picker is open;
  // while the story plays it fades until the next tap reveals it.
  const chrome = !started || !playing || ended || pickerOpen || revealed;

  const activeIndex = useMemo(() => sectionIndexAt(data.sections, t), [data.sections, t]);

  const startStory = useCallback(() => {
    unlock();
    timeline.play();
    reveal(); // arm the 3s chrome fade from the moment playback begins
  }, [unlock, timeline, reveal]);

  const replay = useCallback(() => {
    timeline.replay();
    reveal();
  }, [timeline, reveal]);

  const onStageTap = useCallback(() => {
    if (!started || ended) return;
    timeline.toggle();
    reveal();
  }, [started, ended, timeline, reveal]);

  const onPickMusic = useCallback(
    (id: string | null) => {
      setMusicId(id);
      setPickerOpen(false);
      selectMusicTrack(data.storyId, id).catch(() => {});
    },
    [data.storyId],
  );

  // Open the reaction composer, pausing so the moment holds. `pin` is the
  // timestamp it's tied to (mid-story), or null from the closing card.
  const openReaction = useCallback(
    (pin: number | null) => {
      setPinAt(pin);
      setComposerOpen(true);
      timeline.pause();
      reveal();
    },
    [timeline, reveal],
  );

  return (
    <div
      className={cn(
        "relative w-full select-none overflow-hidden bg-cinema text-cinema-text",
        embedded ? "h-full" : "h-dvh",
      )}
    >
      {/* ---------------------------------------------------- photo backdrops */}
      <div className="absolute inset-0" onPointerDown={onStageTap}>
        <Backdrop
          visible={!started}
          photoUrl={data.titlePhoto?.url ?? null}
          gradient={0}
          t={0}
          start={0}
          end={1}
        />
        {data.sections.map((s, i) => (
          <SectionBackdrop
            key={s.id}
            section={s}
            index={i}
            t={t}
            visible={started && !ended && i === activeIndex}
          />
        ))}
        <Backdrop
          visible={ended}
          photoUrl={null}
          gradient={data.sections.length + 1}
          t={0}
          start={0}
          end={1}
        />
      </div>

      {/* scrim + vignette keep captions legible and hold focus center-frame */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-cinema/85 via-cinema/20 to-cinema/40" />
      <div className="pointer-events-none absolute inset-0 [box-shadow:inset_0_0_180px_60px_rgba(9,8,7,0.75)]" />

      {/* ------------------------------------------------------------ captions */}
      {started && !ended && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 top-0 flex items-end justify-center px-7 pb-28">
          <div className="w-full max-w-[24ch] text-center">
            <CaptionStack section={data.sections[activeIndex]} t={t} />
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------- title card */}
      {!started && (
        <TitleCard data={data} onPlay={startStory} />
      )}

      {/* -------------------------------------------------------- closing card */}
      {ended && (
        <ClosingCard
          data={data}
          onReplay={replay}
          onReact={canReact ? () => openReaction(null) : undefined}
        />
      )}

      {/* ------------------------------------------------------------- chrome */}
      <div
        className={cn(
          "absolute inset-x-0 top-0 z-40 flex items-center justify-between px-5 pt-[calc(env(safe-area-inset-top)+14px)] transition-opacity duration-500 ease-keepsake",
          chrome ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      >
        {mode === "owner" ? (
          <Link
            href={`/story/${data.storyId}`}
            className="font-sans text-sm text-cinema-text/70 underline-offset-4 hover:underline"
          >
            Back to editing
          </Link>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-2">
          {mode === "owner" && (
            <Link
              href={`/story/${data.storyId}/share`}
              className="rounded-button px-3 py-2 font-sans text-sm text-cinema-text/80 hover:text-cinema-text"
            >
              Share
            </Link>
          )}
          {mode === "owner" && (
            <button
              type="button"
              onClick={() => setPickerOpen((v) => !v)}
              className="rounded-button px-3 py-2 font-sans text-sm text-cinema-text/80 hover:text-cinema-text"
            >
              Music
            </button>
          )}
          <button
            type="button"
            aria-label={muted ? "Unmute music" : "Mute music"}
            onClick={() => setMuted((m) => !m)}
            className="grid size-11 place-items-center rounded-full text-cinema-text/80 hover:text-cinema-text"
          >
            {muted ? <IconMuted /> : <IconSound />}
          </button>
        </div>
      </div>

      {/* scrub bar — thin, the only UI allowed over the photo during playback */}
      {started && (
        <div
          className={cn(
            "absolute inset-x-0 bottom-0 z-40 px-5 pb-[calc(env(safe-area-inset-bottom)+16px)] transition-opacity duration-500 ease-keepsake",
            chrome ? "opacity-100" : "pointer-events-none opacity-0",
          )}
        >
          {canReact && !ended && (
            <div className="mb-3 flex justify-center">
              <button
                type="button"
                onClick={() => openReaction(t)}
                className="rounded-full border border-cinema-text/25 px-4 py-2 font-sans text-sm text-cinema-text/80 backdrop-blur-sm transition-colors duration-200 hover:text-cinema-text"
              >
                Leave a note
              </button>
            </div>
          )}
          <div className="relative">
            <input
              type="range"
              className="scrub w-full"
              min={0}
              max={data.totalS}
              step={0.1}
              value={Math.min(t, data.totalS)}
              aria-label="Scrub through the story"
              onPointerDown={() => {
                wasPlaying.current = playing;
                timeline.pause();
              }}
              onPointerUp={() => {
                if (wasPlaying.current) timeline.play();
              }}
              onChange={(e) => timeline.seek(Number(e.target.value))}
            />
            {/* owner-visible ticks where recipients pinned a reaction */}
            {pins.map((p, i) => (
              <span
                key={i}
                aria-hidden
                className="pointer-events-none absolute top-1/2 h-3 w-[2px] -translate-y-1/2 rounded-full bg-accent"
                style={{
                  left: `${Math.min(100, Math.max(0, (p / data.totalS) * 100))}%`,
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* --------------------------------------------------- music picker sheet */}
      {mode === "owner" && pickerOpen && (
        <MusicSheet
          currentId={musicId}
          onPick={onPickMusic}
          onClose={() => setPickerOpen(false)}
        />
      )}

      {/* ---------------------------------------------------- reaction composer */}
      {composerOpen && token && (
        <ReactionComposer
          token={token}
          timestampOffsetS={pinAt}
          onClose={() => setComposerOpen(false)}
        />
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- selectors */

function sectionIndexAt(sections: ExperienceSection[], t: number): number {
  if (sections.length === 0) return 0;
  let idx = 0;
  for (let i = 0; i < sections.length; i++) {
    if (sections[i].start <= t + 0.001) idx = i;
    else break;
  }
  return idx;
}

/* --------------------------------------------------------------- backdrops */

const GRADIENTS = [
  "linear-gradient(160deg, #1c1a17 0%, #121110 55%, #0d0c0b 100%)",
  "radial-gradient(120% 90% at 30% 20%, #2a2119 0%, #141210 60%, #0d0c0b 100%)",
  "linear-gradient(200deg, #241a14 0%, #16130f 55%, #100e0c 100%)",
  "radial-gradient(120% 100% at 70% 30%, #2a201a 0%, #15120f 60%, #0d0c0b 100%)",
  "linear-gradient(180deg, #201b16 0%, #14110e 60%, #0e0d0b 100%)",
];

function gradientFor(index: number): string {
  return GRADIENTS[index % GRADIENTS.length];
}

function Backdrop({
  visible,
  photoUrl,
  gradient,
  index = 0,
}: {
  visible: boolean;
  photoUrl: string | null;
  gradient: number;
  index?: number;
  t?: number;
  start?: number;
  end?: number;
}) {
  return (
    <div
      className="absolute inset-0 transition-opacity duration-[1000ms] ease-keepsake"
      style={{ opacity: visible ? 1 : 0, background: gradientFor(gradient) }}
      aria-hidden={!visible}
    >
      {photoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photoUrl}
          alt=""
          className="kenburns h-full w-full object-cover"
          style={{ transformOrigin: kenBurnsOrigin(index) }}
        />
      )}
    </div>
  );
}

function kenBurnsOrigin(i: number): string {
  return ["50% 40%", "30% 30%", "70% 35%", "40% 65%", "60% 55%"][i % 5];
}

// A section's backdrop: cycles through its assigned photos over the section's
// duration (crossfading), or a warm gradient with no photos.
function SectionBackdrop({
  section,
  index,
  t,
  visible,
}: {
  section: ExperienceSection;
  index: number;
  t: number;
  visible: boolean;
}) {
  const photos = section.photos;
  const activePhoto = useMemo(() => {
    if (photos.length <= 1) return 0;
    const span = Math.max(0.001, section.end - section.start);
    const slice = span / photos.length;
    return Math.min(photos.length - 1, Math.max(0, Math.floor((t - section.start) / slice)));
  }, [photos.length, section.start, section.end, t]);

  return (
    <div
      className="absolute inset-0 transition-opacity duration-[1000ms] ease-keepsake"
      style={{ opacity: visible ? 1 : 0, background: gradientFor(index + 1) }}
      aria-hidden={!visible}
    >
      {photos.map((p, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={p.url}
          src={p.url}
          alt={p.caption ?? ""}
          className="kenburns absolute inset-0 h-full w-full object-cover transition-opacity duration-[1200ms] ease-keepsake"
          style={{
            opacity: i === activePhoto ? 1 : 0,
            transformOrigin: kenBurnsOrigin(index + i),
          }}
        />
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------- captions */

function CaptionStack({ section, t }: { section: ExperienceSection; t: number }) {
  const cues = section.cues;
  if (cues.length === 0) return null;

  let active = 0;
  for (let i = 0; i < cues.length; i++) {
    if (cues[i].start <= t + 0.15) active = i;
    else break;
  }
  const window = [active - 1, active, active + 1].filter(
    (i) => i >= 0 && i < cues.length,
  );

  return (
    <div className="flex flex-col items-center gap-3">
      {window.map((i) => (
        <p
          key={`${section.id}:${i}`}
          data-active={i === active}
          className="caption-line font-serif"
        >
          {cues[i].text}
        </p>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------- cards */

function TitleCard({
  data,
  onPlay,
}: {
  data: ExperienceData;
  onPlay: () => void;
}) {
  const meta = [data.dateText, data.locationText].filter(Boolean).join(" · ");
  return (
    <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-8 px-8 text-center animate-[titleIn_1200ms_var(--ease-keepsake)_both]">
      <div className="flex flex-col items-center gap-3">
        {data.tellerName && (
          <p className="small-caps text-cinema-text/70">{data.tellerName}</p>
        )}
        <h1 className="max-w-[16ch] font-serif text-[clamp(2rem,8vw,3.25rem)] font-medium leading-[1.12] text-cinema-text">
          {data.title}
        </h1>
        {meta && <p className="small-caps text-cinema-text/55">{meta}</p>}
      </div>
      <button
        type="button"
        onClick={onPlay}
        className="inline-flex min-h-[52px] items-center gap-3 rounded-full bg-accent-strong px-8 py-3 font-sans text-base font-medium text-paper shadow-soft transition-colors duration-300 ease-keepsake hover:bg-accent active:bg-accent-press"
      >
        <IconPlay />
        Play their story
      </button>
    </div>
  );
}

function ClosingCard({
  data,
  onReplay,
  onReact,
}: {
  data: ExperienceData;
  onReplay: () => void;
  onReact?: () => void;
}) {
  return (
    <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-7 px-8 text-center animate-[titleIn_1000ms_var(--ease-keepsake)_both]">
      {data.pullQuote && (
        <p className="max-w-[22ch] font-serif text-[clamp(1.5rem,6vw,2.25rem)] italic leading-snug text-cinema-text">
          “{data.pullQuote}”
        </p>
      )}
      <p className="small-caps text-cinema-text/70">
        Told by {data.tellerName ?? "someone who loves you"}
      </p>
      {onReact && (
        <button
          type="button"
          onClick={onReact}
          className="inline-flex min-h-[48px] items-center rounded-full bg-accent-strong px-7 py-3 font-sans text-base font-medium text-paper shadow-soft transition-colors duration-300 ease-keepsake hover:bg-accent active:bg-accent-press"
        >
          Leave a note
        </button>
      )}
      <button
        type="button"
        onClick={onReplay}
        className="font-sans text-sm text-cinema-text/70 underline-offset-4 hover:text-cinema-text hover:underline"
      >
        Play again
      </button>
    </div>
  );
}

/* --------------------------------------------------------- music picker sheet */

function MusicSheet({
  currentId,
  onPick,
  onClose,
}: {
  currentId: string | null;
  onPick: (id: string | null) => void;
  onClose: () => void;
}) {
  return (
    <div className="absolute inset-0 z-50 flex items-end" role="dialog" aria-label="Choose music">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-cinema/60"
      />
      <div className="relative w-full rounded-t-[20px] bg-cinema-raised px-5 pb-[calc(env(safe-area-inset-bottom)+20px)] pt-5 shadow-soft animate-[titleIn_400ms_var(--ease-keepsake)_both]">
        <p className="mb-3 font-sans text-sm text-cinema-text/60">Music</p>
        <ul className="flex flex-col">
          <MusicRow
            label="No music"
            active={currentId === null}
            onClick={() => onPick(null)}
          />
          {MUSIC_TRACKS.map((tk) => (
            <MusicRow
              key={tk.id}
              label={tk.title}
              active={currentId === tk.id}
              onClick={() => onPick(tk.id)}
            />
          ))}
        </ul>
      </div>
    </div>
  );
}

function MusicRow({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "flex w-full items-center justify-between rounded-button px-3 py-3 text-left font-sans text-base transition-colors duration-200",
          active ? "text-cinema-text" : "text-cinema-text/70 hover:text-cinema-text",
        )}
      >
        {label}
        {active && <IconCheck />}
      </button>
    </li>
  );
}

/* ------------------------------------------------------------------- icons */

function IconPlay() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function IconSound() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 9v6h4l5 4V5L8 9H4z" />
      <path d="M17 8a5 5 0 0 1 0 8" />
    </svg>
  );
}

function IconMuted() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 9v6h4l5 4V5L8 9H4z" />
      <path d="M22 9l-6 6M16 9l6 6" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

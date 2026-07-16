"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ExperienceSegment } from "@/lib/experience";

/**
 * The playback clock that drives the whole experience page (spec F7).
 *
 * Two modes, one interface:
 *  - Voice stories: a single <audio> plays each segment in order; the global
 *    time is `segment.start + audio.currentTime`. On a segment's end we advance
 *    to the next. This keeps captions and photos locked to the teller's voice.
 *  - Typed stories (no audio): a virtual wall-clock advances `t` at 1×, so a
 *    story with no recording still plays with synced captions and photos.
 *
 * `t` is the second-position on the global timeline; everything on screen reads
 * from it. Playback must be started by a user gesture (autoplay policy) — the
 * "Play their story" tap calls play().
 */

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export type Timeline = {
  t: number;
  playing: boolean;
  started: boolean;
  ended: boolean;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  seek: (t: number) => void;
  replay: () => void;
};

export function useTimeline(
  segments: ExperienceSegment[],
  totalS: number,
): Timeline {
  const hasAudio = segments.length > 0;

  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [started, setStarted] = useState(false);
  const [ended, setEnded] = useState(false);

  const tRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const segRef = useRef(0); // index of the currently loaded audio segment
  const vBaseRef = useRef(0); // virtual clock: t at the last (re)start
  const vStartRef = useRef(0); // virtual clock: performance.now() at that restart

  const setTime = useCallback((next: number) => {
    tRef.current = next;
    setT(next);
  }, []);

  const getAudio = useCallback(() => {
    if (!audioRef.current) {
      const a = new Audio();
      a.preload = "auto";
      audioRef.current = a;
    }
    return audioRef.current;
  }, []);

  const stopRaf = useCallback(() => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  }, []);

  const finish = useCallback(() => {
    stopRaf();
    audioRef.current?.pause();
    setPlaying(false);
    setEnded(true);
    setTime(totalS);
  }, [stopRaf, setTime, totalS]);

  // Point the audio element at segment i (idempotent).
  const loadSegment = useCallback(
    (i: number) => {
      const a = getAudio();
      if (a.getAttribute("data-seg") !== String(i)) {
        a.src = segments[i].url;
        a.setAttribute("data-seg", String(i));
        a.load();
      }
    },
    [getAudio, segments],
  );

  // Start the rAF clock. `step` references itself (a plain local const), which
  // keeps the recursion out of the callback's dependency graph.
  const startLoop = useCallback(() => {
    stopRaf();
    const step = () => {
      let next: number;
      if (hasAudio) {
        const a = audioRef.current;
        const seg = segments[segRef.current];
        next = seg.start + (a?.currentTime ?? 0);
      } else {
        next = vBaseRef.current + (performance.now() - vStartRef.current) / 1000;
      }
      if (next >= totalS) {
        finish();
        return;
      }
      setTime(next);
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
  }, [hasAudio, segments, totalS, finish, setTime, stopRaf]);

  // Advance to the next audio segment when one ends (or finish the story).
  const onSegmentEnded = useCallback(() => {
    const next = segRef.current + 1;
    if (next < segments.length) {
      segRef.current = next;
      loadSegment(next);
      setTime(segments[next].start);
      audioRef.current?.play().catch(() => {});
    } else {
      finish();
    }
  }, [segments, loadSegment, setTime, finish]);

  useEffect(() => {
    if (!hasAudio) return;
    const a = getAudio();
    a.addEventListener("ended", onSegmentEnded);
    return () => a.removeEventListener("ended", onSegmentEnded);
  }, [hasAudio, getAudio, onSegmentEnded]);

  const play = useCallback(() => {
    setStarted(true);
    setEnded(false);
    setPlaying(true);

    if (hasAudio) {
      const a = getAudio();
      loadSegment(segRef.current);
      const rel = Math.max(0, tRef.current - segments[segRef.current].start);
      const applyRel = () => {
        try {
          a.currentTime = rel;
        } catch {
          /* metadata not ready; will start from 0 */
        }
      };
      if (a.readyState >= 1) applyRel();
      else a.addEventListener("loadedmetadata", applyRel, { once: true });
      a.play().catch(() => {});
    } else {
      vBaseRef.current = tRef.current;
      vStartRef.current = performance.now();
    }

    startLoop();
  }, [hasAudio, getAudio, loadSegment, segments, startLoop]);

  const pause = useCallback(() => {
    setPlaying(false);
    stopRaf();
    if (hasAudio) audioRef.current?.pause();
    else vBaseRef.current = tRef.current; // freeze the virtual clock
  }, [hasAudio, stopRaf]);

  const toggle = useCallback(() => {
    if (playing) pause();
    else play();
  }, [playing, pause, play]);

  const seek = useCallback(
    (target: number) => {
      const to = clamp(target, 0, totalS);
      setEnded(false);
      setTime(to);

      if (hasAudio) {
        // Segment covering `to`, else the last one starting at/before it.
        let i = segments.findIndex(
          (s) => to >= s.start && to < s.start + s.duration,
        );
        if (i === -1) {
          i = segments.reduce(
            (acc, s, idx) => (s.start <= to ? idx : acc),
            0,
          );
        }
        segRef.current = i;
        const a = getAudio();
        a.src = segments[i].url;
        a.setAttribute("data-seg", String(i));
        a.load();
        const rel = Math.max(0, to - segments[i].start);
        a.addEventListener(
          "loadedmetadata",
          () => {
            try {
              a.currentTime = rel;
            } catch {
              /* ignore */
            }
          },
          { once: true },
        );
        if (playing) a.play().catch(() => {});
      } else if (playing) {
        vBaseRef.current = to;
        vStartRef.current = performance.now();
      }
    },
    [hasAudio, segments, totalS, getAudio, playing, setTime],
  );

  const replay = useCallback(() => {
    segRef.current = 0;
    setTime(0);
    setEnded(false);
    // Defer play so the reset settles, then start from the top.
    if (hasAudio) {
      const a = getAudio();
      a.src = segments[0].url;
      a.setAttribute("data-seg", "0");
      a.load();
    }
    setStarted(true);
    setPlaying(true);
    vBaseRef.current = 0;
    vStartRef.current = performance.now();
    if (hasAudio) getAudio().play().catch(() => {});
    startLoop();
  }, [hasAudio, getAudio, segments, setTime, startLoop]);

  // Clean up on unmount.
  useEffect(() => {
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      audioRef.current?.pause();
    };
  }, []);

  return { t, playing, started, ended, play, pause, toggle, seek, replay };
}

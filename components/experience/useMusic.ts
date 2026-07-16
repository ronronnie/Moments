"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * The music bed (spec F7): a looping instrumental routed through the Web Audio
 * API so it sits UNDER the voice, ducked ~-14dB, fading gently in and out.
 *
 * The graph (AudioContext → MediaElementSource → GainNode → destination) is
 * built lazily and unlocked from the user's first gesture, per autoplay policy.
 * `active` (playing & started & not ended) fades the bed in; clearing it or
 * muting fades it out. Same-origin files only, so MediaElementSource is untainted.
 */

const DUCK_GAIN = 0.2; // ≈ -14 dB — a bed, never a soundtrack
const FADE = 1.2; // seconds, ease constant for setTargetAtTime

type WebkitWindow = Window & { webkitAudioContext?: typeof AudioContext };

export function useMusic(url: string | null, active: boolean, muted: boolean) {
  const ctxRef = useRef<AudioContext | null>(null);
  const elRef = useRef<HTMLAudioElement | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const pauseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // (Re)create the media element when the chosen track changes.
  useEffect(() => {
    if (!url) {
      elRef.current?.pause();
      elRef.current = null;
      return;
    }
    const el = new Audio(url);
    el.loop = true;
    el.preload = "auto";
    elRef.current = el;
    return () => {
      el.pause();
      if (elRef.current === el) elRef.current = null;
    };
  }, [url]);

  // Build the audio graph once, on demand (must be inside a user gesture).
  const ensureGraph = useCallback(() => {
    const el = elRef.current;
    if (!el || ctxRef.current) return;
    const Ctx =
      window.AudioContext ?? (window as WebkitWindow).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const source = ctx.createMediaElementSource(el);
    const gain = ctx.createGain();
    gain.gain.value = 0;
    source.connect(gain).connect(ctx.destination);
    ctxRef.current = ctx;
    gainRef.current = gain;
  }, []);

  /** Call from the first Play gesture so iOS/Safari allow later playback. */
  const unlock = useCallback(() => {
    ensureGraph();
    ctxRef.current?.resume().catch(() => {});
  }, [ensureGraph]);

  useEffect(() => {
    const el = elRef.current;
    if (!el || !url) return;

    if (pauseTimer.current) {
      clearTimeout(pauseTimer.current);
      pauseTimer.current = null;
    }

    const ctx = ctxRef.current;
    const gain = gainRef.current;

    if (active && !muted) {
      ensureGraph();
      ctxRef.current?.resume().catch(() => {});
      el.play().catch(() => {});
      const g = gainRef.current;
      const c = ctxRef.current;
      if (g && c) {
        g.gain.cancelScheduledValues(c.currentTime);
        g.gain.setTargetAtTime(DUCK_GAIN, c.currentTime, FADE / 3);
      }
    } else {
      if (gain && ctx) {
        gain.gain.cancelScheduledValues(ctx.currentTime);
        gain.gain.setTargetAtTime(0, ctx.currentTime, FADE / 4);
      }
      // Pause the element only when the story isn't running (mute keeps position).
      if (!active) {
        pauseTimer.current = setTimeout(() => el.pause(), FADE * 1000);
      }
    }
  }, [active, muted, url, ensureGraph]);

  useEffect(() => {
    return () => {
      if (pauseTimer.current) clearTimeout(pauseTimer.current);
      ctxRef.current?.close().catch(() => {});
    };
  }, []);

  return { unlock };
}

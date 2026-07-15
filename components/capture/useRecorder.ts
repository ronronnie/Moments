"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

export type RecorderStatus = "idle" | "recording" | "paused";

export type RecordingResult = {
  file: File;
  durationS: number;
  mimeType: string;
};

type Options = {
  onComplete: (result: RecordingResult) => void;
  onError?: (message: string) => void;
  /** Auto-stop after this many seconds (soft cap; default 600 = 10 min). */
  maxSeconds?: number;
};

// Preference order. iOS Safari does NOT support audio/webm — it needs
// audio/mp4. We try Opus/WebM first (Chrome/Firefox/Android), then fall back.
const MIME_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4;codecs=mp4a.40.2",
  "audio/mp4",
  "audio/aac",
  "audio/ogg;codecs=opus",
];

function pickMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  for (const c of MIME_CANDIDATES) {
    try {
      if (MediaRecorder.isTypeSupported(c)) return c;
    } catch {
      // isTypeSupported can throw on some browsers — keep trying.
    }
  }
  return ""; // let the browser choose its default
}

function extensionFor(mime: string): string {
  if (mime.includes("webm")) return "webm";
  if (mime.includes("mp4")) return "mp4";
  if (mime.includes("aac")) return "aac";
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("wav")) return "wav";
  return "webm";
}

/**
 * MediaRecorder wrapped for the capture flow. Handles the iOS Safari quirks the
 * spec calls out: mime-type fallback and resuming the AudioContext on the user
 * gesture that starts recording (Safari starts it suspended). Also drives a
 * live input level for the "alive" meter, and enforces a soft max length.
 */
export function useRecorder({ onComplete, onError, maxSeconds = 600 }: Options) {
  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [elapsedS, setElapsedS] = useState(0);
  const [level, setLevel] = useState(0); // 0..1 input amplitude

  // Feature support, read SSR-safely: assume supported on the server so markup
  // matches, then resolve the real value on the client without an effect.
  const supported = useSyncExternalStore(
    () => () => {},
    () =>
      !!navigator.mediaDevices?.getUserMedia &&
      typeof MediaRecorder !== "undefined",
    () => true,
  );

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const mimeRef = useRef<string>("");
  const rafRef = useRef<number | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedMsRef = useRef(0);
  const lastResumeRef = useRef(0);

  const stopMeter = useCallback(() => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  }, []);

  const runMeter = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;
    const buf = new Uint8Array(analyser.fftSize);
    const loop = () => {
      analyser.getByteTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) {
        const v = (buf[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / buf.length);
      // Ease toward the new level so bars glide rather than jitter.
      setLevel((prev) => prev + (Math.min(1, rms * 2.2) - prev) * 0.35);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
  }, []);

  const startTimer = useCallback(() => {
    lastResumeRef.current = Date.now();
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = setInterval(() => {
      const total =
        elapsedMsRef.current + (Date.now() - lastResumeRef.current);
      setElapsedS(Math.floor(total / 1000));
      if (total / 1000 >= maxSeconds) {
        // Reach into stop via the ref-held recorder.
        const rec = recorderRef.current;
        if (rec && rec.state !== "inactive") rec.stop();
      }
    }, 250);
  }, [maxSeconds]);

  const pauseTimer = useCallback(() => {
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = null;
    elapsedMsRef.current += Date.now() - lastResumeRef.current;
  }, []);

  const teardown = useCallback(() => {
    stopMeter();
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    analyserRef.current = null;
    setLevel(0);
  }, [stopMeter]);

  const start = useCallback(async () => {
    if (!supported) {
      onError?.("Recording isn't supported on this browser. Type it instead.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // AudioContext for the level meter — resume on this user gesture (iOS).
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      const ctx = new Ctx();
      if (ctx.state === "suspended") await ctx.resume();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      source.connect(analyser);
      audioCtxRef.current = ctx;
      analyserRef.current = analyser;

      const mime = pickMimeType();
      mimeRef.current = mime;
      const recorder = new MediaRecorder(
        stream,
        mime ? { mimeType: mime } : undefined,
      );
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        pauseTimer();
        const type = mimeRef.current || recorder.mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type });
        const durationS = Math.max(
          1,
          Math.round(elapsedMsRef.current / 1000),
        );
        const file = new File(
          [blob],
          `segment-${Date.now()}.${extensionFor(type)}`,
          { type },
        );
        teardown();
        elapsedMsRef.current = 0;
        setElapsedS(0);
        setStatus("idle");
        onComplete({ file, durationS, mimeType: type });
      };

      elapsedMsRef.current = 0;
      setElapsedS(0);
      recorder.start();
      recorderRef.current = recorder;
      setStatus("recording");
      startTimer();
      runMeter();
    } catch (err) {
      teardown();
      setStatus("idle");
      const name = (err as Error)?.name;
      onError?.(
        name === "NotAllowedError"
          ? "Microphone access was blocked. You can type it instead."
          : "Couldn't start recording. You can type it instead.",
      );
    }
  }, [supported, onError, onComplete, pauseTimer, startTimer, runMeter, teardown]);

  const pause = useCallback(() => {
    const rec = recorderRef.current;
    if (rec && rec.state === "recording") {
      rec.pause();
      pauseTimer();
      stopMeter();
      setLevel(0);
      setStatus("paused");
    }
  }, [pauseTimer, stopMeter]);

  const resume = useCallback(() => {
    const rec = recorderRef.current;
    if (rec && rec.state === "paused") {
      rec.resume();
      startTimer();
      runMeter();
      setStatus("recording");
    }
  }, [startTimer, runMeter]);

  const stop = useCallback(() => {
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") rec.stop();
  }, []);

  // Clean up if the component unmounts mid-recording.
  useEffect(() => () => teardown(), [teardown]);

  return { status, elapsedS, level, supported, start, pause, resume, stop };
}

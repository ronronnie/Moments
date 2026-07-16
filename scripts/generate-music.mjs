// Generate 6 placeholder instrumental tracks for the experience page music bed.
//
// These are synthesized from scratch (soft sine-pad chords with slow attack /
// release) — no sampling, no third-party audio, so they are royalty-free by
// construction. They are deliberately quiet and featureless: a music BED that
// sits under the teller's voice, never competing with it. Swap for licensed
// tracks before launch if desired; the registry in lib/music.ts is the source
// of truth for what ships.
//
// Run: node scripts/generate-music.mjs   (writes public/music/*.wav)

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "public", "music");

const SAMPLE_RATE = 22050; // mono, plenty for a soft pad; keeps files small

// A2..C5-ish range, kept low so it never masks speech. Semitone → frequency.
const A2 = 110;
const freq = (semitonesFromA2) => A2 * 2 ** (semitonesFromA2 / 12);

// Each track: a slow chord progression. Numbers are semitone offsets from A2;
// each inner array is one chord (root + a couple of upper voices). Chords are
// ~7s each with a gentle swell, so consecutive chords breathe rather than click.
const TRACKS = [
  {
    id: "still-water",
    title: "Still water",
    // Am – F – C – G, warm and unhurried
    chords: [[0, 7, 12], [-4, 3, 8], [3, 10, 15], [-2, 5, 10]],
  },
  {
    id: "first-light",
    title: "First light",
    // C – G – Am – F, hopeful
    chords: [[3, 10, 15], [-2, 5, 12], [0, 7, 12], [-4, 3, 8]],
  },
  {
    id: "long-shadows",
    title: "Long shadows",
    // Dm – Am – Bb – F, tender / reflective
    chords: [[5, 12, 17], [0, 7, 12], [1, 8, 13], [-4, 3, 8]],
  },
  {
    id: "held-close",
    title: "Held close",
    // F – C – Dm – Bb, intimate
    chords: [[-4, 3, 8], [3, 10, 15], [5, 12, 17], [1, 8, 13]],
  },
  {
    id: "open-sky",
    title: "Open sky",
    // G – D – Em – C, expansive
    chords: [[-2, 5, 10], [5, 12, 17], [7, 14, 19], [3, 10, 15]],
  },
  {
    id: "evening-in",
    title: "Evening in",
    // Em – C – G – D, calm resolve
    chords: [[7, 14, 19], [3, 10, 15], [-2, 5, 10], [5, 12, 17]],
  },
];

const CHORD_S = 7; // seconds per chord
const LOOPS = 2; // repeat the progression twice → ~56s loop

// One chord rendered into `buffer` at sample offset `at`, additively.
function renderChord(buffer, at, semis) {
  const n = Math.floor(CHORD_S * SAMPLE_RATE);
  const attack = 1.4 * SAMPLE_RATE;
  const release = 2.0 * SAMPLE_RATE;
  for (let i = 0; i < n; i++) {
    // Amplitude envelope: slow swell in, slow fade out (breathing pad).
    let env;
    if (i < attack) env = i / attack;
    else if (i > n - release) env = (n - i) / release;
    else env = 1;
    env = Math.max(0, env) ** 1.5;

    const t = i / SAMPLE_RATE;
    let s = 0;
    for (let v = 0; v < semis.length; v++) {
      const f = freq(semis[v]);
      // Fundamental + a soft, quieter octave for warmth; tiny vibrato.
      const vib = 1 + 0.0015 * Math.sin(2 * Math.PI * 0.2 * t);
      s += Math.sin(2 * Math.PI * f * vib * t);
      s += 0.28 * Math.sin(2 * Math.PI * f * 2 * vib * t);
    }
    s /= semis.length * 1.28;
    buffer[at + i] += s * env;
  }
}

function renderTrack(chords) {
  const total = Math.floor(CHORD_S * chords.length * LOOPS * SAMPLE_RATE);
  const buf = new Float32Array(total);
  let at = 0;
  for (let loop = 0; loop < LOOPS; loop++) {
    for (const chord of chords) {
      renderChord(buf, at, chord);
      at += Math.floor(CHORD_S * SAMPLE_RATE);
    }
  }
  // Overall gentle fade at the very start/end so the loop seam is inaudible.
  const edge = Math.floor(0.5 * SAMPLE_RATE);
  for (let i = 0; i < edge; i++) {
    const g = i / edge;
    buf[i] *= g;
    buf[total - 1 - i] *= g;
  }
  return buf;
}

// Float32 [-1,1] → 16-bit PCM mono WAV.
function toWav(samples) {
  const gain = 0.5; // headroom: this is a bed, kept quiet
  const dataLen = samples.length * 2;
  const buf = Buffer.alloc(44 + dataLen);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + dataLen, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16); // PCM chunk size
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(SAMPLE_RATE, 24);
  buf.writeUInt32LE(SAMPLE_RATE * 2, 28); // byte rate
  buf.writeUInt16LE(2, 32); // block align
  buf.writeUInt16LE(16, 34); // bits per sample
  buf.write("data", 36);
  buf.writeUInt32LE(dataLen, 40);
  let o = 44;
  for (let i = 0; i < samples.length; i++) {
    const v = Math.max(-1, Math.min(1, samples[i] * gain));
    buf.writeInt16LE(Math.round(v * 32767), o);
    o += 2;
  }
  return buf;
}

mkdirSync(OUT_DIR, { recursive: true });
for (const track of TRACKS) {
  const samples = renderTrack(track.chords);
  const wav = toWav(samples);
  const file = join(OUT_DIR, `${track.id}.wav`);
  writeFileSync(file, wav);
  console.log(`wrote ${file} (${(wav.length / 1e6).toFixed(2)} MB)`);
}
console.log("done");

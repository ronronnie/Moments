/**
 * The bundled music beds offered on the experience page (spec F7).
 *
 * These ship in /public/music as self-synthesized, royalty-free instrumental
 * loops (see scripts/generate-music.mjs). They are a quiet BED under the
 * teller's voice — auto-ducked and mutable — never a soundtrack that competes
 * with the story. `stories.music_track_id` stores the chosen id; a null id (or
 * an unknown one) means no music. Keep this list in sync with the files.
 */

export type MusicTrack = {
  id: string;
  title: string;
  /** Public path under /public. Loop-friendly (seamless start/end). */
  src: string;
};

export const MUSIC_TRACKS: MusicTrack[] = [
  { id: "still-water", title: "Still water", src: "/music/still-water.wav" },
  { id: "first-light", title: "First light", src: "/music/first-light.wav" },
  { id: "long-shadows", title: "Long shadows", src: "/music/long-shadows.wav" },
  { id: "held-close", title: "Held close", src: "/music/held-close.wav" },
  { id: "open-sky", title: "Open sky", src: "/music/open-sky.wav" },
  { id: "evening-in", title: "Evening in", src: "/music/evening-in.wav" },
];

export function findMusicTrack(id: string | null | undefined): MusicTrack | null {
  if (!id) return null;
  return MUSIC_TRACKS.find((t) => t.id === id) ?? null;
}

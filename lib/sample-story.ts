import type { ExperienceData } from "@/lib/experience";

/**
 * A curated sample experience for the landing page — the front door leads with
 * a finished story, never with "record your memories" (spec §12: never let it be
 * mistaken for a journal). Typed/audio-less so it's self-contained (virtual
 * clock, no blobs), zero-photo so it shows the typographic experience, with a
 * bundled music bed. Not a real person's story — a small, invented moment.
 */
export const SAMPLE_STORY: ExperienceData = {
  storyId: "sample",
  title: "The bench by the harbour",
  tellerName: "A story",
  dateText: "Some years ago",
  locationText: null,
  occasion: null,
  pullQuote: "We didn’t say much. We didn’t need to.",
  version: "polished",
  titlePhoto: null,
  segments: [],
  totalS: 27,
  music: { id: "first-light", title: "First light", url: "/music/first-light.wav" },
  sections: [
    {
      id: "s1",
      start: 0,
      end: 9,
      photos: [],
      cues: [
        { text: "Every evening that summer, we walked down to the harbour.", start: 0, end: 3.6 },
        { text: "There was one bench we always went to,", start: 3.8, end: 6.2 },
        { text: "the paint worn soft where a hundred hands had rested.", start: 6.4, end: 8.8 },
      ],
    },
    {
      id: "s2",
      start: 9,
      end: 18,
      photos: [],
      cues: [
        { text: "We’d watch the boats come in, one after another,", start: 9, end: 12 },
        { text: "and the light go from gold to grey to almost nothing.", start: 12.2, end: 17.6 },
      ],
    },
    {
      id: "s3",
      start: 18,
      end: 27,
      photos: [],
      cues: [
        { text: "We didn’t say much.", start: 18, end: 20 },
        { text: "We didn’t need to.", start: 20.2, end: 22 },
        { text: "I’d give anything for one more evening on that bench.", start: 22.2, end: 26.6 },
      ],
    },
  ],
};

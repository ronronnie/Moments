import "server-only";

import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import {
  media,
  profiles,
  recordings,
  shareLinks,
  stories,
  storyVersions,
  type Section,
  type Word,
} from "@/db/schema";
import { findMusicTrack } from "@/lib/music";

/**
 * Everything the experience player (spec F7) needs to play one story, in a
 * single plain-serializable object handed from a server component to the client
 * <ExperiencePlayer>. Built for BOTH surfaces: the owner preview
 * (/story/[id]/preview) and the recipient view (/s/[token]). The recipient path
 * reaches it only through a validated share token — never direct table access
 * (standing rule 3). Blob URLs are handed over only after that authorization.
 */

// One caption unit shown on screen at a time. For the EXACT version these are
// short phrases synced to the teller's real words; for the POLISHED version
// (whose words don't map 1:1 to the audio) it's one cue per section, crossfading
// at the section boundary. `start`/`end` are seconds on the global timeline.
export type ExperienceCue = { text: string; start: number; end: number };

export type ExperiencePhoto = { url: string; caption: string | null };

export type ExperienceSection = {
  id: string;
  start: number;
  end: number;
  cues: ExperienceCue[];
  photos: ExperiencePhoto[];
};

// One playable audio blob and where it sits on the global timeline. Segments
// play sequentially; global time = segment.start + <audio>.currentTime. Empty
// array => an audio-less (typed) story, driven by a virtual clock instead.
export type ExperienceSegment = { url: string; start: number; duration: number };

export type ExperienceData = {
  storyId: string;
  title: string;
  tellerName: string | null;
  dateText: string | null;
  locationText: string | null;
  occasion: string | null;
  pullQuote: string | null;
  version: "exact" | "polished";
  titlePhoto: ExperiencePhoto | null;
  sections: ExperienceSection[];
  segments: ExperienceSegment[];
  totalS: number;
  music: { id: string; title: string; url: string } | null;
};

const SYNTH_WORD_S = 0.42; // mirror story-version.ts: typed words share the clock

type TimelineRow = typeof recordings.$inferSelect;

/**
 * Flatten every recording into one continuous word timeline plus the playable
 * audio segments. Voice timings are offset by the cumulative duration of prior
 * segments; typed segments get synthetic timing so the whole story shares one
 * clock (identical logic to generateVersions, so cues line up with sections).
 */
function buildTimeline(rows: TimelineRow[]): {
  words: Word[];
  segments: ExperienceSegment[];
  totalS: number;
} {
  const words: Word[] = [];
  const segments: ExperienceSegment[] = [];
  let offset = 0;

  for (const r of rows) {
    const segStart = offset;
    let segDur = 0;

    if (r.wordsJson && r.wordsJson.length > 0) {
      for (const w of r.wordsJson) {
        words.push({
          w: w.w,
          start: +(w.start + offset).toFixed(2),
          end: +(w.end + offset).toFixed(2),
          conf: w.conf,
        });
      }
      const last = r.wordsJson[r.wordsJson.length - 1];
      segDur = r.durationS ?? last.end;
    } else if (r.transcriptText?.trim()) {
      const toks = r.transcriptText.trim().split(/\s+/);
      toks.forEach((t, i) =>
        words.push({
          w: t,
          start: +(offset + i * SYNTH_WORD_S).toFixed(2),
          end: +(offset + (i + 1) * SYNTH_WORD_S - 0.06).toFixed(2),
        }),
      );
      segDur = toks.length * SYNTH_WORD_S;
    } else if (r.audioPath) {
      // Audio with no transcript (transcription failed) — still play it.
      segDur = r.durationS ?? 0;
    } else {
      continue; // nothing usable in this row
    }

    if (r.audioPath) {
      segments.push({
        url: r.audioPath,
        start: +segStart.toFixed(2),
        duration: +segDur.toFixed(2),
      });
    }
    offset += segDur;
  }

  return { words, segments, totalS: +offset.toFixed(2) };
}

// Break a section's verbatim words into short, readable phrases (EXACT sync).
// Prefer clause/sentence punctuation; cap length so nothing runs past ~one
// comfortable line. Never per-word — captions read like candlelight, not karaoke.
function phrasesFromWords(words: Word[]): ExperienceCue[] {
  const cues: ExperienceCue[] = [];
  let cur: Word[] = [];
  const flush = () => {
    if (cur.length === 0) return;
    cues.push({
      text: cur.map((w) => w.w).join(" "),
      start: cur[0].start,
      end: cur[cur.length - 1].end,
    });
    cur = [];
  };
  for (const w of words) {
    cur.push(w);
    const breaks = /[.!?…]$/.test(w.w);
    const softBreak = /[,;:]$/.test(w.w);
    if ((breaks && cur.length >= 3) || (softBreak && cur.length >= 6) || cur.length >= 9) {
      flush();
    }
  }
  flush();
  return cues;
}

function buildSections(
  sections: Section[],
  words: Word[],
  version: "exact" | "polished",
  photosBySection: Map<string, ExperiencePhoto[]>,
  totalS: number,
): ExperienceSection[] {
  return sections.map((s, i) => {
    const start = s.start_s ?? 0;
    const end = s.end_s ?? (i < sections.length - 1 ? sections[i + 1].start_s ?? totalS : totalS);
    const photos = photosBySection.get(s.id) ?? [];

    let cues: ExperienceCue[];
    if (version === "polished") {
      // Polished words don't map to the audio — crossfade whole section text.
      cues = s.text.trim()
        ? [{ text: s.text.trim(), start, end }]
        : [];
    } else {
      const inRange = words.filter((w) => w.start >= start - 0.001 && w.start < end - 0.001);
      cues = phrasesFromWords(inRange);
      // Fallback: if word filtering produced nothing (e.g. rounding), show the
      // section text as a single cue so a section never plays blank.
      if (cues.length === 0 && s.text.trim()) {
        cues = [{ text: s.text.trim(), start, end }];
      }
    }

    return { id: s.id, start: +start.toFixed(2), end: +end.toFixed(2), cues, photos };
  });
}

type StoryRow = typeof stories.$inferSelect;

/** Shared assembly once ownership/token has been authorized by the caller. */
async function assemble(story: StoryRow): Promise<ExperienceData | null> {
  const version = story.selectedVersion ?? "exact";

  const [versionRow] = await db
    .select()
    .from(storyVersions)
    .where(and(eq(storyVersions.storyId, story.id), eq(storyVersions.kind, version)));
  // Fall back to whichever version exists if the selected one is missing.
  const sectionsJson: Section[] =
    versionRow?.sectionsJson ??
    (
      await db
        .select()
        .from(storyVersions)
        .where(eq(storyVersions.storyId, story.id))
    )[0]?.sectionsJson ??
    [];

  if (sectionsJson.length === 0) return null; // nothing to play yet

  const recordingRows = await db
    .select()
    .from(recordings)
    .where(eq(recordings.storyId, story.id))
    .orderBy(asc(recordings.segmentIndex));

  const { words, segments, totalS } = buildTimeline(recordingRows);

  const mediaRows = await db
    .select()
    .from(media)
    .where(eq(media.storyId, story.id))
    .orderBy(asc(media.position));

  const photosBySection = new Map<string, ExperiencePhoto[]>();
  for (const m of mediaRows) {
    if (!m.sectionId) continue;
    const list = photosBySection.get(m.sectionId) ?? [];
    list.push({ url: m.storagePath, caption: m.caption });
    photosBySection.set(m.sectionId, list);
  }
  const titlePhoto: ExperiencePhoto | null = mediaRows[0]
    ? { url: mediaRows[0].storagePath, caption: mediaRows[0].caption }
    : null;

  const sections = buildSections(sectionsJson, words, version, photosBySection, totalS);

  // A polished/typed story with no audio still has a duration from cues; a story
  // with audio uses the segment timeline. Cap total to whatever the last cue ends.
  const lastCueEnd = sections.reduce(
    (max, s) => s.cues.reduce((m, c) => Math.max(m, c.end), max),
    0,
  );
  const duration = Math.max(totalS, lastCueEnd, sections.at(-1)?.end ?? 0);

  const [profile] = await db
    .select({ displayName: profiles.displayName })
    .from(profiles)
    .where(eq(profiles.id, story.ownerId));

  const track = findMusicTrack(story.musicTrackId);

  return {
    storyId: story.id,
    title: (versionRow?.title ?? story.title ?? "").trim() || "Untitled story",
    tellerName: profile?.displayName ?? null,
    dateText: story.storyDateText,
    locationText: story.locationText,
    occasion: story.occasion,
    pullQuote: versionRow?.pullQuote ?? null,
    version,
    titlePhoto,
    sections,
    segments,
    totalS: +duration.toFixed(2),
    music: track ? { id: track.id, title: track.title, url: track.src } : null,
  };
}

/** Owner preview: authorize by ownership, then assemble. */
export async function getExperienceForOwner(
  storyId: string,
  ownerId: string,
): Promise<ExperienceData | null> {
  const [story] = await db
    .select()
    .from(stories)
    .where(and(eq(stories.id, storyId), eq(stories.ownerId, ownerId)));
  if (!story) return null;
  return assemble(story);
}

/**
 * Recipient view: authorize by a valid, un-revoked share token, then assemble.
 * No account, no owner scoping — token possession is the grant (standing rule 3).
 * View-count / notifications are wired in Prompt 7; this loader is read-only.
 */
export async function getExperienceByToken(
  token: string,
): Promise<ExperienceData | null> {
  const [link] = await db
    .select({ storyId: shareLinks.storyId })
    .from(shareLinks)
    .where(and(eq(shareLinks.token, token), isNull(shareLinks.revokedAt)));
  if (!link) return null;

  const [story] = await db.select().from(stories).where(eq(stories.id, link.storyId));
  if (!story) return null;
  return assemble(story);
}

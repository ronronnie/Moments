import {
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Data model — section 8 of moments-product-spec.md.
 *
 * Auth is Clerk, so an "owner" is a Clerk user id (text like "user_2ab…"),
 * NOT a Postgres auth uuid. There is no Postgres RLS here (that was a Supabase
 * feature): ownership is enforced in the server layer — every query is scoped
 * to the signed-in user's id. Recipient access to a shared story never touches
 * these tables directly; it goes through a server route that validates a token.
 */

/* ---------------------------------------------------------------- enums */
export const storyStatus = pgEnum("story_status", ["draft", "ready", "shared"]);
export const versionKind = pgEnum("version_kind", ["exact", "polished"]);
export const recordingSource = pgEnum("recording_source", [
  "initial",
  "followup",
]);
export const questionStatus = pgEnum("question_status", [
  "pending",
  "answered",
  "skipped",
]);
export const mediaType = pgEnum("media_type", ["photo", "clip"]);
export const reactionKind = pgEnum("reaction_kind", ["text", "emoji", "voice"]);

/* ------------------------------------------------------------- profiles */
export const profiles = pgTable("profiles", {
  // = Clerk user id. Upserted on first sign-in.
  id: text("id").primaryKey(),
  displayName: text("display_name"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/* -------------------------------------------------------------- stories */
// Confirmed extracted context (spec §4 step 4). Every field is a SUGGESTION the
// user confirmed — never auto-saved. timeframe/occasion/first place are also
// mirrored to the dedicated columns for the experience-page title card.
export type StoryContext = {
  people?: string[];
  places?: string[];
  timeframe?: string;
  occasion?: string;
  emotionalTone?: string;
  notableObjects?: string[];
};

export const stories = pgTable("stories", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: text("owner_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  title: text("title"),
  status: storyStatus("status").notNull().default("draft"),
  occasion: text("occasion"),
  storyDateText: text("story_date_text"),
  locationText: text("location_text"),
  selectedVersion: versionKind("selected_version"),
  musicTrackId: text("music_track_id"),
  contextJson: jsonb("context_json").$type<StoryContext>(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (t) => [index("stories_owner_id_idx").on(t.ownerId)]);

/* ------------------------------------------------------------ questions */
// Defined before recordings because recordings.question_id references it.
export const questions = pgTable("questions", {
  id: uuid("id").primaryKey().defaultRandom(),
  storyId: uuid("story_id")
    .notNull()
    .references(() => stories.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
  status: questionStatus("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (t) => [index("questions_story_id_idx").on(t.storyId)]);

/* ----------------------------------------------------------- recordings */
export type Word = { w: string; start: number; end: number; conf?: number };

export const recordings = pgTable("recordings", {
  id: uuid("id").primaryKey().defaultRandom(),
  storyId: uuid("story_id")
    .notNull()
    .references(() => stories.id, { onDelete: "cascade" }),
  segmentIndex: integer("segment_index").notNull().default(0),
  // Vercel Blob pathname for the original audio (never public).
  audioPath: text("audio_path"),
  durationS: numeric("duration_s", { mode: "number" }),
  transcriptText: text("transcript_text"),
  wordsJson: jsonb("words_json").$type<Word[]>(),
  source: recordingSource("source").notNull().default("initial"),
  questionId: uuid("question_id").references(() => questions.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (t) => [index("recordings_story_id_idx").on(t.storyId)]);

/* ------------------------------------------------------- story_versions */
export type Section = {
  id: string;
  text: string;
  start_s?: number;
  end_s?: number;
  media_ids?: string[];
};

export const storyVersions = pgTable("story_versions", {
  id: uuid("id").primaryKey().defaultRandom(),
  storyId: uuid("story_id")
    .notNull()
    .references(() => stories.id, { onDelete: "cascade" }),
  kind: versionKind("kind").notNull(),
  title: text("title"),
  pullQuote: text("pull_quote"),
  sectionsJson: jsonb("sections_json").$type<Section[]>(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (t) => [
  index("story_versions_story_id_idx").on(t.storyId),
  // One row per (story, kind) — prevents duplicates when generation races.
  unique("story_versions_story_kind_uq").on(t.storyId, t.kind),
]);

/* ---------------------------------------------------------------- media */
export const media = pgTable("media", {
  id: uuid("id").primaryKey().defaultRandom(),
  storyId: uuid("story_id")
    .notNull()
    .references(() => stories.id, { onDelete: "cascade" }),
  type: mediaType("type").notNull().default("photo"),
  // Vercel Blob pathname (never public); served via signed/gated server route.
  storagePath: text("storage_path").notNull(),
  caption: text("caption"),
  position: integer("position").notNull().default(0),
  // References a section id inside story_versions.sections_json (not a FK).
  sectionId: text("section_id"),
  exifDatetime: timestamp("exif_datetime", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (t) => [index("media_story_id_idx").on(t.storyId)]);

/* ---------------------------------------------------------- share_links */
export const shareLinks = pgTable("share_links", {
  id: uuid("id").primaryKey().defaultRandom(),
  storyId: uuid("story_id")
    .notNull()
    .references(() => stories.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  viewCount: integer("view_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (t) => [index("share_links_story_id_idx").on(t.storyId)]);

/* ------------------------------------------------------------ reactions */
export const reactions = pgTable("reactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  storyId: uuid("story_id")
    .notNull()
    .references(() => stories.id, { onDelete: "cascade" }),
  shareLinkId: uuid("share_link_id").references(() => shareLinks.id, {
    onDelete: "cascade",
  }),
  kind: reactionKind("kind").notNull(),
  body: text("body"),
  audioPath: text("audio_path"),
  timestampOffsetS: numeric("timestamp_offset_s", { mode: "number" }),
  reactorName: text("reactor_name"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (t) => [
  index("reactions_story_id_idx").on(t.storyId),
  index("reactions_share_link_id_idx").on(t.shareLinkId),
]);

CREATE TYPE "public"."media_type" AS ENUM('photo', 'clip');--> statement-breakpoint
CREATE TYPE "public"."question_status" AS ENUM('pending', 'answered', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."reaction_kind" AS ENUM('text', 'emoji', 'voice');--> statement-breakpoint
CREATE TYPE "public"."recording_source" AS ENUM('initial', 'followup');--> statement-breakpoint
CREATE TYPE "public"."story_status" AS ENUM('draft', 'ready', 'shared');--> statement-breakpoint
CREATE TYPE "public"."version_kind" AS ENUM('exact', 'polished');--> statement-breakpoint
CREATE TABLE "media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"story_id" uuid NOT NULL,
	"type" "media_type" DEFAULT 'photo' NOT NULL,
	"storage_path" text NOT NULL,
	"caption" text,
	"position" integer DEFAULT 0 NOT NULL,
	"section_id" text,
	"exif_datetime" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"display_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"story_id" uuid NOT NULL,
	"text" text NOT NULL,
	"status" "question_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"story_id" uuid NOT NULL,
	"share_link_id" uuid,
	"kind" "reaction_kind" NOT NULL,
	"body" text,
	"audio_path" text,
	"timestamp_offset_s" numeric,
	"reactor_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recordings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"story_id" uuid NOT NULL,
	"segment_index" integer DEFAULT 0 NOT NULL,
	"audio_path" text,
	"duration_s" numeric,
	"transcript_text" text,
	"words_json" jsonb,
	"source" "recording_source" DEFAULT 'initial' NOT NULL,
	"question_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "share_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"story_id" uuid NOT NULL,
	"token" text NOT NULL,
	"revoked_at" timestamp with time zone,
	"view_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "share_links_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "stories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"title" text,
	"status" "story_status" DEFAULT 'draft' NOT NULL,
	"occasion" text,
	"story_date_text" text,
	"location_text" text,
	"selected_version" "version_kind",
	"music_track_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "story_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"story_id" uuid NOT NULL,
	"kind" "version_kind" NOT NULL,
	"title" text,
	"pull_quote" text,
	"sections_json" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reactions" ADD CONSTRAINT "reactions_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reactions" ADD CONSTRAINT "reactions_share_link_id_share_links_id_fk" FOREIGN KEY ("share_link_id") REFERENCES "public"."share_links"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recordings" ADD CONSTRAINT "recordings_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recordings" ADD CONSTRAINT "recordings_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_links" ADD CONSTRAINT "share_links_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stories" ADD CONSTRAINT "stories_owner_id_profiles_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_versions" ADD CONSTRAINT "story_versions_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "media_story_id_idx" ON "media" USING btree ("story_id");--> statement-breakpoint
CREATE INDEX "questions_story_id_idx" ON "questions" USING btree ("story_id");--> statement-breakpoint
CREATE INDEX "reactions_story_id_idx" ON "reactions" USING btree ("story_id");--> statement-breakpoint
CREATE INDEX "reactions_share_link_id_idx" ON "reactions" USING btree ("share_link_id");--> statement-breakpoint
CREATE INDEX "recordings_story_id_idx" ON "recordings" USING btree ("story_id");--> statement-breakpoint
CREATE INDEX "share_links_story_id_idx" ON "share_links" USING btree ("story_id");--> statement-breakpoint
CREATE INDEX "stories_owner_id_idx" ON "stories" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "story_versions_story_id_idx" ON "story_versions" USING btree ("story_id");
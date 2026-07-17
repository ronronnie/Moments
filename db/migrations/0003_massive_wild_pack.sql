CREATE TYPE "public"."event_name" AS ENUM('recording_started', 'recording_completed', 'question_answered', 'preview_reached', 'shared', 'recipient_viewed', 'recipient_completed', 'reaction_left', 'second_story_started');--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" "event_name" NOT NULL,
	"story_id" uuid,
	"owner_id" text,
	"meta" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "events_name_idx" ON "events" USING btree ("name");--> statement-breakpoint
CREATE INDEX "events_story_id_idx" ON "events" USING btree ("story_id");
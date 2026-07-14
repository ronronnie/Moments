# Moments — Product Specification (MVP)

**Product name:** Moments
**Version:** 1.0 — MVP build spec
**One-line definition:** Log stories, let others experience them.

---

## 1. What this product is (and is not)

Moments lets a person tell a meaningful memory in their own voice, then turns it into a **story experience** — a private web page where a recipient hears the teller's real voice while photos, synced captions, and music unfold with the story.

**Core promise:** Turn a moment you remember into a story someone else can experience.

**This product is NOT:**
- A journal or diary (no streaks, no calendars, no daily prompts, no "entries")
- A video generation app (no AI-generated video, no render pipeline in MVP)
- A social network (no feed, no likes, no followers, no public discovery)

Every story has a **teller** and an intended **receiver**. That relationship is the product.

---

## 2. The core architectural decision

**The output is a living web page, not a video file.**

The "experience" is a private link that plays the teller's original voice over their photos with subtle motion (Ken Burns-style pan/zoom), word-synced captions, and a music bed. Built with HTML/CSS/JS playback — no video rendering, no render queue, no AI video models.

Why:
- Cost: pennies per story (transcription + LLM only) vs. dollars for video generation
- Speed: instant preview, no waiting on renders
- Authenticity: the teller's real voice and real photos are the emotional core
- Intimacy: recipients can react inline at the exact moment that moved them
- MP4 export becomes a premium feature later, not the product

---

## 3. Target user and primary use case

**MVP audience:** an adult with one specific memory in mind and one specific person (or small circle) to share it with, usually tied to an occasion — a parent's birthday, how-we-met for an anniversary, preserving a grandparent's story, a memorial, a child's milestone.

Do not design for "build your life archive." Design for **one story, one recipient, one occasion.**

---

## 4. User journey

### Creator flow
1. **Start** — Primary CTA: "Tell a story." Prompt: *"What is the moment you want to remember?"* User enters a working title (e.g., "The day my daughter was born").
2. **Tell it** — Voice recording (recommended, hero option) or typing (fallback). Supportive copy: *"Tell it however you remember it. You can refine it later."* Supports pause/resume, multiple segments, save draft.
3. **The interviewer** — After the first recording, the app asks up to 3 context-aware follow-up questions (sensory detail, emotion, dialogue, why it matters). Answer by voice or text, skip, or swap the question. Answers become additional recording segments.
4. **Confirm context** — App suggests extracted details (people, place, timeframe, occasion, tone) as *suggestions* the user confirms or corrects. Never treated as facts without confirmation.
5. **Add photos** — Native OS photo picker (file input → iOS Photos sheet / Android Photo Picker). Photos/short clips optional; the story must work with zero photos (typographic + caption-driven experience).
6. **Review the story** — App presents a structured draft: suggested title, sections, pull-quote. User chooses **"Keep my exact words"** (verbatim, filler optionally removed) or **"Polish into a story"** (structure and clarity improved; meaning, tone, and personality preserved). Full manual editing always available.
7. **Preview the experience** — User watches the story page exactly as a recipient would. Can reorder photos, change section-photo assignments, pick a music track, edit captions, adjust title/closing card.
8. **Share** — Generate a private, revocable link. Copy link / share via messaging apps. Story stays private by default; no public option in MVP.

### Recipient flow
1. Opens link — **no account, no app install required.** Mobile-first page.
2. Watches/listens to the story experience (voice + photos + captions + music, with progress bar).
3. At the end (or at any moment via a "react here" affordance): leave a written message, an emoji reaction pinned to a timestamp, or record a voice reply.
4. Soft CTA after reacting: *"Have a story of your own to tell?"* → sign-up. This is the growth loop. No other acquisition mechanics in MVP.
5. Creator gets notified (email) when the story is viewed and when a reaction arrives.

---

## 5. Functional requirements

### F1 — Auth & accounts
- Email magic-link sign-in (Supabase Auth). No passwords in MVP.
- Recipients never need accounts to view or react.

### F2 — Story capture
- Browser voice recording via MediaRecorder API; mobile Safari and Chrome for Android must both work.
- Multiple recording segments per story; pause/resume; re-record a segment; max ~10 min total audio.
- Text input as alternative at every point voice is offered.
- Autosave drafts; resume from any device.

### F3 — Transcription
- Server-side transcription with **word-level timestamps** (required for caption sync). Deepgram Nova (or Whisper API + alignment) on audio upload.
- Original audio always preserved untouched.
- Transcript editable by user; low-confidence words flagged.

### F4 — Guided interviewer (AI)
- Generates up to 3 follow-up questions from the transcript. Never asks about details already given.
- Question style: warm, specific, one sentence. Focus areas: what happened just before, sensory detail, what someone said, what the teller felt, why it still matters.
- User can skip or request a different question. Answers append as new segments and are re-transcribed.

### F5 — Story structuring (AI)
- Splits the full transcript into 3–6 sections (word-index boundaries into the timestamp data).
- Suggests a title and one pull-quote.
- Produces two versions: **exact** (verbatim; optional filler-word removal only) and **polished** (rewritten for clarity in first person; must not invent facts, dialogue, people, places, or events; must preserve idiom and personality).
- User selects a version and can edit any text manually.

### F6 — Media
- Photo/short-video upload through the native OS picker (`<input type="file" accept="image/*,video/*" multiple>`).
- Reorder, remove, caption; assign photos to story sections (AI suggests assignment from captions/EXIF datetime; user confirms).
- Client-side image compression before upload. Stories with zero photos must still produce a beautiful experience.

### F7 — The experience page (the product's heart)
- Timeline engine driven by the voice audio: word-synced captions rendered from timestamps; photos crossfade per section with slow pan/zoom; title card opens, closing card ends.
- Music bed from ~6 bundled licensed/CC0 instrumental tracks, auto-ducked under voice (Web Audio API gain).
- Tap to pause/resume; scrub bar; works beautifully on a phone held vertically; graceful with 0 photos.
- Loads fast on mobile data (compressed images, audio streaming).

### F8 — Sharing, reactions, notifications
- Revocable tokenized links (`/s/{token}`); owner can revoke or regenerate at any time; view count visible to owner.
- Reactions: text message, emoji pinned to a timestamp, or recorded voice reply (max 60s). No account required.
- Email notifications to the owner on first view and on each reaction.
- Owner can delete a story → cascades to all audio, media, transcripts, links, reactions (hard delete from storage).

---

## 6. Non-functional requirements

- **Private by default.** Nothing is ever public. Signed URLs for all media; share tokens are unguessable and revocable.
- **Mobile-first.** The entire creator flow must be comfortable one-handed on a phone.
- **Trust rules for AI:** never invent facts, dialogue, people, or events; all extracted context is labeled as a suggestion; polished text is clearly a rewrite the user approves; no voice cloning; no generating deceased people saying things they never said.
- **Sensitive stories:** no pressure-to-share mechanics anywhere; deletion is complete and immediate.
- **Cost target:** < $0.15 in API costs per completed story.

---

## 7. Tech stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js (App Router) + TypeScript | Single codebase, mobile web first |
| Styling | Tailwind CSS | Warm, calm visual language |
| Hosting | Vercel | Edge-friendly, easy previews |
| DB / Auth / Storage | Supabase (Postgres, magic-link auth, Storage buckets, RLS) | Signed URLs for media |
| Transcription | Deepgram (word timestamps) or OpenAI Whisper | Word-level timing is a hard requirement |
| LLM | Claude API (Sonnet) | Interviewer, extraction, structuring, polishing |
| Audio capture | MediaRecorder API | Test Safari iOS quirks early |
| Music | 6 bundled licensed/CC0 tracks | No music generation in MVP |
| Email | Resend (or Supabase SMTP) | View + reaction notifications |
| Payments | Stripe (deferred, post-validation) | Pay-per-story or export unlock later |

---

## 8. Data model

```
profiles        id (=auth.users.id), display_name, created_at
stories         id, owner_id, title, status(draft|ready|shared), occasion,
                story_date_text, location_text, selected_version(exact|polished),
                music_track_id, created_at, updated_at
recordings      id, story_id, segment_index, audio_path, duration_s,
                transcript_text, words_json[{w, start, end, conf}],
                source(initial|followup), question_id?
questions       id, story_id, text, status(pending|answered|skipped)
story_versions  id, story_id, kind(exact|polished), title, pull_quote,
                sections_json[{id, text, start_s, end_s, media_ids[]}]
media           id, story_id, type(photo|clip), storage_path, caption,
                position, section_id?, exif_datetime?
share_links     id, story_id, token(unique), revoked_at?, view_count
reactions       id, story_id, share_link_id, kind(text|emoji|voice),
                body?, audio_path?, timestamp_offset_s?, reactor_name?, created_at
```

RLS: owners have full access to their rows. Anonymous recipient access is served through server routes that validate the share token — never direct table access.

---

## 9. Out of scope for MVP (explicitly)

Video file export/rendering · AI video or animation generation · native iOS/Android apps · public feed, likes, follows, comments · daily prompts, streaks, mood tracking, calendars · story requests ("Dad, tell me about…") · multi-person collaborative stories · collections/albums · voice cloning · avatars · printed books · monetization.

Story requests, native app (which unlocks auto-suggesting photos from the OS library by story date/location), collections, and MP4 export are the v2 roadmap, in roughly that order.

---

## 10. Product language

Use: story, moment, memory, keepsake, "tell your story," "bring it to life," "share privately."
Never use: journal, entry, log, post, content, AI output, generate, followers, streak.
AI works in the background; the interface talks about storytelling, never about technology.

---

## 11. Success metrics

**North star:** completed stories shared with at least one recipient.

Supporting: recording completion rate · % answering ≥1 follow-up question · preview-reached rate · share rate of completed stories · recipient watch-to-end rate · reaction rate · **second-story rate** (the single strongest signal) · % saying the story accurately represents their memory.

**Validation bar:** a user completes a story, shares it, receives a real response, and starts another. Compliments alone don't count.

---

## 12. Key risks & mitigations

| Risk | Mitigation |
|---|---|
| One-and-done novelty | Occasion-based prompts at re-entry; measure second-story rate honestly |
| Output feels generic | Real voice + real photos are the core; restraint in polish; user approves everything |
| Privacy hesitation | Private by default, revocable links, visible delete-everything |
| Mistaken for a journal | Lead marketing and onboarding with a finished story experience, never with "record your memories" |
| Safari audio quirks | Spike MediaRecorder on iOS in week 1, before anything else |

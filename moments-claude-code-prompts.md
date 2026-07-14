# Moments — Claude Code Build Prompts

How to use: place `moments-product-spec.md` in your project root first. Then paste these prompts into Claude Code **one phase at a time**, in order. Review and test each phase before moving on. Phase 6 (the experience page) is the product — budget the most iteration time there.

---

## Prompt 0 — Project kickoff

```
Read moments-product-spec.md in the project root. This is the full product
spec — treat it as the source of truth for everything we build.

Set up a new project:
- Next.js (App Router) + TypeScript + Tailwind CSS
- Supabase client (auth, database, storage) with env vars in .env.local.example
- Mobile-first: every page designed for a vertically held phone first

Create a CLAUDE.md capturing these standing rules:
1. This is NOT a journal app and NOT a video generator. The output is a living
   web "experience page," never a rendered video file.
2. Product language: story, moment, memory, keepsake. Never: journal, entry,
   post, content, generate, AI.
3. Private by default. All media behind signed URLs. Recipients access stories
   only via server routes that validate a share token.
4. AI never invents facts, dialogue, people, places, or events. Extracted
   details are suggestions until the user confirms them.
5. Design is a first-class requirement, not a polish step. Every screen must
   follow the design system from Prompt 0.5 (tokens in tailwind.config +
   /components/ui). Benchmark: a beautifully typeset hardcover book. Anti-
   benchmark: a SaaS dashboard.

Scaffold the route structure only (empty pages): / (landing), /new (create),
/stories (my stories), /story/[id] (edit/preview), /s/[token] (recipient view).
```

## Prompt 0.5 — Design system & art direction (do this before any feature)

```
Establish the design system before building features. Moments must look
like it was art-directed by a seasoned editorial designer. The reference
feeling is a hardcover keepsake book and a quiet cinema — not an app.

TYPOGRAPHY
- Display & story text: "Fraunces" (Google Fonts), optical sizing enabled.
  Titles 500–600 weight; story text 400–450. This face carries the product's
  personality — use it for anything the teller wrote or said.
- UI chrome: "Inter" for labels, buttons, meta text only. Never for story
  content. Exactly two typefaces in the whole app, no weights under 400.
- Story text is the hero: 28–34px on mobile during playback, line-height
  1.4, max measure ~24ch for playback captions, ~60ch for reading/editing.

COLOR — "paper & ink"
- Creation flow (light): ivory #FAF7F2 surfaces, warm ink #211D18 text,
  hairline borders #E8E1D6. Never pure #FFF or #000 anywhere.
- Playback (experience page) is CINEMATIC DARK: near-black #121110 with a
  warm undertone, story text #F5EFE6. When play begins, all chrome fades
  out — the story owns the screen.
- One accent only: terracotta #C4643B, reserved for the primary action.
  Muted semantic colors (sage success, clay error). No decorative gradients,
  no glassmorphism.

SPACING & LAYOUT
- 4px base grid, minimum 24px gutters on mobile, screens must breathe.
- ONE primary action per screen: full-width warm button in thumb reach.
  Secondary actions are quiet text links, never competing buttons.
- Cards: 24px+ padding, 16px radius, hairline border, at most one soft
  shadow tier.

MOTION — where the keepsake feel lives
- Slow and deliberate: 300–500ms UI transitions, 800–1200ms story
  transitions, ease-out cubic-bezier(0.22, 1, 0.36, 1). Nothing bouncy or
  springy, ever.
- The record button breathes (subtle 4s scale pulse) at rest and ripples
  softly while recording — it should feel alive, not mechanical.
- Page transitions: crossfade + 8px rise. Full prefers-reduced-motion
  support (swap all motion for opacity fades).

VOICE & MICROCOPY
- Warm, plain, human. "Listening to your story…" not "Processing audio."
- Sentence case everywhere. No exclamation marks, no emoji, no jargon.

ACCESSIBILITY (non-negotiable)
- WCAG AA contrast, 44px minimum tap targets, visible focus rings (accent,
  2px offset), captions over photos always legible via a bottom scrim.

DELIVERABLE: tailwind.config tokens for all of the above, global styles, and
a component kit — Button, TextLink, Card, Input, Textarea, RecordButton,
ProgressBar, Chip, Toast — each rendered on a /dev/ui review page so we can
inspect every state (default, hover, active, disabled, loading) in isolation
before any feature uses them.
```

## Prompt 1 — Database, auth, storage

```
Implement the data model from section 8 of moments-product-spec.md as
Supabase migrations: profiles, stories, recordings, questions, story_versions,
media, share_links, reactions.

- RLS: owners get full CRUD on their own rows. No anonymous table access at
  all — recipient reads go through server routes.
- Storage buckets: `audio` and `media`, both private, signed-URL access only.
- Auth: email magic link. Minimal sign-in page. After sign-in, land on /stories.
- Deleting a story must cascade-delete all DB rows AND storage objects.

Write a seed script that creates one fake story with 2 recordings and 3 photos
so we can develop downstream phases against real-shaped data.
```

## Prompt 2 — Voice capture & transcription

```
Build the capture flow at /new per spec section 4 (creator flow steps 1–2)
and F2–F3.

- Step 1: "What is the moment you want to remember?" — title input, then
  continue.
- Step 2: recording screen. Big single record button, timer, pause/resume,
  waveform or pulse animation while recording. Supportive copy: "Tell it
  however you remember it. You can refine it later."
- MediaRecorder API. CRITICAL: handle iOS Safari — audio/mp4 fallback when
  audio/webm is unsupported, resume AudioContext on user gesture. Test both.
- "Type it instead" link switches to a textarea at any time.
- Multiple segments: after stopping, user can "add more" or continue.
- Upload segments to the audio bucket; create recording rows; autosave
  everything — refresh must never lose work.
- Server route: on upload, send audio to Deepgram (nova model) requesting
  word-level timestamps. Store transcript_text and words_json on the
  recording row. Show the transcript for review with editing enabled.

Acceptance: I can record two segments on a phone, see an editable transcript
with timing data saved, close the tab, return, and everything is still there.
```

## Prompt 3 — The guided interviewer

```
Build the follow-up questions step (spec F4) using the Claude API server-side.

- After the initial transcript exists, call Claude with the "Interviewer"
  prompt from the appendix of this file. Generate up to 3 questions; store
  them in the questions table.
- Present ONE question at a time on a calm card. Answer by voice (reuses the
  Phase 2 recorder, saved as source=followup) or text. Buttons: "Skip" and
  "Ask me something else" (regenerates that one question).
- Answers get transcribed like any recording and appended to the story's
  full transcript in segment order.
- Also run the "Context extraction" prompt (appendix) and show extracted
  people/place/timeframe/occasion as editable suggestion chips the user
  confirms or corrects — never auto-confirmed.

Acceptance: after recording, I'm asked one thoughtful question at a time that
doesn't repeat anything I already said, and my confirmed context is saved.
```

## Prompt 4 — Story structuring & review

```
Build the review step (spec F5) at /story/[id].

- Server route runs the "Structurer" prompt (appendix) over the combined
  timestamped transcript → 3–6 sections with start_s/end_s boundaries, a
  suggested title, and a pull-quote. Save as story_versions kind=exact.
- Then run the "Polisher" prompt (appendix) → kind=polished version.
- UI: toggle between "Keep my exact words" and "Polish into a story," shown
  as two tappable cards with a preview of the difference. Every section's
  text is editable inline. Title editable. Selection saved on the story row.
- Polished text must remain first-person and must not add any fact, name,
  or event not present in the transcript. Show a small caption when polished
  is selected: "Refined for flow — your meaning, your voice."

Acceptance: I can flip between exact and polished, edit any line, and my
chosen version persists.
```

## Prompt 5 — Photos

```
Build the media step (spec F6).

- "Add photos" opens the native OS picker:
  <input type="file" accept="image/*,video/*" multiple> (photos required to
  work; short clips nice-to-have).
- Client-side: compress images (~1600px max edge, quality ~0.8) before upload
  to the media bucket. Read EXIF datetime when present.
- Grid view: drag to reorder, tap to caption or remove.
- Run the "Photo matcher" prompt (appendix) to suggest which section each
  photo belongs to; show assignments as draggable and user-overridable.
- The story must remain fully valid with zero photos.

Acceptance: on a phone I can pick 5 photos from my gallery, they upload
compressed, and each is assigned to a sensible section that I can change.
```

## Prompt 6 — The experience page (THE PRODUCT — most important phase)

```
Build the story experience player, used by both /story/[id]/preview (owner)
and /s/[token] (recipient). Spec F7. This page IS the product — it must feel
like a keepsake, not a slideshow.

Timeline engine:
- Single <audio> element with the concatenated voice segments (or sequential
  playback of segments) drives everything via currentTime +
  requestAnimationFrame.
- Captions: render the story text word-synced from words_json — current
  phrase visible in large serif type, softly highlighting as spoken. If the
  polished version is selected, sync at SECTION level (crossfade section text
  at section start_s) since polished words don't map 1:1 to audio.
- Photos: each section shows its assigned photo(s) full-bleed behind/above
  the text with a slow Ken Burns pan/zoom (CSS transforms, 20–30s cycles),
  crossfading at section boundaries. Zero-photo sections get a warm gradient
  treatment with larger typography.
- Music: second audio element with the selected bundled track through Web
  Audio API gain, ducked ~-14dB under voice, gentle fade in/out. Add 6
  placeholder instrumental tracks (royalty-free) in /public/music.
- Structure: opening title card (title, teller's name, date/place if
  confirmed) → sections → closing card ("Told by ___" + reaction affordance).
- Controls: tap to pause/resume, thin scrub bar, mute music toggle. Autoplay
  policies: require a "Play their story" tap to start.
- Mobile-first vertical layout; must also look composed on desktop.

Art direction for this page (the emotional bar):
- Opening title card typeset like a book cover: teller's name and date in
  letter-spaced small caps (Inter), the title large in Fraunces, entering
  with a slow 1200ms fade. First impressions happen here.
- Photos sit behind a subtle bottom scrim gradient so captions stay legible,
  with a faint vignette holding focus center-frame. No borders and no UI on
  top of photos except the thin scrub bar.
- Caption sync feels like reading along by candlelight: the current phrase
  at full warmth (#F5EFE6), neighboring phrases dimmed to ~40% — never
  karaoke-style word bouncing.
- All chrome (scrub bar, mute) fades away after 3s of playback and returns
  on tap. During playback, the story is the only thing on screen.
- Closing card: the pull-quote large in Fraunces italic, then "Told by ___",
  then the reaction affordance as a quiet invitation, not a CTA banner.

Acceptance: preview plays voice + synced captions + moving photos + ducked
music end-to-end on iPhone Safari and Android Chrome, and it feels emotional
rather than mechanical.
```

## Prompt 7 — Sharing, recipient view, reactions

```
Build sharing and the recipient loop (spec F8).

- "Share privately" on the story page: creates share_links row with an
  unguessable token → /s/{token}. Buttons: copy link, native share sheet
  (navigator.share). Owner can revoke or regenerate; revoked links show a
  gentle "this story is no longer available" page.
- /s/[token]: server-validates token, serves the experience page. No account,
  no app banner, no signup wall before or during playback.
- Reactions: at the closing card (and via a subtle floating button during
  playback): send a written message, tap an emoji pinned to the current
  timestamp, or record a voice reply (max 60s, reuses recorder). Ask only
  for a first name. Store with timestamp_offset_s when pinned mid-story.
- After reacting: soft one-line CTA "Have a story of your own to tell?" →
  sign-up.
- Email the owner (Resend) on first view and on each reaction.
- Owner sees reactions on the story page, voice replies playable, pinned
  reactions shown on the scrub bar.

Acceptance: an incognito phone browser can open the link, watch everything,
leave a voice reaction without an account, and the owner gets the email and
sees the reaction pinned at the right moment.
```

## Prompt 8 — Polish & launch readiness

```
Final pass:
- /stories: my stories as warm cards (title, date, shared/draft state,
  view + reaction counts). No calendar, no timeline, no streak — a shelf of
  keepsakes.
- Landing page (/): lead with an embedded sample story experience, then one
  CTA: "Tell a story." No feature grid.
- Empty states, loading states (transcription and structuring take seconds —
  show "listening to your story…" style copy), error recovery for failed
  uploads (retry queue).
- Delete story: confirm → cascade DB + storage, verify nothing orphaned.
- Basic event logging to a simple analytics table matching spec section 11:
  recording_started/completed, question_answered, preview_reached, shared,
  recipient_viewed, recipient_completed, reaction_left, second_story_started.
- Run through the full journey on iOS Safari + Android Chrome and fix what
  breaks. Then a Lighthouse pass on /s/[token] for mobile performance.
```

## Prompt 9 — Seasoned-designer QA pass

```
Now act as a demanding design director doing a final review of the whole app.

Setup: install Playwright and script screenshots of EVERY screen and state —
mobile viewport 390×844 and desktop 1440×900 — including mid-recording,
mid-transcription loading, the experience page at title card / mid-story /
closing card, empty states, and error states.

Review each screenshot against the Prompt 0.5 design system and critique
ruthlessly:
- Hierarchy: is the one thing that matters the visually biggest thing? Is
  there exactly one primary action?
- Spacing rhythm: 4px grid drift, cramped clusters, inconsistent gaps
  between the same elements on different screens.
- Typography: measure too wide, orphan words in headings, story content
  accidentally set in Inter, weights below 400, mixed sizes for same role.
- Color: rogue grays, pure #000/#FFF, accent used for anything except the
  primary action, contrast failures.
- Alignment: optical misalignments, off-grid elements, icons not optically
  centered.
- Touch: tap targets under 44px, actions outside thumb reach.
- Tone: does this screen feel like a keepsake or a dashboard? If a screen
  could belong to a project-management tool, redesign it.

Fix every finding, re-screenshot, and repeat until a full pass surfaces
nothing. Triple attention on three screens: the recording screen (the moment
of vulnerability — it must feel calm and private), the experience page title
card (the recipient's first impression), and the reaction flow (the emotional
payoff returning to the teller).
```

---

## Appendix — In-app AI prompt templates

These are the prompts the application itself sends to the Claude API. Keep them in `/lib/prompts.ts`.

### Interviewer

```
You are a gentle, skilled interviewer helping someone tell a personal memory.
Below is the transcript of what they've said so far, plus confirmed context.

Generate up to 3 follow-up questions. Rules:
- Never ask about anything already answered in the transcript.
- One short, warm sentence per question. No preamble, no compound questions.
- Draw from: what happened just before the moment; sensory detail (sight,
  sound, smell); something someone said; what the teller felt; why it still
  matters to them; what they'd want the listener to understand.
- Match the emotional register. If the story is about loss, be tender; if
  joyful, be light. Never sensationalize.
Return JSON: {"questions": ["...", "...", "..."]}

TRANSCRIPT: {{transcript}}
CONTEXT: {{confirmed_context}}
```

### Context extraction

```
Extract story details from this transcript. These are SUGGESTIONS a user will
confirm — do not guess beyond what's stated or strongly implied. Omit anything
uncertain rather than inventing it.
Return JSON: {"people": [], "places": [], "timeframe": "", "occasion": "",
"emotional_tone": "", "notable_objects": []}

TRANSCRIPT: {{transcript}}
```

### Structurer (exact version)

```
Split this timestamped transcript into 3–6 narrative sections. You may only
choose boundaries — never change, reorder, or remove the speaker's words.
Also suggest a title (max 8 words, evocative, no clichés) and select one
verbatim pull-quote.
Input: array of {w, start, end} word objects.
Return JSON: {"title": "", "pull_quote": "", "sections":
[{"start_s": 0, "end_s": 0, "summary_label": ""}]}

WORDS: {{words_json}}
```

### Polisher

```
Rewrite this personal memory for clarity and flow. Hard rules:
- First person, preserving the teller's personality, idiom, and emotional tone.
- NEVER add facts, names, dialogue, places, or events not in the original.
- Remove repetition and false starts; keep distinctive phrasing exactly as
  spoken — that's their voice, not an error.
- Keep the same section structure. Aim for spoken-aloud rhythm, not essay prose.
Return JSON: {"title": "", "pull_quote": "", "sections":
[{"id": "", "text": ""}]}

SECTIONS: {{exact_sections_json}}
```

### Photo matcher

```
Assign each photo to the story section it most likely illustrates, using
captions, EXIF datetime, and section content. If no good match exists, assign
null rather than forcing one. These are suggestions the user can override.
Return JSON: {"assignments": [{"media_id": "", "section_id": null}]}

SECTIONS: {{sections_json}}
PHOTOS: {{media_json}}
```

---

## Build order recap

Phase 0 scaffold → 0.5 **design system** → 1 data/auth → 2 capture/transcribe → 3 interviewer → 4 structuring → 5 photos → 6 **experience page** → 7 sharing/reactions → 8 polish → 9 **design QA pass**.

Week-1 de-risk: prove MediaRecorder works on iOS Safari before anything else. If phase 6 doesn't give you chills with your own story, iterate there before touching phase 7 — the experience page is the entire bet.

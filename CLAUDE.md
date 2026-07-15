# Moments — Standing Rules

The full product spec lives in `moments-product-spec.md` at the project root and
is the source of truth for everything we build. The phased build plan is in
`moments-claude-code-prompts.md`. These standing rules override defaults and must
hold on every screen and in every route.

## 1. What this product is

This is **NOT a journal app** and **NOT a video generator**. The output is a
living web **"experience page"** — voice + photos + synced captions + music
played in the browser — **never a rendered video file**. There is no render
queue, no AI video, no MP4 export in the MVP.

## 2. Product language

Use: **story, moment, memory, keepsake**. Speak of "telling your story,"
"bringing it to life," "sharing privately."

Never use in UI copy: **journal, entry, log, post, content, generate, AI**. The
interface talks about storytelling, never about the technology behind it.

## 3. Private by default

Nothing is ever public. **All media is served behind signed URLs.** Recipients
access a story **only through server routes that validate a share token** —
never through direct table or storage access. Share links are unguessable and
revocable.

## 4. AI is a quiet, honest assistant

AI **never invents facts, dialogue, people, places, or events.** Every extracted
detail (people, place, timeframe, occasion, tone) is a **suggestion the user
must confirm** before it is treated as true. Polished text is a rewrite the user
approves; it may not add anything not present in what the teller said. No voice
cloning; never put words in a real person's mouth.

## 5. Design is a first-class requirement

Design is a requirement, not a polish step. Every screen must follow the design
system (Prompt 0.5): design tokens live in the Tailwind theme (currently
`app/globals.css` `@theme`, since Tailwind v4 is CSS-first) and reusable
primitives live in `/components/ui`.

- **Benchmark:** a beautifully typeset hardcover keepsake book.
- **Anti-benchmark:** a SaaS dashboard. If a screen could belong to a
  project-management tool, it is wrong — redesign it.
- Mobile-first: every page is designed for a vertically held phone first.
- One primary action per screen; screens must breathe.

---

## Project conventions

- **Stack:** Next.js (App Router) + TypeScript + Tailwind CSS v4, deployed on
  Vercel. **DB:** Neon Postgres via **Drizzle ORM**. **Auth:** **Clerk**
  (email magic link). **Storage:** **Vercel Blob** (audio + photos).
  (The spec names Supabase; we substituted this stack — same relational model,
  same guarantees.)
- **Access control:** there is no Postgres RLS (that was a Supabase-auth
  feature). Ownership is enforced in the **server layer** — every query is
  scoped to the Clerk user id via `lib/auth.ts` (`requireUserId`,
  `ensureProfile`). Never trust a client-supplied owner id.
- **DB:** schema in `db/schema.ts`, client in `db/index.ts`, SQL migrations in
  `db/migrations/`. Commands: `npm run db:generate` (after schema edits),
  `db:migrate`, `db:push`, `db:studio`, `db:seed`.
- **Storage:** `lib/blob.ts`. Blob URLs are unguessable and treated as secrets;
  a URL is only handed to a client after the server authorizes the request
  (owner, or recipient with a valid share token). Deleting a story removes its
  blobs first, then the row (see `lib/actions/stories.ts` `deleteStory`).
- **Routes:** `/` landing, `/new` create, `/stories` my stories (post-sign-in
  landing), `/story/[id]` edit/preview, `/s/[token]` recipient view,
  `/sign-in`, `/sign-up`, `/dev/ui` design workbench.
- **Env:** see `.env.local.example`. Never commit `.env.local`. Clerk dashboard:
  enable email **magic link** as the sign-in method.

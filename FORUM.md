# MetricMech Forum

An ask-and-answer forum at [metricmech.com/forum](https://metricmech.com/forum), built the
same way as the rest of the site: static HTML, no build step, no framework. Persistence and
auth come from Supabase; everything else is plain files on Vercel.

---

## You must do two things before it works

The schema is already applied and the code is deployed, but **sign-in will fail until these
two dashboard steps are done.** Both are one-time, in the Supabase dashboard for the
`loglinkr` project.

### 1. Allow the forum's redirect URLs — required

**Authentication → URL Configuration → Redirect URLs**, add:

```
https://metricmech.com/forum/auth
https://metricmech.com/forum/**
http://localhost:*/forum/auth
```

Without this, Supabase refuses to send the user back after they click a sign-in link.
Email magic-link sign-in works as soon as this is saved — nothing else needed.

### 2. Enable Google sign-in — required for the Google button

**Authentication → Providers → Google → Enable**, then paste a Client ID and Client Secret
from a Google Cloud OAuth 2.0 Web application credential.

In the Google Cloud console, the credential's **Authorised redirect URI** must be:

```
https://wzxowvrvuecybdxymjvi.supabase.co/auth/v1/callback
```

Until this is done the Google button will error. The email link path still works, so the
forum is usable either way — but Google is where most of the signups will come from.

### 3. Add the workflow secrets — optional

`.github/workflows/forum-prerender.yml` reads `SUPABASE_URL` and `SUPABASE_ANON_KEY` from
repo secrets. Both are public values (the anon key already ships in the browser bundle), and
the script falls back to hard-coded defaults, so the job runs fine without them. Setting them
just means you can rotate the key later without a code change.

---

## How it fits together

```
forum.html              Hub — search, sort, filter, tag rail
forum/ask.html          Ask form (curated tags, draft is preserved across sign-in)
forum/question.html     Thread view + pre-render template
forum/tag.html          Topic view + pre-render template
forum/auth.html         Landing page after Google / magic-link redirect
forum/q/<slug>.html     Generated nightly — one static page per thread
forum/t/<slug>.html     Generated nightly — one static page per topic

assets/forum.js         Client: auth, data access, rendering, voting
assets/forum-md.js      Post body renderer, shared by browser AND pre-render job
assets/forum.css        Styles, built on the existing blueprint design tokens

scripts/forum-prerender.mjs        The nightly snapshot job (no dependencies)
.github/workflows/forum-prerender.yml
supabase/migrations/20260731_forum.sql
```

### Why the database lives in the `loglinkr` project

The forum reuses the existing Supabase project rather than a new one, with every table
under a `forum_` prefix — the same convention the HR app already uses for its `mcp_` modules.

The two products share a database but not data:

- No `forum_*` table, policy, or function references `my_plant_id()`, `my_role()`,
  `public.users`, or `public.plants`. Nothing in the HR app references `forum_*`.
- A forum-only signup has no row in `public.users`, so `my_plant_id()` returns `NULL` and
  every plant-scoped policy in the HR app evaluates false. Verified: a forum account sees
  `0` rows from `public.plants` and `public.users`.
- Forum identity is a separate table (`forum_profiles`) created lazily by
  `forum_ensure_profile()` on first forum visit. There is deliberately **no trigger on
  `auth.users`**, so the HR signup path is completely untouched and HR users never get a
  forum profile they did not ask for.

**One thing to know:** because both products share one Supabase project, forum signups do
land in the same `auth.users` table as HR logins. They are inert there — but the pre-existing
`plants` insert policy (`p_insert`, which allows any authenticated user to create a plant)
technically remains reachable. That policy predates the forum and is part of your HR signup
flow, so it was left alone. If you ever want the two fully separated, moving the forum to its
own Supabase project is a config change, not a rewrite.

### Reputation

`1` base, `+5` per question upvote, `+10` per answer upvote, `+15` per accepted answer.
Recomputed from source rows on every vote and acceptance, so it is always consistent and
can never drift.

### Anti-abuse

| Control | Where |
|---|---|
| 5 questions/hour, 20 answers/hour per member | DB triggers |
| No voting on your own posts | DB trigger |
| Members cannot change their own `role`, `reputation`, `handle`, or `is_banned` | `forum_profiles_guard` trigger |
| Individual votes are private; only totals are public | RLS |
| Post bodies escaped, then a fixed allow-list of formatting re-applied | `assets/forum-md.js` |
| Only bare `http(s)` URLs auto-link — no `[text](url)`, so no `javascript:` vector | `assets/forum-md.js` |
| Reader-submitted reports go to `forum_flags` | RLS: moderators only |
| Tags are curated — members pick from the list, they cannot mint new ones | `forum_ask()` |

### Moderation

There is no moderator UI yet. Promote yourself once, in the SQL editor:

```sql
update public.forum_profiles set role = 'admin'
where handle = 'your-handle';
```

A moderator can then edit or soft-delete any post through RLS. Day to day:

```sql
-- open reports
select * from public.forum_flags where status = 'open' order by created_at;

-- hide a post (soft delete — the pre-render job drops it on the next run)
update public.forum_questions set deleted_at = now() where slug = '…';
update public.forum_answers   set deleted_at = now() where id   = '…';

-- ban a spammer (their posts stay, they just cannot post again)
update public.forum_profiles set is_banned = true where handle = '…';
```

Deleting an account (`auth.users`) sets `author_id` to `NULL` and leaves the content — a
member leaving should not blank out answers other people depend on.

---

## SEO

Threads are rendered client-side for readers **and** snapshotted to real static HTML nightly.
Vercel serves the filesystem before applying rewrites, so `/forum/q/<slug>` hits the static
snapshot once it exists, and falls through the rewrite to `forum/question.html` (live render)
for anything posted since the last run. Nothing 404s in the gap.

Each snapshot carries `QAPage` JSON-LD with `acceptedAnswer` / `suggestedAnswer` — the schema
that earns the Q&A rich result in Google.

**Unanswered threads are `noindex, follow` and stay out of the sitemap.** A page with a
question and no answer is a thin page; indexing it early trains Google to treat the whole
section as low value. It flips to indexable automatically on the first answer.

`sitemap-forum.xml` is a separate file so this job and the blog content autopilot never
fight over the same file. It is advertised in `robots.txt`.

### Run it by hand

```bash
node scripts/forum-prerender.mjs
```

Writes into `forum/q/`, `forum/t/`, and `sitemap-forum.xml`. Safe to run any time — it
rebuilds those directories from scratch, so moderator deletions disappear on the next run.

---

## Getting the first questions

The forum ships empty, and an empty forum is the hardest state to escape. What actually
works, in order:

1. **Seed it with your own real questions** — the ones you have genuinely hit on a shop
   floor. Post them from your own account and answer some of them yourself a few days later.
   Do not invent personas; a forum with three real threads beats one with thirty fake ones,
   and fabricated members are the fastest way to lose an audience of engineers.
2. **Link from the articles that already rank.** The AS9102 and Cp/Cpk articles pull search
   traffic today. A "still stuck? ask the forum" line at the bottom of each converts readers
   who did not find their exact answer.
3. **Answer fast for the first month.** The first ten askers decide whether this place is
   real. A same-day answer from you personally is worth more than any amount of promotion.

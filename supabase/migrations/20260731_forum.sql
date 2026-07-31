-- ============================================================================
-- MetricMech Forum — schema, RLS, triggers, RPCs
-- ----------------------------------------------------------------------------
-- Lives in the shared `loglinkr` Supabase project under the `forum_` prefix,
-- matching the existing `mcp_` module convention.
--
-- ISOLATION CONTRACT:
--   * No forum_* table, policy, or function references my_plant_id(), my_role(),
--     public.users, or public.plants.
--   * No existing plant-scoped table references forum_*.
--   * A forum-only signup has no row in public.users, so my_plant_id() returns
--     NULL for them and every plant-scoped RLS policy evaluates false.
--   * Forum identity is public by design and is kept in forum_profiles, which is
--     created lazily by forum_ensure_profile() on first forum visit. There is
--     deliberately NO trigger on auth.users, so HR signups never get a forum
--     profile and the HR signup path is untouched.
-- ============================================================================

create extension if not exists citext;
create extension if not exists pg_trgm;

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------
create table if not exists public.forum_profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  handle        citext not null unique,
  display_name  text   not null check (char_length(display_name) between 2 and 60),
  avatar_url    text,
  bio           text check (char_length(bio) <= 400),
  job_title     text check (char_length(job_title) <= 80),
  company       text check (char_length(company) <= 80),
  reputation    integer not null default 1,
  role          text    not null default 'member' check (role in ('member','moderator','admin')),
  is_banned     boolean not null default false,
  created_at    timestamptz not null default now()
);

comment on table public.forum_profiles is
  'MetricMech forum identity. Separate from public.users (the plant-scoped HR identity) on purpose.';

-- ---------------------------------------------------------------------------
-- Tags (curated — members pick from this list, they cannot mint new ones)
-- ---------------------------------------------------------------------------
create table if not exists public.forum_tags (
  id             uuid primary key default gen_random_uuid(),
  slug           citext not null unique,
  name           text   not null,
  description    text,
  question_count integer not null default 0,
  sort_order     integer not null default 100,
  created_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Questions
-- ---------------------------------------------------------------------------
create table if not exists public.forum_questions (
  id               uuid primary key default gen_random_uuid(),
  slug             citext unique,
  title            text not null check (char_length(title) between 15 and 160),
  body             text not null check (char_length(body) between 30 and 20000),
  author_id        uuid references public.forum_profiles(id) on delete set null,
  view_count       integer not null default 0,
  answer_count     integer not null default 0,
  vote_score       integer not null default 0,
  accepted_answer_id uuid,
  is_closed        boolean not null default false,
  closed_reason    text,
  deleted_at       timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),
  search           tsvector generated always as (
                     setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
                     setweight(to_tsvector('english', coalesce(body,  '')), 'B')
                   ) stored
);

create index if not exists forum_questions_search_idx      on public.forum_questions using gin (search);
create index if not exists forum_questions_activity_idx    on public.forum_questions (last_activity_at desc);
create index if not exists forum_questions_created_idx     on public.forum_questions (created_at desc);
create index if not exists forum_questions_author_idx      on public.forum_questions (author_id);
create index if not exists forum_questions_title_trgm_idx  on public.forum_questions using gin (title gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- Answers
-- ---------------------------------------------------------------------------
create table if not exists public.forum_answers (
  id          uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.forum_questions(id) on delete cascade,
  body        text not null check (char_length(body) between 20 and 20000),
  author_id   uuid references public.forum_profiles(id) on delete set null,
  vote_score  integer not null default 0,
  is_accepted boolean not null default false,
  deleted_at  timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists forum_answers_question_idx on public.forum_answers (question_id);
create index if not exists forum_answers_author_idx   on public.forum_answers (author_id);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'forum_questions_accepted_answer_fkey'
  ) then
    alter table public.forum_questions
      add constraint forum_questions_accepted_answer_fkey
      foreign key (accepted_answer_id) references public.forum_answers(id) on delete set null;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Question <-> tag join
-- ---------------------------------------------------------------------------
create table if not exists public.forum_question_tags (
  question_id uuid not null references public.forum_questions(id) on delete cascade,
  tag_id      uuid not null references public.forum_tags(id)      on delete cascade,
  primary key (question_id, tag_id)
);

create index if not exists forum_question_tags_tag_idx on public.forum_question_tags (tag_id);

-- ---------------------------------------------------------------------------
-- Comments (on a question OR an answer — exactly one)
-- ---------------------------------------------------------------------------
create table if not exists public.forum_comments (
  id          uuid primary key default gen_random_uuid(),
  question_id uuid references public.forum_questions(id) on delete cascade,
  answer_id   uuid references public.forum_answers(id)   on delete cascade,
  body        text not null check (char_length(body) between 2 and 1000),
  author_id   uuid references public.forum_profiles(id) on delete set null,
  deleted_at  timestamptz,
  created_at  timestamptz not null default now(),
  constraint forum_comments_one_target check (
    (question_id is not null and answer_id is null) or
    (question_id is null and answer_id is not null)
  )
);

create index if not exists forum_comments_question_idx on public.forum_comments (question_id);
create index if not exists forum_comments_answer_idx   on public.forum_comments (answer_id);

-- ---------------------------------------------------------------------------
-- Votes (on a question OR an answer — exactly one)
-- ---------------------------------------------------------------------------
create table if not exists public.forum_votes (
  id          uuid primary key default gen_random_uuid(),
  voter_id    uuid not null references public.forum_profiles(id) on delete cascade,
  question_id uuid references public.forum_questions(id) on delete cascade,
  answer_id   uuid references public.forum_answers(id)   on delete cascade,
  value       smallint not null check (value in (-1, 1)),
  created_at  timestamptz not null default now(),
  constraint forum_votes_one_target check (
    (question_id is not null and answer_id is null) or
    (question_id is null and answer_id is not null)
  )
);

create unique index if not exists forum_votes_q_uniq on public.forum_votes (voter_id, question_id) where question_id is not null;
create unique index if not exists forum_votes_a_uniq on public.forum_votes (voter_id, answer_id)   where answer_id   is not null;

-- ---------------------------------------------------------------------------
-- Flags (moderation reports)
-- ---------------------------------------------------------------------------
create table if not exists public.forum_flags (
  id          uuid primary key default gen_random_uuid(),
  question_id uuid references public.forum_questions(id) on delete cascade,
  answer_id   uuid references public.forum_answers(id)   on delete cascade,
  comment_id  uuid references public.forum_comments(id)  on delete cascade,
  reporter_id uuid references public.forum_profiles(id) on delete set null,
  reason      text not null check (reason in ('spam','offensive','off-topic','duplicate','wrong-info','other')),
  note        text check (char_length(note) <= 500),
  status      text not null default 'open' check (status in ('open','actioned','dismissed')),
  created_at  timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.forum_profiles(id) on delete set null
);

create index if not exists forum_flags_open_idx on public.forum_flags (status) where status = 'open';

-- ============================================================================
-- Helper functions
-- ============================================================================

-- Is the caller a forum moderator? SECURITY DEFINER so that RLS on
-- forum_profiles cannot recurse back into the policies that call this.
create or replace function public.forum_is_moderator()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.forum_profiles p
    where p.id = auth.uid() and p.role in ('moderator','admin')
  );
$$;

-- Caller has a forum profile and is not banned.
create or replace function public.forum_is_active()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.forum_profiles p
    where p.id = auth.uid() and p.is_banned = false
  );
$$;

create or replace function public.forum_slugify(txt text)
returns text
language sql
immutable
as $$
  select trim(both '-' from
           regexp_replace(
             regexp_replace(lower(coalesce(txt, '')), '[^a-z0-9]+', '-', 'g'),
             '-{2,}', '-', 'g'));
$$;

-- ============================================================================
-- Triggers
-- ============================================================================

create or replace function public.forum_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists forum_questions_touch on public.forum_questions;
create trigger forum_questions_touch before update on public.forum_questions
  for each row execute function public.forum_touch_updated_at();

drop trigger if exists forum_answers_touch on public.forum_answers;
create trigger forum_answers_touch before update on public.forum_answers
  for each row execute function public.forum_touch_updated_at();

-- --- slug -------------------------------------------------------------------
create or replace function public.forum_questions_set_slug()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base text;
  cand text;
  n    integer := 0;
begin
  if new.slug is not null and length(trim(new.slug::text)) > 0 then
    return new;
  end if;

  base := left(public.forum_slugify(new.title), 70);
  base := trim(both '-' from base);
  if base = '' then base := 'question'; end if;

  cand := base;
  while exists (select 1 from public.forum_questions q where q.slug = cand) loop
    n := n + 1;
    cand := base || '-' || n::text;
  end loop;

  new.slug := cand;
  return new;
end $$;

drop trigger if exists forum_questions_slug on public.forum_questions;
create trigger forum_questions_slug before insert on public.forum_questions
  for each row execute function public.forum_questions_set_slug();

-- --- answer count + activity ------------------------------------------------
create or replace function public.forum_answers_sync()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare qid uuid;
begin
  qid := coalesce(new.question_id, old.question_id);

  update public.forum_questions q
     set answer_count = (
           select count(*) from public.forum_answers a
           where a.question_id = qid and a.deleted_at is null
         ),
         last_activity_at = now()
   where q.id = qid;

  return null;
end $$;

drop trigger if exists forum_answers_sync_trg on public.forum_answers;
create trigger forum_answers_sync_trg
  after insert or update or delete on public.forum_answers
  for each row execute function public.forum_answers_sync();

-- --- tag counts -------------------------------------------------------------
create or replace function public.forum_tag_counts_sync()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare tid uuid;
begin
  tid := coalesce(new.tag_id, old.tag_id);
  update public.forum_tags t
     set question_count = (
           select count(*)
           from public.forum_question_tags qt
           join public.forum_questions q on q.id = qt.question_id
           where qt.tag_id = tid and q.deleted_at is null
         )
   where t.id = tid;
  return null;
end $$;

drop trigger if exists forum_tag_counts_trg on public.forum_question_tags;
create trigger forum_tag_counts_trg
  after insert or delete on public.forum_question_tags
  for each row execute function public.forum_tag_counts_sync();

-- --- reputation -------------------------------------------------------------
-- 1 base + 5/question upvote + 10/answer upvote + 15/accepted answer.
create or replace function public.forum_recalc_reputation(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Marks this UPDATE as system-driven so forum_profiles_guard lets the
  -- reputation change through. Transaction-local (third arg true).
  perform set_config('forum.internal', '1', true);

  update public.forum_profiles p
     set reputation = greatest(1,
           1
           + coalesce((select sum(q.vote_score) * 5  from public.forum_questions q
                       where q.author_id = p_user and q.deleted_at is null), 0)
           + coalesce((select sum(a.vote_score) * 10 from public.forum_answers a
                       where a.author_id = p_user and a.deleted_at is null), 0)
           + coalesce((select count(*) * 15 from public.forum_answers a
                       where a.author_id = p_user and a.is_accepted and a.deleted_at is null), 0)
         )
   where p.id = p_user;

  perform set_config('forum.internal', '0', true);
end $$;

-- --- vote score -------------------------------------------------------------
create or replace function public.forum_votes_sync()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  qid    uuid := coalesce(new.question_id, old.question_id);
  aid    uuid := coalesce(new.answer_id,   old.answer_id);
  author uuid;
begin
  if qid is not null then
    update public.forum_questions q
       set vote_score = (select coalesce(sum(v.value), 0) from public.forum_votes v where v.question_id = qid)
     where q.id = qid
     returning q.author_id into author;
  else
    update public.forum_answers a
       set vote_score = (select coalesce(sum(v.value), 0) from public.forum_votes v where v.answer_id = aid)
     where a.id = aid
     returning a.author_id into author;

    update public.forum_questions q set last_activity_at = now()
     where q.id = (select question_id from public.forum_answers where id = aid);
  end if;

  if author is not null then
    perform public.forum_recalc_reputation(author);
  end if;

  return null;
end $$;

drop trigger if exists forum_votes_sync_trg on public.forum_votes;
create trigger forum_votes_sync_trg
  after insert or update or delete on public.forum_votes
  for each row execute function public.forum_votes_sync();

-- --- no self-voting ---------------------------------------------------------
create or replace function public.forum_votes_block_self()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare author uuid;
begin
  if new.question_id is not null then
    select author_id into author from public.forum_questions where id = new.question_id;
  else
    select author_id into author from public.forum_answers   where id = new.answer_id;
  end if;

  if author is not null and author = new.voter_id then
    raise exception 'You cannot vote on your own post'
      using errcode = 'check_violation';
  end if;

  return new;
end $$;

drop trigger if exists forum_votes_block_self_trg on public.forum_votes;
create trigger forum_votes_block_self_trg before insert or update on public.forum_votes
  for each row execute function public.forum_votes_block_self();

-- --- profile privilege guard ------------------------------------------------
-- Members can edit their own bio/name/avatar. Only a moderator may change role,
-- reputation, handle, or ban state.
create or replace function public.forum_profiles_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(current_setting('forum.internal', true), '0') = '1' then
    return new;   -- system-driven (reputation recalc)
  end if;

  if public.forum_is_moderator() then
    return new;
  end if;

  new.role       := old.role;
  new.reputation := old.reputation;
  new.is_banned  := old.is_banned;
  new.handle     := old.handle;
  new.created_at := old.created_at;
  return new;
end $$;

drop trigger if exists forum_profiles_guard_trg on public.forum_profiles;
create trigger forum_profiles_guard_trg before update on public.forum_profiles
  for each row execute function public.forum_profiles_guard();

-- --- rate limits ------------------------------------------------------------
create or replace function public.forum_rate_limit_questions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare recent integer;
begin
  if new.author_id is null then return new; end if;

  select count(*) into recent
    from public.forum_questions
   where author_id = new.author_id and created_at > now() - interval '1 hour';

  if recent >= 5 then
    raise exception 'Rate limit: you can post at most 5 questions per hour. Try again shortly.'
      using errcode = 'check_violation';
  end if;

  return new;
end $$;

drop trigger if exists forum_rate_limit_questions_trg on public.forum_questions;
create trigger forum_rate_limit_questions_trg before insert on public.forum_questions
  for each row execute function public.forum_rate_limit_questions();

create or replace function public.forum_rate_limit_answers()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare recent integer;
begin
  if new.author_id is null then return new; end if;

  select count(*) into recent
    from public.forum_answers
   where author_id = new.author_id and created_at > now() - interval '1 hour';

  if recent >= 20 then
    raise exception 'Rate limit: you can post at most 20 answers per hour. Try again shortly.'
      using errcode = 'check_violation';
  end if;

  return new;
end $$;

drop trigger if exists forum_rate_limit_answers_trg on public.forum_answers;
create trigger forum_rate_limit_answers_trg before insert on public.forum_answers
  for each row execute function public.forum_rate_limit_answers();

-- ============================================================================
-- Row Level Security
-- ============================================================================

alter table public.forum_profiles      enable row level security;
alter table public.forum_tags          enable row level security;
alter table public.forum_questions     enable row level security;
alter table public.forum_answers       enable row level security;
alter table public.forum_question_tags enable row level security;
alter table public.forum_comments      enable row level security;
alter table public.forum_votes         enable row level security;
alter table public.forum_flags         enable row level security;

-- --- profiles ---------------------------------------------------------------
drop policy if exists forum_profiles_read      on public.forum_profiles;
drop policy if exists forum_profiles_insert    on public.forum_profiles;
drop policy if exists forum_profiles_update    on public.forum_profiles;
drop policy if exists forum_profiles_moderate  on public.forum_profiles;

create policy forum_profiles_read on public.forum_profiles
  for select to anon, authenticated using (true);

create policy forum_profiles_insert on public.forum_profiles
  for insert to authenticated with check (id = auth.uid());

-- A member may edit their own profile. Privilege escalation (role, reputation,
-- is_banned) is blocked by forum_profiles_guard below rather than in the policy
-- itself — a sub-select against forum_profiles inside a forum_profiles policy
-- would re-enter RLS and recurse.
create policy forum_profiles_update on public.forum_profiles
  for update to authenticated
  using (id = auth.uid() and is_banned = false)
  with check (id = auth.uid());

create policy forum_profiles_moderate on public.forum_profiles
  for all to authenticated
  using (public.forum_is_moderator())
  with check (public.forum_is_moderator());

-- --- tags -------------------------------------------------------------------
drop policy if exists forum_tags_read     on public.forum_tags;
drop policy if exists forum_tags_moderate on public.forum_tags;

create policy forum_tags_read on public.forum_tags
  for select to anon, authenticated using (true);

create policy forum_tags_moderate on public.forum_tags
  for all to authenticated
  using (public.forum_is_moderator()) with check (public.forum_is_moderator());

-- --- questions --------------------------------------------------------------
drop policy if exists forum_questions_read     on public.forum_questions;
drop policy if exists forum_questions_insert   on public.forum_questions;
drop policy if exists forum_questions_update   on public.forum_questions;
drop policy if exists forum_questions_moderate on public.forum_questions;

create policy forum_questions_read on public.forum_questions
  for select to anon, authenticated using (deleted_at is null or public.forum_is_moderator());

create policy forum_questions_insert on public.forum_questions
  for insert to authenticated
  with check (author_id = auth.uid() and public.forum_is_active());

create policy forum_questions_update on public.forum_questions
  for update to authenticated
  using (author_id = auth.uid() and deleted_at is null and public.forum_is_active())
  with check (author_id = auth.uid());

create policy forum_questions_moderate on public.forum_questions
  for all to authenticated
  using (public.forum_is_moderator()) with check (public.forum_is_moderator());

-- --- answers ----------------------------------------------------------------
drop policy if exists forum_answers_read     on public.forum_answers;
drop policy if exists forum_answers_insert   on public.forum_answers;
drop policy if exists forum_answers_update   on public.forum_answers;
drop policy if exists forum_answers_moderate on public.forum_answers;

create policy forum_answers_read on public.forum_answers
  for select to anon, authenticated using (deleted_at is null or public.forum_is_moderator());

create policy forum_answers_insert on public.forum_answers
  for insert to authenticated
  with check (
    author_id = auth.uid()
    and public.forum_is_active()
    and exists (
      select 1 from public.forum_questions q
      where q.id = question_id and q.deleted_at is null and q.is_closed = false
    )
  );

create policy forum_answers_update on public.forum_answers
  for update to authenticated
  using (author_id = auth.uid() and deleted_at is null and public.forum_is_active())
  with check (author_id = auth.uid());

create policy forum_answers_moderate on public.forum_answers
  for all to authenticated
  using (public.forum_is_moderator()) with check (public.forum_is_moderator());

-- --- question tags ----------------------------------------------------------
drop policy if exists forum_question_tags_read     on public.forum_question_tags;
drop policy if exists forum_question_tags_write    on public.forum_question_tags;
drop policy if exists forum_question_tags_moderate on public.forum_question_tags;

create policy forum_question_tags_read on public.forum_question_tags
  for select to anon, authenticated using (true);

create policy forum_question_tags_write on public.forum_question_tags
  for all to authenticated
  using (exists (select 1 from public.forum_questions q where q.id = question_id and q.author_id = auth.uid()))
  with check (exists (select 1 from public.forum_questions q where q.id = question_id and q.author_id = auth.uid()));

create policy forum_question_tags_moderate on public.forum_question_tags
  for all to authenticated
  using (public.forum_is_moderator()) with check (public.forum_is_moderator());

-- --- comments ---------------------------------------------------------------
drop policy if exists forum_comments_read     on public.forum_comments;
drop policy if exists forum_comments_insert   on public.forum_comments;
drop policy if exists forum_comments_update   on public.forum_comments;
drop policy if exists forum_comments_moderate on public.forum_comments;

create policy forum_comments_read on public.forum_comments
  for select to anon, authenticated using (deleted_at is null or public.forum_is_moderator());

create policy forum_comments_insert on public.forum_comments
  for insert to authenticated
  with check (author_id = auth.uid() and public.forum_is_active());

create policy forum_comments_update on public.forum_comments
  for update to authenticated
  using (author_id = auth.uid() and public.forum_is_active())
  with check (author_id = auth.uid());

create policy forum_comments_moderate on public.forum_comments
  for all to authenticated
  using (public.forum_is_moderator()) with check (public.forum_is_moderator());

-- --- votes ------------------------------------------------------------------
-- Individual votes are private; only aggregate scores are public.
drop policy if exists forum_votes_own      on public.forum_votes;
drop policy if exists forum_votes_moderate on public.forum_votes;

create policy forum_votes_own on public.forum_votes
  for all to authenticated
  using (voter_id = auth.uid())
  with check (voter_id = auth.uid() and public.forum_is_active());

create policy forum_votes_moderate on public.forum_votes
  for select to authenticated using (public.forum_is_moderator());

-- --- flags ------------------------------------------------------------------
drop policy if exists forum_flags_insert   on public.forum_flags;
drop policy if exists forum_flags_own_read on public.forum_flags;
drop policy if exists forum_flags_moderate on public.forum_flags;

create policy forum_flags_insert on public.forum_flags
  for insert to authenticated
  with check (reporter_id = auth.uid() and public.forum_is_active());

create policy forum_flags_own_read on public.forum_flags
  for select to authenticated using (reporter_id = auth.uid());

create policy forum_flags_moderate on public.forum_flags
  for all to authenticated
  using (public.forum_is_moderator()) with check (public.forum_is_moderator());

-- ============================================================================
-- Read view — one round trip for the question feed
-- ============================================================================
drop view if exists public.forum_question_list;
create view public.forum_question_list
with (security_invoker = on) as
select
  q.id,
  q.slug,
  q.title,
  left(q.body, 320)                       as excerpt,
  q.view_count,
  q.answer_count,
  q.vote_score,
  (q.accepted_answer_id is not null)      as has_accepted,
  q.is_closed,
  q.created_at,
  q.last_activity_at,
  q.search,
  p.handle                                as author_handle,
  p.display_name                          as author_name,
  p.avatar_url                            as author_avatar,
  p.reputation                            as author_reputation,
  coalesce(
    (select array_agg(t.slug::text order by t.name)
       from public.forum_question_tags qt
       join public.forum_tags t on t.id = qt.tag_id
      where qt.question_id = q.id),
    '{}'::text[]
  )                                       as tag_slugs,
  coalesce(
    (select json_agg(json_build_object('slug', t.slug, 'name', t.name) order by t.name)
       from public.forum_question_tags qt
       join public.forum_tags t on t.id = qt.tag_id
      where qt.question_id = q.id),
    '[]'::json
  )                                       as tags
from public.forum_questions q
left join public.forum_profiles p on p.id = q.author_id
where q.deleted_at is null;

grant select on public.forum_question_list to anon, authenticated;

-- ============================================================================
-- RPCs
-- ============================================================================

-- Create (or fetch) the caller's forum profile. Called on first forum visit —
-- this is why no trigger on auth.users is needed.
create or replace function public.forum_ensure_profile(
  p_display_name text default null,
  p_avatar_url   text default null
)
returns public.forum_profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  uid      uuid := auth.uid();
  existing public.forum_profiles;
  email    text;
  base     text;
  cand     text;
  n        integer := 0;
  nice     text;
begin
  if uid is null then
    raise exception 'Sign in required' using errcode = '28000';
  end if;

  select * into existing from public.forum_profiles where id = uid;
  if found then
    return existing;
  end if;

  select u.email into email from auth.users u where u.id = uid;

  nice := nullif(trim(coalesce(p_display_name, '')), '');
  if nice is null then
    nice := initcap(replace(split_part(coalesce(email, 'engineer'), '@', 1), '.', ' '));
  end if;
  nice := left(nice, 60);
  if char_length(nice) < 2 then nice := 'Engineer'; end if;

  base := left(public.forum_slugify(nice), 24);
  if base = '' then base := 'engineer'; end if;

  cand := base;
  while exists (select 1 from public.forum_profiles p where p.handle = cand) loop
    n := n + 1;
    cand := base || '-' || n::text;
  end loop;

  insert into public.forum_profiles (id, handle, display_name, avatar_url)
  values (uid, cand, nice, nullif(trim(coalesce(p_avatar_url, '')), ''))
  returning * into existing;

  return existing;
end $$;

-- Post a question and attach curated tags atomically.
create or replace function public.forum_ask(
  p_title text,
  p_body  text,
  p_tags  text[] default '{}'
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  uid  uuid := auth.uid();
  qid  uuid;
  qslug text;
begin
  if uid is null then
    raise exception 'Sign in required' using errcode = '28000';
  end if;
  if not public.forum_is_active() then
    raise exception 'Your account cannot post right now' using errcode = '42501';
  end if;

  insert into public.forum_questions (title, body, author_id)
  values (trim(p_title), trim(p_body), uid)
  returning id, slug into qid, qslug;

  -- Curated tags only: unknown slugs are ignored, max 4 kept.
  insert into public.forum_question_tags (question_id, tag_id)
  select qid, t.id
    from public.forum_tags t
   where t.slug = any (select lower(trim(x)) from unnest(coalesce(p_tags, '{}')) x)
   order by t.sort_order, t.name
   limit 4
  on conflict do nothing;

  return qslug;
end $$;

-- Cast, change, or clear a vote. Returns the post's new score.
create or replace function public.forum_vote(
  p_question uuid,
  p_answer   uuid,
  p_value    smallint
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  uid   uuid := auth.uid();
  score integer;
begin
  if uid is null then
    raise exception 'Sign in required' using errcode = '28000';
  end if;
  if not public.forum_is_active() then
    raise exception 'Your account cannot vote right now' using errcode = '42501';
  end if;
  if (p_question is null) = (p_answer is null) then
    raise exception 'Vote exactly one of question or answer' using errcode = '22023';
  end if;
  if p_value not in (-1, 0, 1) then
    raise exception 'Vote must be -1, 0 or 1' using errcode = '22023';
  end if;

  -- Votes are stored in one table but uniqueness is enforced by two partial
  -- indexes, so each target kind needs its own conflict target.
  if p_value = 0 then
    delete from public.forum_votes
     where voter_id = uid
       and question_id is not distinct from p_question
       and answer_id   is not distinct from p_answer;
  elsif p_question is not null then
    insert into public.forum_votes (voter_id, question_id, value)
    values (uid, p_question, p_value)
    on conflict (voter_id, question_id) where question_id is not null
      do update set value = excluded.value;
  else
    insert into public.forum_votes (voter_id, answer_id, value)
    values (uid, p_answer, p_value)
    on conflict (voter_id, answer_id) where answer_id is not null
      do update set value = excluded.value;
  end if;

  if p_question is not null then
    select vote_score into score from public.forum_questions where id = p_question;
  else
    select vote_score into score from public.forum_answers where id = p_answer;
  end if;

  return coalesce(score, 0);
end $$;

-- Accept (or un-accept) an answer. Question author or moderator only.
create or replace function public.forum_accept_answer(p_answer uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  uid       uuid := auth.uid();
  qid       uuid;
  q_author  uuid;
  a_author  uuid;
  currently boolean;
begin
  if uid is null then
    raise exception 'Sign in required' using errcode = '28000';
  end if;

  select a.question_id, a.is_accepted, a.author_id
    into qid, currently, a_author
    from public.forum_answers a where a.id = p_answer and a.deleted_at is null;

  if qid is null then
    raise exception 'Answer not found' using errcode = 'P0002';
  end if;

  select q.author_id into q_author from public.forum_questions q where q.id = qid;

  if q_author is distinct from uid and not public.forum_is_moderator() then
    raise exception 'Only the person who asked can accept an answer' using errcode = '42501';
  end if;

  update public.forum_answers set is_accepted = false where question_id = qid;

  if currently then
    update public.forum_questions
       set accepted_answer_id = null, last_activity_at = now()
     where id = qid;
  else
    update public.forum_answers set is_accepted = true where id = p_answer;
    update public.forum_questions
       set accepted_answer_id = p_answer, last_activity_at = now()
     where id = qid;
  end if;

  if a_author is not null then
    perform public.forum_recalc_reputation(a_author);
  end if;

  return not currently;
end $$;

-- View counter — callable by anonymous readers.
create or replace function public.forum_view(p_slug text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.forum_questions
     set view_count = view_count + 1
   where slug = p_slug and deleted_at is null;
$$;

grant execute on function public.forum_ensure_profile(text, text) to authenticated;
grant execute on function public.forum_ask(text, text, text[])    to authenticated;
grant execute on function public.forum_vote(uuid, uuid, smallint) to authenticated;
grant execute on function public.forum_accept_answer(uuid)        to authenticated;
grant execute on function public.forum_view(text)                 to anon, authenticated;
grant execute on function public.forum_is_moderator()             to anon, authenticated;
grant execute on function public.forum_is_active()                to anon, authenticated;

-- ============================================================================
-- Seed tags
-- ============================================================================
insert into public.forum_tags (slug, name, description, sort_order) values
  ('gdt',              'GD&T',                'Geometric dimensioning and tolerancing, ASME Y14.5, ISO 1101', 10),
  ('cp-cpk',           'Cp / Cpk',            'Process capability, Ppk, capability studies',                  20),
  ('gauge-rr',         'Gauge R&R',           'MSA, measurement system analysis, bias and linearity',         30),
  ('ppap',             'PPAP',                'Production part approval process, submission levels',          40),
  ('as9102',           'AS9102',              'Aerospace first article inspection reporting',                 50),
  ('fai',              'FAI',                 'First article inspection, ballooning, characteristic lists',   60),
  ('cmm',              'CMM',                 'Coordinate measuring machines, probing, uncertainty',          70),
  ('metrology',        'Metrology',           'Gauges, calibration, measurement uncertainty',                 80),
  ('tolerance-stack',  'Tolerance Stack-Up',  'Worst case, RSS, statistical stack analysis',                  90),
  ('fits-tolerances',  'Fits & Tolerances',   'ISO 286, press fits, clearance and interference',             100),
  ('sheet-metal',      'Sheet Metal',         'Bend allowance, K-factor, minimum bend radius, flat patterns',110),
  ('machining',        'Machining',           'Speeds and feeds, chip load, tooling, cycle time',            120),
  ('welding',          'Welding',             'Heat input, WPS, weld symbols, distortion',                   130),
  ('casting',          'Casting & Forging',   'Draft, shrinkage, porosity, near-net-shape',                  140),
  ('materials',        'Materials',           'Steel grades, heat treatment, hardness, coatings',            150),
  ('fmea',             'FMEA',                'PFMEA, DFMEA, action priority, RPN',                          160),
  ('spc',              'SPC',                 'Control charts, subgrouping, out-of-control rules',           170),
  ('quality-systems',  'Quality Systems',     'IATF 16949, ISO 9001, ISO 13485, audits',                     180),
  ('root-cause',       'Root Cause',          '8D, 5-why, Ishikawa, corrective action',                      190),
  ('inspection',       'Inspection',          'Sampling, AQL, go/no-go, visual standards',                   200),
  ('production',       'Production',          'OEE, takt time, line balancing, changeover',                  210),
  ('costing',          'Costing & Quoting',   'Cycle cost, COPQ, quoting, should-cost',                      220),
  ('supplier-quality', 'Supplier Quality',    'APQP, supplier audits, incoming inspection',                  230),
  ('drawings',         'Drawings & CAD',      'Drawing interpretation, revisions, model-based definition',   240),
  ('careers',          'Careers',             'Interviews, certifications, growing as a quality engineer',   250),
  ('shop-floor',       'Shop Floor',          'Day-to-day problems that do not fit anywhere else',           260)
on conflict (slug) do nothing;

-- ============================================================================
-- Hardening — applied as migration forum_05_harden_function_grants
-- ----------------------------------------------------------------------------
-- Postgres grants EXECUTE to PUBLIC on new functions by default, which exposes
-- every SECURITY DEFINER helper (including trigger functions) under
-- /rest/v1/rpc/*. Internal machinery must not be callable by a client role.
-- ============================================================================

alter function public.forum_slugify(text)      set search_path = public;
alter function public.forum_touch_updated_at() set search_path = public;

do $$
declare fn text;
begin
  foreach fn in array array[
    'public.forum_recalc_reputation(uuid)',
    'public.forum_answers_sync()',
    'public.forum_votes_sync()',
    'public.forum_votes_block_self()',
    'public.forum_tag_counts_sync()',
    'public.forum_questions_set_slug()',
    'public.forum_profiles_guard()',
    'public.forum_rate_limit_questions()',
    'public.forum_rate_limit_answers()',
    'public.forum_touch_updated_at()'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', fn);
  end loop;
end $$;

revoke all on function public.forum_ask(text, text, text[])    from public, anon;
revoke all on function public.forum_vote(uuid, uuid, smallint) from public, anon;
revoke all on function public.forum_accept_answer(uuid)        from public, anon;
revoke all on function public.forum_ensure_profile(text, text) from public, anon;

grant execute on function public.forum_ask(text, text, text[])    to authenticated;
grant execute on function public.forum_vote(uuid, uuid, smallint) to authenticated;
grant execute on function public.forum_accept_answer(uuid)        to authenticated;
grant execute on function public.forum_ensure_profile(text, text) to authenticated;

revoke all on function public.forum_view(text)     from public;
revoke all on function public.forum_is_moderator() from public;
revoke all on function public.forum_is_active()    from public;
revoke all on function public.forum_slugify(text)  from public;

-- anon needs these two: RLS policies scoped `to anon` evaluate them directly.
grant execute on function public.forum_view(text)     to anon, authenticated;
grant execute on function public.forum_is_moderator() to anon, authenticated;
grant execute on function public.forum_is_active()    to anon, authenticated;

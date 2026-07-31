#!/usr/bin/env node
/* ==========================================================================
   MetricMech Forum — static pre-render

   Snapshots every forum thread and topic into real HTML files so crawlers get
   fully-formed content with QAPage schema, while readers still get the live,
   interactive page (the client re-fetches and replaces the snapshot on load).

   Writes:
     forum/q/<slug>.html    one per question   (from forum/question.html)
     forum/t/<slug>.html    one per used topic (from forum/tag.html)
     sitemap-forum.xml      its own sitemap, so the content autopilot and this
                            job never fight over the same file

   Vercel serves the filesystem before applying rewrites, so a pre-rendered
   /forum/q/<slug> wins; anything newer than the last run falls through the
   rewrite to forum/question.html and still renders client-side.

   No dependencies — plain Node 20 with global fetch. Reads only public data
   through the anon key, so it needs no secrets.
   ========================================================================== */

import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MD = require(resolve(ROOT, 'assets/forum-md.js'));

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://wzxowvrvuecybdxymjvi.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_NYFIl1lGQHd0SwWb0dJCUw_VtdIV8Kj';
const SITE = 'https://metricmech.com';

const esc = MD.esc;
const isoDay = (d) => new Date(d).toISOString().slice(0, 10);

// JSON.stringify leaves `<` alone, so a display name of "</script><script>…"
// would break straight out of the ld+json block. Escape the three characters
// that can terminate it. Still valid JSON — \uXXXX is legal in a JSON string.
const jsonLd = (obj) =>
  JSON.stringify(obj, null, 2)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');

/* ----------------------------------------------------------------- fetch */

async function api(path, params = {}) {
  const url = new URL(`${SUPABASE_URL}/rest/v1/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, Accept: 'application/json' }
  });
  if (!res.ok) throw new Error(`${path} → ${res.status} ${await res.text()}`);
  return res.json();
}

async function fetchAll(path, params = {}, pageSize = 500) {
  const out = [];
  for (let offset = 0; ; offset += pageSize) {
    const page = await api(path, { ...params, limit: pageSize, offset });
    out.push(...page);
    if (page.length < pageSize) return out;
  }
}

/* ---------------------------------------------------------------- render */

function bylineHTML(p, verb, iso) {
  const name = esc(p.author_name || 'Former member');
  const rep = p.author_reputation ? `<span class="fm-rep">${p.author_reputation}</span>` : '';
  const initials = String(p.author_name || '?').trim().split(/\s+/).slice(0, 2)
    .map((w) => w[0]).join('').toUpperCase();
  const av = p.author_avatar
    ? `<img class="fm-avatar" src="${esc(p.author_avatar)}" alt="" width="26" height="26" style="width:26px;height:26px" loading="lazy" referrerpolicy="no-referrer">`
    : `<span class="fm-avatar fm-avatar-fb" style="width:26px;height:26px;font-size:10px">${esc(initials)}</span>`;
  return `<div class="fm-byline">${av}<strong>${name}</strong>${rep}` +
         `<span>· ${verb} <time datetime="${iso}">${isoDay(iso)}</time></span></div>`;
}

function threadHTML(q, answers) {
  const tags = (q.tags || [])
    .map((t) => `<a class="fm-tag" href="/forum/t/${encodeURIComponent(t.slug)}">${esc(t.name)}</a>`)
    .join('');

  let html =
    `<h1>${esc(q.title)}</h1>` +
    `<div class="fm-thread-meta">` +
      `<span>Asked <time datetime="${q.created_at}">${isoDay(q.created_at)}</time></span>` +
      `<span>${q.view_count} views</span>` +
      `<span>${q.answer_count} ${q.answer_count === 1 ? 'answer' : 'answers'}</span>` +
      (q.has_accepted ? `<span style="color:var(--ok)">Solved</span>` : '') +
    `</div>` +
    `<div class="fm-post">` +
      `<div class="fm-votecol"><span class="fm-score">${q.vote_score}</span></div>` +
      `<div><div class="fm-body">${MD.renderBody(q.body)}</div>` +
        `<div class="fm-post-foot"><div class="fm-tags">${tags}</div>${bylineHTML(q, 'asked', q.created_at)}</div>` +
      `</div>` +
    `</div>`;

  html += `<div class="fm-section-head"><h2>` +
    (answers.length ? `${answers.length} ${answers.length === 1 ? 'Answer' : 'Answers'}` : 'No answers yet') +
    `</h2></div>`;

  if (!answers.length) {
    html += `<div class="fm-empty" style="padding:34px 20px"><h3>Be the first to answer</h3>` +
      `<p>Someone on a shop floor is blocked on this right now. If you have solved it before, two minutes of your time is worth a lot here.</p></div>`;
  } else {
    html += answers.map((a) =>
      `<div class="fm-post${a.is_accepted ? ' accepted' : ''}">` +
        `<div class="fm-votecol"><span class="fm-score">${a.vote_score}</span></div>` +
        `<div>` +
          (a.is_accepted ? `<div class="fm-accepted-pill">Accepted answer</div>` : '') +
          `<div class="fm-body">${MD.renderBody(a.body)}</div>` +
          `<div class="fm-post-foot"><span></span>${bylineHTML(a, 'answered', a.created_at)}</div>` +
        `</div>` +
      `</div>`
    ).join('');
  }

  return html;
}

function questionHead(q, answers) {
  const url = `${SITE}/forum/q/${encodeURIComponent(q.slug)}`;
  const desc = MD.toText(q.body, 155);
  const title = `${q.title} | MetricMech Forum`;

  const jsonld = {
    '@context': 'https://schema.org',
    '@type': 'QAPage',
    mainEntity: {
      '@type': 'Question',
      name: q.title,
      text: MD.toText(q.body, 5000),
      answerCount: answers.length,
      upvoteCount: q.vote_score,
      datePublished: q.created_at,
      author: { '@type': 'Person', name: q.author_name || 'MetricMech member' },
      ...(answers.length ? (() => {
        const accepted = answers.find((a) => a.is_accepted);
        const toAnswer = (a) => ({
          '@type': 'Answer',
          text: MD.toText(a.body, 5000),
          upvoteCount: a.vote_score,
          datePublished: a.created_at,
          url: `${url}#a-${a.id}`,
          author: { '@type': 'Person', name: a.author_name || 'MetricMech member' }
        });
        const rest = answers.filter((a) => !a.is_accepted).map(toAnswer);
        return {
          ...(accepted ? { acceptedAnswer: toAnswer(accepted) } : {}),
          ...(rest.length ? { suggestedAnswer: rest } : {})
        };
      })() : {})
    },
    breadcrumb: {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE}/` },
        { '@type': 'ListItem', position: 2, name: 'Forum', item: `${SITE}/forum` },
        { '@type': 'ListItem', position: 3, name: q.title, item: url }
      ]
    }
  };

  return `<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}" />
<link rel="canonical" href="${url}">
<meta name="robots" content="${answers.length ? 'index, follow, max-snippet:-1, max-image-preview:large' : 'noindex, follow'}">
<meta property="og:type" content="article">
<meta property="og:title" content="${esc(q.title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${url}">
<meta property="og:site_name" content="MetricMech">
<meta property="og:image" content="${SITE}/icons/icon-512.png">
<meta property="og:locale" content="en_IN">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(q.title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${SITE}/icons/icon-512.png">
<script type="application/ld+json">
${jsonLd(jsonld)}
</script>`;
}

function tagHead(tag, rows) {
  const url = `${SITE}/forum/t/${encodeURIComponent(tag.slug)}`;
  const desc = `${rows.length} question${rows.length === 1 ? '' : 's'} on ${tag.name} answered by working manufacturing engineers. ${tag.description || ''}`.trim().slice(0, 155);

  const jsonld = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `${tag.name} — MetricMech Forum`,
    url,
    description: desc,
    isPartOf: { '@type': 'WebSite', name: 'MetricMech', url: SITE },
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: rows.slice(0, 50).map((r, i) => ({
        '@type': 'ListItem', position: i + 1, name: r.title,
        url: `${SITE}/forum/q/${encodeURIComponent(r.slug)}`
      }))
    }
  };

  return `<title>${esc(tag.name)} — Questions &amp; Answers | MetricMech Forum</title>
<meta name="description" content="${esc(desc)}" />
<link rel="canonical" href="${url}">
<meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(tag.name)} — MetricMech Forum">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${SITE}/icons/icon-512.png">
<script type="application/ld+json">
${jsonLd(jsonld)}
</script>`;
}

function tagListHTML(rows) {
  if (!rows.length) {
    return `<div class="fm-empty"><h3>Nothing here yet</h3><p>No questions in this topic so far.</p></div>`;
  }
  return rows.map((r) => {
    const tags = (r.tags || [])
      .map((t) => `<a class="fm-tag" href="/forum/t/${encodeURIComponent(t.slug)}">${esc(t.name)}</a>`).join('');
    const cls = r.has_accepted ? 'solved' : (r.answer_count > 0 ? 'answered' : '');
    const label = r.has_accepted ? 'solved' : (r.answer_count === 1 ? 'answer' : 'answers');
    return `<article class="fm-item">` +
      `<div class="fm-stats">` +
        `<div class="fm-stat"><b>${r.vote_score}</b>${Math.abs(r.vote_score) === 1 ? 'vote' : 'votes'}</div>` +
        `<div class="fm-stat ${cls}"><b>${r.answer_count}</b>${label}</div>` +
        `<div class="fm-stat"><b>${r.view_count}</b>views</div>` +
      `</div>` +
      `<div><h3><a href="/forum/q/${encodeURIComponent(r.slug)}">${esc(r.title)}</a></h3>` +
        `<p class="fm-excerpt">${esc(r.excerpt)}</p>` +
        `<div class="fm-item-foot"><div class="fm-tags">${tags}</div>` +
        bylineHTML(r, 'asked', r.created_at) + `</div></div></article>`;
  }).join('');
}

/* ------------------------------------------------------------- templating */

function replaceBlock(html, name, content) {
  const re = new RegExp(`<!--MM:${name}-->[\\s\\S]*?<!--/MM:${name}-->`);
  if (!re.test(html)) throw new Error(`template is missing the MM:${name} block`);
  return html.replace(re, `<!--MM:${name}-->\n${content}\n<!--/MM:${name}-->`);
}

// Templates live at /forum/*.html and reference assets as "../x". The output
// lives one level deeper at /forum/q/*.html, so make every reference absolute.
function absolutize(html) {
  return html.replace(/(\b(?:href|src)=")\.\.\//g, '$1/')
             .replace(/(data-prefix=")\.\.\/(")/g, '$1/$2');
}

/* -------------------------------------------------------------------- run */

async function main() {
  const started = Date.now();
  console.log('MetricMech forum pre-render');

  const [questionsRaw, tags] = await Promise.all([
    fetchAll('forum_question_list', {
      select: 'id,slug,title,excerpt,view_count,answer_count,vote_score,has_accepted,is_closed,created_at,last_activity_at,author_handle,author_name,author_avatar,author_reputation,tags,tag_slugs',
      order: 'created_at.desc'
    }),
    api('forum_tags', { select: 'slug,name,description,question_count', order: 'sort_order.asc' })
  ]);

  if (!questionsRaw.length) {
    console.log('No questions yet — nothing to pre-render.');
    await writeSitemap([], []);
    return;
  }

  const bodies = await fetchAll('forum_questions', { select: 'id,body,author_id', deleted_at: 'is.null' });
  const bodyById = new Map(bodies.map((b) => [b.id, b.body]));

  const answersRaw = await fetchAll('forum_answers', {
    select: 'id,question_id,body,vote_score,is_accepted,created_at,forum_profiles(display_name,avatar_url,reputation)',
    deleted_at: 'is.null',
    order: 'is_accepted.desc,vote_score.desc,created_at.asc'
  });

  const answersByQ = new Map();
  for (const a of answersRaw) {
    const p = a.forum_profiles || {};
    a.author_name = p.display_name;
    a.author_avatar = p.avatar_url;
    a.author_reputation = p.reputation;
    if (!answersByQ.has(a.question_id)) answersByQ.set(a.question_id, []);
    answersByQ.get(a.question_id).push(a);
  }

  const questions = questionsRaw
    .filter((q) => bodyById.has(q.id))
    .map((q) => ({ ...q, body: bodyById.get(q.id) }));

  // Rebuild from scratch so questions deleted by a moderator stop being served.
  const qDir = resolve(ROOT, 'forum/q');
  const tDir = resolve(ROOT, 'forum/t');
  for (const dir of [qDir, tDir]) {
    if (existsSync(dir)) await rm(dir, { recursive: true, force: true });
    await mkdir(dir, { recursive: true });
  }

  const qTemplate = absolutize(await readFile(resolve(ROOT, 'forum/question.html'), 'utf8'));
  const tTemplate = absolutize(await readFile(resolve(ROOT, 'forum/tag.html'), 'utf8'));

  let noindexed = 0;
  for (const q of questions) {
    const answers = answersByQ.get(q.id) || [];
    if (!answers.length) noindexed++;
    let out = replaceBlock(qTemplate, 'HEAD', questionHead(q, answers));
    out = replaceBlock(out, 'THREAD', threadHTML(q, answers));
    await writeFile(resolve(qDir, `${q.slug}.html`), out, 'utf8');
  }
  console.log(`  ${questions.length} question page(s) written` +
              (noindexed ? ` (${noindexed} noindexed — no answers yet)` : ''));

  const usedTags = [];
  for (const tag of tags) {
    const rows = questions.filter((q) => (q.tag_slugs || []).some((s) => s.toLowerCase() === tag.slug.toLowerCase()));
    if (!rows.length) continue;
    usedTags.push({ tag, rows });
    let out = replaceBlock(tTemplate, 'HEAD', tagHead(tag, rows));
    out = replaceBlock(out, 'LIST', tagListHTML(rows));
    await writeFile(resolve(tDir, `${tag.slug}.html`), out, 'utf8');
  }
  console.log(`  ${usedTags.length} topic page(s) written (${tags.length - usedTags.length} topics still empty)`);

  await writeSitemap(questions, usedTags, answersByQ);
  console.log(`Done in ${((Date.now() - started) / 1000).toFixed(1)}s`);
}

async function writeSitemap(questions, usedTags, answersByQ = new Map()) {
  // Only list threads that have at least one answer — the question pages are
  // marked noindex until then, and a sitemap should not disagree with the page.
  const answered = questions.filter((q) => (answersByQ.get(q.id) || []).length > 0);

  const urls = [
    `  <url>\n    <loc>${SITE}/forum</loc>\n    <lastmod>${isoDay(Date.now())}</lastmod>\n    <changefreq>daily</changefreq>\n    <priority>0.8</priority>\n  </url>`,
    ...usedTags.map(({ tag, rows }) => {
      const last = rows.reduce((m, r) => (r.last_activity_at > m ? r.last_activity_at : m), rows[0].last_activity_at);
      return `  <url>\n    <loc>${SITE}/forum/t/${encodeURIComponent(tag.slug)}</loc>\n    <lastmod>${isoDay(last)}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.6</priority>\n  </url>`;
    }),
    ...answered.map((q) =>
      `  <url>\n    <loc>${SITE}/forum/q/${encodeURIComponent(q.slug)}</loc>\n    <lastmod>${isoDay(q.last_activity_at)}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.7</priority>\n  </url>`)
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
  await writeFile(resolve(ROOT, 'sitemap-forum.xml'), xml, 'utf8');
  console.log(`  sitemap-forum.xml — ${urls.length} URL(s)` +
              (questions.length - answered.length ? `, ${questions.length - answered.length} unanswered thread(s) held back` : ''));
}

main().catch((err) => {
  console.error('Pre-render failed:', err.message);
  process.exit(1);
});

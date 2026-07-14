#!/usr/bin/env python3
"""Blog autopilot orchestrator. Run from repo root:
    python3 content-engine/scripts/run_pipeline.py [--dry-run]
Flow: caps gate -> pop queue -> generate (Claude API) -> build HTML on site chrome -> lint ->
      AI critic (max 2 repair loops) -> register (hub + sitemap + 2 inbound links) -> log.
A failing post is marked blocked and NEVER published. Commit/push/IndexNow/GSC/notify happen in the workflow."""
import os, re, sys, json, html, subprocess, datetime
import yaml

ROOT = os.getcwd()
CE = os.path.join(ROOT, 'content-engine')
CFG = yaml.safe_load(open(f'{CE}/site-config.yaml'))
MODEL = os.environ.get('AUTOPILOT_MODEL', 'claude-sonnet-4-6')
DRY = '--dry-run' in sys.argv
TODAY = datetime.date.today()

def die(msg, code=0):
    print(msg); sys.exit(code)

# ---------- 1. HARD CAPS (safety feature — do not remove) ----------
log = yaml.safe_load(open(f'{CE}/published-log.yaml')) or {}
posts = [p for p in (log.get('posts') or []) if p.get('source') != 'pre-autopilot']
week = TODAY.isocalendar()[:2]
this_week = [p for p in posts if datetime.date.fromisoformat(str(p['date'])).isocalendar()[:2] == week]
today_posts = [p for p in posts if str(p['date']) == TODAY.isoformat()]
if len(today_posts) >= CFG['daily_cap']:
    die(f"CAP: already published {len(today_posts)} post(s) today (cap {CFG['daily_cap']}). Refusing to publish more.")
if len(this_week) >= CFG['weekly_cap']:
    die(f"CAP: already published {len(this_week)} post(s) this ISO week (cap {CFG['weekly_cap']}). Refusing to publish more.")

# ---------- 2. Pop queue ----------
q = yaml.safe_load(open(f'{CE}/keyword-queue.yaml'))
entry = next((e for e in q['queue'] if e.get('status') == 'queued'), None)
if not entry: die('Queue empty — nothing to publish. Add keywords to keyword-queue.yaml.')
KW = entry['keyword']
print(f"Generating: {KW}")

# ---------- 3. Context for the generator ----------
truth = ''
if CFG.get('feature_truth'):
    truth = open(os.path.join(ROOT, CFG['feature_truth'])).read()
stories = yaml.safe_load(open(f'{CE}/story-bank.yaml')) or {}
story = next((s for s in (stories.get('stories') or [])
              if not s.get('used_in') and set(s.get('tags', [])) & set(KW.lower().split())), None)
template = open(f"{CE}/templates/tutorial.md").read()
existing = yaml.safe_load(open(f'{CE}/published-log.yaml'))['posts']
existing_titles = '\n'.join(f"- {p['url']} — {p['title']}" for p in existing[-60:])

def call_claude(system, user, max_tokens=16000):
    import urllib.request
    key = os.environ.get('ANTHROPIC_API_KEY')
    if not key: die('ANTHROPIC_API_KEY not set', 1)
    req = urllib.request.Request('https://api.anthropic.com/v1/messages',
        data=json.dumps({"model": MODEL, "max_tokens": max_tokens, "system": system,
                         "messages": [{"role": "user", "content": user}]}).encode(),
        headers={'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json'})
    with urllib.request.urlopen(req, timeout=600) as r:
        return json.loads(r.read())['content'][0]['text']

GEN_SYSTEM = f"""You write SEO blog posts for {CFG['site']} as Rajadurai R, a mechanical engineer and
plant head with 14 years of experience. Follow the template exactly. ABSOLUTE RULES:
- No fabricated personal anecdotes. {'Use the provided real story naturally.' if story else 'NO first-person stories at all in this post — write as an expert explainer.'}
- Product claims only from the feature-truth file (status: live). No invented statistics or testimonials.
- Never hyperlink competitors; naming them is fine.
- Return EXACTLY the ===META=== / ===BODY=== / ===END=== sections specified, no markdown fences."""

NL = chr(10)
truth_block = ('FEATURE TRUTH FILE:' + NL + truth) if truth else ''
story_block = ('REAL FOUNDER STORY to weave in (verbatim facts, natural phrasing):' + NL + story['story']) if story else ''
GEN_USER = f"""Write a post targeting the primary keyword: "{KW}"
Intent: {entry['intent']} | Audience: {entry['audience']} engineers | Target words: {entry['word_count']}
Secondary keywords: {', '.join(entry.get('secondary', []))}

TEMPLATE:\n{template}\n
{truth_block}
{story_block}
EXISTING POSTS (link 2-3 relevant ones; NEVER reuse these topics):\n{existing_titles}

Return your answer in EXACTLY this format (three sentinel lines, no markdown fences):
===META===
{{a JSON object with keys: slug (3-5 hyphenated words), title (40-65 chars incl ' | {'CadNexa' if CFG['site']=='cadnexa' else 'MetricMech'}'),
  meta_description (120-156 chars), tag (2-3 word category), read_minutes (int), h1,
  toc (list of [anchor, label] pairs for metricmech; empty list for cadnexa),
  faq (list of objects with keys q and a, for FAQPage schema), card_blurb (1-2 sentence hub-card description)}}
===BODY===
the full article inner HTML (NOT inside JSON): h2/h3/p/table/ul/ol, internal links per template,
FAQ section with h3 questions; for cadnexa use classes highlight/cta-box; for metricmech use
classes lede/callout/warn-box and id anchors on h2 for the TOC
===END==="""

def extract_json(s):
    s = s.strip()
    if s.startswith('```'): s = re.sub(r'^```\w*\n|\n```$', '', s)
    return json.loads(s[s.index('{'):s.rindex('}')+1])

def parse_generation(raw):
    """Preferred: sentinel format — body HTML travels OUTSIDE the JSON so one bad escape
    cannot kill the run. Falls back to the legacy single-JSON format."""
    m = re.search(r'===META===\s*(.*?)\s*===BODY===\s*(.*?)\s*(?:===END===|\Z)', raw, re.S)
    if m:
        meta = m.group(1)
        g = json.loads(meta[meta.index('{'):meta.rindex('}')+1])
        g['body_html'] = m.group(2).strip()
        if not g['body_html']: raise ValueError('empty body_html')
        return g
    return extract_json(raw)

def enforce_meta(g):
    """Deterministically fix title/meta length near-misses so repair loops are not wasted on them."""
    brand = 'CadNexa' if CFG['site'] == 'cadnexa' else 'MetricMech'
    for _ in range(3):
        t = g.get('title', '')
        if 40 <= len(t) <= 65 and KW.lower() in t.lower(): break
        g['title'] = call_claude(
            'You fix SEO title tags. Return ONLY the corrected title text, no quotes, no explanation.',
            f'Rewrite this title tag: "{t}"\nHARD RULES: total length 45-63 characters INCLUDING the ending '
            f'" | {brand}"; must contain the exact phrase "{KW}" (title-case is fine); must end with " | {brand}".',
            200).strip().strip('"')
    for _ in range(3):
        d = g.get('meta_description', '')
        if 120 <= len(d) <= 156: break
        g['meta_description'] = call_claude(
            'You fix SEO meta descriptions. Return ONLY the corrected description text, no quotes, no explanation.',
            f'Rewrite this meta description to 125-150 characters (hard limits). Keep the phrase "{KW}" and the meaning:\n{d}',
            300).strip().strip('"')
    return g

def generate(user_prompt):
    """Call the generator; retry up to 3x if the output cannot be parsed."""
    last = None
    for i in range(3):
        raw = call_claude(GEN_SYSTEM, user_prompt)
        try:
            return raw, enforce_meta(parse_generation(raw))
        except Exception as e:
            print(f'unparseable generator output (attempt {i+1}/3): {e}')
            last = e
    die(f'generation failed: unparseable output after 3 attempts: {last}', 1)

# ---------- 4. Build HTML on the site chrome ----------
def build_html(g):
    tpl = open(os.path.join(ROOT, CFG['chrome_template']), encoding='utf-8').read()
    if CFG['site'] == 'cadnexa':
        url = f"https://cadnexa.com/blog-{g['slug']}.html"
        h = tpl
        h = re.sub(r'<title>.*?</title>', f"<title>{g['title']}</title>", h, flags=re.S)
        for pat, val in [(r'<meta name="description" content=".*?">', f'<meta name="description" content="{g["meta_description"]}">'),
                         (r'<meta property="og:title" content=".*?">', f'<meta property="og:title" content="{g["title"].split(" | ")[0]}">'),
                         (r'<meta property="og:description" content=".*?">', f'<meta property="og:description" content="{g["meta_description"]}">'),
                         (r'<meta property="og:url" content=".*?">', f'<meta property="og:url" content="{url}">'),
                         (r'<link rel="canonical" href=".*?">', f'<link rel="canonical" href="{url}">')]:
            h = re.sub(pat, val, h)
        meta = (f'<div class="meta">\n    <span class="tag">{g["tag"]}</span>\n    <span>{TODAY.strftime("%B %d, %Y")}</span>'
                f'\n    <span>{g["read_minutes"]} min read</span>\n    <span>{CFG["byline"]}</span>\n  </div>')
        body = f'<article>\n  {meta}\n\n  <h1>{g["h1"]}</h1>\n\n{g["body_html"]}\n</article>'
        h = re.sub(r'<article>.*?</article>', lambda m: body, h, flags=re.S)
        ld = [{"@context":"https://schema.org","@type":"Article","headline":g['title'].split(' | ')[0],
               "description":g['meta_description'],
               "author":{"@type":"Person","name":"Rajadurai R","jobTitle":"Founder, CadNexa"},
               "publisher":{"@type":"Organization","name":"CadNexa","url":"https://cadnexa.com"},
               "datePublished":TODAY.isoformat(),"url":url},
              {"@context":"https://schema.org","@type":"FAQPage","mainEntity":[
               {"@type":"Question","name":f['q'],"acceptedAnswer":{"@type":"Answer","text":f['a']}} for f in g['faq']]},
              {"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[
               {"@type":"ListItem","position":1,"name":"Home","item":"https://cadnexa.com/"},
               {"@type":"ListItem","position":2,"name":"Blog","item":"https://cadnexa.com/blog.html"},
               {"@type":"ListItem","position":3,"name":g['h1'][:80],"item":url}]}]
        blocks = '\n'.join('<script type="application/ld+json">\n'+json.dumps(o, indent=2, ensure_ascii=False)+'\n</script>' for o in ld)
        h = re.sub(r'<script type="application/ld\+json">.*</script>', blocks, h, flags=re.S)
        out = f"blog-{g['slug']}.html"
    else:
        url = f"https://metricmech.com/articles/{g['slug']}"
        h = tpl
        h = re.sub(r'<title>.*?</title>', f"<title>{g['title']}</title>", h, flags=re.S)
        old_desc = re.search(r'<meta name="description" content="(.*?)"', h, re.S).group(1)
        h = h.replace(old_desc, g['meta_description'])
        old_canon = re.search(r'<link rel="canonical" href="(.*?)"', h).group(1)
        h = h.replace(old_canon, url)
        for pat in [r'(<meta property="og:title" content=")(.*?)(")', r'(<meta name="twitter:title" content=")(.*?)(")']:
            h = re.sub(pat, lambda m: m.group(1)+g['title']+m.group(3), h)
        # replace the two ld+json blocks + breadcrumb, toc, article
        ld = [{"@context":"https://schema.org","name":g['title'],"description":g['meta_description'],"url":url,
               "publisher":{"@type":"Organization","name":"MetricMech","url":"https://metricmech.com",
               "logo":{"@type":"ImageObject","url":"https://metricmech.com/icons/icon-512.png"}},
               "@type":"Article","headline":g['h1'],
               "author":{"@type":"Person","name":"Rajadurai R","jobTitle":"Founder, Plant Head, Mechanical Engineer"},
               "datePublished":TODAY.isoformat(),"mainEntityOfPage":url},
              {"@context":"https://schema.org","@type":"FAQPage","mainEntity":[
               {"@type":"Question","name":f['q'],"acceptedAnswer":{"@type":"Answer","text":f['a']}} for f in g['faq']]},
              {"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[
               {"@type":"ListItem","position":1,"name":"Home","item":"https://metricmech.com/"},
               {"@type":"ListItem","position":2,"name":"Articles","item":"https://metricmech.com/articles.html"},
               {"@type":"ListItem","position":3,"name":g['h1'][:80],"item":url}]}]
        blocks = '\n'.join('<script type="application/ld+json">\n'+json.dumps(o, indent=2, ensure_ascii=False)+'\n</script>' for o in ld)
        h = re.sub(r'<script type="application/ld\+json">.*</script>\n\n</head>', blocks + '\n\n</head>', h, flags=re.S)
        bc = re.search(r'(<span class="sep">/</span>)([^<]*)(</div>)', h)
        h = h[:bc.start(2)] + g['h1'][:40] + h[bc.end(2):]
        toc = '\n'.join(f'    <a href="#{a}">{l}</a>' for a, l in g.get('toc', []))
        h = re.sub(r'(<h4>On this page</h4>\n).*?(\n  </aside>)', lambda m: m.group(1)+toc+m.group(2), h, flags=re.S)
        meta_bar = (f'<div class="art-meta-bar">\n      <span>{g["tag"]}</span>\n      <span>{TODAY.strftime("%B %d, %Y")}</span>'
                    f'\n      <span>{g["read_minutes"]} min read</span>\n      <span>{CFG["byline"]}</span>\n    </div>')
        article = (f'<article class="art-content">\n    <h1>{g["h1"]}</h1>\n    {meta_bar}\n\n{g["body_html"]}\n\n'
                   '    <div class="author-card">\n      <div class="author-avatar">RR</div>\n      <div>\n'
                   '        <div class="author-name">Rajadurai R</div>\n'
                   '        <div class="author-title">Founder, 14 years plant-head experience · Mechanical engineer</div>\n'
                   '      </div>\n    </div>\n\n  </article>')
        h = re.sub(r'<article class="art-content">.*?</article>', lambda m: article, h, flags=re.S)
        out = f"articles/{g['slug']}.html"
    open(os.path.join(ROOT, out), 'w', encoding='utf-8').write(h)
    return out, url

# ---------- 5. Generate -> lint -> critic loop (max 2 repairs) ----------
CRITIC_SYSTEM = """You are a strict technical editor for a manufacturing engineering blog. Check the post and return ONLY JSON:
{"verdict": "PASS" | "FAIL", "fixes": ["specific instruction", ...]}
FAIL if ANY: a product claim is not backed by a live entry in the feature-truth file; a formula, standard
reference or technical fact is wrong; the intro does not answer the primary keyword within 100 words;
any first-person anecdote appears that is not in the provided story bank; pricing differs from feature-truth;
it reads like marketing copy instead of a senior engineer; a competitor is hyperlinked.
NOT failures (approved boilerplate — never flag these): the site byline/author-card "Rajadurai R,
Founder, 14 years plant-head experience" (a credential, not an anecdote); cross-links to cadnexa.com
or metricmech.com (same owner, pre-approved); links to the site's own calculators/tools.
Judge only the article body content."""

attempt, out_file, url = 0, None, None
raw, g = generate(GEN_USER)
while attempt <= 2:
    out_file, url = build_html(g)
    lint = subprocess.run([sys.executable, f'{CE}/scripts/lint_post.py', out_file, KW, str(entry['word_count'])],
                          capture_output=True, text=True)
    critic_raw = call_claude(CRITIC_SYSTEM,
        f"PRIMARY KEYWORD: {KW}\n\nFEATURE TRUTH:\n{truth or '(n/a — metricmech has no product claims beyond the CadNexa cross-link)'}\n\n"
        f"STORY BANK PROVIDED: {json.dumps(story) if story else 'none — zero anecdotes allowed'}\n\nPOST HTML:\n{open(out_file, encoding='utf-8').read()}", 2000)
    try: critic = extract_json(critic_raw)
    except Exception: critic = {"verdict": "FAIL", "fixes": ["critic returned unparseable output"]}
    if lint.returncode == 0 and critic['verdict'] == 'PASS':
        print(lint.stdout.strip()); print('CRITIC PASS'); break
    attempt += 1
    problems = (lint.stdout + '\n' + '\n'.join(critic.get('fixes', []))).strip()
    print(f'REPAIR LOOP {attempt}:\n{problems}')
    if attempt > 2:
        os.remove(out_file)
        entry['status'] = 'blocked'; entry['note'] = f'QA failed {TODAY}: ' + problems[:400]
        yaml.safe_dump(q, open(f'{CE}/keyword-queue.yaml', 'w'), sort_keys=False, allow_unicode=True)
        die(f'DO NOT PUBLISH: "{KW}" failed QA after 2 repair loops. Entry blocked, founder will be notified.', 3)
    raw, g = generate(GEN_USER + f"\n\nYOUR PREVIOUS DRAFT FAILED QA. Fix ALL of these and return the full corrected output in the same ===META===/===BODY===/===END=== format:\n{problems}\n\nPREVIOUS DRAFT:\n{raw}")

if DRY: die(f'DRY RUN OK — built {out_file}, not registering.')

# ---------- 6. Register: hub card + 2 inbound links + sitemap ----------
if CFG['site'] == 'cadnexa':
    hub = open('blog.html', encoding='utf-8').read()
    card = (f'<a href="/{out_file}" class="blog-card">\n  <div class="blog-body">\n    <span class="tag">{g["tag"]}</span>\n'
            f'    <h3>{html.escape(g["h1"], quote=False)}</h3>\n    <p>{g["card_blurb"]}</p>\n'
            f'    <div class="blog-meta"><span>{TODAY.strftime("%b %d, %Y")}</span><span>{g["read_minutes"]} min read</span></div>\n  </div>\n</a>\n')
    hub = hub.replace('<div class="blog-grid">\n', '<div class="blog-grid">\n' + card, 1)
    open('blog.html', 'w', encoding='utf-8').write(hub)
    l = open('learn.html', encoding='utf-8').read()
    lcard = (f'<a href="/{out_file}" class="blog-card" style="text-decoration:none;color:inherit">\n  <div class="blog-body">\n'
             f'    <h3>{html.escape(g["h1"], quote=False)}</h3>\n    <p>{g["card_blurb"]}</p>\n'
             f'    <div class="blog-meta"><span>{TODAY.strftime("%B %Y")}</span><span>{g["read_minutes"]} min read</span></div>\n  </div>\n</a>\n')
    l = l.replace('<div class="blog-grid">\n', '<div class="blog-grid">\n' + lcard, 1)
    open('learn.html', 'w', encoding='utf-8').write(l)
else:
    hub = open('articles.html', encoding='utf-8').read()
    row = (f'<a href="articles/{g["slug"]}.html" class="art-row">\n  <div class="art-meta"><span class="topic-tag">{g["tag"]}</span>'
           f'{TODAY.strftime("%b %d, %Y")}<br>{g["read_minutes"]} min read</div>\n  <div>\n    <h3>{html.escape(g["h1"], quote=False)}</h3>\n'
           f'    <p>{g["card_blurb"]}</p>\n    <div class="byline">By Rajadurai R &middot; Founder, MetricMech &amp; CadNexa</div>\n  </div>\n</a>\n')
    m = re.search(r'<a href="articles/[a-z0-9-]+\.html" class="art-row">', hub)
    hub = hub[:m.start()] + row + hub[m.start():]
    open('articles.html', 'w', encoding='utf-8').write(hub)

# 2 inbound links FROM older relevant posts TO the new post
body_words = set(re.sub(r'<[^>]+>', ' ', g['body_html']).lower().split())
scored = []
posts_glob = subprocess.check_output(['git', 'ls-files', CFG['post_dir'] if CFG['site'] == 'metricmech' else '.'], text=True).split()
for f in posts_glob:
    if CFG['site'] == 'cadnexa' and not (f.startswith('blog-') and f.endswith('.html')): continue
    if CFG['site'] == 'metricmech' and not (f.startswith('articles/') and f.endswith('.html')): continue
    if f == out_file: continue
    ph = open(f, encoding='utf-8').read()
    pt = re.search(r'<title>(.*?)</title>', ph, re.S).group(1).lower()
    score = sum(1 for w in KW.lower().split() if w in pt) + sum(1 for w in pt.split()[:8] if w in body_words)
    scored.append((score, f))
scored.sort(reverse=True)
link_html = (f'<a href="/{out_file}" style="color:#2554ba;font-weight:600">{g["h1"]}</a>' if CFG['site'] == 'cadnexa'
             else f'<a href="../articles/{g["slug"]}.html">{g["h1"]}</a>')
added = 0
for _, f in scored[:4]:
    ph = open(f, encoding='utf-8').read()
    if out_file in ph or added >= 2: continue
    para = f'\n  <p>Also new: {link_html}.</p>\n' if CFG['site'] == 'cadnexa' else f'\n    <p>Also on MetricMech: {link_html}.</p>\n'
    tgt = '</article>' if CFG['site'] == 'cadnexa' else '<div class="author-card">'
    if tgt in ph:
        ph = ph.replace(tgt, para + tgt, 1) if CFG['site'] == 'cadnexa' else ph.replace(tgt, para + '    ' + tgt, 1)
        open(f, 'w', encoding='utf-8').write(ph); added += 1
print(f'inbound links added from {added} older posts')

subprocess.run([sys.executable, CFG['sitemap_script']], check=True)

# ---------- 7. Log + dequeue ----------
entry['status'] = 'published'
yaml.safe_dump(q, open(f'{CE}/keyword-queue.yaml', 'w'), sort_keys=False, allow_unicode=True)
log = yaml.safe_load(open(f'{CE}/published-log.yaml'))
log['posts'].append({'url': url, 'date': TODAY.isoformat(), 'title': g['title'], 'keyword': KW, 'source': 'autopilot'})
yaml.safe_dump(log, open(f'{CE}/published-log.yaml', 'w'), sort_keys=False, allow_unicode=True)
json.dump({'url': url, 'title': g['title'], 'keyword': KW, 'file': out_file}, open('/tmp/autopilot_result.json', 'w'))
print(f'PUBLISHED (pending push): {url}')

#!/usr/bin/env python3
"""Build pillar (topic hub) pages for the site's top clusters (runs in GitHub Actions).
Skips pillars that already exist. Writes content-engine/pillars.yaml used by run_pipeline."""
import os, re, sys, json, html, datetime, subprocess, urllib.request
import yaml

CFG = yaml.safe_load(open('content-engine/site-config.yaml'))
KEY = os.environ['ANTHROPIC_API_KEY']
TODAY = datetime.date.today()

def claude(system, user, max_tokens=10000):
    req = urllib.request.Request('https://api.anthropic.com/v1/messages',
        data=json.dumps({"model": "claude-sonnet-4-6", "max_tokens": max_tokens, "system": system,
                         "messages": [{"role": "user", "content": user}]}).encode(),
        headers={'x-api-key': KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json'})
    with urllib.request.urlopen(req, timeout=600) as r:
        return json.loads(r.read())['content'][0]['text']

PILLARS = {
 'cadnexa': [
   ('AS9102 & FAI', 'as9102-fai-hub', 'AS9102 & First Article Inspection Hub', r'as9102|fai|first article'),
   ('PPAP & APQP', 'ppap-apqp-hub', 'PPAP & APQP Knowledge Hub', r'ppap|apqp|psw|control plan'),
   ('GD&T', 'gdt-hub', 'GD&T Knowledge Hub', r'gd&t|gdt|feature control|datum|tolerance'),
   ('Drawing Ballooning & Inspection Sheets', 'drawing-ballooning-hub', 'Drawing Ballooning & Inspection Hub', r'balloon|inspection sheet|drawing'),
 ],
 'metricmech': [
   ('Fits & Tolerances (ISO 286)', 'fits-tolerances-guide', 'Fits & Tolerances: Complete Guide', r'fit|tolerance|iso 286|shaft|hole'),
   ('Threads & Fasteners', 'threads-fasteners-guide', 'Threads & Fasteners: Complete Guide', r'thread|bolt|screw|fastener|torque|engagement'),
   ('Sheet Metal Design', 'sheet-metal-design-guide', 'Sheet Metal Design: Complete Guide', r'sheet metal|bend|k-factor|flange|press brake'),
   ('GD&T Reference', 'gdt-reference-guide', 'GD&T Reference: Complete Guide', r'gd&t|gdt|flatness|position|profile|runout|datum'),
 ]}

SYS = """You write pillar/hub pages for a manufacturing-engineering site as Rajadurai R, a mechanical engineer and plant head with 14 years of experience. A pillar page is the definitive overview of a topic cluster that links to deeper articles. No fabricated anecdotes, no invented statistics, no marketing fluff. International English.
Return EXACTLY this format (no markdown fences):
===META===
{a JSON object with keys: title (45-63 chars incl the brand suffix given), meta_description (125-150 chars), tag, read_minutes (int), h1, toc (list of [anchor,label] pairs; empty list if told to), faq (list of objects with keys q and a), card_blurb}
===BODY===
the article inner HTML: an authoritative 1100-1400 word overview of the topic cluster with h2 sections (each h2 needs an id anchor if toc requested), covering what it is, why it matters, key standards, common mistakes, and how the linked sub-articles fit together. Naturally hyperlink the provided existing articles inline where relevant. End with an FAQ section (h2 'Frequently asked questions', h3 questions).
===END==="""

site = CFG['site']
brand = 'CadNexa' if site == 'cadnexa' else 'MetricMech'
src = open('content-engine/scripts/run_pipeline.py').read()
seg = src[src.index('# ---------- 4. Build'):src.index('# ---------- 5.')]
ns = {'re': re, 'json': json, 'html': html, 'os': os, 'CFG': CFG, 'TODAY': TODAY, 'ROOT': os.getcwd()}
exec(seg, ns)
build_html = ns['build_html']

pil_path = 'content-engine/pillars.yaml'
pil_map = (yaml.safe_load(open(pil_path)) or {}).get('pillars', {}) if os.path.exists(pil_path) else {}

for cluster, slug, h1, pat in PILLARS[site]:
    out_name = (f'blog-{slug}.html' if site == 'cadnexa' else f'articles/{slug}.html')
    if cluster in pil_map and os.path.exists(pil_map[cluster]['file']):
        print('exists, skipping:', cluster); continue
    files = [f for f in os.listdir('.' if site == 'cadnexa' else 'articles') if f.endswith('.html')]
    links = []
    for f in files:
        path = f if site == 'cadnexa' else f'articles/{f}'
        if site == 'cadnexa' and not f.startswith('blog-'): continue
        if slug in f: continue
        try:
            t = re.search(r'<title>(.*?)</title>', open(path, encoding='utf-8').read(), re.S).group(1).split(' | ')[0].strip()
        except Exception: continue
        if re.search(pat, t, re.I):
            links.append((('/' + path) if site == 'cadnexa' else ('/articles/' + f[:-5]), t))
    links = links[:12]
    linklist = '\n'.join(f'- {u} : {t}' for u, t in links) or '(none yet - write standalone)'
    user = (f"SITE: {brand} ({CFG['base_url']}). Topic cluster: {cluster}.\nH1 to use: {h1}\n"
            f"Title suffix required: ' | {brand}'. TOC: {'required with anchors' if site == 'metricmech' else 'return empty list'}\n"
            f"EXISTING ARTICLES to hyperlink inline where relevant:\n{linklist}")
    g = None
    for attempt in range(3):
        raw = claude(SYS, user)
        m = re.search(r'===META===\s*(.*?)\s*===BODY===\s*(.*?)\s*(?:===END===|\Z)', raw, re.S)
        if not m: print('bad format, retry'); continue
        try:
            meta = m.group(1)
            g = json.loads(meta[meta.index('{'):meta.rindex('}')+1])
            g['slug'] = slug; g['body_html'] = m.group(2).strip(); break
        except Exception as e:
            print('meta parse fail, retry:', e)
    if g is None:
        print('FAILED pillar:', cluster); continue
    lis = '\n'.join(f'      <li><a href="{u}">{html.escape(t, quote=False)}</a></li>' for u, t in links)
    g['body_html'] += ('\n\n  <h2 id="all-articles">All articles in this hub</h2>\n  <ul class="pillar-links">\n'
                       + (lis + '\n' if lis else '') + '      <!-- pillar-list -->\n  </ul>')
    out, url = build_html(g)
    if site == 'cadnexa':
        hub = open('blog.html', encoding='utf-8').read()
        if slug not in hub:
            card = (f'<a href="/{out}" class="blog-card">\n  <div class="blog-body">\n    <span class="tag">Topic Hub</span>\n'
                    f'    <h3>{html.escape(g["h1"], quote=False)}</h3>\n    <p>{g["card_blurb"]}</p>\n'
                    f'    <div class="blog-meta"><span>{TODAY.strftime("%b %d, %Y")}</span><span>{g["read_minutes"]} min read</span></div>\n  </div>\n</a>\n')
            open('blog.html', 'w', encoding='utf-8').write(hub.replace('<div class="blog-grid">\n', '<div class="blog-grid">\n' + card, 1))
    else:
        hub = open('articles.html', encoding='utf-8').read()
        if slug not in hub:
            row = (f'<a href="articles/{slug}.html" class="art-row">\n  <div class="art-meta"><span class="topic-tag">Topic Hub</span>'
                   f'{TODAY.strftime("%b %d, %Y")}<br>{g["read_minutes"]} min read</div>\n  <div>\n    <h3>{html.escape(g["h1"], quote=False)}</h3>\n'
                   f'    <p>{g["card_blurb"]}</p>\n    <div class="byline">By Rajadurai R &middot; Founder, MetricMech &amp; CadNexa</div>\n  </div>\n</a>\n')
            mm = re.search(r'<a href="articles/[a-z0-9-]+\.html" class="art-row">', hub)
            open('articles.html', 'w', encoding='utf-8').write(hub[:mm.start()] + row + hub[mm.start():])
    pil_map[cluster] = {'file': out, 'url': ('/' + out) if site == 'cadnexa' else '/articles/' + slug, 'title': g['h1']}
    print('pillar built:', out)

yaml.safe_dump({'pillars': pil_map}, open(pil_path, 'w'), sort_keys=False, allow_unicode=True)
subprocess.run([sys.executable, CFG['sitemap_script']], check=True)
print('pillars.yaml + sitemap updated')

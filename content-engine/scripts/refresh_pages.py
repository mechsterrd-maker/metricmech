#!/usr/bin/env python3
"""GSC-driven content refresh. Takes 'todo' entries from refresh-queue.yaml (blog/article pages only),
rewrites them with an AI editor pass, runs a strict critic gate, and reindexes. Max 2 pages/run."""
import os, re, sys, json, datetime, subprocess, urllib.request
import yaml

CFG = yaml.safe_load(open('content-engine/site-config.yaml'))
KEY = os.environ['ANTHROPIC_API_KEY']
TODAY = datetime.date.today()
MAX_PAGES = 2

def claude(system, user, max_tokens=16000):
    req = urllib.request.Request('https://api.anthropic.com/v1/messages',
        data=json.dumps({"model": "claude-sonnet-4-6", "max_tokens": max_tokens, "system": system,
                         "messages": [{"role": "user", "content": user}]}).encode(),
        headers={'x-api-key': KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json'})
    with urllib.request.urlopen(req, timeout=600) as r:
        return json.loads(r.read())['content'][0]['text']

rqp = 'content-engine/refresh-queue.yaml'
if not os.path.exists(rqp):
    print('no refresh queue - nothing to do'); sys.exit(0)
rq = yaml.safe_load(open(rqp)) or {'pages': []}

def url_to_file(u):
    f = u.replace(CFG['base_url'] + '/', '').split('?')[0].rstrip('/')
    if not f: return None
    if CFG['site'] == 'metricmech' and not f.endswith('.html'): f += '.html'
    ok = (f.startswith('blog-') if CFG['site'] == 'cadnexa' else f.startswith('articles/'))
    return f if ok and os.path.exists(f) else None

EDITOR_SYS = """You are a senior technical editor improving an EXISTING manufacturing-engineering article so it climbs from page 2 to page 1 of Google. You will receive the current <article> HTML plus its Search Console context.
Improve it: strengthen the opening 100 words into a direct answer; expand thin sections with accurate technical depth (standards, worked numbers); sharpen h2/h3 headings around search phrasing; add an FAQ section if missing (h2 'Frequently asked questions', h3 questions); add a comparison/data table if the topic suits one; keep EVERY existing internal link; do not invent product features, anecdotes or statistics; keep the same voice.
Return ONLY the full replacement inner-article HTML (everything that goes INSIDE <article>...</article>, excluding the article tags themselves). No markdown fences, no commentary."""

CRITIC_SYS = """You are a strict technical editor. Compare a refreshed article against its original. Return ONLY JSON: {"verdict":"PASS"|"FAIL","reasons":["..."]}
FAIL if: any technical fact, formula or standards reference became wrong; an internal link was removed; new unverifiable product claims or personal anecdotes appeared; the article became thinner or marketing-toned."""

done = 0
for pg in rq['pages']:
    if done >= MAX_PAGES: break
    if pg.get('status') != 'todo': continue
    f = url_to_file(pg['url'])
    if not f:
        pg['status'] = 'manual'; pg['note'] = 'not a blog/article page - needs human/dev attention'
        print('MANUAL (not refreshable automatically):', pg['url']); continue
    h = open(f, encoding='utf-8').read()
    m = re.search(r'(<article[^>]*>)(.*?)(</article>)', h, re.S)
    if not m:
        pg['status'] = 'manual'; pg['note'] = 'no <article> region'; continue
    orig = m.group(2)
    ctx = f"URL: {pg['url']}\nGSC: reason={pg.get('reason')}, position={pg.get('position')}, impressions={pg.get('impressions')}\n\nCURRENT ARTICLE HTML:\n{orig}"
    new_inner = None
    for _ in range(2):
        cand = claude(EDITOR_SYS, ctx).strip()
        cand = re.sub(r'^```\w*\n|\n```$', '', cand)
        if len(re.sub(r'<[^>]+>', ' ', cand).split()) < 0.9 * len(re.sub(r'<[^>]+>', ' ', orig).split()):
            print('refresh draft too thin, retrying'); continue
        old_links = set(re.findall(r'href="([^"]+)"', orig))
        if not old_links.issubset(set(re.findall(r'href="([^"]+)"', cand))):
            print('refresh dropped links, retrying'); continue
        try:
            verdict = json.loads(re.search(r'\{.*\}', claude(CRITIC_SYS,
                'ORIGINAL:\n' + orig[:30000] + '\n\nREFRESHED:\n' + cand[:30000], 1000), re.S).group(0))
        except Exception:
            verdict = {'verdict': 'FAIL', 'reasons': ['critic unparseable']}
        if verdict.get('verdict') == 'PASS':
            new_inner = cand; break
        print('critic failed refresh:', verdict.get('reasons'))
    if not new_inner:
        pg['status'] = 'blocked'; pg['note'] = 'QA would not pass an automated refresh'; continue
    open(f, 'w', encoding='utf-8').write(h[:m.start(2)] + '\n' + new_inner + '\n' + h[m.end(2):])
    pg['status'] = 'done'; pg['refreshed'] = TODAY.isoformat()
    done += 1
    print('REFRESHED:', pg['url'])

yaml.safe_dump(rq, open(rqp, 'w'), sort_keys=False, allow_unicode=True)
if done:
    subprocess.run([sys.executable, CFG['sitemap_script']], check=True)
    urls = [p['url'] for p in rq['pages'] if p.get('refreshed') == TODAY.isoformat()]
    subprocess.run([sys.executable, 'scripts/indexnow_submit.py'] + urls + [CFG['base_url'] + '/sitemap.xml'])
print(f'refresh run complete: {done} page(s) refreshed')

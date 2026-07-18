#!/usr/bin/env python3
"""Deterministic linter — a post CANNOT publish unless every check passes.
Usage: python3 content-engine/scripts/lint_post.py <post.html> <primary-keyword> <target-words>"""
import re, json, sys, os, html as H

BANNED = ["delve into", "in today's fast-paced", "in today’s fast-paced", "navigate the complexities",
          "leverage the power of", "in the realm of", "Add image here", "Add cover image", "TODO",
          "coming soon", "[image]", "📸 Screenshot", "lorem ipsum"]

def main():
    path, kw, target = sys.argv[1], sys.argv[2].lower(), int(sys.argv[3])
    h = open(path, encoding='utf-8').read()
    root = os.getcwd()
    errs = []

    for b in BANNED:
        if b.lower() in h.lower(): errs.append(f'banned phrase: "{b}"')

    t = re.search(r'<title>(.*?)</title>', h, re.S)
    title = H.unescape(t.group(1).strip()) if t else ''
    if not (40 <= len(title) <= 65): errs.append(f'title length {len(title)} (need 40-65)')
    d = re.search(r'<meta name="description" content="(.*?)"', h, re.S)
    desc = d.group(1) if d else ''
    if not (120 <= len(desc) <= 156): errs.append(f'meta description length {len(desc)} (need 120-156)')
    if len(re.findall(r'<h1[ >]', h)) != 1: errs.append('must have exactly one h1')
    if '<link rel="canonical"' not in h: errs.append('missing canonical tag')

    lds = re.findall(r'<script type="application/ld\+json">(.*?)</script>', h, re.S)
    if not lds: errs.append('missing JSON-LD')
    types = []
    for ld in lds:
        try:
            j = json.loads(ld)
            for o in (j if isinstance(j, list) else [j]): types.append(o.get('@type'))
        except Exception as e: errs.append(f'JSON-LD does not parse: {e}')
    if 'Article' not in types and 'BlogPosting' not in types: errs.append('missing Article schema')
    if 'BreadcrumbList' not in types: errs.append('missing BreadcrumbList schema')
    faq_in_body = re.search(r'>\s*Frequently asked', h, re.I)
    if faq_in_body and 'FAQPage' not in types: errs.append('FAQ section present but no FAQPage schema')

    body = re.search(r'<article[^>]*>.*?</article>', h, re.S)
    body = body.group(0) if body else h
    text = re.sub(r'<[^>]+>', ' ', re.sub(r'<script.*?</script>', '', body, flags=re.S))
    words = len(text.split())
    if not (target*0.8 <= words <= target*1.35): errs.append(f'word count {words} outside ±20-35% of {target}')

    # internal links 3-6 unique, all resolving
    hrefs = [x for x in re.findall(r'href="([^"]+)"', body) if not x.startswith('#')]
    internal = [x for x in hrefs if not x.startswith('http') or 'cadnexa.com' in x or 'metricmech.com' in x]
    uniq = list(dict.fromkeys(internal))
    if not (3 <= len(uniq) <= 8): errs.append(f'{len(uniq)} unique internal links (need 3-8)')
    for u in uniq:
        p = u
        if u.startswith('http'):
            if 'cadnexa.com' in u and os.path.basename(root) != 'cadnexa': continue
            if 'metricmech.com' in u and os.path.basename(root) != 'metricmech': continue
            p = re.sub(r'https?://[^/]+/?', '', u)
        p = p.split('#')[0].split('?')[0]
        if not p: continue
        cand = os.path.normpath(os.path.join(os.path.dirname(path), p)) if not u.startswith(('http','/')) else p.lstrip('/')
        if not (os.path.exists(cand) or os.path.exists(cand + '.html')): errs.append(f'internal link does not resolve: {u}')

    # images exist + alt
    for src, tag in re.findall(r'<img src="([^"]+)"([^>]*)>', body):
        loc = os.path.normpath(os.path.join(os.path.dirname(path), src)) if not src.startswith('/') else src.lstrip('/')
        if not os.path.exists(loc): errs.append(f'image missing on disk: {src}')
        if 'alt="' not in tag or 'alt=""' in tag: errs.append(f'image missing alt text: {src}')

    # keyword placement
    low = lambda s: re.sub(r'\s+', ' ', s.lower())
    kw_words = [w for w in kw.split() if len(w) > 3] or [w for w in kw.split() if len(w) > 2]
    def coverage(s):
        t = low(s)
        return sum(1 for w in kw_words if w in t) / max(1, len(kw_words))
    # long-tail keywords cannot fit whole in a 65-char title — require majority coverage instead
    if coverage(title) < 0.6: errs.append('primary keyword not in title (needs most of its key words)')
    h1 = re.search(r'<h1[^>]*>(.*?)</h1>', h, re.S).group(1) if re.search(r'<h1[^>]*>(.*?)</h1>', h, re.S) else ''
    if coverage(re.sub(r'<[^>]+>', '', h1)) < 0.75: errs.append('primary keyword not in h1')
    first100 = ' '.join(text.split()[:120])
    if coverage(first100) < 0.75: errs.append('primary keyword not in first 100 words')
    dens = low(text).count(kw.lower()) * len(kw.split()) / max(words, 1)
    if dens > 0.015: errs.append(f'keyword density {dens:.1%} > 1.5%')

    if errs:
        print('LINT FAIL:\n' + '\n'.join(f'  - {e}' for e in errs)); sys.exit(1)
    print(f'LINT PASS ({words} words, {len(uniq)} internal links)')

if __name__ == '__main__': main()

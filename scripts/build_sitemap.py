#!/usr/bin/env python3
"""Regenerate sitemap.xml for metricmech.com (clean URLs, no .html — Vercel cleanUrls).
Never hand-edit sitemap.xml — run this instead. Usage: python3 scripts/build_sitemap.py"""
import glob, os, subprocess, datetime

SITE = 'https://metricmech.com'
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SUBDIRS = ['articles', 'calculators', 'gdt', 'reference', 'standards']
ROOT_EXCLUDE = {'googleb013589de9a2f690.html'}

def lastmod(path):
    try:
        out = subprocess.check_output(['git', 'log', '-1', '--format=%cs', '--', path], cwd=ROOT, text=True).strip()
        if out: return out
    except Exception: pass
    return datetime.date.fromtimestamp(os.path.getmtime(os.path.join(ROOT, path))).isoformat()

def url(loc, lm, freq, pri):
    return f'  <url>\n    <loc>{loc}</loc>\n    <lastmod>{lm}</lastmod>\n    <changefreq>{freq}</changefreq>\n    <priority>{pri}</priority>\n  </url>\n'

entries = []
for p in sorted(glob.glob(os.path.join(ROOT, '*.html'))):
    f = os.path.basename(p)
    if f in ROOT_EXCLUDE: continue
    if f == 'index.html':
        entries.append(url(SITE + '/', lastmod(f), 'weekly', '1.0')); continue
    slug = f[:-5]
    pri = '0.8' if slug in ('calculators', 'articles', 'reference', 'gdt', 'standards', 'templates') else '0.5'
    entries.append(url(f'{SITE}/{slug}', lastmod(f), 'weekly' if pri == '0.8' else 'monthly', pri))
for sub in SUBDIRS:
    for p in sorted(glob.glob(os.path.join(ROOT, sub, '*.html'))):
        f = f'{sub}/{os.path.basename(p)[:-5]}'
        pri = '0.8' if sub == 'calculators' else '0.7'
        entries.append(url(f'{SITE}/{f}', lastmod(f + '.html'), 'monthly', pri))

xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + ''.join(entries) + '</urlset>\n'
open(os.path.join(ROOT, 'sitemap.xml'), 'w').write(xml)
print(f'sitemap.xml written: {len(entries)} URLs')

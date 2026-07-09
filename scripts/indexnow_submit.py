#!/usr/bin/env python3
"""Submit URLs to IndexNow (Bing + partners, instant, no auth).
Usage:
  python3 scripts/indexnow_submit.py url1 url2 ...    # specific URLs
  python3 scripts/indexnow_submit.py --all            # every URL in sitemap.xml
Key file 9ef877ab96696c79389c8234236e9307.txt must stay at site root."""
import json, re, sys, os, urllib.request

HOST = 'metricmech.com'
KEY = '9ef877ab96696c79389c8234236e9307'
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

if len(sys.argv) > 1 and sys.argv[1] == '--all':
    sm = open(os.path.join(ROOT, 'sitemap.xml')).read()
    urls = re.findall(r'<loc>(.*?)</loc>', sm)
else:
    urls = [u for u in sys.argv[1:] if u.startswith('http')]
if not urls:
    print('no URLs to submit'); sys.exit(0)

payload = {"host": HOST, "key": KEY, "keyLocation": f"https://{HOST}/{KEY}.txt", "urlList": urls[:10000]}
req = urllib.request.Request('https://api.indexnow.org/indexnow',
    data=json.dumps(payload).encode(), headers={'Content-Type': 'application/json; charset=utf-8'})
try:
    with urllib.request.urlopen(req, timeout=30) as r:
        print(f'IndexNow: HTTP {r.status} — {len(urls)} URL(s) submitted')
except urllib.error.HTTPError as e:
    print(f'IndexNow: HTTP {e.code} {e.reason}'); sys.exit(1)

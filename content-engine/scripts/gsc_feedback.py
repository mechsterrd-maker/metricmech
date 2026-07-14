#!/usr/bin/env python3
"""Weekly Search Console feedback loop.
Finds striking-distance pages (pos 8-30), low-CTR page-1 results, suggests new keywords
from real search queries, checks the sitemap for broken pages, and updates
content-engine/refresh-queue.yaml. Report is printed (workflow emails it via notify.py)."""
import os, sys, json, re, datetime, urllib.request, urllib.parse, concurrent.futures
import yaml

CFG = yaml.safe_load(open('content-engine/site-config.yaml'))
PROP, BASE = CFG['gsc_property'], CFG['base_url']

sa = os.environ.get('GSC_SERVICE_ACCOUNT_JSON')
if not sa:
    print('GSC_SERVICE_ACCOUNT_JSON not set - skipping (not an error).'); sys.exit(0)
open('/tmp/sa.json', 'w').write(sa)
from google.oauth2 import service_account
from google.auth.transport.requests import Request
creds = service_account.Credentials.from_service_account_file(
    '/tmp/sa.json', scopes=['https://www.googleapis.com/auth/webmasters.readonly'])
creds.refresh(Request())

def gsc(body):
    u = 'https://www.googleapis.com/webmasters/v3/sites/%s/searchAnalytics/query' % urllib.parse.quote(PROP, safe='')
    req = urllib.request.Request(u, data=json.dumps(body).encode(),
        headers={'Authorization': 'Bearer ' + creds.token, 'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read()).get('rows', [])

end = datetime.date.today() - datetime.timedelta(days=2)
start = end - datetime.timedelta(days=28)
base = {'startDate': start.isoformat(), 'endDate': end.isoformat(), 'rowLimit': 1000}
pages = gsc({**base, 'dimensions': ['page']})
queries = gsc({**base, 'dimensions': ['query']})

R = ['SEARCH CONSOLE WEEKLY - %s (%s to %s)' % (CFG['site'].upper(), start, end), '']
R.append('TOTALS: %d impressions | %d clicks | %d pages appearing in Google' %
         (sum(r['impressions'] for r in pages), sum(r['clicks'] for r in pages), len(pages)))

striking = sorted([r for r in pages if 8 <= r['position'] <= 30 and r['impressions'] >= 10],
                  key=lambda r: -r['impressions'])
lowctr = [r for r in pages if r['position'] <= 12 and r['impressions'] >= 30 and r['ctr'] < 0.02]

R.append(''); R.append('STRIKING DISTANCE (pos 8-30; a content refresh can reach page 1):')
R += ['  pos %4.1f | %5d impr | %s' % (r['position'], r['impressions'], r['keys'][0]) for r in striking[:15]] or ['  none yet - normal for a young site']
R.append(''); R.append('LOW CTR ON PAGE 1 (rewrite title/meta):')
R += ['  pos %4.1f | %5d impr | ctr %.1f%% | %s' % (r['position'], r['impressions'], r['ctr']*100, r['keys'][0]) for r in lowctr[:10]] or ['  none']

# refresh queue
rqp = 'content-engine/refresh-queue.yaml'
rq = yaml.safe_load(open(rqp)) if os.path.exists(rqp) else None
rq = rq or {'pages': []}
known = {p['url'] for p in rq['pages']}
added = 0
for r in striking[:10] + lowctr[:10]:
    u = r['keys'][0]
    if u in known: continue
    rq['pages'].append({'url': u, 'reason': 'striking-distance' if r in striking else 'low-ctr',
                        'position': round(r['position'], 1), 'impressions': r['impressions'],
                        'added': datetime.date.today().isoformat(), 'status': 'todo'})
    known.add(u); added += 1
yaml.safe_dump(rq, open(rqp, 'w'), sort_keys=False, allow_unicode=True)
R.append(''); R.append('refresh-queue.yaml: %d new candidates recorded (ask Claude to refresh them)' % added)

# keyword ideas from real searches not yet covered
qk = yaml.safe_load(open('content-engine/keyword-queue.yaml'))['queue']
have = {e['keyword'].lower() for e in qk}
sugg = sorted([(r['impressions'], r['keys'][0].lower()) for r in queries
               if r['impressions'] >= 10 and r['keys'][0].lower() not in have
               and not any(r['keys'][0].lower() in k or k in r['keys'][0].lower() for k in have)], reverse=True)
R.append(''); R.append('NEW KEYWORD IDEAS FROM REAL SEARCHES (add via Claude):')
R += ['  %5d impr | %s' % (im, q) for im, q in sugg[:10]] or ['  none yet']

# broken-page sweep from live sitemap
R.append(''); R.append('BROKEN PAGE CHECK (live sitemap):')
try:
    sm = urllib.request.urlopen(BASE + '/sitemap.xml', timeout=30).read().decode()
    urls = re.findall(r'<loc>(.*?)</loc>', sm)[:300]
    def check(u):
        try:
            rq2 = urllib.request.Request(u, method='GET', headers={'User-Agent': 'autopilot-linkcheck'})
            return u, urllib.request.urlopen(rq2, timeout=20).status
        except Exception as e:
            return u, str(e)[:60]
    bad = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as ex:
        for u, st in ex.map(check, urls):
            if st != 200: bad.append('  %s -> %s' % (u, st))
    R += bad or ['  all %d sitemap URLs return 200 OK' % len(urls)]
except Exception as e:
    R.append('  sweep failed: ' + str(e)[:100])

print('\n'.join(R))

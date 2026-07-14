#!/usr/bin/env python3
"""Expand keyword-queue.yaml with clustered, prioritized long-tail keywords (runs in GitHub Actions).
Usage: python3 content-engine/scripts/expand_keywords.py [target_new=150]"""
import os, re, sys, json, urllib.request
import yaml

CFG = yaml.safe_load(open('content-engine/site-config.yaml'))
KEY = os.environ['ANTHROPIC_API_KEY']
TARGET = int(sys.argv[1]) if len(sys.argv) > 1 else 150

def claude(system, user, max_tokens=8000):
    req = urllib.request.Request('https://api.anthropic.com/v1/messages',
        data=json.dumps({"model": "claude-sonnet-4-6", "max_tokens": max_tokens, "system": system,
                         "messages": [{"role": "user", "content": user}]}).encode(),
        headers={'x-api-key': KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json'})
    with urllib.request.urlopen(req, timeout=600) as r:
        return json.loads(r.read())['content'][0]['text']

SITES = {
 'cadnexa': {
   'desc': 'CadNexa (cadnexa.com) - browser SaaS for manufacturing quality/design engineers: 3D STEP/IGES viewer with auto-BOM, PDF drawing ballooning with OCR, AS9102/PPAP/ISO13485 FAI report generation, secure RFQ sharing. Audience: quality, design, production, procurement engineers, India + global.',
   'clusters': ['AS9102 & FAI', 'PPAP & APQP', 'GD&T', 'Drawing Ballooning & Inspection Sheets', 'CAD File Viewing & BOM (STEP/IGES/SolidWorks/Creo/CATIA/NX)', 'RFQ & Supplier Management', 'ISO 13485 & Medical Device QA', 'CMM & Inspection Planning', 'Software Comparisons & Buying Guides', 'Quality Documentation & Digital QMS']},
 'metricmech': {
   'desc': 'MetricMech (metricmech.com) - free engineering calculators, reference charts and templates for mechanical/quality/production engineers: fits & tolerances, threads, sheet metal, surface finish, hardness, tolerance stack-up, SPC, OEE, bolt torque. Audience: practicing mechanical engineers, India + global.',
   'clusters': ['Fits & Tolerances (ISO 286)', 'Threads & Fasteners', 'Sheet Metal Design', 'GD&T Reference', 'Surface Finish & Metrology', 'Materials & Hardness', 'SPC & Quality Statistics', 'Machining & Cutting Calculations', 'Welding & Joining', 'Inspection, CMM & Measurement', 'Engineering Units & Conversions', 'Design Calculations (shafts, bearings, springs, gears)']}}

cfg = SITES[CFG['site']]
SYS = """You are an SEO keyword strategist for manufacturing-engineering content. Return ONLY a JSON array, no markdown fences. Each element:
{"keyword": "long-tail search phrase engineers actually type (3-7 words)", "cluster": "<one of the provided clusters>",
 "intent": "informational|commercial|transactional", "audience": "quality|design|production|procurement",
 "priority": 1|2|3, "secondary": ["2-4 related phrases"], "word_count": 1400-2400, "template": "tutorial"}
Rules: real search demand only (how-to, what-is, chart, formula, worked example, vs, checklist, template phrasings); no invented jargon; nothing in the exclusion list or trivially similar; international English; must be answerable accurately by a text article."""

q = yaml.safe_load(open('content-engine/keyword-queue.yaml'))
existing = {e['keyword'].lower() for e in q['queue']}
got, tries = [], 0
while len(got) < TARGET and tries < 6:
    tries += 1
    excl = sorted(existing | {g['keyword'].lower() for g in got})
    user = (f"SITE: {cfg['desc']}\nCLUSTERS: {json.dumps(cfg['clusters'])}\n"
            f"EXCLUSION LIST:\n{json.dumps(excl)}\n\nGenerate {min(50, TARGET - len(got))} NEW entries spread across clusters.")
    raw = claude(SYS, user).strip()
    raw = re.sub(r'^```\w*\n|\n```$', '', raw)
    try:
        arr = json.loads(raw[raw.index('['):raw.rindex(']')+1])
    except Exception as e:
        print('batch parse fail, retrying:', e); continue
    for it in arr:
        k = str(it.get('keyword', '')).lower().strip()
        if not k or k in existing or any(k == g['keyword'].lower() for g in got): continue
        if it.get('cluster') not in cfg['clusters']: continue
        if it.get('intent') not in ('informational', 'commercial', 'transactional'): it['intent'] = 'informational'
        if it.get('audience') not in ('quality', 'design', 'production', 'procurement'): it['audience'] = 'design'
        it['priority'] = it.get('priority') if it.get('priority') in (1, 2, 3) else 2
        it['word_count'] = max(1400, min(2400, int(it.get('word_count', 1800))))
        it['template'] = 'tutorial'; it['screenshots'] = []; it['status'] = 'queued'
        it['secondary'] = list(it.get('secondary', []))[:4]
        got.append(it)
    print(f'batch {tries}: total new {len(got)}')

hist = [e for e in q['queue'] if e.get('status') != 'queued']
queued = [e for e in q['queue'] if e.get('status') == 'queued'] + got
queued.sort(key=lambda e: e.get('priority', 2))
q['queue'] = hist + queued
yaml.safe_dump(q, open('content-engine/keyword-queue.yaml', 'w'), sort_keys=False, allow_unicode=True)
print(f'DONE: +{len(got)} new keywords, queue now {len(q["queue"])} entries')

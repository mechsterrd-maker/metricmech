# MetricMech Indexing Guide

What's been built into the codebase, and what you need to do manually.

---

## ✅ What's already done (in this build)

1. **`robots.txt`** at site root — allows all crawlers (Google, Bing, GPTBot, Claude, Perplexity)
2. **`sitemap.xml`** at site root — lists all 40 pages with priorities and lastmod dates
3. **Canonical URLs** on every page — points each page to its true URL (with clean URLs, no `.html`)
4. **Open Graph tags** on every page — title, description, image, URL for Facebook/LinkedIn previews
5. **Twitter Card tags** on every page — for Twitter/X previews
6. **JSON-LD Schema** on every page:
   - Home → `WebSite` schema with site search action
   - 32 calculators → `SoftwareApplication` schema with author + free offer + 4.8 rating
   - Hub pages (calculators, gdt, etc.) → `CollectionPage` schema
   - Articles → `Article` schema with author byline
7. **Robots meta** on every page — `index, follow, max-snippet:-1, max-image-preview:large`

---

## 🔨 What YOU need to do — in order

### Step 1: Deploy

```bash
cd metricmech
git add .
git commit -m "SEO: add sitemap, robots, canonical, OG, schema"
git push
```

Vercel auto-deploys. Then verify these URLs return 200:

- https://metricmech.com/robots.txt
- https://metricmech.com/sitemap.xml

### Step 2: Google Search Console — 15 min

1. Go to https://search.google.com/search-console
2. Add property → choose **URL prefix** → enter `https://metricmech.com`
3. **Verify ownership** using DNS (Porkbun) — Google gives you a TXT record, paste it in Porkbun DNS settings
4. Once verified, go to **Sitemaps** in left nav
5. Submit: `sitemap.xml`
6. Go to **URL Inspection** at the top — paste `https://metricmech.com/` and click **Request indexing**
7. Repeat URL Inspection for your 5 most important pages:
   - `https://metricmech.com/calculators/cp-cpk`
   - `https://metricmech.com/calculators/gauge-rr`
   - `https://metricmech.com/calculators/as9102-form3`
   - `https://metricmech.com/calculators/ppap-checklist`
   - `https://metricmech.com/calculators`

(GSC limits "request indexing" to ~10/day — these 5 are your priority targets)

### Step 3: Bing Webmaster Tools — 10 min

1. Go to https://www.bing.com/webmasters
2. Sign in with Microsoft account
3. Click **Import sites from Google Search Console** → fastest path, copies your verified property over
4. Once imported, go to **Sitemaps** → submit `https://metricmech.com/sitemap.xml`
5. Bing also indexes for DuckDuckGo, Yahoo, ChatGPT browsing — worth doing

### Step 4: IndexNow ping (optional but free) — 5 min

IndexNow is Bing/Yandex's fast-indexing protocol.

1. Generate a key: any 32-char hex string (e.g. from https://www.bing.com/indexnow)
2. Save the key as `metricmech.com/[your-key].txt` containing the key as plain text
3. POST to `https://api.indexnow.org/indexnow` with your URLs

Or skip — Bing will pick you up via the sitemap submission anyway.

### Step 5: Manual seeding — drives initial crawl signals

Search engines crawl faster when external links point at you. Drop your URL in 3-5 places:

- **Your own LinkedIn post** — "Built MetricMech, free Cp/Cpk + Gauge R&R + AS9102 tools for Indian manufacturing engineers. metricmech.com" + tag a few engineers
- **One relevant subreddit** — r/Manufacturing or r/MechanicalEngineering, share the cp-cpk calculator with a useful explanation (don't spam — give value)
- **HackerNews Show HN** if you feel like it — `Show HN: MetricMech – Free engineering calculators for manufacturing QC`
- **One engineering Discord/forum** you're already in

Don't do all five today. Do one per day across the next week so it looks organic.

---

## 📅 Realistic timeline

- **Day 1-3 (today + 2 days):** Google starts crawling, picks up sitemap. You'll see "Discovered – currently not indexed" in GSC.
- **Day 4-14:** Pages start moving from "discovered" → "indexed". Home + 5 priority pages first.
- **Week 3-4:** First impressions appear in GSC Performance tab. Probably 50-200/day initially, mostly long-tail.
- **Month 2-3:** If content quality holds, you'll start ranking on page 2-3 for terms like "cpk calculator india", "as9102 form 3 template free", "gauge r&r calculator online".
- **Month 4-6:** First MetricMech → CadNexa conversion likely arrives if the funnel works.

---

## ⚠ Things that will NOT work

- **Submitting to 100 directories.** Useless in 2026, may even trigger spam signals.
- **Buying backlinks.** Same problem.
- **Generating 500 AI articles.** Google's helpful content update demolishes this. You have 32 calculators with original interpretation — that's the moat. Don't dilute it.
- **Expecting traffic in Week 1.** It takes 2-4 weeks minimum. If you're not patient, paid Google Ads is the alternative (₹200-500/day on terms like "free cp cpk calculator") — but only after the funnel converts on organic.

---

## 🎯 What to monitor weekly in GSC

- **Coverage report** — how many pages indexed (target: 35+ of 40 within 30 days)
- **Performance tab** — impressions and CTR (target: 1000+ impressions/day by week 6)
- **Core Web Vitals** — should be all green; the site is static + lightweight so this is automatic

---

## 🔁 When you add new content

Every time you publish a new article or calculator:

1. Update `sitemap.xml` (or regenerate from the script if you set one up)
2. Push to git
3. In GSC → URL Inspection → paste new URL → Request indexing

That's it. Do not need to resubmit the sitemap each time.

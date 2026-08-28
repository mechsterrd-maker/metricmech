# MetricMech Admin — analytics dashboard

Private dashboard at **[metricmech.com/admin](https://metricmech.com/admin)**: which calculators
people actually use, and full traffic detail for today / yesterday / 7 days / 30 days across
every page.

Not linked from anywhere on the site, `noindex, nofollow`, and blocked in `robots.txt`.

---

## Two things to do before it works

### 1. Make yourself an admin — already done

`rajadurai-r` now has `role = 'admin'` (migration `grant_admin_role_to_owner`). To add someone else
later, sign them in once at [metricmech.com/forum](https://metricmech.com/forum) so a profile
exists, then in the Supabase SQL editor:

```sql
select set_config('forum.internal', '1', true);
update public.forum_profiles set role = 'admin' where handle = 'their-handle';
```

The `set_config` line is required — a trigger stops profiles promoting themselves.

Anyone without `role = 'admin'` gets a polite refusal — both in the page **and** in the API, so it
cannot be bypassed by calling the endpoint directly.

### 2. Give the dashboard read access to GA4 — ~5 minutes, once

The site is static, so GA4 has to be queried server-side. That happens in the `mm-analytics`
Supabase Edge Function (already deployed), which needs a Google service account.

**If you already made a service account for Search Console** (see `SETUP.md`), reuse it — skip to
step c.

**a. Service account.** [console.cloud.google.com](https://console.cloud.google.com) → your project
→ **IAM & Admin → Service Accounts → Create** → any name → **Keys → Add key → Create new key →
JSON**. A file downloads. Copy the account's email (ends `.iam.gserviceaccount.com`).

**b. Enable the API.** **APIs & Services → Library** → search **"Google Analytics Data API"** →
**Enable**. This is the step people miss; without it every request returns 403.

**c. Grant it access to the property.** [analytics.google.com](https://analytics.google.com) →
**Admin → Property access management → +** → paste the service-account email → role **Viewer** → Add.

**d. Find your property ID.** **Admin → Property Settings** → *Property ID*, a number like
`493812345`. This is **not** the `G-SQ0H6965Z1` measurement ID.

**e. Store both as Supabase secrets.** Dashboard → **Edge Functions → Secrets**:

| Secret | Value |
|---|---|
| `GA4_PROPERTY_ID` | the number from step d |
| `GA4_SERVICE_ACCOUNT_JSON` | the entire contents of the JSON file from step a |

The dashboard tells you exactly which of these is missing if you load it early, so you can work
through it with the page open.

---

## What it shows

| Section | Detail |
|---|---|
| **Headline tiles** | People, pageviews, sessions, average engaged time — each with a % change against the immediately preceding period of the same length |
| **Trend** | Daily pageviews vs actual calculator runs, hover for exact figures |
| **Calculators** | Every calculator ranked by *runs* — someone entering data, not just landing |
| **Events** | All tracked interactions: `calculator_run`, `pdf_download`, `cadnexa_cta_click`, `scroll_depth`, `study_saved`, `whatif_used`, `outbound_click` |
| **Acquisition** | Channels and top referrers |
| **Devices / Countries** | Sessions by device, people by country |
| **PDF editor funnel** | Viewed → opened a PDF → edited something → downloaded, with the drop-off at each step |
| **Campaigns** | Every `utm_campaign`, its source/medium, engagement rate, and how many of those sessions opened, edited and downloaded |
| **Where people land** | First page of each session — check an ad is sending people where you meant |
| **Every page** | Full table — path, title, views, people, average time. Up to 300 pages |

**Export CSV** dumps everything on screen for the selected period.

### Reading "calculator runs" correctly

A run fires when someone actually types into a calculator's inputs (debounced 1s so drive-by
keystrokes do not count), once per page load. So:

- **Views ≫ runs** on a calculator page means people are reading, not calculating — usually a sign
  the page ranks for an informational query.
- **Runs close to views** means the page is doing its job as a tool.

The gap between the two lines on the trend chart is exactly this, site-wide.

---

## How it fits together

```
admin.html          the page (noindex, unlinked)
assets/admin.css    styles + the validated chart palette
assets/admin.js     auth gate, data fetch, SVG charts, CSV export
supabase/functions/mm-analytics/index.ts
                    holds the Google credential, checks admin role, queries GA4
```

Auth is the forum's: Supabase session → `forum_profiles.role`. No second login system.

**Chart colours are validated, not chosen by eye.** Slot 1 `#2554BA`, slot 2 `#D97706`, checked for
colour-blind separation (worst adjacent pair ΔE 30.2 under protanopia) and ≥ 3:1 contrast on white.
The brand amber `#F59E0B` was rejected — it lands at 2.15:1 and is hard to see on a white
background. If you change a series colour, re-run the check rather than eyeballing it.

Deltas carry an arrow **and** the word "up"/"down", so direction never rests on colour alone.

---

## Notes and limits

- **GA4 has a data-processing delay.** "Today" is usually a few hours behind and will disagree
  slightly with GA4 Realtime. Yesterday and older are stable.
- **Ad-blockers block GA4.** Real traffic is somewhat higher than shown — this is true of the GA4
  UI as well, so the two agree with each other.
- **"People" is `totalUsers`**, so someone visiting on a phone and a laptop counts twice.
- **The `mm-analytics` function is deployed but has not yet run against live GA4** — it could not be
  exercised end to end until the secrets in step 2 exist. If the first load errors, the message on
  the page will name the cause.
- **Campaign rows only appear for UTM-tagged ads.** Point the ad at a URL carrying the tags, e.g.
  `https://metricmech.com/pdf-tools/edit-pdf?utm_source=google&utm_medium=cpc&utm_campaign=pdf-editor`.
  Untagged paid traffic still shows under *How people arrive*, but cannot be split by campaign.
- **The PDF editor funnel starts from 25 Aug 2026.** `pdf_edit_open`, `pdf_edit_text`,
  `pdf_edit_markup`, `pdf_edit_download`, `pdf_edit_no_text` and `pdf_edit_fail` did not exist
  before then, so earlier traffic shows views but no funnel.

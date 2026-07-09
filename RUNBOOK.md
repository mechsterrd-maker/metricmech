# Blog Autopilot — Runbook

## Pause everything
GitHub → repo → **Actions → Blog Autopilot → ⋯ (top right) → Disable workflow**.
Re-enable the same way. Nothing publishes while disabled.

## Skip or blocklist a topic
Open `content-engine/keyword-queue.yaml`, find the entry, change `status: queued` to
`status: blocked` (add a `note:` if you want to remember why). The autopilot skips it forever.

## Change frequency
Edit `.github/workflows/blog-autopilot.yml` → the `cron:` line (days of week: 1=Mon … 6=Sat), AND
`content-engine/site-config.yaml` → `weekly_cap`. **Never raise the cap above 3/week** —
daily AI publishing on a low-authority domain is the exact pattern Google's scaled-content
policy demotes, and a manual action would take the product pages down with the blog.

## A post was blocked by QA
You'll get a failure email. The entry in `keyword-queue.yaml` is marked `blocked` with the reason
in `note:`. Fix the entry (or the feature-truth file if the claim was stale) and set it back to
`queued`, or leave it blocked.

## Something published that you don't like
Delete the post file, remove its card from `blog.html`+`learn.html` (CadNexa) or its row from
`articles.html` (MetricMech), run `python3 scripts/build_sitemap.py`, commit and push.
Also remove its entry from `content-engine/published-log.yaml` so the caps stay accurate.

## Regenerate the sitemap manually
`python3 scripts/build_sitemap.py` from the repo root. Never hand-edit `sitemap.xml`.

## Submit URLs to search engines manually
`python3 scripts/indexnow_submit.py --all` (or pass specific URLs).

## Files that matter
- `content-engine/keyword-queue.yaml` — what gets written next
- `content-engine/published-log.yaml` — what shipped (feeds the weekly cap — don't delete)
- `content-engine/story-bank.yaml` — your real stories (the only source of anecdotes)
- `content-engine/feature-truth.yaml` — CadNexa repo only; the critic rejects claims not marked `live`
- `content-engine/scripts/run_pipeline.py` — the whole pipeline

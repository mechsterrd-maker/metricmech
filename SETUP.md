# Blog Autopilot — One-Time Setup (for Rajadurai)

The pipeline is fully committed and will run on its own once you finish these steps.
Everything here is done once; after that you never have to touch it.

## 0. Install the workflow file (required — 2 minutes)

The publishing token can't create GitHub Actions workflows, so this last file is added by you, once:

1. Open the repo on github.com → **Add file → Create new file**.
2. Name it exactly: `.github/workflows/blog-autopilot.yml`
3. Paste the full contents of [`content-engine/workflows/blog-autopilot.yml`](content-engine/workflows/blog-autopilot.yml) (already in this repo).
4. Commit to `main`. Done — the schedule is live (it still publishes nothing until step 1's API key exists).

## 1. GitHub secrets (required — ~5 minutes)

For **both** repos (`cadnexa` and `metricmech`):
GitHub → repo → **Settings → Secrets and variables → Actions → New repository secret**

| Secret | Where to get it | Needed for |
|---|---|---|
| `ANTHROPIC_API_KEY` | console.anthropic.com → API keys | Post generation + AI critic (required) |
| `RESEND_API_KEY` | resend.com → API Keys (you already use Resend for CadNexa) | Email notifications (optional but recommended) |
| `GSC_SERVICE_ACCOUNT_JSON` | See step 2 | Google Search Console sitemap resubmit (optional) |

Without `ANTHROPIC_API_KEY` the workflow fails safely and publishes nothing.
Without the other two, those steps skip quietly — nothing breaks.

## 2. Google Search Console service account (optional — ~10 minutes, once)

1. Go to **console.cloud.google.com** → create (or pick) a project.
2. **APIs & Services → Library** → search **"Google Search Console API"** → **Enable**.
3. **IAM & Admin → Service Accounts → Create service account** → any name (e.g. `blog-autopilot`) → Done.
4. Open the account → **Keys → Add key → Create new key → JSON** → a file downloads.
5. Copy the service account's email address (ends in `.iam.gserviceaccount.com`).
6. Go to **search.google.com/search-console** → select the `cadnexa.com` property →
   **Settings → Users and permissions → Add user** → paste the service-account email → permission **Full**.
7. Repeat step 6 for the `metricmech.com` property.
8. Open the downloaded JSON file, copy its ENTIRE contents, and paste as the value of the
   `GSC_SERVICE_ACCOUNT_JSON` secret in BOTH repos.

## 3. Add real stories to the story bank (ongoing, whenever you like)

Open `content-engine/story-bank.yaml`. Paste voice-note transcripts or rough notes under `inbox:`.
On a future run, ask Claude to format them into tagged entries. **Posts only use YOUR real stories —
if none matches a topic, the post is written with zero personal anecdotes. The system never invents one.**

## 4. Add keywords to the queue (when the 60-entry runway runs low)

Open `content-engine/keyword-queue.yaml` and append entries at the bottom in the same format.
The autopilot always takes the first entry with `status: queued`.

## 5. Test it

GitHub → repo → **Actions → Blog Autopilot → Run workflow**. Watch the log. You'll get an email
(if Resend is set) with the live URL, or a failure report explaining exactly what happened.

## Schedule (already configured)

- **CadNexa:** Mon / Wed / Fri ~06:00 IST — max 3 posts/week, hard-capped
- **MetricMech:** Tue / Thu / Sat ~06:00 IST — max 3 posts/week, hard-capped

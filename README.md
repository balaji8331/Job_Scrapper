# India Job OS

Ranked India job queue, tailored resumes, and a 30–40 applications/day tracker.

This is an apply cockpit, not an auto-submit bot. It pulls listings from official APIs and company career portals, ranks them against your profile, and generates a resume PDF per job. You open the apply link yourself.

## Stack

- Next.js (Vercel-ready)
- Supabase Postgres + Storage
- Optional Gemini API (`gemini-3.5-flash-lite`) for ranking and resume rewrite
- Adzuna India + Greenhouse / Lever / Ashby / Workable boards
- Optional RapidAPI JSearch if you need extra Naukri/Indeed/LinkedIn mirrors

Jio Gemini Pro is the consumer Gemini app. It does not provide API credits. Use a free [Google AI Studio](https://aistudio.google.com/apikey) key in this app. You can still polish your master resume in Gemini Docs, then paste it into Profile.

## Setup

1. Create a free [Supabase](https://supabase.com) project.
2. In the SQL editor, run [`supabase/migrations/001_init.sql`](supabase/migrations/001_init.sql), then [`supabase/migrations/002_companies_crawler.sql`](supabase/migrations/002_companies_crawler.sql), then [`supabase/migrations/003_company_candidates.sql`](supabase/migrations/003_company_candidates.sql).
3. Copy [`.env.example`](.env.example) to `.env.local` and fill:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ADZUNA_APP_ID=
ADZUNA_APP_KEY=
GEMINI_API_KEY=
```

Adzuna keys: [developer.adzuna.com](https://developer.adzuna.com/). Company portals work even without Adzuna.

Crawl India MNC career portals (Playwright fallback):

```bash
npm run crawl -- --slug=accenture --max=20
npm run crawl -- --slug=wipro --max=20
```

Or from the **Sources** UI: **Sync seed** (~500 India employers), **Resolve URLs**, paste any career URL, then **Crawl next 20**. Jobs land in **Today's queue → Company crawl**.

Or `POST /api/crawl` with `{ "mode": "pending", "limit": 20 }` / `{ "slug": "accenture", "maxJobs": 15 }`.

4. Install and run:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Fill **Profile**, then **Build today's 40**.

## Pages

| Route | Purpose |
| --- | --- |
| `/` | Dashboard: daily progress, funnel, connected sources, setup checklist |
| `/queue` | Today's ranked queue, search filters, resume generation, link import |
| `/tracker` | Pipeline board across queued → saved → applied → interview → offer → rejected |
| `/profile` | Master resume: identity, positioning, experience, education, projects |
| `/sources` | Company career portals: paste URL, sync India seed, detect ATS, batch crawl |

## Daily workflow

1. Enter role + experience level + city.
2. Review the ranked queue (target 40, match ≥ 55, seniority must fit).
3. Generate a tailored resume PDF.
4. Open the apply link, submit on the company site.
5. Click **Mark applied**. The dashboard shows `applied / 40`.
6. Paste extra Naukri/company URLs with **Import link** when aggregators miss a posting.

## Deploy on Vercel

1. Push this repo to GitHub.
2. Import the project in Vercel.
3. Add the same environment variables.
4. Deploy.

Hobby functions time out around 10 seconds. Search still returns whatever sources finish in time; run it again or import links if the queue is short. Raising `maxDuration` helps on Pro.

## Honest limit

Public APIs do not clone Naukri. Volume comes from Adzuna India + company ATS boards + optional JSearch, plus manual URL import into the same queue.

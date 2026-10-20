# Workforce Futures Engine

From who you are today to where you can be in the AI era.

A web app for the **SDC Hackathon 2026, Domain 1: Aiversecity Future-Ready Workforce**.

- **Sign in** to a personal account stored in the database by choosing it from a list (prototype: no password). Tester accounts, set with `TEST_ACCOUNTS`, start with an empty profile and go straight into the setup. The synthetic sample people are shared for demos.
- **About you** is a short setup that asks one thing per screen: how you want things explained (Simple or Detailed), country, age band and situation, time and budget, your experience (import a CV, write a few lines, or skip), your skills, and your interests. You can run it again at any time from the account menu.
- **Home** is your dashboard: your next step, your career ladder, progress, today's trend check, resume status and advice.
- **Careers** ranks careers by fit, demand trends and AI exposure, under three possible futures.
- **Path** is a step-by-step map from entry level to the top of the career (for example AI-enabled executive assistant → office manager → chief operating officer), rechecked against the latest trend data.
- **Resume** unlocks when you finish a stage and lists only what you completed.

**Simple mode** is for first-time career planners. It turns numbers into plain words: "Great fit" instead of a score, "AI impact: high" instead of an exposure index, "more jobs want this" instead of a percentage change. Every banner has a **?** button that explains it in the chosen style. Detailed mode keeps the numbers and sources.

HR managers and career centres get a team or cohort view. The app supports career decisions. It never makes hiring, selection or eligibility decisions.

## What it does (Domain 1 must-haves)

| Must-have | How the app delivers it |
|---|---|
| 1. Skills profile intake | CV import (PDF, Word, text) with an editable review form; free-text description; live ESCO job search that pre-fills typical skills; editable skill levels. An optional language model reads the CV after contact details and IC numbers are removed, and must quote the CV for every skill. |
| 2. AI-trend signal layer | Dated snapshots from public APIs: Hacker News "Who is hiring?" job posts (skill share, last 3 months vs the 3 before), arXiv papers on AI topics, and mentions of newer tools (for example MCP, dbt, SOC 2). Adzuna job ads are added when a key is set. A scheduled job refreshes the data; the app rechecks your path against it on every visit. |
| 3. Future-role matching | 12 careers grounded in ESCO occupations, ranked by a published formula. Each score shows its parts, the skills you have, and the gap. |
| 4. Personalised reskilling pathway | A path map across three career stages, each a real ESCO occupation, up to the peak role. Courses and certificates come from a closed catalogue of 51 checked items and fit your budget; paid options show as optional upgrades. Steps are ordered by prerequisites and current demand, and flagged when their priority changes or a new tool is rising. |
| 5. SDG mapping | Every career and every skill links to official UN SDG targets (text from the UN SDG API), shown with a reason. SDG links are information only: they never change rankings, except that the Green transition scenario weights low-carbon careers, because that scenario assumes demand for them grows. |
| 6. Handling uncertainty | Three scenarios (Moderate AI, Fast disruption, Green transition), score ranges across scenarios, and "what changed" when trend data changes. |

Also included: local job search links, funding schemes and critical-occupation notes for Malaysia and Singapore; plain-language advice and "earn while you learn" ideas for people on a tight budget; explanations in English, Bahasa Malaysia and Chinese; a resume builder with PDF export; a team and cohort heatmap with CSV upload; a mobile-friendly layout.

### Fairness and privacy

- Age band and situation are optional and only shape cost and time advice. A test checks that they never change career matches.
- Accounts, profiles, CV details and progress are stored in the database (SQLite locally, PostgreSQL on Replit). Session tokens are stored only as SHA-256 hashes.
- Sign-in has no password, so anyone with the link can open any account. Share the link only with testers.
- Testers should enter only information they are happy to store. For the competition demo, use the synthetic sample people and CVs.
- A production version would use a proper identity provider and a consent and data-deletion flow under Malaysia's PDPA. The server does not store CVs; contact details are removed before any text reaches the model.
- Demos use the synthetic sample CVs in `static/samples/`. Domain 1 forbids real CVs in the competition demo.

## How it works

```
Browser (static/)            FastAPI (app/)                       Data
──────────────────           ─────────────────────────            ─────────────────────────────
profile in localStorage ───▶ /api/analyze   engine.py  ◀───────── seed: ESCO roles & skills,
                             /api/pathway   (scores,              ILO exposure, UN SDG targets,
                             /api/explain    scenarios,           course catalogue (data/seed)
                             /api/extract    pathways)
                             /api/occupations/search ──▶ ESCO API (live)
                             assist.py ──▶ llm.py ──▶ WorkBuddy CLI (optional)
                                                              ◀── snapshots table (SQLite / Postgres)
                                                                      ▲
                                            ingest/refresh.py ────────┘  Hacker News, arXiv, Adzuna
```

- **Scoring** (`app/engine.py`) is deterministic. Weights per scenario are in one table and shown in the app.
- **AI exposure** comes from the ILO's 2025 GenAI exposure index, matched through the ISCO-08 code ESCO gives each occupation. Malaysia's MASCO uses the same codes.
- **"Future skill" requirements**: ESCO predates generative AI, so the team adds requirements such as "Working with AI tools". The app labels each requirement as `ESCO` or `future skill`.

### Language model guardrails

The model is reached through the WorkBuddy (CodeBuddy) CLI, default `deepseek-v4.1-flash`, with every tool disabled and an empty working folder. It is used for two jobs only:

1. **Reading a description**: it may only pick skill-cluster ids from a fixed list, and each pick must quote words that appear in the user's text. Anything else is discarded.
2. **Rewording an explanation**: it gets the computed facts; if its text contains any number not in those facts, the text is rejected and a template explanation is shown.

It never chooses roles, courses or scores. If the CLI is missing or fails, the app falls back to keyword matching and templates.

## Run locally

Requires Python 3.11+.

```bash
python -m venv .venv
.venv/Scripts/activate        # Windows; use .venv/bin/activate on macOS/Linux
pip install -r requirements-dev.txt
uvicorn app.main:app --reload
```

Open http://localhost:8000. The first start loads the two bundled trend snapshots. To use the model locally, install the WorkBuddy CLI (`npm i -g @tencent-ai/codebuddy-code`) and log in once.

Useful commands:

```bash
python -m ingest.refresh                     # new trend snapshot as of today
python -m ingest.refresh --as-of 2026-07-20  # rebuild a past snapshot
python -m ingest.build_seed                  # re-download ESCO, ILO and SDG seed data
python -m ingest.check_catalogue             # check every course link
python -m ingest.make_sample_cvs             # rebuild the synthetic sample CVs
python -m ingest.manage_accounts list        # accounts and setup status
python -m ingest.manage_accounts reset-profile chew  # blank profile; setup runs again
python -m pytest -q                          # tests
```

## Deploy on Replit

1. Import this GitHub repository into Replit.
2. In **Tools → Database**, add a PostgreSQL database. Replit sets `DATABASE_URL`.
3. In **Secrets**, add:
   - `ADMIN_TOKEN`: any long random string (protects `POST /api/admin/refresh`)
   - `TEST_ACCOUNTS`: tester accounts to create, for example `alice:Alice,bob:Bob`. Kept out of the repository on purpose.
   - `CODEBUDDY_API_KEY`: from your WorkBuddy/CodeBuddy profile page, to enable the model (optional). For the China edition also set `CODEBUDDY_INTERNET_ENVIRONMENT=internal`.
   - `CODEBUDDY_MODEL`: optional, default `deepseek-v4.1-flash`
   - `ADZUNA_APP_ID`, `ADZUNA_APP_KEY`: optional job-ads source
4. **Publish → Autoscale**. Build and run commands come from `.replit` (`scripts/build.sh`, `scripts/start.sh`).
5. **Publish → Scheduled**: command `bash scripts/refresh.sh`, daily. Each run stores a dated snapshot; the app compares the newest snapshot with the one before to re-rank path steps and flag new tools. (Hacker News hiring threads are monthly and arXiv is daily, so most days only part of the data changes.)

Keep the deployment URL: it is the Replit proof for the Technical & Tools Declaration.

## API

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/accounts` | Accounts for the sign-in list |
| POST | `/api/accounts/{id}/signin` | Sign in; returns a session token |
| GET / PUT | `/api/me` | Load or save the signed-in account's profile (Bearer token) |
| POST | `/api/signout` | End the session |
| GET | `/api/meta` | Roles, skill clusters, scenarios, samples, snapshots, sources, model status |
| POST | `/api/analyze` | Rankings for all scenarios; with `compare_id`, what changed |
| POST | `/api/pathway` | Career path across all stages (budget- and country-aware) |
| POST | `/api/advice` | Plain-language advice, side-income ideas, funding and job-search links |
| POST | `/api/cv` | Read a CV file into editable fields (multipart upload; nothing stored) |
| POST | `/api/resume/polish` | Optional AI rewording of resume lines, checked against the input |
| GET | `/api/updates` | What changed since the previous snapshot and which new tools are rising |
| POST | `/api/extract` | Skills from free text |
| POST | `/api/explain` | Plain-language explanation (en, ms, zh) |
| GET | `/api/occupations/search?q=` | Live ESCO job search with ILO exposure |
| GET | `/api/snapshots/{id}` | One trend snapshot with all signals |
| POST | `/api/admin/refresh` | Fetch a new snapshot now (Bearer `ADMIN_TOKEN`) |

## Data and licences

See [NOTICE](NOTICE). Code is under the [Apache License 2.0](LICENSE). Sample people and teams in `data/seed/samples.json` are synthetic. No real CVs or personal data are used. Profiles stay in the user's browser; free text sent for extraction is not stored.

## Known limits

- Job-post signals come from global, tech-heavy hiring threads. Malaysian job-ad data has no open API; Adzuna (Singapore, as a labelled regional proxy) is used when a key is set.
- ESCO is European; some Malaysian job titles may be missing.
- Course content, prices and HRD Corp status must be confirmed with each provider. The link checker only proves a page exists.
- Scenario weights are the team's starting assumptions, published in the app for scrutiny.

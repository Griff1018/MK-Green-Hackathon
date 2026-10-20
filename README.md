# Workforce Futures Engine

From who you are today to where you can be in the AI era.

A web app for the **SDC Hackathon 2026, Domain 1: Aiversecity Future-Ready Workforce**. A person describes their experience; the app tracks how AI and the job market are moving, ranks future roles under several scenarios, builds a reskilling pathway from free and low-cost courses, and shows how the path connects to the UN Sustainable Development Goals. HR managers and career centres get a team or cohort view.

The app supports career decisions. It never makes hiring, selection or eligibility decisions.

## What it does (Domain 1 must-haves)

| Must-have | How the app delivers it |
|---|---|
| 1. Skills profile intake | Free-text description (keyword matching, plus an optional language model that must quote the user's own words), live ESCO job search that pre-fills typical skills, editable skill levels, interests and weekly hours. |
| 2. AI-trend signal layer | Dated snapshots fetched from public APIs: Hacker News "Who is hiring?" job posts (skill share, last 3 months vs the 3 before) and arXiv papers on AI topics (last 90 days vs the 90 before), plus Adzuna job ads when a key is set. Source and date shown everywhere. Refreshed by a scheduled job. |
| 3. Future-role matching | 12 roles grounded in ESCO occupations, ranked by a published formula. Each score shows its parts, the skills you have, and the gap. |
| 4. Personalised reskilling pathway | Ordered steps from a closed catalogue of 29 real courses, with hours, cost, HRD Corp status and a weeks estimate from your weekly hours. Says so when no verified course exists. |
| 5. SDG mapping | Every role links to official UN SDG targets (text from the UN SDG API) with a reason for each link. |
| 6. Handling uncertainty | Three scenarios (Moderate AI, Fast disruption, Green transition), score ranges across scenarios, "top 3 in n of 3 scenarios", and "what changed" when trend data changes. |

Good-to-haves included: team and cohort heatmap with CSV upload, automatic "what changed" comparison between snapshots, explanations in English, Bahasa Malaysia and Chinese, mobile-friendly layout, progress tracking, and no protected attributes in scoring.

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
python -m pytest -q                          # tests
```

## Deploy on Replit

1. Import this GitHub repository into Replit.
2. In **Tools → Database**, add a PostgreSQL database. Replit sets `DATABASE_URL`.
3. In **Secrets**, add:
   - `ADMIN_TOKEN`: any long random string (protects `POST /api/admin/refresh`)
   - `CODEBUDDY_API_KEY`: from your WorkBuddy/CodeBuddy profile page, to enable the model (optional). For the China edition also set `CODEBUDDY_INTERNET_ENVIRONMENT=internal`.
   - `CODEBUDDY_MODEL`: optional, default `deepseek-v4.1-flash`
   - `ADZUNA_APP_ID`, `ADZUNA_APP_KEY`: optional job-ads source
4. **Publish → Autoscale**. Build and run commands come from `.replit` (`scripts/build.sh`, `scripts/start.sh`).
5. **Publish → Scheduled**: command `bash scripts/refresh.sh`, weekly. This keeps the trend layer updating.

Keep the deployment URL: it is the Replit proof for the Technical & Tools Declaration.

## API

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/meta` | Roles, skill clusters, scenarios, samples, snapshots, sources, model status |
| POST | `/api/analyze` | Rankings for all scenarios; with `compare_id`, what changed |
| POST | `/api/pathway` | Ordered learning plan for one role |
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

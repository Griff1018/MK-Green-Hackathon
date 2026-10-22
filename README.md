# Workforce Futures

> A career planner for the AI era: it reads live job-market and AI-research signals, matches a person (or a whole team) to future roles they can reach, and builds a step-by-step reskilling path with every role and skill linked to the UN SDGs.

---

## Team Information

| Field                  | Details                                     |
| ---------------------- | ------------------------------------------- |
| **Team Name**          | [Team name]                                 |
| **Team Domain**        | Domain 1: Future-Ready Workforce            |
| **SDG Track (1–17)**   | SDG 8 — Decent Work and Economic Growth (also SDG 4.4 and 9.5) |
| **Team Leader**        | [Leader name]                               |
| **University**         | [University name(s)]                        |
| **Number of Members**  | [n]                                         |

## Links

| Resource          | Link                                           |
| ----------------- | ---------------------------------------------- |
| GitHub Repository | https://github.com/Griff1018/MK-Green-Hackathon |
| Replit Project    | https://replit.com/@wongyiksheng/MK-Green-Hackathon |
| Live Demo         | https://mk-green-hackathon.replit.app          |
| RunPod Endpoint   | https://api.runpod.ai/v2/[endpoint-id]         |
| Slide Deck        | [slide deck link]                              |
| Demo Video        | [demo video link]                              |

---

## Overview

### Problem

AI is changing which skills employers ask for faster than workers, students and career advisers can see. In Malaysia, 600,000+ workers are expected to need reskilling within 3–5 years (Minister of Science, Technology and Innovation, January 2025, reported by Malay Mail). Our live data shows the shift: from May–Jul to Aug–Oct 2026, the share of job posts asking for spreadsheets and data handling fell from 2.3% to 1.6%, while databases and SQL rose from 13.4% to 16.4%. People such as Mei Ling, a 45-year-old office clerk (one of our synthetic personas), cannot tell which of their skills are fading, which career fits them next, or what to learn first; career advice is generic and courses are scattered.

### Solution

Workforce Futures turns public trend signals into a personal, explainable plan. It fetches job posts and AI research every day, measures which skills are rising or cooling, scores 20 future careers for the person with an open formula (skills, demand, transferable skills and interests, minus AI exposure from the ILO index), and builds an ordered reskilling path with checked courses that fit their budget and weekly hours. Every role and skill is linked to official UN SDG targets with a reason. A language model (on a RunPod GPU endpoint, or DeepSeek) only reads CVs and rewords explanations, under guardrails; it never chooses careers, courses or scores. The person stays in charge: the app explains, it never decides.

### Key Features

- **Skills profile intake** — CV upload (PDF, Word, text), a short form, or a few lines of free text, in English, Bahasa Malaysia or Chinese. The model must quote the person's words for every skill it suggests.
- **AI-trend signals** — daily snapshots of Hacker News "Who is hiring?" posts and arXiv research; each skill's share of posts against the previous three months, with new tools (e.g. MCP, AI agents) tracked by name. An **Update data** button fetches live and shows what changed in every part of the plan.
- **Future-role matching** — 20 careers grounded in ESCO occupations, each with a fit score out of 100, its parts, the skills already held and the gap.
- **Personalised reskilling pathway** — three real ESCO jobs from entry to peak role; steps ordered by prerequisites, then demand; 71 checked courses filtered by budget and hours.
- **SDG mapping** — goal numbers on every career card and SDG targets on every step, each with a reason, linking to the UN goal page.
- **Handling uncertainty** — three futures (Moderate AI, Fast disruption, Green transition), a score range per career and "what changed" after each update.
- **Onboarding story and guide** — a short animated story replays the four steps with the person's own numbers, then a guided tour of the dashboard.
- **Teams and career centres** — several teams side by side, a skills table, one group learning plan and a profile per person whose path steps the manager ticks off. For training plans only, never for hiring or selection.

### Tech Stack

| Layer         | Technology                   |
| ------------- | ---------------------------- |
| Frontend      | HTML, CSS, vanilla JavaScript (GSAP and Lenis for motion) |
| Backend       | Python, FastAPI, Uvicorn     |
| Database      | PostgreSQL on Replit, SQLite locally (SQLAlchemy) |
| AI / Compute  | RunPod Serverless vLLM endpoint (Qwen2.5-7B-Instruct); DeepSeek API as fallback |
| Data          | ESCO v1.2, ILO GenAI exposure index (WP 140), UN SDG API, Hacker News, arXiv |
| Hosting / Dev | Replit (Autoscale deployment, PostgreSQL, Secrets) |

---

## Project Structure

```
.
├── app/                     # FastAPI backend
│   ├── main.py              # Application entry point and HTTP API
│   ├── engine.py            # Scoring, scenarios and pathway builder
│   ├── llm.py               # Model connector (RunPod / DeepSeek / CLI) with guardrails
│   ├── assist.py, agent.py  # Skill extraction, explanations, the in-app helper
│   └── ...                  # accounts, advice, CV import, job check, config, db
├── ingest/                  # Daily trend refresh, seed builders, checks
├── data/seed/               # ESCO roles and skills, ILO scores, SDG targets, courses, synthetic people
├── static/                  # Web app (index.html, app.js, styles.css, translations)
├── runpod/                  # RunPod endpoint setup and smoke test
├── docs/                    # Screenshots and evidence
├── submission/              # Required submission documents
├── scripts/                 # Replit build, start and refresh scripts
├── tests/                   # Unit tests (pytest)
├── .env.example             # Example environment variables
├── .replit                  # Replit run configuration
├── LICENSE, NOTICE
├── requirements.txt         # Python dependencies
└── README.md
```

### Architecture

```
Browser (static/) ──► Replit: FastAPI app (app/) ──► PostgreSQL (accounts, profiles, snapshots)
                             │
                             ├──► RunPod Serverless vLLM endpoint (reads CVs, rewords explanations)
                             │      └─ fallback: DeepSeek API, then templates
                             ├──► ESCO API (live job search)
                             └──► ingest/refresh.py: Hacker News + arXiv ──► dated trend snapshots
```

---

## How to Run

### Option 1 — Run on Replit (Recommended)

1. Open the [Replit Project](https://replit.com/@wongyiksheng/MK-Green-Hackathon), or import this repository via **Create Repl → Import from GitHub**.
2. In **Tools → Database**, add a PostgreSQL database (Replit sets `DATABASE_URL`).
3. Open the **Secrets** tab (🔒) and add the variables listed in `.env.example`:
   - `RUNPOD_API_KEY`, `RUNPOD_ENDPOINT_ID` (see [runpod/README.md](runpod/README.md))
   - `ADMIN_TOKEN` (any long random string), `TEST_ACCOUNTS` (e.g. `alice:Alice,bob:Bob`)
   - optional: `LLM_API_KEY` (DeepSeek fallback), `ADZUNA_APP_ID` / `ADZUNA_APP_KEY`
4. Click **Run**. Replit uses `.replit` to run `scripts/build.sh` and `scripts/start.sh`.

### Option 2 — Run Locally

```bash
# 1. Clone the repository
git clone https://github.com/Griff1018/MK-Green-Hackathon.git
cd MK-Green-Hackathon

# 2. Create and activate a virtual environment (Python 3.11+)
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate

# 3. Install dependencies
pip install -r requirements-dev.txt

# 4. Configure environment variables
cp .env.example .env            # then fill in your values

# 5. Run the app
uvicorn app.main:app --reload
```

Open http://localhost:8000. Without any model key the app still works: skills come from keyword matching and explanations from templates.

### Run Tests

```bash
python -m pytest -q
```

---

## How We Use Replit *(Required)*

- **Development:** the team imports the GitHub repository into a shared Repl and runs it there to test each change.
- **Hosting:** the app is deployed with Replit Deployments (Autoscale) at the Live Demo link above, using `scripts/build.sh` and `scripts/start.sh` from `.replit`.
- **Database:** Replit PostgreSQL stores accounts, profiles, progress, chats and the dated trend snapshots.
- **Scheduled refresh:** the running app fetches a new trend snapshot once a day; a Replit Scheduled Deployment can run `bash scripts/refresh.sh` as well.
- **Secrets:** API keys and tester accounts live in Replit Secrets, never in the code.

📄 Proof of use: [`submission/SDC2026_TeamName_Replit_POU.pdf`](submission/SDC2026_TeamName_Replit_POU.pdf)

## How We Use RunPod *(Required)*

- **Workload:** the app's language model runs on a RunPod GPU: it reads CVs and free text to suggest skills (quoting the person's words) and rewords explanations, resume lines and news summaries from facts the engine computed.
- **Setup:** a **RunPod Serverless Endpoint** using RunPod's vLLM worker with `Qwen/Qwen2.5-7B-Instruct`. Steps in [runpod/README.md](runpod/README.md).
- **Integration:** when `RUNPOD_API_KEY` and `RUNPOD_ENDPOINT_ID` are set, the Replit app sends model calls to the endpoint's OpenAI-compatible route (`app/llm.py`, `app/config.py`). Output is validated; anything that fails falls back to templates.

Example request:

```bash
curl -X POST https://api.runpod.ai/v2/$RUNPOD_ENDPOINT_ID/openai/v1/chat/completions \
  -H "Authorization: Bearer $RUNPOD_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model": "Qwen/Qwen2.5-7B-Instruct", "messages": [{"role": "user", "content": "Hello"}]}'
```

Or run `python runpod/smoke_test.py`.

📄 Proof of use: [`submission/SDC2026_TeamName_Runpod_POU.pdf`](submission/SDC2026_TeamName_Runpod_POU.pdf)

---

## Challenges & Learnings

- **No open Malaysian job-ad API.** We use Hacker News hiring threads (global and tech-heavy) as the main live signal, damp small samples, date every snapshot, show three futures as a range, and add Adzuna ads (Singapore, labelled as a regional proxy) when a key is set.
- **Stopping the model from inventing things.** The model only picks from fixed lists and must quote the user; any text with a number not in our data is rejected and a template is shown. Careers, courses and scores come from code, not the model.
- **ESCO predates generative AI.** We added "future skill" requirements such as working with AI tools and label them separately from ESCO's own.
- **Keeping scores explainable.** Every score opens into its parts, and the weights for each future are published in the app.
- **We learned** that a plan people trust needs sources and dates on every number, and that one concrete persona explains the product better than a feature list.

## Future Improvements

- [ ] Partner for Malaysian job-ad data (for example a national job portal) to replace the global proxy
- [ ] Member sign-in for teams, so people can see the plan their manager keeps for them
- [ ] Consent and data-deletion flow under Malaysia's PDPA, and a proper identity provider
- [ ] Have fluent speakers review the Bahasa Malaysia and Chinese translations
- [ ] Pilot with a career centre and measure first-step completion

## Team

| Name        | Role                | GitHub                                   |
| ----------- | ------------------- | ---------------------------------------- |
| [Name]      | [Role]              | [@Griff1018](https://github.com/Griff1018) |
| [Name]      | [Role]              | [@username]                              |
| [Name]      | [Role]              | [@username]                              |

---

## Submission Checklist

- [ ] Team name, domain (Domain 1 / Domain 2) and SDG track filled in
- [ ] Slide deck link added
- [ ] Demo video link added
- [ ] Replit used, with proof of use in `submission/`
- [ ] RunPod used, with proof of use in `submission/`
- [ ] Preliminary submission completed (`SDC2026_TeamName_Preliminary.pdf`)
- [ ] Technology declaration completed (`SDC2026_TeamName_TechDeclaration.pdf`)
- [ ] Submission files renamed with your team name (replace `TeamName`)
- [x] "How to Run" steps verified
- [x] No API keys or secrets committed to the repository

---

## More detail

### Scoring

Fit = skill match + demand outlook + transferable skills + interest fit (+ green bonus in the Green transition) − AI exposure, scaled to 100. Weights per future are in `app/engine.py` and shown in the app. AI exposure comes from the ILO's 2025 GenAI exposure index, matched through the ISCO-08 code ESCO gives each occupation (Malaysia's MASCO uses the same codes).

### Fairness and privacy

- Age band and situation are optional and only shape cost and time advice; a test checks they never change career matches. Gender and ethnicity are never asked.
- Accounts, profiles and progress are stored in the database; session tokens only as SHA-256 hashes. CVs are not stored; contact details are removed before any text reaches a model.
- Team lists and member profiles stay in the manager's browser; only skill levels are sent to be scored.
- Sign-in has no password in this prototype. Demos use the synthetic sample people and CVs in `data/seed/samples.json` and `static/samples/`; no real CVs are used.

### Known limits

- Job-post signals come from global, tech-heavy hiring threads (see Challenges).
- ESCO is European; some Malaysian job titles may be missing.
- Course content, prices and HRD Corp status must be confirmed with each provider; the link checker only proves a page exists.
- Scenario weights are the team's starting assumptions, published in the app for scrutiny.

### Data and licences

See [NOTICE](NOTICE) for every source and licence.

## License

This project is licensed under the [Apache License 2.0](LICENSE).

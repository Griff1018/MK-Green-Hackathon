# Workforce Futures

> A career planner for the AI era: it reads live job-market and AI-research signals, matches a person (or a whole team) to future roles they can reach, and builds a step-by-step reskilling path with every role and skill linked to the UN SDGs.

---

## Team Information

| Field                  | Details                                                        |
| ---------------------- | -------------------------------------------------------------- |
| **Team Name**          | MK GreenCode                                                   |
| **Team Domain**        | Domain 1: Future-Ready Workforce                               |
| **SDG Track (1–17)**   | SDG 8 — Decent Work and Economic Growth (also SDG 4.4 and 9.5) |
| **Team Leader**        | Wong Yik Sheng                                                 |
| **University**         | Universiti Malaya                                              |
| **Number of Members**  | 5                                                              |

## Links

| Resource          | Link                                                                                                 |
| ----------------- | ---------------------------------------------------------------------------------------------------- |
| GitHub Repository | https://github.com/Griff1018/MK-GreenCode-WorkFuture                                                 |
| Replit Project    | https://replit.com/@wongyiksheng/MK-Green-Hackathon                                                  |
| Live Demo         | https://workforce-future.replit.app/                                                                 |
| Slide Deck        | https://docs.google.com/presentation/d/1uMcbffadX3EHKjX_2TqMDCnALSO22dPwjIWN5dp7Pmg/edit?usp=sharing |
| Demo Video        | https://www.youtube.com/watch?v=AdGutqiT2iY                                                          |
| Pitching Video    | *(to be added)*                                                                                      |

---

## Overview

### Problem

AI is changing which skills employers ask for faster than workers, students and career advisers can see. In Malaysia, 600,000+ workers are expected to need reskilling within 3–5 years (Minister of Science, Technology and Innovation, January 2025, reported by Malay Mail). Our live data shows the shift: from May–Jul to Aug–Oct 2026, the share of job posts asking for spreadsheets and data handling fell from 2.3% to 1.6%, while databases and SQL rose from 13.4% to 16.4%. Jobs like office clerk (one of our synthetic personas), cannot tell which of their skills are fading, which career fits them next, or what to learn first, career advice is generic and courses are scattered.

### Solution

Workforce Futures turns public trend signals into a personal, explainable plan. It fetches job posts and AI research every day, measures which skills are rising or cooling, scores 20 future careers for the person with an open formula (skills, demand, transferable skills and interests, minus AI exposure from the ILO index), and builds an ordered reskilling path with checked courses that fit their budget and weekly hours. Every role and skill is linked to official UN SDG targets with a reason. A language model (the DeepSeek API) only reads CVs and rewords explanations, under guardrails; it never chooses careers, courses or scores. The person stays in charge: the app explains, it never decides.

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
| AI / Compute  | DeepSeek API (deepseek-chat) through its OpenAI-compatible route; WorkBuddy (CodeBuddy) CLI for local runs; templates when no model is available |
| Data          | ESCO v1.2, ILO GenAI exposure index (WP 140), UN SDG API, Hacker News, arXiv |
| Hosting / Dev | Replit (Autoscale deployment, PostgreSQL, Secrets) |

---

## Project Structure

```
.
├── app/                     # FastAPI backend
│   ├── main.py              # Application entry point and HTTP API
│   ├── engine.py            # Scoring, scenarios and pathway builder
│   ├── llm.py               # Model connector (DeepSeek API / local CLI) with guardrails
│   ├── accounts.py          # Sign-in, sessions, tester accounts
│   ├── advice.py            # Cost and weekly-hours advice
│   ├── agent.py             # In-app helper
│   ├── assist.py            # Skill extraction and explanations
│   ├── config.py            # Environment and app configuration
│   ├── cv.py                # CV import (PDF, Word, text)
│   ├── data.py              # Seed data loading
│   ├── db.py                # Database models and session storage
│   ├── interview.py         # Guided intake interview
│   └── jobcheck.py          # Live job checks (ESCO API)
├── ingest/                  # Data tooling: daily trend refresh (refresh.py, news.py),
│   │                        # seed builders (build_seed.py, draft_role.py), checks
│   │                        # (check_catalogue.py, check_i18n.py), i18n tooling,
│   │                        # sample-CV generator, account manager
├── data/seed/               # ESCO roles and skills, ILO scores, SDG targets, courses, synthetic people
├── static/                  # Web app (index.html, app.js, styles.css) plus
│   │                        # i18n/ translations, samples/, vendor/ and art assets
├── docs/                    # Art assets and evidence (screenshots)
├── submission/              # Required submission documents
│   ├── SDC2026_MKGreenCode_Preliminary.pdf      # Preliminary submission
│   ├── SDC2026_MKGreenCode_TechDeclaration.pdf  # Technology declaration
│   └── SDC2026_MKGreenCode_Replit_POU.pdf       # Replit proof of use
├── scripts/                 # Replit build.sh, start.sh, refresh.sh, share-ngrok.bat
├── tests/                   # Unit tests (pytest)
├── .env.example             # Example environment variables
├── .replit                  # Replit run configuration
├── requirements-app.txt     # Runtime dependencies
├── requirements-dev.txt     # Development and test dependencies
├── LICENSE                  # Apache License 2.0
├── NOTICE                   # Data sources and licences
└── README.md
```

### Architecture

```
Browser (static/) ──► Replit: FastAPI app (app/) ──► PostgreSQL (accounts, profiles, snapshots)
                             │
                             ├──► DeepSeek API (reads CVs, rewords explanations)
                             │      └─ local runs: WorkBuddy CLI; no model: templates
                             ├──► ESCO API (live job search)
                             └──► ingest/refresh.py: Hacker News + arXiv ──► dated trend snapshots
```

---

## How to Run

### Run Online — Replit (Recommended)

1. Open the [Replit Project](https://replit.com/@wongyiksheng/MK-Green-Hackathon), or import this repository via **Create Repl → Import from GitHub**.
2. In **Tools → Database**, add a PostgreSQL database (Replit sets `DATABASE_URL`).
3. Open the **Secrets** tab (🔒) and add the variables listed in `.env.example`:
   - `ADMIN_TOKEN` (any long random string), `TEST_ACCOUNTS` (e.g. `alice:Alice,bob:Bob`)
   - optional: `LLM_API_KEY` (DeepSeek API, for the language features), `ADZUNA_APP_ID` / `ADZUNA_APP_KEY`
4. Click **Run**. Replit uses `.replit` to run `scripts/build.sh` and `scripts/start.sh`.

A deployed version is always available at the [Live Demo](https://workforce-future.replit.app/) link above.

### Run Online — Share a Local Run with ngrok (Windows)

To let others try your local instance over the internet without deploying, use the bundled `scripts/share-ngrok.bat`. No Git knowledge is needed — downloading the repository as a ZIP is enough.

**One-time setup:**

1. Get the code — either is fine:
   - **Download as ZIP (no Git needed):** on the [GitHub page](https://github.com/Griff1018/MK-GreenCode-WorkFuture), click **Code → Download ZIP**, then extract it to a folder (e.g. `C:\MK-GreenCode-WorkFuture`).
   - **Or clone:** `git clone https://github.com/Griff1018/MK-GreenCode-WorkFuture.git`
2. Install ngrok: open **Command Prompt** (press Start, type `cmd`) and run `winget install ngrok.ngrok`, then authenticate once with `ngrok config add-authtoken <your-token>` (free token from [ngrok.com](https://dashboard.ngrok.com/get-started/your-authtoken)).
3. In the project folder (open it in File Explorer, click the address bar, type `cmd` and press Enter to get a terminal in the right place), set up Python once (Python 3.11+ must be installed — see [python.org/downloads](https://www.python.org/downloads/)):
   ```
   python -m venv .venv
   .venv\Scripts\python -m pip install -r requirements-app.txt
   ```

**Every time you want to share the app:**

4. In **File Explorer**, double-click `scripts\share-ngrok.bat`. It starts the app on port 8001 in its own window, waits for it to be healthy, then opens an ngrok tunnel.
5. Share the `https://...ngrok-free.app` address ngrok prints. Anyone with the link can use the app in their browser while the two windows stay open; press Ctrl+C in the ngrok window to stop sharing.

Add `noai` to turn off the language model for the run: `scripts\share-ngrok.bat noai`. You can also use a different ngrok binary by setting the `NGROK` environment variable.

### Run Local

**What you need:** Python 3.11+ ([python.org/downloads](https://www.python.org/downloads/) — on Windows, tick "Add Python to PATH" during install).

**Open a terminal in the project folder:**
- **Windows:** Command Prompt or PowerShell (press Start, type `cmd`)
- **macOS/Linux:** Terminal

No IDE is required. If you use VS Code, open the project folder there and run the same commands in its terminal (Terminal → New Terminal).

**What you'll see:** the app running at http://localhost:8000 — open that address in any web browser (Chrome, Edge, Firefox).

**Windows (Command Prompt) — copy and paste the whole block:**

```bat
git clone https://github.com/Griff1018/MK-GreenCode-WorkFuture.git
cd MK-GreenCode-WorkFuture

python -m venv .venv
.venv\Scripts\activate

pip install -r requirements-dev.txt

copy .env.example .env

uvicorn app.main:app --reload
```

**macOS / Linux (Terminal) — copy and paste the whole block:**

```bash
git clone https://github.com/Griff1018/MK-GreenCode-WorkFuture.git
cd MK-GreenCode-WorkFuture

python3 -m venv .venv
source .venv/bin/activate

pip install -r requirements-dev.txt

cp .env.example .env

uvicorn app.main:app --reload
```

(Or skip the clone and download the ZIP from GitHub, extract it, then start from the `python -m venv` step inside the extracted folder.)

Open http://localhost:8000 in your browser. Without any model key the app still works: skills come from keyword matching and explanations from templates.

**Python version:** Replit uses Python 3.12 (see `.replit`); 3.11+ is recommended locally. The run scripts (`scripts/build.sh`, `scripts/start.sh`) create a `.venv` and install `requirements-app.txt` automatically, which is how Replit runs the app.

### Scheduled trend refresh

The app fetches a new trend snapshot once a day while running. To run it manually or from a Replit Scheduled Deployment:

```bash
# runs: python -m ingest.refresh
bash scripts/refresh.sh
```

`ADMIN_TOKEN` protects the `POST /api/admin/refresh` endpoint.

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

📄 Proof of use: [`submission/SDC2026_MKGreenCode_Replit_POU.pdf`](submission/SDC2026_MKGreenCode_Replit_POU.pdf)

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

| Name            | Role                                          | GitHub                                     |
| --------------- | --------------------------------------------- | ------------------------------------------ |
| Wong Yik Sheng  | Team Lead                                     | [@tms-tm](https://github.com/tms-tm)       |
| Chew Chee Kin   | Architect & Presenter                         | [@Griff1018](https://github.com/Griff1018) |
| Adam Go Zi Yang | Video Editor                                  | [@ADGGG](https://github.com/ADGGG)         |
| Wee Kuan Xun    | Presenter                                     | [@Duskxw](https://github.com/Duskxw)       |
| Tan Yong Sheng  | Documentation                                 | [@Ystan35](https://github.com/Ystan35)     |

---

## Submission Checklist

- [x] Team name, domain (Domain 1 / Domain 2) and SDG track filled in
- [x] Slide deck link added
- [x] Demo video link added
- [x] Replit used, with proof of use in `submission/`
- [x] All required submission documents (preliminary, technology declaration, Replit proof of use) completed, uploaded to `submission/` and renamed with the team name
- [x] "How to Run" steps verified
- [x] No API keys or secrets committed to the repository

---

## More Detail

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

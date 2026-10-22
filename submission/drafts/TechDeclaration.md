# SDC 2026 Technology Declaration: draft answers

Copy into `SDC2026_TeamName_TechDeclaration.pdf`. Word counts are in brackets after each limited answer. Fill every `[bracket]`. Never paste API keys or secrets.

## 1. Team details

| Field | Answer |
|---|---|
| Team Name | [Team name] |
| Project / Solution Name | Workforce Futures |
| Name (Leader) | [Leader name] |
| Email & Phone (Leader) | [email] · [phone] |
| University Affiliation(s) | [University] |
| Live Prototype URL | https://mk-green-hackathon.replit.app |
| Code Repository URL | https://github.com/Griff1018/MK-Green-Hackathon [make public or grant judges access] |

## 2.1 System Architecture Overview (max 200 words)

The user works in a browser app (HTML, CSS, vanilla JavaScript) served by a Python FastAPI backend on Replit Deployments. The backend stores accounts, profiles, progress and dated trend snapshots in Replit PostgreSQL.

A refresh job, run daily inside the app or as a Replit scheduled task, calls the Hacker News (Algolia) and arXiv APIs, measures how often job posts and research mention each of 39 skill clusters, and saves a snapshot. The scoring engine combines that snapshot with ESCO occupations and skills, the ILO GenAI exposure index and UN SDG targets (all bundled as seed data) to rank 20 careers and build reskilling paths. The ESCO API is called live for job-title search.

For reading CVs and rewording explanations, the backend calls a language model on a RunPod Serverless vLLM endpoint through its OpenAI-compatible route, with the DeepSeek API as fallback and templates when neither is available. Model output is validated before it reaches the user.

```
Browser ──► Replit: FastAPI ──► PostgreSQL
                 ├──► RunPod Serverless vLLM (fallback: DeepSeek API)
                 ├──► ESCO API
                 └──► Daily refresh: Hacker News + arXiv ──► snapshots
```

[157 words]

## 2.2 Languages, Frameworks & Libraries

| Name & Version | Purpose in Project | License |
|---|---|---|
| Python 3.12 | Backend language | PSF License |
| JavaScript, HTML, CSS | Web app | n/a |
| FastAPI 0.148.0 | HTTP API | MIT |
| Uvicorn 0.54.0 | Web server | BSD-3-Clause |
| HTTPX 0.28.1 | Calls to external APIs and the model | BSD-3-Clause |
| SQLAlchemy 2.1.5 | Database access | MIT |
| psycopg 3.3.6 | PostgreSQL driver | LGPL-3.0 |
| RapidFuzz 3.14.6 | Fuzzy matching of job titles and skills | MIT |
| pypdf 6.21.1, python-docx 1.2.0 | Reading uploaded CVs | BSD-3-Clause, MIT |
| python-multipart 0.0.32 | File uploads | Apache 2.0 |
| openpyxl 3.1.5, fpdf2 2.8.9 | Building seed data and synthetic sample CVs | MIT, LGPL-3.0 |
| pytest 9.1.1 | Tests | MIT |
| GSAP 3.12.5 + ScrollTrigger | Page animations | GSAP Standard License |
| Lenis 1.1.20 | Smooth scrolling | MIT |
| Newsreader, Figtree (Google Fonts) | Typefaces | SIL Open Font License |

## 3.1 External APIs

| API and Provider | Purpose in Project | Access Tier |
|---|---|---|
| RunPod Serverless API (vLLM worker) | Language model: CV reading, explanations | [Sponsor-provided credits / paid] |
| DeepSeek API | Fallback language model | Paid (pay as you go) |
| ESCO API, European Commission | Live job-title search and occupation skills | Free |
| Hacker News Search API (Algolia) | Job-post demand counts, work headlines | Free |
| arXiv API | AI research activity per skill | Free |
| UN SDG API (UN Statistics Division) | Official SDG goal and target text (bundled) | Free |
| Adzuna API (optional, off by default) | Job-ad counts, Singapore as a regional proxy | Free tier |

## 3.2 Cloud Platforms & Deployment

| Service & Provider | Purpose in Project | Plan / Region |
|---|---|---|
| Replit Deployments (Autoscale) | Hosts the live app | [Core plan, provided by organisers] / [region] |
| Replit PostgreSQL | Accounts, profiles, progress, trend snapshots | Included with Replit / [region] |
| Replit Secrets | API keys and tester accounts | Included with Replit |
| RunPod Serverless | GPU inference for the language model | [Sponsor credits] / [region] |
| GitHub | Source code and history | Free |

Deployment: the Replit Repl is linked to the GitHub repository; `scripts/build.sh` installs dependencies and `scripts/start.sh` starts Uvicorn. Secrets are set in the Replit Secrets tab.

## 4.1 AI Models Used in the Solution

| Model & Version | Source / Provider | Usage | License / Terms |
|---|---|---|---|
| Qwen2.5-7B-Instruct | Alibaba Cloud (Qwen), served on RunPod vLLM | Pre-trained | Apache 2.0 |
| DeepSeek chat model (`deepseek-chat`) | DeepSeek API | Pre-trained (fallback) | DeepSeek API terms |
| DeepSeek V4.1 Flash via WorkBuddy / CodeBuddy CLI | Tencent CodeBuddy (local development option) | Pre-trained | CodeBuddy terms |

No model is fine-tuned or trained by the team. The scoring itself is a published formula, not a model.

## 4.2 Datasets

| Dataset Name | Source / URL | Type | License | Personal Data? |
|---|---|---|---|---|
| ESCO v1.2 occupations and skills | esco.ec.europa.eu | Public | EU reuse policy, attribution | N |
| ILO Working Paper 140 GenAI exposure scores (Gmyrek et al., 2025) | ilo.org | Public | CC BY 4.0 | N |
| UN SDG goals and targets | unstats.un.org/sdgs (SDG API) | Public | UN terms of use | N |
| Hacker News "Who is hiring?" posts (counts only) | hn.algolia.com/api | Public | Public API; only counts stored | N |
| arXiv paper metadata (counts only) | arxiv.org | Public | CC0 metadata | N |
| Course and certificate catalogue (71 items) | Each provider's public page, checked by the team | Self-collected | Each provider's terms; links only | N |
| TalentCorp MyCOL 2024/2025 (as reported by SAYS, 9 Jan 2026) | says.com | Public | Public report | N |
| Sample people, teams and CVs | `data/seed/samples.json`, `static/samples/` | Synthetic | Team-made | N |

## 4.3 AI-Assisted Development Tools

Did the team use generative-AI tools to help create code, design, text or other material? **Yes.**

| Tool & Version | Used For | Extent of Use |
|---|---|---|
| Claude Code (Anthropic), Claude Opus 5.5 | Writing most of the code from the team's instructions, research checks, design, documentation, slide deck | Major |
| Perplexity | Early research draft | Minor |
| [Other tools the team used] | [Purpose] | [Extent] |

How the team reviewed and took responsibility for AI output (max 100 words):

[Team to adapt] Every change was run and checked in the live app before it was kept. We added automated tests (49) for scoring, fairness, model guardrails and data, and reviewed screenshots of each page in light, dark and phone layouts. Facts, prices and statistics were checked against their sources, and anything we could not verify was removed or marked. Each team member can explain the part they own: [names and parts].

[72 words]

## 5. Sponsor resources

Did the project use any official SDC sponsor-provided resource? **Yes.**

| Sponsor | Resource | How It Was Used in the Project |
|---|---|---|
| Replit | Platform (Deployments, PostgreSQL, Secrets) | Hosts the live prototype and its database |
| RunPod | [Credits] / Serverless GPU endpoint | Runs the language model for CV reading and explanations |

Was the sponsor resource essential, or could it be replaced? (max 100 words)

Replit is essential to the prototype as built: it hosts the app, its database and secrets, though the code is standard Python and PostgreSQL and could run on another host. RunPod provides the language model; the app is designed so the model is helpful but not critical: if the endpoint is unavailable it falls back to the DeepSeek API, then to keyword matching and template explanations, so scores and paths still work.

[72 words]

## 6.1 Data Handling & Privacy (max 150 words)

The app stores, in Replit PostgreSQL, each account's name, profile (skill levels, interests, country, optional age band and situation, weekly hours, budget), chosen career, path progress, resume fields the user types, and chat history with the in-app helper. Session tokens are stored only as SHA-256 hashes.

Uploaded CVs are read in memory and not stored. Before any text reaches a language model (RunPod or DeepSeek), email addresses, phone numbers and IC numbers are removed. Team lists and member profiles stay in the manager's browser; only skill levels are sent to be scored.

Data is kept until the account is reset; the prototype has no password sign-in, so testers are told to use synthetic data only. The competition demo uses synthetic sample people and CVs. A production version would add proper sign-in and a PDPA-compliant consent and deletion flow.

[138 words]

## 6.2 Known Limitations & Risks (max 150 words)

- **Thin or skewed trend data:** Hacker News hiring threads are global and tech-heavy. Mitigation: small samples are damped, snapshots are dated, careers show a range across three futures, and Adzuna ads can be added.
- **Hallucination:** the model only picks skills from a fixed list and must quote the user; any output with a number not in our data is rejected and a template is shown. Careers, courses and scores never come from the model.
- **Bias:** age, gender and ethnicity never enter a score; a test checks that age band cannot change matches.
- **Provider dependency and rate limits:** RunPod, then DeepSeek, then templates.
- **Coverage:** ESCO is European, so some Malaysian job titles are missing; course prices and HRD Corp status must be confirmed with providers.

[129 words]

## 7. Checklist (team to tick)

- [ ] All APIs, cloud services, AI tools, models and datasets are declared.
- [ ] Third-party code, datasets and models are used under their licences, with attribution.
- [ ] No API keys, passwords or credentials are exposed in the repository, prototype or this document.
- [ ] Use of generative-AI development tools is disclosed and reviewed.
- [ ] Sponsor resources are declared in Section 5.
- [ ] The prototype is accessible to judges through the links in Section 1.
- [ ] All fields are completed within the word limits.

# Technical & Tools Declaration (draft)

Draft for the team to complete and copy into the official template. Items in [brackets] need the team's input. The Participant Handbook (6.3.5.4, 8.4, 10.6) requires every major tool, API, dataset, model and AI assistant to be declared.

## Platforms

| Item | Use | Proof / notes |
|---|---|---|
| Replit (Core, provided by organisers) | Hosts the live app (Autoscale) and the weekly trend refresh (Scheduled Deployment) with Replit PostgreSQL | Live URL: [replit URL]. Project link: [link] |
| RunPod | Not used. The app needs no GPU. | n/a |
| GitHub | Source code and commit history | [repo URL] |

## APIs and datasets

| Source | Use | Licence / terms |
|---|---|---|
| ESCO v1.2 API, European Commission | Occupations, essential skills, ISCO-08 codes; live job search | EU reuse policy, attribution |
| ILO Working Paper 140 data (Gmyrek et al., 2025) | GenAI exposure score per ISCO-08 occupation | CC BY 4.0 |
| UN Statistics Division SDG API | Official SDG goal and target text | UN terms of use |
| Hacker News "Who is hiring?" via Algolia HN Search API | Job-post demand counts per skill | Public API; counts only stored |
| arXiv API | Research activity on AI topics | Metadata CC0 |
| Adzuna API (optional) | Job-ad counts, Singapore market as a regional proxy | Adzuna terms |
| Course and certification providers listed in `data/seed/catalogue.json` | Learning path links | Each provider's terms |
| TalentCorp MyCOL 2024/2025, as reported by SAYS (9 Jan 2026) | "In demand in Malaysia" notes on some career stages | Public report; to be checked against the official list |
| Job portals (JobStreet, MyFutureJobs, MyCareersFuture, LinkedIn) | Outbound search links only; no data is collected | Each site's terms |

## Open-source libraries

FastAPI, Uvicorn, HTTPX, SQLAlchemy, psycopg, RapidFuzz, pypdf and python-docx (CV import), python-multipart, openpyxl and fpdf2 (seed and sample-CV build), pytest. Fonts: Bricolage Grotesque and IBM Plex (Google Fonts, SIL Open Font License).

## AI tools

| Tool | Model | How it was used |
|---|---|---|
| WorkBuddy / CodeBuddy CLI (Tencent) | DeepSeek V4.1 Flash (`deepseek-v4.1-flash`) | At runtime, optional: suggests skills from a user's description (must quote the user's words) and rewords explanations (numbers checked against the data), reads CVs after contact details are removed, and rewords resume lines without adding facts. Tools disabled. |
| Claude Code (Anthropic) | Claude Opus 5.5 | During development: research checks, a concept demo, and generating most of the first version of the code from the team's instructions. [Team: describe which parts you reviewed, changed and can explain, per Handbook 8.5.6.] |
| Perplexity | [model] | Early research draft (`research.md`). |

## Pre-existing code or materials

None. The repository was created after the 19 October 2026 problem-statement release. [Team: confirm.]

## Team understanding (Handbook 8.5.3, 8.5.7)

[Team: name the member who owns and can explain each part: data ingestion, scoring engine, model connector and guardrails, web UI, deployment.]

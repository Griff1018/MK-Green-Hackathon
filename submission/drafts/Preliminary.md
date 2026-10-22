# SDC 2026 Preliminary submission: draft answers

Copy into `SDC2026_TeamName_Preliminary.pdf`. Word counts are in brackets after each answer. Fill every `[bracket]`.

## 1. Team details

| Field | Answer |
|---|---|
| Team Name | [Team name] |
| Selected Domain | Domain 1: Future-Ready Workforce |
| Selected SDG Track (1–17) | SDG 8: Decent Work and Economic Growth |
| Project / Solution Name | Workforce Futures |
| Name (Leader) | [Leader name] |
| Email & Phone (Leader) | [email] · [phone] |
| University Affiliation(s) | [University] |
| Number of Team Members | [n] |

## 2.1 The Problem Context (max 250 words)

AI is changing which skills employers ask for faster than workers, students and career advisers can see. In Malaysia, more than 600,000 workers are expected to need reskilling within three to five years (Minister of Science, Technology and Innovation, January 2025, reported by Malay Mail; the Human Resources Minister gave the same figure in October 2024, citing TalentCorp).

The people most affected are mid-career workers in routine office roles, fresh graduates choosing a first job, TVET students, and the HR managers and career centres who plan their training. Take Mei Ling, 45, an office clerk for 18 years (a synthetic persona): she keys in orders and prepares invoices in Excel. Public job-post data shows exactly these skills cooling: the share of posts asking for spreadsheets and data handling fell from 2.3% to 1.6% between May–July and August–October 2026, while databases and SQL rose from 13.4% to 16.4% (Hacker News "Who is hiring?" threads).

Today she cannot see which of her skills are fading, which future role fits her, or what to learn first. Advice is generic ("learn AI"), courses are scattered with unclear prices, and her manager plans the team's training in a spreadsheet. The result is wasted training money, people reskilling into the wrong roles, and workers left behind, an economic and social cost that falls hardest on those with the least time and money to experiment.

[228 words]

## 2.2 The Proposed AI Solution (max 300 words)

Workforce Futures is a deployed web app that takes a person from "who I am today" to "where I can be in the AI era" in four steps.

1. **Tell us about yourself.** Upload a CV, fill a short form or write a few lines, in English, Bahasa Malaysia or Chinese. A large language model suggests skills, but must quote the person's own words for each one.
2. **Future Skills Radar.** Every day the app fetches public job posts and AI research (Hacker News, arXiv), measures which skills are rising or cooling and which new tools appear, and stores a dated snapshot.
3. **Get matched.** An open formula scores 20 future careers (built on ESCO occupations) for the person: skill match, demand outlook, transferable skills and interests, minus AI exposure from the ILO's GenAI exposure index. Each score shows its parts and the skills gap, under three possible futures.
4. **Follow a pathway.** An ordered, step-by-step plan from entry role to peak role, with checked courses that fit the person's budget and weekly hours. Every role and skill links to official UN SDG targets with a reason.

HR managers and career centres get the same map for whole teams: a skills table, one group learning plan, and progress per person.

The AI is kept on a short leash: the model only reads text and rewords explanations from computed facts; any output containing a number not in our data is rejected. Careers, courses and scores come from code, so the person stays in charge.

Workshop skills used: GenAI APIs (a RunPod Serverless vLLM endpoint, with the DeepSeek API as fallback), database architecture (PostgreSQL for accounts, profiles and dated trend snapshots), and cloud hosting (Replit Deployments, Secrets and a scheduled data refresh).

[290 words]

## 3.1 Conceptual Tech Stack

- **Frontend:** HTML, CSS and vanilla JavaScript; three languages; works on phones.
- **Backend:** Python, FastAPI, Uvicorn; deterministic scoring and pathway engine.
- **Database:** PostgreSQL on Replit (SQLite locally) through SQLAlchemy.
- **AI:** Qwen2.5-7B-Instruct on a RunPod Serverless vLLM endpoint (OpenAI-compatible); DeepSeek API as fallback; templates when no model is available.
- **Data and APIs:** ESCO v1.2 API, ILO Working Paper 140 GenAI exposure scores, UN SDG API, Hacker News (Algolia) "Who is hiring?" threads, arXiv API; optional Adzuna job ads.
- **Hosting:** Replit Autoscale deployment with Secrets; daily trend refresh.

Block diagram:

```
Browser ──► Replit: FastAPI app ──► PostgreSQL (accounts, profiles, trend snapshots)
                 │
                 ├──► RunPod Serverless vLLM (reads CVs, rewords explanations)
                 ├──► ESCO API (live job search)
                 └──► Daily refresh: Hacker News + arXiv ──► dated snapshots
```

**Sponsor resources:** Yes. **Replit** hosts the live app, its PostgreSQL database and Secrets. **RunPod** runs the language model on a GPU through a Serverless vLLM endpoint that the app calls for CV reading and explanations.

## 3.2 Design-Thinking & Deployment Strategy (max 200 words)

**Empathise:** we wrote three synthetic personas from the brief's user groups: a mid-career office clerk, a fresh graduate switching fields and a TVET student, plus HR and career-centre users.
**Define:** each needs to know which skills are fading, which role fits, and what to do first, with reasons they can trust.
**Ideate and prototype:** we built the full chain end to end early, then improved it screen by screen: plain-language "Simple" mode, a four-step onboarding story, a guided tour, and team views.
**Test:** 49 automated tests cover scoring, fairness (age band never changes matches), model guardrails and data checks; we reviewed every screen in light, dark and phone layouts and fixed every problem we found.

**Deployment:** the prototype already runs on Replit with PostgreSQL and Secrets. Trend data refreshes daily, and only public or synthetic data is used. Phase 2 work: a Malaysian job-ad source, member sign-in for teams, a consent and deletion flow under the PDPA, and a pilot with a career centre.

[164 words]

## 4. Impact baseline

| Metric | Response |
|---|---|
| Target SDG sub-target(s) | **Target 4.4:** "By 2030, substantially increase the number of youth and adults who have relevant skills, including technical and vocational skills, for employment, decent jobs and entrepreneurship." Also **Target 8.5:** "full and productive employment and decent work for all". |
| Current problem baseline | More than **600,000 workers in Malaysia** are expected to need reskilling within 3–5 years (MOSTI, January 2025, reported by Malay Mail). Signals are already visible: the share of job posts asking for spreadsheets and data handling fell from **2.3% to 1.6%** in three months (Hacker News "Who is hiring?", May–Jul vs Aug–Oct 2026). |
| Core measurable KPI | **% of users who leave onboarding with a ranked career and a costed path**, and **% who complete their first path step within 30 days**. |
| Phase 2 impact target | [Team to set] e.g. [__]% of pilot users receive a path; [__]% complete their first step within 30 days. |

## 5. Checklist (team to tick)

- [ ] All team members have completed the mandatory GenAI, Database and Cloud Deployment workshops.
- [ ] The concept addresses a verified real-world problem mapped to one or more UN SDGs.
- [ ] The solution targets a functional, deployed application.
- [ ] All fields are completed within the word limits.

## 6. Intellectual property

- **6.1 Pre-existing work:** [No. Team to confirm: the repository was created after the 19 October 2026 problem-statement release.]
- **6.2 Third-party code, datasets or models:** Yes.

| Name | Type | Licence |
|---|---|---|
| FastAPI, Uvicorn, HTTPX, SQLAlchemy, psycopg, RapidFuzz, pypdf, python-docx, python-multipart | Code | MIT / BSD / Apache 2.0 / LGPL (psycopg) |
| GSAP 3.12.5 with ScrollTrigger; Lenis 1.1.20 | Code | GSAP Standard License; MIT |
| ESCO v1.2 (European Commission) | Dataset | EU reuse policy, attribution |
| ILO Working Paper 140 GenAI exposure scores | Dataset | CC BY 4.0 |
| UN SDG API target text | Dataset | UN terms of use |
| Hacker News "Who is hiring?" (Algolia API), arXiv API | Dataset | Public APIs; arXiv metadata CC0 |
| Qwen2.5-7B-Instruct (Alibaba Cloud) | Model | Apache 2.0 |
| DeepSeek chat model (fallback, via API) | Model | DeepSeek API terms |

- **6.3 Employment-related IP conflicts:** [Team to answer.]

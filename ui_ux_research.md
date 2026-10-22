<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# Act as a Principal UI/UX Lead and Design Systems Architect specializing in AI-driven EdTech, Workforce Intelligence dashboards, and Data Visualizations.

We are building a web application for DOMAIN 1 of the SDC Hackathon 2026: "Aiversecity Future-Ready Workforce".

Our stack is Next.js, React Flow, Tailwind CSS, and shadcn/ui.

Our app covers 6 Mandatory Deliverables:

1. Skills Profile Intake (Resume/CV parser \& skill taxonomy setup).
2. AI-Trend Signal Layer (Real-time/dated labor market trend tracker \& automation exposure index).
3. Future-Role Matching + Gap Analysis (0–100% match scores \& missing skill breakdown).
4. Personalised Reskilling Pathways (Interactive Directed Acyclic Graph / DAG roadmap visualizer).
5. UN SDG Mapping Layer (Connecting skills and future roles to SDG 4, 8, 9, 13).
6. Multiple Future Scenarios (Dynamic parameter sliders for Copilot vs. Aggressive AI Disruption).

Our competition evaluation rubric heavily emphasizes Innovation \& Originality (30%) and Clarity (20%). We want to strictly avoid generic flat chatbot wrappers and create an interactive dashboard experience.

Please conduct research on UI/UX best practices, layout patterns, and design systems for this specific domain. Output your response strictly as a clean Markdown (.md) document.

______________________________________________________________________

### 1. LAYOUT \& INFORMATION ARCHITECTURE

- Analyze top workforce intelligence platforms (e.g., Lightcast, LinkedIn Career Insights, Coursera Pathways, Retrain.ai).
- Define the optimal global layout (e.g., Collapsible Sidebar vs. Top Navigation, multi-tab dashboard layout vs. split-screen workspace).
- Provide a clear UI Page Hierarchy detailing how to structure the 6 mandatory deliverables into logical dashboard sections/tabs.

______________________________________________________________________

### 2. CORE FEATURE VISUALIZATION PATTERNS

#### A. Interactive Reskilling Pathway Visualizer (React Flow DAG)

- Research visual node-graph UX best practices for learning roadmaps (e.g., Duolingo tree style vs. node-based workflow editor).
- Specify visual states for DAG nodes: Completed, In-Progress, Missing Core Skill, Optional Milestone, SDG Badge.
- Recommend color codes, line styles, pan/zoom controls, and drawer overlays when clicking a node to view learning resources.


#### B. Dynamic Scenario Parameter Controls

- UX patterns for real-time scenario adjustment (e.g., dual-slider for "AI Automation Speed" vs. "Industry Adoption Rate").
- How to visually communicate real-time recalculations on skill demand without overwhelming the user.


#### C. AI-Trend Signals \& Automation Exposure Dashboard

- Best data visualization patterns (e.g., sparklines, threat/opportunity gauges, skill velocity heatmaps) to display emerging vs. declining skills.
- How to present data sources transparently (citing job feeds/research papers) to establish AI trust and human-in-the-loop control.


#### D. UN SDG Impact Layer

- How to integrate UN SDG target badges (SDG 4 Quality Education, SDG 8 Decent Work) into skill cards and role summaries cleanly without creating visual clutter.

______________________________________________________________________

### 3. DESIGN SYSTEM \& COMPONENT SPECIFICATIONS (Tailwind + shadcn/ui)

- Color Palette Recommendation: A modern palette balancing Sustainability (SDG green accents) and Future Tech (slate/indigo/cyan).
- Typography \& Hierarchy recommendations for data-dense dashboards.
- Recommended `shadcn/ui` components to use for each dashboard section (e.g., `Tabs`, `Dialog`, `Slider`, `Card`, `Badge`, `HoverCard`, `Progress`).

______________________________________________________________________

### 4. OUTPUT CONSTRAINTS

- Format strictly as a clean Markdown (.md) file with explicit headings, ASCII layout mockups, and UI design component tables.
- Focus on actionable UI/UX guidance that can be fed directly to an AI developer (Claude/Cursor) to generate React components.

````markdown
# UI/UX & Design Systems Blueprint
## Project: [INSERT PROJECT NAME]
### SDC Hackathon 2026 — Domain 1: Aiversecity Future-Ready Workforce

**Stack:** Next.js · React Flow · Tailwind CSS · shadcn/ui

**Design goal:** Build an interactive **Workforce Futures Intelligence Dashboard**, not a chat wrapper. The interface should make AI risk, skill gaps, learning pathways and SDG impact visible, explorable and trustworthy.

---

## 1. Layout & Information Architecture

### 1.1 Benchmark Patterns

| Platform Pattern | Strength | Limitation | What to Adopt |
|---|---|---|---|
| **Lightcast-style labour-market dashboards** | Strong occupational/skill trend visualisation, filters and data density | Can feel enterprise-heavy and impersonal | Trend charts, filters, source metadata and skill heatmaps |
| **LinkedIn Career Insights** | Familiar role cards, skill overlap and career-transition framing | Limited scenario exploration and weak causal explainability | Role-match cards, transferable-skill overlap, “people also transitioned to” pattern |
| **Coursera / learning-path products** | Clear progression, course cards and completion states | Often linear; weak connection to labour-market signals | Milestones, progress rings, resource cards and completion states |
| **Retrain.ai-style workforce platforms** | Strong skills taxonomy, internal mobility and reskilling orientation | Often B2B/admin-first rather than learner-first | Skill taxonomy chips, role readiness scores and cohort views |
| **Node-based editors such as React Flow workflows** | Excellent for non-linear prerequisites and exploratory pathways | Can overwhelm non-technical users if uncontrolled | Controlled DAG with staged reveal, guided layout and drawer details |

The winning pattern is a **learner-first intelligence workspace**: simple entry points on top, powerful exploratory tools beneath, and every number traceable to evidence.

### 1.2 Recommended Global Layout

Use a **collapsible left sidebar + persistent top command bar + main workspace**.

This supports both individual users and workforce planners without forcing a mobile-first single-column experience.

```text
┌──────────────────────────────────────────────────────────────────────┐
│  [Logo]  Workforce Futures Engine      [Search] [Scenario] [Profile] │
├────────────┬─────────────────────────────────────────────────────────┤
│            │                                                         │
│  SIDEBAR   │                     MAIN WORKSPACE                      │
│            │                                                         │
│  Overview  │  ┌───────────────────────────────────────────────────┐  │
│  My Skills │  │  Page Title + Contextual Explanation              │  │
│  AI Trends │  └───────────────────────────────────────────────────┘  │
│  Future    │                                                         │
│  Roles     │  ┌───────────────┐  ┌───────────────┐  ┌────────────┐  │
│  Pathways  │  │ KPI Card      │  │ KPI Card      │  │ KPI Card   │  │
│  SDG Impact│  └───────────────┘  └───────────────┘  └────────────┘  │
│  Scenarios │                                                         │
│  Sources   │  ┌─────────────────────────┐  ┌─────────────────────┐  │
│            │  │ Primary Visualisation   │  │ Detail / Controls   │  │
│  [Collapse]│  └─────────────────────────┘  └─────────────────────┘  │
│            │                                                         │
└────────────┴─────────────────────────────────────────────────────────┘
````


### 1.3 Navigation Decision

| Option | Verdict | Reason |
| :-- | :-- | :-- |
| Top navigation only | Reject | Too many domain-specific sections for a data-dense product |
| Collapsible left sidebar | **Adopt** | Scales from student to workforce-planner mode; preserves workspace width |
| Multi-tab dashboard | **Adopt within pages** | Separates Overview, Evidence, Controls and Actions |
| Split-screen workspace | **Adopt selectively** | Ideal for Pathways, Role Matching and Scenario Explorer |
| Full-screen chat | Reject | Undermines the dashboard-first, evidence-first positioning |

### 1.4 Page Hierarchy

Map the six mandatory deliverables into six primary destinations plus an evidence layer.

```text
App Root
├── 1. Overview
│   ├── Welcome / synthetic profile selector
│   ├── Career readiness snapshot
│   ├── Top risks and opportunities
│   └── Recommended next action
│
├── 2. My Skills
│   └── Deliverable 1: Skills Profile Intake
│       ├── Synthetic CV / profile selector
│       ├── Extracted skills table
│       ├── ESCO / O*NET mapping confidence
│       ├── User confirmation controls
│       └── Skill-category breakdown
│
├── 3. AI Trends
│   └── Deliverable 2: AI-Trend Signal Layer
│       ├── Emerging skills
│       ├── Declining skills
│       ├── Occupation demand velocity
│       ├── Automation exposure index
│       └── Source transparency panel
│
├── 4. Future Roles
│   └── Deliverable 3: Future-Role Matching + Gap Analysis
│       ├── Ranked role matches
│       ├── Match score explanation
│       ├── Missing-skill breakdown
│       └── Role comparison
│
├── 5. Pathways
│   └── Deliverable 4: Personalised Reskilling Pathways
│       ├── React Flow DAG
│       ├── Timeline milestones
│       ├── Learning-resource drawer
│       └── Progress tracker
│
├── 6. SDG Impact
│   └── Deliverable 5: UN SDG Mapping Layer
│       ├── SDG impact by role
│       ├── SDG impact by skill
│       ├── Evidence and target links
│       └── Impact comparison
│
├── 7. Scenario Explorer
│   └── Deliverable 6: Multiple Future Scenarios
│       ├── Scenario sliders
│       ├── Before/after role ranking
│       ├── Sensitivity explanation
│       └── Exportable scenario summary
│
└── 8. Data & Sources
    ├── Dataset catalogue
    ├── API retrieval dates
    ├── Model assumptions
    └── Human-review log
```


### 1.5 Primary User Flows

**Student / job seeker**

```text
Select synthetic profile
    → Confirm extracted skills
    → View AI exposure
    → Compare future roles
    → Open pathway DAG
    → Inspect SDG impact
```

**Mid-career professional**

```text
Select synthetic worker profile
    → See automation exposure
    → Compare “stay and augment” vs “pivot” roles
    → Adjust scenario sliders
    → Open shortest reskilling path
```

**Workforce planner**

```text
Select synthetic cohort
    → View skill-gap heatmap
    → Identify high-risk occupations
    → Compare scenarios
    → Export SDG-linked training priorities
```


______________________________________________________________________

## 2. Core Feature Visualization Patterns

### 2.A Interactive Reskilling Pathway Visualizer

Use **React Flow** as a guided learning map, not an unconstrained workflow editor. React Flow models a flow through nodes, edges and a viewport, and recommends patterns such as unique node/edge IDs, memoised callbacks, pure node components, centralised flow state and `fitView()` on initial render. [^74][^75]

#### Recommended DAG UX

| Principle | Implementation |
| :-- | :-- |
| Guided, not chaotic | Auto-layout left-to-right; limit initial visible nodes to 5–9 |
| Progressive disclosure | Show current node, next 1–2 steps and target role; expand on demand |
| Clear direction | Left-to-right flow: `Current profile → Skills → Projects → Credentials → Target role` |
| Minimal canvas controls | Zoom, fit view, minimap toggle, reset layout |
| Evidence-first | Every node opens a drawer with source, rationale and SDG link |
| Mobile fallback | On small screens, render a vertical stepper version of the same DAG |

#### ASCII DAG Mockup

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│  Pathway: Marketing Executive → AI Marketing Analyst                         │
│  Estimated duration: 12–16 weeks        Match improvement: 54% → 82%         │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────┐      ┌────────────────┐      ┌────────────────┐         │
│  │ Current Skills │─────▶│ SQL Basics     │─────▶│ Dashboarding   │────▶ …  │
│  │ Marketing      │      │ ● Recommended  │      │ ● In progress  │         │
│  │ Communication  │      │ SDG 4 · SDG 8  │      │ SDG 4 · SDG 9  │         │
│  └────────────────┘      └────────────────┘      └────────────────┘         │
│           │                                                                  │
│           └────────────▶┌────────────────┐                                   │
│                         │ AI Literacy    │─────▶ Target Role                 │
│                         │ ● Missing core │       AI Marketing Analyst        │
│                         └────────────────┘                                   │
│                                                                              │
│  [Fit view] [Zoom +] [Zoom -] [Reset] [Show optional milestones]            │
└──────────────────────────────────────────────────────────────────────────────┘
```


#### Node Visual States

| State | Visual Treatment | Tailwind / shadcn Guidance |
| :-- | :-- | :-- |
| Completed | Solid emerald left border, subtle check icon, reduced emphasis | `border-l-4 border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40` |
| In progress | Cyan/indigo pulse ring or animated progress bar | `ring-2 ring-cyan-500/60` + `Progress` component |
| Recommended next | Indigo border, elevated shadow, “Next” badge | `border-indigo-500 shadow-lg` + `Badge` |
| Missing core skill | Amber warning border and alert icon | `border-amber-500 bg-amber-50 dark:bg-amber-950/30` |
| Optional milestone | Dashed border, muted colour | `border-dashed border-slate-400` |
| Blocked / prerequisite missing | Slate muted node with lock icon | `opacity-70` + `Lock` icon |
| Target role | Larger node, gradient border, role icon | `bg-gradient-to-r from-indigo-500 to-cyan-500` |
| SDG-linked node | Small SDG-coloured dot or compact badge row | Use official SDG colours only as compact accents |

#### Edge Styles

| Edge Meaning | Style |
| :-- | :-- |
| Required prerequisite | Solid 2px indigo line |
| Recommended but optional | Dashed 1.5px slate line |
| Critical bottleneck | Solid 3px amber line |
| Completed path | Solid emerald line |
| Alternative route | Dotted cyan line |

#### Node Drawer

Clicking a node opens a right-side `Sheet` or `Drawer`, not a modal that hides the DAG.

```text
┌───────────────────────────────┬──────────────────────────────┐
│                               │  SQL Basics                  │
│        React Flow DAG         │  ──────────────────────────  │
│                               │  Status: Missing core skill  │
│   [Node]──[Node]──[Node]      │  Importance: Critical         │
│                               │  Est. effort: 8–10 hours      │
│                               │                              │
│                               │  Why recommended             │
│                               │  Required by 3 of 5 target   │
│                               │  roles; appears in rising    │
│                               │  job postings.               │
│                               │                              │
│                               │  Learning resources          │
│                               │  -  Verified course card      │
│                               │  -  Documentation             │
│                               │  -  Practice project          │
│                               │                              │
│                               │  SDG impact                  │
│                               │  [SDG 4] [SDG 8]             │
│                               │                              │
│                               │  [Mark started] [Mark done]  │
└───────────────────────────────┴──────────────────────────────┘
```


### 2.B Dynamic Scenario Parameter Controls

Use a **scenario control rail** fixed to the right side of the Scenario Explorer, with immediate but restrained visual feedback.

#### Recommended Controls

| Control | Type | Range | Purpose |
| :-- | :-- | :-- | :-- |
| AI automation speed | Slider | Conservative → Aggressive | Increases automation-risk penalty |
| Industry adoption rate | Slider | Low → High | Increases AI-skill demand weighting |
| Augmentation level | Slider | Task substitution → Human-AI copilot | Increases human judgement and domain-expertise weighting |
| Green transition | Slider | Low → High | Increases green-skill and SDG 13 weighting |
| Local market focus | Toggle | Global / Local | Adjusts role demand to selected geography |

#### Scenario Slider Layout

```text
┌─────────────────────────────────────────────┐
│  Scenario Explorer                          │
├─────────────────────────────────────────────┤
│  AI automation speed        ●──────────     │
│                             Moderate        │
│                                             │
│  Industry adoption rate     ──────●────     │
│                             High            │
│                                             │
│  Augmentation level         ●──────────     │
│                             Copilot-heavy   │
│                                             │
│  Green transition           ────●──────     │
│                             Medium          │
├─────────────────────────────────────────────┤
│  Presets:                                   │
│  [Conservative] [Copilot] [Disruption]      │
│  [Green Transition] [Reset]                 │
└─────────────────────────────────────────────┘
```


#### Real-Time Recalculation UX

| Pattern | Use |
| :-- | :-- |
| Debounced recalculation | Update after 150–250 ms of slider rest to avoid jitter |
| Delta badges | Show `+12`, `-18`, or `No change` beside each role score |
| Animated score bars | Animate width/height transitions over 250–350 ms |
| Rank-change arrows | Show `▲ 2`, `▼ 3`, or `=` next to role rankings |
| Before/after toggle | Let users compare baseline vs current scenario |
| Explanation popover | Explain exactly which weight caused the change |
| Scenario snapshot | Save current slider configuration as a named scenario |

**Avoid:** recalculating every animation frame, flashing entire charts, or changing colours dramatically on every slider movement.

#### Scenario Comparison Card

```text
┌──────────────────────────────────────────────────────────┐
│  Future Role Rankings                                    │
├──────────────────────────────────────────────────────────┤
│  AI Marketing Analyst                                    │
│  ████████████████████████████████████░░░  82%   ▲ 9      │
│                                                          │
│  Sustainability Data Analyst                             │
│  █████████████████████████████████░░░░░░  78%   ▲ 4      │
│                                                          │
│  Routine Reporting Analyst                               │
│  ██████████████████░░░░░░░░░░░░░░░░░░░░  48%   ▼ 6      │
├──────────────────────────────────────────────────────────┤
│  Main driver: Higher AI adoption increased demand for    │
│  AI evaluation and data-analysis skills.                 │
│                                                          │
│  [View evidence] [Save scenario]                         │
└──────────────────────────────────────────────────────────┘
```


### 2.C AI-Trend Signals \& Automation Exposure Dashboard

Use a **signal-to-risk hierarchy**: first show what is changing, then explain what it means for the user.

#### Recommended Visualisations

| Data Pattern | Best Visual | Placement |
| :-- | :-- | :-- |
| Skill demand velocity | Sparkline + percentage delta | Emerging/declining skill cards |
| Emerging vs declining skills | Diverging bar chart | AI Trends overview |
| Automation exposure | Horizontal risk meter, not a scary gauge | Role and occupation cards |
| Skill concentration | Heatmap | Workforce planner view |
| Research-frontier signals | Timeline or tagged paper list | AI Trends evidence tab |
| Job-posting momentum | Area or line chart with date range filter | Trend detail drawer |
| Role opportunity | Opportunity/risk quadrant | Future Roles page |

#### AI Trends Page Mockup

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│  AI Trend Signals                            Last updated: 20 Oct 2026, 09:30 │
├──────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────┐  ┌──────────────────────┐  ┌────────────────────┐  │
│  │ Emerging Skills      │  │ Declining Skills     │  │ Automation Exposure│  │
│  │ ▲ AI evaluation +34% │  │ ▼ Manual reporting   │  │ Current role: 62%  │  │
│  │ ▲ MLOps +28%         │  │ ▼ Basic data entry   │  │ ▓▓▓▓▓▓▓▓░░ Medium  │  │
│  │ ▲ ESG analytics +21% │  │ ▼ Routine QA         │  │                    │  │
│  └──────────────────────┘  └──────────────────────┘  └────────────────────┘  │
│                                                                              │
│  ┌─────────────────────────────────────┐  ┌───────────────────────────────┐  │
│  │ Skill Velocity Heatmap              │  │ Evidence Trail                │  │
│  │           Low   Medium   High       │  │ -  Adzuna: 1,284 postings      │  │
│  │ AI literacy   ░░░    ▒▒▒    ███      │  │ -  arXiv: 86 recent papers     │  │
│  │ Data viz      ░░░    ███    ▒▒▒      │  │ -  Frey-Osborne lookup         │  │
│  │ ESG reporting ▒▒▒    ███    ░░░      │  │ -  AIOE lookup                 │  │
│  └─────────────────────────────────────┘  └───────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────┘
```


#### Automation Exposure Presentation

Avoid presenting automation risk as a binary “your job will disappear” message.


| Exposure Band | Label | Colour | Message |
| :-- | :-- | :-- | :-- |
| 0–25% | Low exposure | Emerald | Tasks are relatively resistant to current AI automation |
| 26–50% | Moderate exposure | Cyan | Some tasks may be reshaped; augmentation opportunities exist |
| 51–75% | High exposure | Amber | Significant task reshaping likely; reskilling is valuable |
| 76–100% | Very high exposure | Red | Many routine tasks may be automated; transition planning is urgent |

Always pair the score with:

- “What is driving this score?”
- “Which tasks are most affected?”
- “Which adjacent roles reuse my skills?”
- “What is the recommended next step?”


#### Source Transparency Pattern

Every chart, score and recommendation should expose its evidence through a `HoverCard`, `Popover` or “View evidence” drawer.

```text
┌────────────────────────────────────────────────────────────┐
│  AI literacy demand: ▲ +34% over 90 days                   │
├────────────────────────────────────────────────────────────┤
│  Sources                                                   │
│  -  Adzuna job postings — 1,284 listings, retrieved 20 Oct  │
│  -  arXiv AI papers — 86 relevant publications              │
│  -  Felten AIOE occupation exposure lookup                  │
│                                                            │
│  Method                                                    │
│  Demand velocity = change in matched postings vs prior     │
│  90-day period.                                            │
│                                                            │
│  Human control                                             │
│  [View raw sample] [Adjust filters] [Flag data issue]      │
└────────────────────────────────────────────────────────────┘
```

This supports trust and human-in-the-loop governance: users can inspect evidence, challenge mappings and understand uncertainty.

### 2.D UN SDG Impact Layer

Use SDG badges as **compact, consistent metadata**, not as large decorative blocks. The UN provides official SDG icons, colour wheel and usage guidance, and its guidelines specify that SDG icon colours should not be altered. [^62][^63][^64]

#### SDG Badge Rules

| Rule | Implementation |
| :-- | :-- |
| Use official SDG colours | SDG 4, 8, 9 and 13 use their official colour identities |
| Keep badges small | 16–20 px icon or compact pill; never oversized colour blocks |
| Limit visible tags | Show top 2–3 SDGs per card; expose full list in detail drawer |
| Always link to evidence | Badge click opens SDG rationale and target reference |
| Avoid rainbow clutter | Use neutral card backgrounds; SDG colour appears only in badge/dot |
| Explain impact | Pair badge with one short sentence, e.g. “Supports lifelong learning and employment transitions” |

#### SDG Badge Component

```text
┌───────────────────────────────────────────────┐
│  AI Marketing Analyst                         │
│  Match: 82%        Automation risk: Medium    │
│                                               │
│  SDG impact:                                  │
│   Quality Education   Decent Work       │[^1][^2]
│                                               │
│  Why: Builds AI literacy, analytics and       │
│  employment-transition readiness.             │
│                                               │
│  [View SDG evidence]                          │
└───────────────────────────────────────────────┘
```


#### SDG Detail Drawer

```text
┌──────────────────────────────────────────────────────────┐
│  SDG Impact — AI Marketing Analyst                       │
├──────────────────────────────────────────────────────────┤
│   Quality Education                                   │[^1]
│  Skills supported: AI literacy, data analysis,           │
│  lifelong learning                                       │
│  Evidence: Learning pathway includes verified courses    │
│  and project-based assessment.                           │
│                                                          │
│   Decent Work and Economic Growth                     │[^2]
│  Skills supported: Employment transition, productivity,  │
│  human-AI collaboration                                  │
│  Evidence: Target role shows rising demand in job-feed   │
│  sample.                                                 │
│                                                          │
│   Industry, Innovation and Infrastructure             │[^3]
│  Skills supported: Digital tools, data infrastructure    │
│                                                          │
│   Climate Action                                     │[^4]
│  Skills supported: Sustainability analytics, ESG         │
│  reporting                                               │
└──────────────────────────────────────────────────────────┘
```


______________________________________________________________________

## 3. Design System \& Component Specifications

### 3.1 Colour Palette

Use a restrained **slate + indigo + cyan** product palette, with **emerald** as the sustainability accent and **official SDG colours** reserved for SDG metadata.


| Token | Light Mode | Dark Mode | Usage |
| :-- | :-- | :-- | :-- |
| `background` | `#F8FAFC` | `#0B1120` | App background |
| `surface` | `#FFFFFF` | `#111827` | Cards, sheets, panels |
| `border` | `#E2E8F0` | `#1F2937` | Dividers and card borders |
| `text-primary` | `#0F172A` | `#F1F5F9` | Headings and key data |
| `text-secondary` | `#475569` | `#94A3B8` | Supporting text |
| `primary` | `#4F46E5` | `#6366F1` | Primary actions, selected state |
| `accent-tech` | `#06B6D4` | `#22D3EE` | AI signals, trend highlights |
| `success` | `#10B981` | `#34D399` | Completed, low risk, positive delta |
| `warning` | `#F59E0B` | `#FBBF24` | Missing skills, medium risk |
| `danger` | `#EF4444` | `#F87171` | High automation exposure, declining demand |
| `sdg-4` | `#C5192D` | Same | SDG 4 Quality Education |
| `sdg-8` | `#A21942` | Same | SDG 8 Decent Work |
| `sdg-9` | `#FD6925` | Same | SDG 9 Industry, Innovation and Infrastructure |
| `sdg-13` | `#3F7E44` | Same | SDG 13 Climate Action |

The official UN SDG palette includes, among others, `#C5192D` for SDG 4, `#A21942` for SDG 8, `#FD6925` for SDG 9 and `#3F7E44` for SDG 13. [^64][^68]

### 3.2 Typography

Use a single highly legible sans-serif family, such as **Inter**, **Geist** or **IBM Plex Sans**.


| Role | Style | Tailwind Example |
| :-- | :-- | :-- |
| Page title | 24–30 px, semibold, tight tracking | `text-2xl font-semibold tracking-tight` |
| Section title | 18–20 px, semibold | `text-lg font-semibold` |
| Card title | 16 px, medium | `text-base font-medium` |
| Body | 14 px, regular | `text-sm text-muted-foreground` |
| KPI value | 28–36 px, bold, tabular numbers | `text-3xl font-bold tabular-nums` |
| Data label | 12 px, uppercase, wide tracking | `text-xs uppercase tracking-wide` |
| Source citation | 12 px, muted | `text-xs text-muted-foreground` |
| Badge | 11–12 px, medium | `text-xs font-medium` |

**Rules:**

- Use tabular numbers for all scores, percentages and dates.
- Never use more than two font weights in a single card.
- Keep data labels sentence case except for short uppercase metadata labels.
- Use line clamping for long AI explanations; expand in a drawer.


### 3.3 Spacing \& Density

| Token | Value | Use |
| :-- | :-- | :-- |
| Card padding | 16–20 px | Standard dashboard cards |
| Section gap | 24–32 px | Between dashboard sections |
| Grid gap | 12–16 px | KPI and chart grids |
| DAG node padding | 12–16 px | React Flow nodes |
| Drawer width | 360–420 px | Node and role details |
| Max content width | 1280–1440 px | Main workspace |

### 3.4 shadcn/ui Component Map

| Dashboard Area | Recommended shadcn/ui Components | Purpose |
| :-- | :-- | :-- |
| Global shell | `Sidebar`, `Menubar`, `Command`, `Tooltip`, `Avatar` | Navigation, search, profile |
| Skills Profile Intake | `Card`, `Tabs`, `Table`, `Badge`, `Checkbox`, `Progress`, `Alert`, `Sheet` | Synthetic CV selection, extraction review, confirmation |
| AI Trends | `Card`, `Tabs`, `Select`, `Slider`, `Badge`, `HoverCard`, `Popover`, `Separator`, `ScrollArea` | Trend charts, filters, source transparency |
| Future Roles | `Card`, `Badge`, `Progress`, `Accordion`, `HoverCard`, `Dialog`, `Table` | Ranked matches, score explanation, gap analysis |
| Pathways | `React Flow`, `Sheet`, `Badge`, `Progress`, `Button`, `Tooltip`, `Breadcrumb`, `Toggle` | DAG canvas, node drawer, progress and controls |
| SDG Impact | `Badge`, `Card`, `Tabs`, `Accordion`, `Popover`, `Table` | SDG tags, evidence and comparisons |
| Scenario Explorer | `Slider`, `Switch`, `ToggleGroup`, `Card`, `Badge`, `Chart`, `Button`, `Dialog` | Scenario controls and live recalculations |
| Data \& Sources | `Table`, `Badge`, `Accordion`, `Sheet`, `Alert`, `Skeleton` | Dataset catalogue, retrieval dates, audit trail |
| Empty / loading states | `Skeleton`, `Alert`, `Button`, `Progress` | Graceful API or ingestion failures |

### 3.5 Component Specifications

#### Role Match Card

```text
┌────────────────────────────────────────────────────┐
│  AI Marketing Analyst                    [82%]     │
│  Emerging demand · Medium automation exposure      │
│                                                    │
│  Skill overlap                                     │
│  ████████████████████████████████░░░░░░░           │
│                                                    │
│  Missing core skills                               │
│  [SQL] [Prompt evaluation] [Product analytics]     │
│                                                    │
│  SDG:                                     │[^2][^3][^1]
│                                                    │
│  [View pathway] [Why this match?]                  │
└────────────────────────────────────────────────────┘
```

| Element | Component | Behaviour |
| :-- | :-- | :-- |
| Match score | `Progress` + numeric label | Colour shifts by readiness band |
| Missing skills | `Badge` | Click opens skill detail |
| SDG tags | `Badge` | Click opens SDG evidence |
| Why this match | `HoverCard` or `Dialog` | Shows formula inputs and sources |
| View pathway | `Button` | Routes to Pathways with selected target role |

#### Skill Chip

```text
┌──────────────────────────────┐
│  Data Visualisation     88%  │
│  ESCO · Confirmed            │
│  [SDG 4] [SDG 9]             │
└──────────────────────────────┘
```

| Element | Rule |
| :-- | :-- |
| Skill name | Primary text |
| Confidence | Small tabular number |
| Taxonomy source | Muted metadata |
| Confirmation status | `Badge`: Confirmed / Suggested / Rejected |
| SDG tags | Compact dots or badges |

#### Automation Exposure Meter

```text
Low          Moderate         High        Very high
├────────────┼────────────────┼────────────┤
                 ▲ Current role: 62%
```

| Element | Rule |
| :-- | :-- |
| Meter | Horizontal segmented bar |
| Current score | Marker with numeric label |
| Colour | Emerald → cyan → amber → red |
| Explanation | Always visible below or in `HoverCard` |
| Call to action | “Explore resilient adjacent roles” |


______________________________________________________________________

## 4. Interaction \& Accessibility Standards

### 4.1 Interaction Rules

| Interaction | Expected Behaviour |
| :-- | :-- |
| Hover over score | Show formula inputs and source summary |
| Click role card | Open role detail or route to Pathways |
| Click DAG node | Open right-side drawer; retain DAG context |
| Move scenario slider | Debounced recalculation and delta indicators |
| Click SDG badge | Open SDG evidence drawer |
| Filter trend data | Update charts with loading skeleton, not blank screen |
| Mark skill confirmed | Update profile vector and show toast confirmation |
| API failure | Show cached data with “last updated” warning |

### 4.2 Accessibility Requirements

- Maintain WCAG AA contrast for text and interactive controls.
- Do not rely on colour alone; pair colour with icons, labels or patterns.
- Provide keyboard navigation for DAG nodes, sliders, tabs and drawers.
- Add `aria-label` to every React Flow node and edge.
- Ensure sliders expose current value and range to screen readers.
- Provide a non-canvas fallback for Pathways: vertical milestone stepper.
- Respect `prefers-reduced-motion`; disable DAG animations and score transitions when requested.


### 4.3 Empty, Loading and Error States

| State | UI Pattern |
| :-- | :-- |
| No profile selected | Onboarding card with synthetic profile options |
| Extracting skills | Skeleton rows with progress label |
| No verified learning resource | Amber alert: “No verified resource indexed for this skill yet.” |
| API rate limit | Cached-data banner with retrieval timestamp |
| Low-confidence mapping | Amber badge: “Review suggested mapping” |
| Scenario unchanged | Neutral “No material change” message |


______________________________________________________________________

## 5. Innovation-Focused UI Differentiators

To maximise the 30% Innovation \& Originality score, implement these signature interactions:

1. **Future Scenario Dial**\
A prominent, elegant control panel that visibly reshapes role rankings, pathway recommendations and SDG impact.
2. **Skill Capital Map**\
Visualise the user’s existing skills as reusable capital, with lines showing which future roles they transfer into.
3. **Pathway “What Changes?” Mode**\
When a user changes a scenario, highlight only the DAG nodes and edges whose importance changes.
4. **Evidence-First Hover System**\
Every score, badge and recommendation can be interrogated: source, date, method, confidence and human-review status.
5. **SDG Impact Lens**\
A toggle that recolours the dashboard around SDG 4, 8, 9 or 13, showing which pathways create the greatest sustainability-aligned impact.
6. **Career Resilience Score**\
A single composite indicator combining automation exposure, skill transferability, demand momentum and learning feasibility.

______________________________________________________________________

## 6. Developer Implementation Notes

### 6.1 Recommended Component Structure

```text
/components
  /layout
    AppShell.tsx
    SidebarNav.tsx
    TopCommandBar.tsx
  /skills
    ProfileIntakePanel.tsx
    SkillChip.tsx
    SkillConfirmationTable.tsx
  /trends
    TrendOverview.tsx
    SkillVelocityHeatmap.tsx
    AutomationExposureMeter.tsx
    SourceEvidencePanel.tsx
  /roles
    RoleMatchCard.tsx
    RoleGapBreakdown.tsx
    RoleComparison.tsx
  /pathways
    PathwayCanvas.tsx
    SkillNode.tsx
    ResourceNode.tsx
    RoleNode.tsx
    NodeDetailSheet.tsx
  /sdg
    SdgBadge.tsx
    SdgImpactPanel.tsx
    SdgEvidenceDrawer.tsx
  /scenarios
    ScenarioControlRail.tsx
    ScenarioSlider.tsx
    ScenarioComparison.tsx
    ScenarioPresetButtons.tsx
```


### 6.2 React Flow Implementation Rules

- Store nodes and edges in a central store such as Zustand.
- Use stable unique IDs for nodes and edges.
- Memoise node components and callbacks.
- Use `fitView()` on initial render.
- Use `nodesDraggable={false}` for learner mode.
- Enable panning and zooming, but provide reset and fit-view controls.
- Use `MiniMap` only on desktop and make it collapsible.
- Keep custom node components presentational; pass data and callbacks from the parent flow.
- Use CSS classes or Tailwind tokens rather than extensive inline styles.

React Flow’s documented model separates nodes, edges and the viewport, and community guidance recommends unique IDs, memoised callbacks, pure node components, centralised state, `fitView()` and keyboard shortcuts. [^74][^75]

### 6.3 State Model

```ts
type AppState = {
  activeSyntheticProfileId: string | null;
  confirmedSkills: SkillMapping[];
  selectedTargetRoleId: string | null;
  scenario: {
    automationSpeed: number;
    industryAdoption: number;
    augmentationLevel: number;
    greenTransition: number;
    marketFocus: "global" | "local";
  };
  pathwayProgress: Record<string, "not_started" | "in_progress" | "completed">;
  evidencePanelOpen: boolean;
  activeEvidenceId: string | null;
};
```


______________________________________________________________________

## 7. Final Design Principles

1. **Dashboard first, chat second.**\
AI explanations support exploration; they do not replace structured data views.
2. **Make uncertainty visible.**\
Show confidence, source dates, assumptions and scenario sensitivity.
3. **Progressive disclosure.**\
Show the decision first; reveal methodology and evidence on demand.
4. **Sustainability as metadata, not decoration.**\
SDG badges must be compact, official-coloured and evidence-linked.
5. **Human control at every decision point.**\
Users confirm skills, choose pathways, adjust scenarios and inspect evidence.
6. **Design for judges and users simultaneously.**\
The first screen should communicate the problem, the AI engine and the measurable outcome within five seconds.
```

This blueprint is ready to save as `ui-ux-spec.md` and feed directly into Claude, Cursor or another coding agent to generate the Next.js, Tailwind, shadcn/ui and React Flow implementation.```

<span style="display:none">[^10][^11][^12][^13][^14][^15][^16][^17][^18][^19][^5][^6][^7][^8][^9]</span>

<div align="center">⁂</div>

[^1]: https://github.com/KonstantinosPetrakis/esco-skill-extractor/blob/master/README.md
[^2]: https://github.com/CMUSustainability/SDGmapR/security
[^3]: https://github.com/topics/esco
[^4]: https://github.com/topics/occupations
[^5]: https://www.un.org/sustainabledevelopment/wp-content/uploads/2023/09/E_SDG_Guidelines_Sep20238.pdf
[^6]: https://www.un.org/en/academic-impact/new-guidelines-using-sustainable-development-goals-logo-and-icons
[^7]: https://www.un.org/sustainabledevelopment/news/communications-material/
[^8]: https://www.un.org/sustainabledevelopment/wp-content/uploads/2019/01/SDG_Guidelines_AUG_2019_Final.pdf
[^9]: https://sdgs.un.org/goals
[^10]: https://sdgs.un.org/home
[^11]: https://www.unic.or.jp/files/UN-Guidelines-for-Use-of-SDG-logo-and-17-icons-December-2017_JP.pdf
[^12]: https://www.unic.or.jp/files/SDG_Guidelines_AUG_2019_Final_ja.pdf
[^13]: https://www.un.org/sustainabledevelopment/sustainable-development-goals/
[^14]: https://sdgs.un.org/goals/goal17
[^15]: https://sdgs.un.org/es/goals?pt=webpage%20url
[^16]: https://www.un.org/sustainabledevelopment/development-goals/
[^17]: https://sdghelpdesk.unescap.org/media-centre/sdg-communications-materials
[^18]: https://reactflow.dev/learn/concepts/building-a-flow
[^19]: https://claudeskills.info/skills/thebushidocollective/han/reactflow-fundamentals/```


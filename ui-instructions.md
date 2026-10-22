# UI Polish & Layout Instructions (for AI coding agent)

## Project: [INSERT PROJECT NAME]: Workforce Futures Engine
### SDC Hackathon 2026, Domain 1: Aiversecity Future-Ready Workforce
**Stack:** Next.js · React Flow · Tailwind CSS · shadcn/ui
**Companion docs:** `research.md` (features), `ui-ux-spec.md` (existing page hierarchy and components)

---

## 0. How to use this file

You are a senior product designer and front-end engineer. **Restyle and re-lay-out the existing app; do not change business logic, data models, API routes, scoring formulas or feature scope.**

Rules of engagement:
1. Work in the order in §12. Commit after each step so nothing breaks the live demo.
2. Prefer editing design tokens (`globals.css`, `tailwind.config`) over editing components one by one.
3. Reuse shadcn/ui primitives; do not add a second UI library.
4. Keep every trust element: source names, retrieval dates, confidence, "estimate, not prediction" labels. Polish must never hide them, only organise them.
5. If a rule below conflicts with the existing code structure, make the smallest change that satisfies the rule and leave a `// TODO(ui):` note.

**Goal:** a first screen that looks credible, calm and obviously useful within a few seconds, and a workspace where a learner can reach "what should I do next?" in three clicks.

---

## 1. What the research says (and what it means for us)

| # | Finding | Source | Design rule for this app |
|---|---|---|---|
| R1 | Users judge visual appeal within about **50 ms**, and that impression is stable and colours later judgement. | Lindgaard et al. (2006), as summarised by NN/g-related write-ups | The **first viewport** must be visually finished: clean hero, strong hierarchy, no half-loaded widgets |
| R2 | Users prefer designs that are both **low in visual complexity and high in prototypicality (familiar)**. Complexity lowers perceived beauty even when the layout is familiar. | Google Research, *Users love simple and familiar designs* | Use familiar patterns (left sidebar, top bar, cards, tabs). Be novel only in the signature visuals (DAG, scenario dial) |
| R3 | Users **scan**, not read: F-pattern on text-heavy pages, layer-cake on headed pages, "spotted" scanning towards bold, contrasting anchors. Placement matters more than volume. | Eye-tracking summaries (NN/g, LeanLabs) | Put the most important number top-left of every page; use clear headings; one dominant visual anchor per screen |
| R4 | About **46%** of people cited overall design/look when judging a site's credibility; poor navigation and clutter cost credibility; third-party citations raise it. | Stanford Web Credibility Project (Fogg) | Look professional, keep navigation obvious, show citations and sources prominently (this is our trust story) |
| R5 | Response-time limits: **~0.1 s** feels instant, **~1 s** keeps flow, **~10 s** is the attention limit. | Nielsen, *Response Times: The 3 Important Limits* | Scenario sliders update in <100 ms (client-side); page transitions <1 s; anything longer shows a progress indicator with a label |
| R6 | Users leave many pages within **10–20 s** unless there is a clear value proposition. | NN/g via 5-second-test literature | State the value in one sentence above the fold; show a result (not a form) first |
| R7 | **Jakob's Law**: users spend most time on other sites and expect yours to work the same. | NN/g | Do not reinvent navigation, form controls or icons |
| R8 | Progressive disclosure reduces cognitive load in data-dense tools. | Established UX practice (NN/g) | Show decision first, evidence on demand (hover card, drawer) |
| R9 | WCAG 2.2 AA: text contrast ≥ **4.5:1** (3:1 large text and UI components), visible focus, minimum target size, no colour-only meaning. | W3C WCAG 2.2 | Check every token pair; pair colour with icon or label |
| R10 | Core Web Vitals "good" thresholds: LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1. | Google web.dev | Set budgets in §10 |

> R1–R6 were verified against the cited sources. R7–R10 are standard published guidance; re-check thresholds on the primary pages (NN/g, W3C, web.dev) before quoting them in the pitch.

---

## 2. Design principles (decision filters)

1. **Calm, then clever.** The baseline UI is quiet and familiar; the signature interactions (DAG, scenario dial, SDG lens) carry the "wow".
2. **One hero per screen.** Each page has exactly one dominant visual (chart, DAG, ranked list). Everything else is secondary.
3. **Answer first, evidence on demand.** Lead with the number or recommendation; sources, formulas and confidence appear in hover cards and drawers.
4. **Whitespace is a feature.** If a screen feels dense, remove something before shrinking it.
5. **Consistency over decoration.** Same radius, same shadow scale, same spacing steps everywhere.
6. **Every state is designed.** Empty, loading, error, stale-data and low-confidence states get real UI.
7. **Trust is visible.** Source chips, "Last updated" stamps and "Estimate" labels are styled design elements, not footnotes.

---

## 3. First screen (landing / Overview): the 5-second test

**Pass criteria:** a new viewer can say what the product does, who it is for, and what to click, after 5 seconds.

```text
┌──────────────────────────────────────────────────────────────────────────┐
│ [Logo]  Workforce Futures Engine        Pathways · Trends · Sources  [Try demo] │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   See how AI changes your career, and your next 12 weeks.                │  ← H1, one line
│   Live job and research signals → future roles → a personalised path.    │  ← 1 sentence
│                                                                          │
│   [ Start with a sample profile ▸ ]    [ Watch 60-second tour ]          │  ← 1 primary, 1 secondary CTA
│                                                                          │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐    │
│  │ 39%          │ │ 59 of 100    │ │ Live data    │ │ SDG 4 · 8    │    │  ← proof strip
│  │ skills change│ │ need reskill │ │ updated today│ │ aligned      │    │
│  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘    │
│                                                                          │
│   [ Preview: pathway DAG + scenario toggle, static or auto-playing ]     │  ← the "wow" visual
└──────────────────────────────────────────────────────────────────────────┘
```

Instructions:
- **Do not** open on a blank form or a chat box. Open on a **result**: a pre-selected sample profile with its top role matches already visible.
- One primary button (filled `primary`), one secondary (outline). No third CTA above the fold.
- The proof strip uses real, cited numbers (WEF 2025) with a small "Source" link each, and one **live** chip ("Data refreshed {date}") bound to the actual signal timestamp.
- Include a persistent, subtle line: *"Sample data only. Estimates, not predictions. You stay in control."*
- Hero visual: a lightweight static SVG/PNG of the DAG or a looping CSS animation; **never** a heavy video.

---

## 4. Global layout and navigation

Keep the existing architecture (collapsible left sidebar + top command bar + workspace) and refine it:

| Element | Spec |
|---|---|
| Sidebar | 240 px expanded, 64 px collapsed (icons + tooltips). Group items: **Explore** (Overview, My Skills, AI Trends), **Decide** (Future Roles, Scenarios), **Act** (Pathways, SDG Impact), **Trust** (Data & Sources). Active item: filled `primary/10` background plus 3 px left accent bar. |
| Top bar | 56 px height, sticky, blurred surface (`backdrop-blur`), contains: breadcrumb, profile selector, scenario chip (shows active scenario and opens a popover), theme toggle, language switcher (if i18n is implemented) |
| Content width | `max-w-[1280px]`, centred; 24 px page padding desktop, 16 px mobile |
| Page header | Title (H1), one-line purpose, and the primary action right-aligned. Same pattern on every page. |
| Page grid | 12-column CSS grid. Typical splits: 8/4 (visual + detail), 7/5 (list + detail), 12 (full-width canvas) |
| Mobile (<768 px) | Sidebar becomes a bottom tab bar with 5 items (Overview, Skills, Roles, Path, More). DAG falls back to a vertical stepper. Scenario controls open in a bottom sheet. |
| Breadcrumb / progress | A slim 4-step "journey" indicator on the Overview: **Profile → Roles → Pathway → Impact** with completed states, so the user always knows where they are |

Do not add more than 8 top-level destinations. If a page is rarely needed (Data & Sources), keep it in the "Trust" group at the bottom.

---

## 5. Visual system (tokens first)

### 5.1 Colour: keep the slate + indigo + cyan + emerald palette, add elevation and tints

Implement as CSS variables in `globals.css` using shadcn's convention, so every component inherits them.

```css
:root {
  --background: 210 40% 98%;      /* #F8FAFC */
  --foreground: 222 47% 11%;      /* #0F172A */
  --card: 0 0% 100%;
  --card-foreground: 222 47% 11%;
  --muted: 210 40% 96%;
  --muted-foreground: 215 19% 35%; /* aim ≥ 4.5:1 on background; verify */
  --border: 214 32% 91%;
  --primary: 243 75% 59%;         /* indigo #4F46E5 */
  --primary-foreground: 0 0% 100%;
  --accent-tech: 188 94% 43%;     /* cyan */
  --success: 160 84% 39%;
  --warning: 38 92% 50%;
  --danger: 0 84% 60%;
  --radius: 0.75rem;              /* 12px cards */
}
.dark {
  --background: 224 55% 7%;
  --foreground: 210 40% 96%;
  --card: 221 39% 11%;
  --border: 217 24% 18%;
  --primary: 239 84% 67%;
}
```

Rules:
- **60 / 30 / 10 rule:** 60% neutral surfaces, 30% secondary (cards, muted), 10% accents (primary, status).
- Use **at most one saturated colour per card** (status OR SDG OR action), not all three.
- Official SDG colours appear only inside SDG badges and the SDG Impact Lens (SDG 4 `#C5192D`, SDG 8 `#A21942`, SDG 9 `#FD6925`, SDG 13 `#3F7E44`). Verify against the UN SDG communications guidelines before final use.
- Provide **dark mode** and test every chart in both.
- Warning amber on white fails contrast for text; use amber as a border/icon with dark text (`text-amber-900` on `bg-amber-50`).

### 5.2 Typography

- One family: **Inter** (or Geist) via `next/font` with `display: swap` and Latin subset only. If Chinese UI is added, rely on system CJK fallback to avoid font weight.
- Scale: H1 `text-3xl` (30) · H2 `text-xl` (20) · H3/card title `text-base font-medium` · body `text-sm` (14) · caption `text-xs`.
- Line height: body 1.5, headings 1.2. Max paragraph width 65–75 characters (`max-w-prose`).
- `tabular-nums` on every score, percentage and date. Right-align numeric columns.
- Never more than two weights per card (regular + semibold).

### 5.3 Spacing, radius, elevation

| Token | Value |
|---|---|
| Spacing scale | 4 · 8 · 12 · 16 · 24 · 32 · 48 (use only these) |
| Card padding | 20 px (16 px on mobile) |
| Gap between cards | 16 px; between sections 32 px |
| Radius | 12 px cards, 8 px inputs/buttons, full for badges/avatars |
| Elevation | Level 0: border only. Level 1: `shadow-sm` for cards. Level 2: `shadow-md` for popovers/sheets. Level 3 (hover lift on clickable cards only): `shadow-lg` + `-translate-y-0.5`. |
| Borders | 1 px `border` colour; avoid heavy shadows plus borders together in dark mode |

### 5.4 Iconography and imagery
- `lucide-react` only, 16/20 px, 1.5 stroke. Icons always paired with a label or `aria-label`.
- No stock photos of people. If imagery is needed, use simple inline SVG illustrations in the palette.

---

## 6. Page-by-page layout instructions

For each page: **hero visual → KPI row → detail → evidence**. Keep the KPI row to 3–4 cards.

### 6.1 Overview
- Journey indicator (Profile → Roles → Pathway → Impact), then "Recommended next action" as the single highlighted card.
- KPI cards: Career Resilience Score, Top matched role (with % and delta), Automation exposure (meter), SDG alignment (compact badges).
- "Top 3 opportunities" and "Top 3 risks" as two side-by-side lists, each with sparkline and source chip.

### 6.2 My Skills (Intake)
- Left (5/12): profile selector (sample profiles as cards with avatar initials, role, one-line summary), questionnaire or form in a `Tabs` (Form · Questionnaire · Sample CV).
- Right (7/12): extracted skills as chips grouped by category; low-confidence chips use an amber outline plus "Review" label; **Confirm all high-confidence** bulk action at the top.
- Show a small progress ring ("18 of 22 skills confirmed"). Nothing leaves the page until the user has a clear "Continue to roles" button.

### 6.3 AI Trends
- Hero: **skill velocity heatmap** or "Emerging vs Declining" two-column list with sparklines.
- Filters in one row (`Select` for occupation family, region, time window). Defaults pre-selected; never an empty chart.
- Always-visible **Source bar** at the top of the chart card: `Source: Adzuna · Retrieved 2026-10-20 · n = 1,240 postings · [Methodology]`.
- Gauge/meter for exposure uses the segmented bar already specified; add icon + text for each band (not colour only).

### 6.4 Future Roles
- Split view: ranked list (left, 5/12) and selected-role detail (right, 7/12). Selecting a card updates the detail pane without navigation.
- Card: role title, match % ring, 2 badges max (demand, risk), 3 missing-skill chips max with "+N more".
- Detail pane tabs: **Why this match** (score breakdown bar), **Skill gap**, **Market evidence**, **SDG**.
- Comparison: allow selecting up to 3 roles and open a side-by-side `Dialog`.

### 6.5 Pathways (DAG)
- Full-width canvas with a 360–420 px right drawer. Toolbar floats top-left: Fit view, Zoom, Reset, "Show optional steps", "What changed?".
- Default 5–9 nodes; auto-layout left-to-right; ensure `fitView` with 10% padding.
- A **timeline strip** below the canvas shows milestones with week ranges so the plan is also readable as a list.
- Node states (completed, in progress, recommended, missing core, optional, locked, target) follow the existing spec; add an always-visible **legend** (collapsible) so colour is never the only cue.

### 6.6 SDG Impact
- Row of SDG tiles (4, 8, 9, 13 prominent, others available in "All 17" expander) with contribution level bars.
- "Your path contributes to…" narrative card in plain language (max 3 sentences) with an evidence link.
- Impact Lens toggle recolours the dashboard accents; keep text colours unchanged for contrast.

### 6.7 Scenario Explorer
- Control rail (right, 320 px) with 3–4 sliders and 3 preset buttons (**Copilot**, **Balanced**, **Aggressive**). Presets first, sliders for fine-tuning.
- Main area: before/after role ranking as a **slope or bump chart** (rank changes), with delta chips (▲2, ▼1).
- Uncertainty is shown as **range bars** or soft bands on scores, plus the persistent "Estimates, not predictions" label.

### 6.8 Data & Sources
- Table of sources with columns: name, type, retrieved date, sample size, licence, status (Fresh / Stale / Cached). Stale rows use the amber alert style.
- "Human review log" as a simple timeline.

---

## 7. Component polish checklist

| Component | Instructions |
|---|---|
| **Card** | Border + `shadow-sm`; header (title + optional action), body, optional footer with source chip. Clickable cards get hover lift and a visible focus ring. |
| **Role match card** | Match ring on the right, title left; no more than 2 badges and 3 missing-skill chips visible; "Why this match?" is a text link (not a big button). |
| **Skill chip** | Name + confidence; status as a small icon (✓ confirmed, ! review); SDG shown as 8–10 px dots with tooltip, **not** full badges. |
| **SDG badge** | Compact pill: coloured dot + "SDG 4". Max 3 visible; extras collapse into "+2". Full name and target in a `HoverCard`. |
| **Source chip** | Small outline pill with icon, name and date; opens a popover with URL, method, sample size and licence. Reuse everywhere. |
| **Confidence / uncertainty** | Use a 3-level label (Low / Medium / High) plus a tiny bar. Avoid showing false precision (no "82.347%"). Round scores to whole numbers. |
| **KPI card** | Label (xs uppercase), value (3xl tabular), delta chip, optional sparkline. |
| **Buttons** | One primary per view. Min height 40 px (44 px on mobile). Loading state replaces the label with a spinner and keeps width. |
| **Tables** | Sticky header, zebra off, row hover, right-aligned numbers, 44 px row height, horizontal scroll container on mobile. |
| **Tabs** | Max 5 tabs; use counts only where meaningful. |
| **Tooltips / HoverCards** | Open after ~200 ms; also reachable by keyboard focus; never contain the only copy of critical information. |
| **Toasts** | Short, one line, auto-dismiss in 4 s, used for confirmations ("Skill confirmed"). |
| **Charts** | Max 5 series; direct labels instead of legends when possible; light gridlines; colour-blind-safe palette; each chart has a text summary for screen readers. |

---

## 8. Motion and feedback

| Situation | Behaviour |
|---|---|
| Hover / press | 100–150 ms ease-out |
| Panel / drawer open | 200 ms slide + fade |
| Scenario slider drag | Recompute client-side, update numbers via a number-tween (≤200 ms). Highlight **only changed items** with a brief background pulse. |
| Rank changes | Animate position swap (FLIP) over 300 ms; show ▲▼ chips |
| Page load | Skeletons matching the final layout (no layout shift), never a blank screen or a lone spinner |
| Long operation (>1 s) | Progress label ("Matching 214 roles…"); (>10 s) must show steps and allow cancel |
| Reduced motion | Respect `prefers-reduced-motion`: disable translate/pulse/DAG animations, keep opacity changes |

Avoid: auto-playing carousels, parallax, confetti on non-milestone events, looping animations beyond the hero visual.

---

## 9. Responsive, inclusive and low-bandwidth design

- Breakpoints: `sm 640`, `md 768`, `lg 1024`, `xl 1280`. Design mobile first for Overview, Skills, Roles and Pathways (stepper); Scenario Explorer works on mobile with presets and a bottom sheet.
- Touch targets ≥ 44×44 px on mobile (WCAG 2.2 minimum is 24×24 px; 44 is the safer design target).
- Language switcher (EN / BM / 中文) in the top bar if i18n exists: all UI strings in JSON, no hard-coded text in components; allow ~30% text expansion in layouts; keep skill/role names from the taxonomy.
- Low-bandwidth: lazy-load React Flow and chart libraries (`next/dynamic`, `ssr: false` where needed), compress images, use SVG icons, avoid video, and cache the last successful API payload for offline-tolerant viewing.
- Plain-language copy: reading level suitable for a school leaver; define jargon on first use ("Automation exposure: how much of this job's tasks AI could do").

---

## 10. Performance and quality budgets

| Metric | Target |
|---|---|
| LCP (home, mid-range mobile) | ≤ 2.5 s |
| INP | ≤ 200 ms |
| CLS | ≤ 0.1 (use skeletons and reserved sizes) |
| First-load JS (Overview route) | ≤ 200 KB gzipped; DAG and charts code-split |
| Scenario recalculation | < 100 ms perceived (client-side) |
| Lighthouse (Accessibility) | ≥ 95 |
| Contrast | All text pairs ≥ 4.5:1, UI components ≥ 3:1 |

---

## 11. Accessibility and trust requirements (non-negotiable)

- Visible focus ring on every interactive element (`ring-2 ring-primary ring-offset-2`).
- Full keyboard path: sidebar → top bar → page content → drawers; `Esc` closes drawers; focus returns to the trigger.
- React Flow nodes: `aria-label` with name, status and importance; provide the vertical stepper alternative.
- Never convey status by colour alone (icon + text).
- Sliders: labelled, expose `aria-valuetext` ("Aggressive, 80 of 100").
- Disclosure labels must stay visible after the restyle: **"Sample data"**, **"Estimates, not predictions"**, **"Source + date"**, **"Human review required"**.
- Fairness note in the footer: *"Recommendations do not use age, gender or ethnicity."* (only if true in the implementation).

---

## 12. Execution order for the agent

1. **Audit:** list pages and components, screenshot each at 1440 px and 390 px, note violations of §3–§11. Output a short `UI_AUDIT.md`.
2. **Tokens:** update `globals.css`, `tailwind.config`, fonts, radius, shadows (§5).
3. **Shell:** sidebar, top bar, page header pattern, mobile tab bar (§4).
4. **Shared components:** Card, KPI card, Source chip, SDG badge, Skill chip, Match ring, Skeletons, Empty/Error states (§7).
5. **Overview / landing** to pass the 5-second test (§3, §6.1).
6. **Pathways and Scenario Explorer** (the signature screens): layout, legend, drawer, rank-change animation (§6.5, §6.7, §8).
7. **Remaining pages** (§6.2–6.4, 6.6, 6.8).
8. **Accessibility and performance pass** (§10, §11): run axe, Lighthouse, keyboard walkthrough, reduced-motion test.
9. **Final QA with 5 people:** 5-second test on the Overview (what is this, who is it for, what do I click?), then a 3-task usability run (confirm skills, find the best role, open the first pathway step). Fix the top 3 issues.

### Definition of done
- [ ] Overview passes the 5-second test with ≥4 of 5 testers.
- [ ] Every page follows hero → KPI → detail → evidence.
- [ ] No page has more than one primary button.
- [ ] Every score, trend and recommendation shows source + date or can reveal it in one hover/click.
- [ ] Light and dark mode both pass contrast checks.
- [ ] Works at 390 px width with no horizontal page scroll.
- [ ] Scenario slider updates feel instant; no layout shift.
- [ ] Lighthouse accessibility ≥ 95 and no critical axe violations.

---

## 13. Prompt to paste into Claude Code / Cursor

```text
Read ui-polish-instructions.md, ui-ux-spec.md and research.md.
Restyle and re-lay-out the existing Next.js app according to ui-polish-instructions.md.
Do NOT change business logic, API routes, data models or scoring formulas.
Follow the execution order in section 12. After each step, run the build, fix errors,
and summarise what changed in a short changelog. Keep all disclosure labels
(sample data, estimates not predictions, source + date, human review required).
Start with step 1 (UI_AUDIT.md) and wait for my approval before step 2.
```

---

## 14. Sources

- Lindgaard, G., Fernandes, G., Dudek, C., & Brown, J. (2006). *Attention web designers: You have 50 milliseconds to make a good first impression!* Behaviour & Information Technology. (summaries: NN/g-related and UX psychology write-ups)
- Google Research, *Users love simple and familiar designs: why websites need to make a great first impression* (visual complexity and prototypicality) — https://research.google/blog/users-love-simple-and-familiar-designs-why-websites-need-to-make-a-great-first-impression/
- Fogg, B.J. et al., Stanford Web Credibility Project, *How Do People Evaluate a Web Site's Credibility?* (46.1% cited design/look)
- Nielsen, J., *Response Times: The 3 Important Limits* — https://www.nngroup.com/videos/3-response-time-limits-interaction-design/
- Nielsen Norman Group, F-pattern and scanning research; Jakob's Law of the Web User Experience — https://www.nngroup.com
- W3C, *Web Content Accessibility Guidelines (WCAG) 2.2* — https://www.w3.org/TR/WCAG22/
- Google, *Core Web Vitals* — https://web.dev/vitals/
- United Nations, *SDG communications materials and colour guidelines* — https://www.un.org/sustainabledevelopment/news/communications-material/

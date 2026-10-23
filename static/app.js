/* Workforce Futures Engine: web client.
   Sign in → step-by-step "About you" setup → personal dashboard with career, path and
   resume. Accounts live in the server database; this browser keeps only the session token. */
(function () {
"use strict";

// ---------- accounts and state -----------------------------------------------------
const TOKEN = "wfe.token";
const DATA_KEYS = ["onboarded", "prefs", "profile", "progress", "role", "seen", "team"];
const st = {
  meta: null, page: "signin", wiz: 0, scen: "moderate", compare: false,
  analysis: null, advice: null, path: null, updates: null, sel: null, open: null,
  explain: {}, exTried: {}, busy: {}, cvDraft: null, extractNote: "", occ: { q: "", results: [], source: "" }, expMode: null,
  team: "hr", ownTeams: [], legacyUpload: null, teamTargets: {}, polished: null,
  acct: null, token: null, accounts: [], signin: { error: "" }
};
const A = () => st.acct;
const P = () => A().profile;
const simple = () => !!A() && A().prefs.mode === "simple";
let tSave = null;
// Saves the account to the server database, a moment after the last change.
function save() {
  if (!A() || !st.token) return;
  clearTimeout(tSave);
  tSave = setTimeout(async () => {
    const data = Object.fromEntries(DATA_KEYS.map((k) => [k, A()[k]]));
    try { await api("/api/me", data, false, "PUT"); }
    catch (e) { if (/sign in/i.test(e.message)) { toast(e.message); signedOut(); } else toast(T("Could not save: {e}", { e: e.message })); }
  }, 600);
}
function useAccount(u) {
  st.acct = { id: u.id, name: u.name, sample: u.kind === "sample", kind: u.kind, ...u.data };
  if (st.acct.profile) st.acct.profile = { home_country: "", custom_skills: [], ...st.acct.profile };
  loadOwnTeams();
  if (st.acct.team) {
    const t = st.acct.team, src = t.source === "upload" ? (st.ownTeams[0] || {}).id : t.source;
    st.teamTargets = t.targets || (t.target && src ? { [src]: t.target } : {});
    st.team = src && (isOwn(src) ? st.ownTeams.some((x) => x.id === src) : st.meta.samples.teams.some((x) => x.id === src)) ? src : (st.acct.profile && st.acct.profile.situation === "tvet" ? "tvet" : "hr");
  }
  st.teamReport = null; st.openAreas = null; st.slide = null; st.teamSlide = null;
}
function signedOut() {
  if (A() && A().kind === "fresh") { try { localStorage.removeItem(`wfe.members.${A().id}`); localStorage.removeItem(`wfe.teams.${A().id}`); } catch (e) { /* ignore */ } }
  st.members = null;
  st.acct = null; st.token = null; st.chat = { open: false, opening: false, loaded: false, busy: false, messages: [], draft: "", quote: null };
  try { localStorage.removeItem(TOKEN); } catch (e) { /* ignore */ }
  st.page = "signin"; st.signin = { error: "" }; loadAccounts();
}
async function loadAccounts() { try { st.accounts = (await api("/api/accounts")).accounts; } catch (e) { st.accounts = []; } render(); }

// ---------- interface language ------------------------------------------------------
// English text is the key. static/i18n/<lang>.json maps it to Bahasa Melayu or Chinese;
// anything missing falls back to English. Job titles, skill names, course names and
// quoted source text stay in English because they come from ESCO, the ILO and providers.
const LANGS = [["en", "EN", "English"], ["ms", "BM", "Bahasa Melayu"], ["zh", "中文", "中文"]];
const LOCALE = { en: "en-GB", ms: "ms-MY", zh: "zh-CN" };
const HTML_LANG = { en: "en", ms: "ms", zh: "zh-Hans" };
const LANG_KEY = "wfe.lang";
const DICT = {};
let LANG = "en", TPL = [], LOWER = {};
async function loadLang(l) {
  if (l !== "en" && !DICT[l]) {
    try { const r = await fetch(`/static/i18n/${l}.json`); DICT[l] = r.ok ? await r.json() : {}; } catch (e) { DICT[l] = {}; }
  }
  LANG = l === "en" || DICT[l] ? l : "en";
  const d = DICT[LANG] || {};
  LOWER = Object.fromEntries(Object.entries(d).map(([k, v]) => [k.toLowerCase(), v]));
  // keys with {placeholders} also match text the server builds, such as advice tips
  TPL = Object.keys(d).filter((k) => /\{\w+\}/.test(k) && k.replace(/\{\w+\}/g, "").trim().length > 3).map((k) => {
    const names = [];
    const src = k.replace(/[.*+?^$()|[\]\\]/g, "\\$&").replace(/\{(\w+)\}/g, (m, n) => { names.push(n); return "(.+?)"; });
    return [new RegExp("^" + src + "$", "s"), k, names];
  });
  document.documentElement.lang = HTML_LANG[LANG];
}
// Interface text written in this file.
function T(s, v) {
  let out = LANG === "en" ? s : ((DICT[LANG] || {})[s] || s);
  if (v) out = out.replace(/\{(\w+)\}/g, (m, k) => (v[k] != null ? v[k] : m));
  return out;
}
// Text that arrives from the server: exact match, then a template with {placeholders}.
function TS(s) {
  if (s == null || s === "" || LANG === "en") return s;
  const str = String(s), d = DICT[LANG] || {};
  if (d[str]) return d[str];
  if (LOWER[str.toLowerCase()]) return LOWER[str.toLowerCase()];
  for (const [re, key, names] of TPL) {
    const m = str.match(re);
    if (m) { const v = {}; names.forEach((n, i) => { v[n] = TS(m[i + 1]); }); return T(key, v); }
  }
  return s;
}
const fmtDate = (iso, o) => new Date(iso + "T00:00:00").toLocaleDateString(LOCALE[LANG], o || { day: "numeric", month: "short", year: "numeric" });
const firstSentence = (x) => { const m = String(x).match(/^.*?[.。!?！？](?=\s|$)/); return m ? m[0] : x; };
const stageName = (s, lower) => (LANG === "en" && lower ? String(s).toLowerCase() : TS(s));
async function setLang(l) {
  await loadLang(l);
  try { localStorage.setItem(LANG_KEY, l); } catch (e) { /* this visit only */ }
  if (A()) { A().prefs.lang = l; st.explain = {}; save(); }
  render();
}
// One shared setting: a choice made on this device wins and is saved to the account.
async function syncAccountLang() {
  let mine = null; try { mine = localStorage.getItem(LANG_KEY); } catch (e) { /* ignore */ }
  if (mine) { if (A().prefs.lang !== mine) { A().prefs.lang = mine; save(); } }
  else if (A().prefs.lang && A().prefs.lang !== LANG) await loadLang(A().prefs.lang);
}

// ---------- helpers -------------------------------------------------------------------
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const LV = ["none", "basic", "working", "strong"];
const lv = (n) => T(LV[n]);
const cl = (id) => st.meta.clusters.find((c) => c.id === id) || { label: id, sdg: [] };
const roleOf = (id) => st.meta.roles.find((r) => r.id === id);
const country = () => st.meta.countries[P().country] || st.meta.countries.OTHER;
const countryName = () => hasLocal(P().country) ? TS(country().name) : regionName(P().country || "OTHER");
const firstName = () => (A().name || "").split(",")[0].trim();
const skillsNow = () => { const s = { ...P().skills }; Object.entries(P().pathSkills).forEach(([k, v]) => { s[k] = Math.max(s[k] || 0, v); }); return s; };
function toast(m) { const t = $("#toast"); t.textContent = m; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => { t.hidden = true; }, 4000); }
const wide = () => window.matchMedia("(min-width: 1024px)").matches;
// Source chip: name and date always visible; method, sample size and licence on click.
const SRC_ICON = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5"/></svg>';
function srcChip(name, date, lines, url, live) {
  return `<details class="src"><summary>${live ? '<span class="live-dot" aria-hidden="true"></span>' : SRC_ICON}<span>${esc(name)}</span>${date ? `<span class="src-date">· ${esc(date)}</span>` : ""}</summary><span>${(lines || []).map((l) => `<span>${esc(l)}</span>`).join("")}${url ? `<a href="${esc(url)}" target="_blank" rel="noopener">${T("Open source ↗")}</a>` : ""}</span></details>`;
}
const snap = () => st.updates && st.updates.snapshot;
// Geometric marks drawn for this project (circle, half, quarter, ring, stripes, dots).
// Ink outlines with one accent fill: repetition with a single exception.
const GEO = (() => {
  const o = (inner) => `<svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.4">${inner}</svg>`;
  return {
    dashboard: o('<circle cx="12" cy="12" r="10"/><path d="M12 2a10 10 0 0 1 0 20z" fill="var(--accent)" stroke="none"/>'),
    jobcheck: o('<rect x="2" y="2" width="20" height="20"/><path d="M2 12h20v10H2z" fill="var(--accent)" stroke="none"/><path d="M7 7h10"/>'),
    updates: o('<circle cx="12" cy="12" r="10"/><path d="M12 12L12 2A10 10 0 0 1 22 12z" fill="var(--accent)" stroke="none"/><circle cx="12" cy="12" r="5"/>'),
    teams: o('<rect x="2" y="2" width="9" height="9"/><rect x="13" y="2" width="9" height="9"/><rect x="2" y="13" width="9" height="9"/><rect x="13" y="13" width="9" height="9" fill="var(--accent)" stroke="none"/>'),
    people: o('<circle cx="7" cy="8" r="3.4"/><circle cx="17" cy="8" r="3.4" fill="var(--accent)" stroke="none"/><path d="M2 21c.8-3.6 2.6-5.4 5-5.4s4.2 1.8 5 5.4M12 21c.8-3.6 2.6-5.4 5-5.4s4.2 1.8 5 5.4"/>'),
    member: o('<circle cx="12" cy="12" r="10"/><circle cx="12" cy="9" r="3.6"/><path d="M5.5 19c1.6-3.4 4-4.6 6.5-4.6s4.9 1.2 6.5 4.6" stroke="var(--accent)" stroke-width="2.4"/>'),
    news: o('<rect x="2" y="3" width="20" height="18"/><path d="M2 3h20v6H2z" fill="var(--accent)" stroke="none"/><path d="M6 13h12M6 17h8"/>'),
    mycareer: o('<circle cx="12" cy="12" r="10"/><circle cx="12" cy="9" r="3.6" fill="var(--accent)" stroke="none"/><path d="M5.5 19c1.6-3.4 4-4.6 6.5-4.6s4.9 1.2 6.5 4.6"/>'),
    careers: o('<rect x="2" y="2" width="20" height="20"/><path d="M2 22V2a20 20 0 0 1 20 20z" fill="var(--accent)" stroke="none"/>'),
    path: o('<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2.6" fill="var(--accent)" stroke="none"/>'),
    resume: o('<circle cx="12" cy="12" r="10"/><path d="M3.3 7h17.4M2 12h20M3.3 17h17.4" stroke="var(--accent)"/>'),
    sources: o('<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6.5"/><circle cx="12" cy="12" r="3" fill="var(--accent)" stroke="none"/>'),
    team: o('<circle cx="7" cy="7" r="3.2"/><circle cx="17" cy="7" r="3.2"/><circle cx="7" cy="17" r="3.2"/><circle cx="17" cy="17" r="3.2" fill="var(--accent)" stroke="none"/>'),
    wizard: o('<circle cx="12" cy="12" r="10"/><path d="M14 3.2a9 9 0 1 0 0 17.6 7.5 7.5 0 0 1 0-17.6z" fill="var(--accent)" stroke="none"/>')
  };
})();
// Landing composition: a large ring, a blue half disc, a striped circle, a dot and one leading line.
const GEO_HERO = `<svg class="geo-hero" viewBox="0 0 600 600" aria-hidden="true">
  <defs><clipPath id="geoStripe"><circle cx="150" cy="455" r="72"/></clipPath></defs>
  <circle cx="330" cy="300" r="232" fill="none" stroke="rgba(244,242,236,.55)" stroke-width="1.2"/>
  <circle cx="468" cy="174" r="112" fill="none" stroke="rgba(244,242,236,.7)" stroke-width="1.2"/>
  <g clip-path="url(#geoStripe)" stroke="rgba(244,242,236,.55)" stroke-width="5">${Array.from({ length: 10 }, (_, i) => `<line x1="70" x2="230" y1="${388 + i * 15}" y2="${388 + i * 15}"/>`).join("")}</g>
  <circle cx="556" cy="470" r="11" fill="#F4F2EC"/>
  <line x1="0" y1="590" x2="600" y2="372" stroke="rgba(244,242,236,.35)" stroke-width="1"/>
</svg>
<svg class="geo-edge" viewBox="0 0 160 320" aria-hidden="true"><path d="M160 0 A160 160 0 0 0 160 320 Z" fill="#1F3BD9"/><circle cx="160" cy="160" r="104" fill="none" stroke="rgba(244,242,236,.6)" stroke-width="1.2"/></svg>`;
function trendChip() {
  const s = snap(); if (!s) return "";
  const hn = s.sources.hn || {};
  return srcChip(T("Job posts"), s.as_of, [hn.name || "Hacker News 'Who is hiring?'", hn.posts_current ? T("{now} posts in the last three monthly threads, compared with {before} before.", { now: hn.posts_current, before: hn.posts_previous }) : "", T("Counts only; no post text is stored.")].filter(Boolean), hn.url, true);
}
const iloChip = () => srcChip("ILO WP140", st.meta.sources.ilo.retrieved, [st.meta.sources.ilo.source, T("Licence: CC BY 4.0. Task-level scores from 0 to 1.")], "https://github.com/pgmyrek/2025_GenAI_scores_ISCO08");
const escoChip = (uri) => srcChip("ESCO v1.2", st.meta.sources.esco.retrieved, [st.meta.sources.esco.source, T("European Commission; reused with attribution.")], uri || "https://esco.ec.europa.eu");
// Theme: follows the device unless the person picks light or dark (kept in this browser only).
function theme() { const t = document.documentElement.dataset.theme; return t || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"); }
function renderThemeBtn() {
  const dark = theme() === "dark", b = $("#themeBtn"); if (!b) return;
  b.innerHTML = dark ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>'
    : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 13A9 9 0 1 1 11 3a7 7 0 0 0 10 10z"/></svg>';
  const label = dark ? T("Switch to light mode") : T("Switch to dark mode");
  b.setAttribute("aria-label", label); b.title = label;
}
async function api(path, body, isForm, method) {
  const headers = isForm || !body ? {} : { "Content-Type": "application/json" };
  if (st.token) headers.Authorization = "Bearer " + st.token;
  const opt = body ? { method: method || "POST", body: isForm ? body : JSON.stringify(method === "PUT" ? { data: body } : body), headers } : { method: method || "GET", headers };
  const r = await fetch(path, opt);
  if (!r.ok) { let m = r.statusText; try { m = (await r.json()).detail || m; } catch (e) { /* not json */ } throw new Error(m); }
  return r.json();
}
const lvlDots = (n) => `<span class="lvl" aria-hidden="true">${[1, 2, 3].map((i) => `<i class="${i <= n ? "on" : ""}"></i>`).join("")}</span>`;
const SDG_COL = { 1: "#E5243B", 2: "#DDA63A", 3: "#4C9F38", 4: "#C5192D", 5: "#FF3A21", 6: "#26BDE2", 7: "#FCC30B", 8: "#A21942", 9: "#FD6925", 10: "#DD1367", 11: "#FD9D24", 12: "#BF8B2E", 13: "#3F7E44", 14: "#0A97D9", 15: "#56C02B", 16: "#00689D", 17: "#19486A" };
// UN target text is quoted in English, as published.
const sdgUrl = (g) => `https://sdgs.un.org/goals/goal${g}#targets_and_indicators`;
const sdgTag = (t) => { const g = parseInt(t, 10); const d = st.meta.sdg_targets[t]; return `<a class="sdg ${g === 7 ? "y" : ""}" style="background:${SDG_COL[g]}" href="${sdgUrl(g)}" target="_blank" rel="noopener" title="${esc((d ? "SDG " + t + ": " + d.text : "SDG " + t) + " · " + T("Opens the UN page for this goal"))}">SDG ${esc(t)}</a>`; };
// SDG impact of a career: the targets it serves directly plus those of the skills it needs.
// Shown as small goal numbers on each career card; it never changes the fit score.
function sdgImpact(roleId) {
  const r = roleOf(roleId), own = r.sdg.map((l) => l.target);
  const targets = [...new Set([...own, ...r.req.flatMap((q) => cl(q.cluster).sdg || [])])];
  const goals = [...new Set(targets.map((t) => parseInt(t, 10)))].sort((a, b) => a - b);
  return { targets, goals, own: r.sdg };
}

// ---------- plain-language layer ---------------------------------------------------
// "Simple" mode turns numbers and jargon into short, direct words. "Detailed" keeps the
// numbers and sources. Every banner has a (?) that explains it in the chosen style.
const GLOSSARY = {
  score: ["How well this career fits you, out of 100.", "Weighted mix of skill match, demand outlook, transferable skills and interests, minus AI exposure, scaled to 100. Weights are on the Sources page."],
  exposure: ["How much of this job's daily tasks AI tools can already do. High means the job will change more, not that it disappears.", "ILO 2025 GenAI exposure index (Working Paper 140): the mean score of the occupation's tasks from 0 to 1, grouped into gradients 1–4."],
  demand: ["Whether more or fewer job ads ask for this skill than three months ago.", "Share of Hacker News 'Who is hiring?' posts mentioning the skill, last three monthly threads vs the three before, pulled toward zero for small samples."],
  scenario: ["Nobody knows the future, so we check your careers in three possible futures.", "Each scenario changes the weights and how strongly AI-related and falling signals count. Ranges show the spread across scenarios."],
  stage: ["A level in the career. You move up by learning and by doing the work.", "Each stage is a real ESCO occupation; requirements add up from one stage to the next."],
  priority: ["We put the skills employers want most right now first.", "Within each stage, steps are ordered by prerequisites, then by gap × demand momentum. When new trend data changes that order, the step is flagged."],
  newtech: ["A newer tool that more job ads mention than before.", "Watch-list terms whose share of job posts rose versus the previous three months, with at least five mentions."],
  budget: ["We only pick courses you can afford. Paid ones show as optional.", "Courses are filtered by cost tier for your budget; stronger paid options appear as upgrades."],
  sdg: ["The UN's 17 goals for a better world. This shows how the work helps them.", "Links to official UN SDG targets with a reason; tap a goal to open its UN page. The small numbers on each career are the goals it serves. They do not change your fit score, except in the Green transition scenario."],
  esco: ["The EU's official list of jobs and skills. We use it so careers are real.", "ESCO v1.2 occupations and essential skills, linked to ISCO-08 codes."],
  future: ["A skill employers now want because of AI. Official job lists don't include it yet.", "Requirement added by the team because ESCO predates generative AI."],
  resume: ["Your resume is ready any time. It grows as you finish path steps, so it only shows what you can really do.", "The resume lists skills at working level or above and only courses marked done."],
  update: ["We check the latest job and research data every time you visit.", "The newest trend snapshot is compared with the previous one to re-rank steps and spot rising tools."]
};
const GLOSS_LABEL = { score: "Fit score", exposure: "AI exposure", demand: "Demand", scenario: "Future scenario", stage: "Stage", priority: "Priority", newtech: "New tool", budget: "Budget", sdg: "UN goals", esco: "ESCO", future: "AI-era skill", resume: "Resume", update: "Daily check" };
const gloss = (key) => T(GLOSSARY[key][simple() ? 0 : 1]);
// Built from inline elements (not <details>) so the "?" can sit inside a sentence:
// a <details> inside a <p> makes the browser close the paragraph and drop it to a new line.
const info = (key) => `<span class="info"><button type="button" class="info-btn" data-info aria-expanded="false" aria-label="${T("What does this mean?")}" title="${T("What does this mean?")}">?</button><span class="info-pop" role="tooltip">${esc(gloss(key))}</span></span>`;
function closeInfo(except) { document.querySelectorAll(".info.open").forEach((x) => { if (x !== except) { x.classList.remove("open"); x.querySelector(".info-btn").setAttribute("aria-expanded", "false"); } }); }
const fitLabel = (s) => T(s >= 70 ? "Great fit" : s >= 55 ? "Good fit" : s >= 40 ? "Some fit" : "Long shot");
function demandText(x) {
  if (x == null) return T(simple() ? "not enough data" : "no data");
  if (!simple()) return (x >= 0 ? "+" : "") + Math.round(x * 100) + "%";
  return T(x >= 0.05 ? "more jobs want this" : x <= -0.05 ? "fewer jobs want this" : "about the same");
}
const EXP_BANDS = [["low", "Low"], ["moderate", "Moderate"], ["high", "High"], ["vhigh", "Very high"]];
function expGrad(e) { return (e.category.match(/Gradient (\d)/) || [])[1]; }
function expBadge(e) {
  if (!e) return `<span class="badge">${T("No AI score")}</span>`;
  const g = expGrad(e);
  const lvl = g === "4" || g === "3" ? "high" : g === "2" ? "medium" : "low";
  const label = simple() ? T("AI impact: {level}", { level: T(lvl) }) : T("AI exposure: {category} ({score})", { category: e.category.replace("Exposed: ", ""), score: e.mean.toFixed(2) });
  return `<span class="badge ${lvl === "high" ? "warn" : ""}">${esc(label)}</span>`;
}
function expBand(e) {
  const g = expGrad(e);
  return g === "4" ? 3 : g === "3" ? 2 : g ? 1 : 0;
}
function expMeter(e) {
  if (!e) return "";
  const b = expBand(e);
  return `<div class="meter" role="img" aria-label="${esc(T("AI impact on this job: {level}", { level: T(EXP_BANDS[b][1]) }))}">
    <div class="meter-track">${EXP_BANDS.map(([k], i) => `<span class="seg-${k} ${i === b ? "on" : ""}"></span>`).join("")}</div>
    <div class="meter-labels">${EXP_BANDS.map(([, l], i) => `<span class="${i === b ? "on" : ""}">${T(l)}</span>`).join("")}</div>
    ${simple() ? "" : `<p class="tiny muted">${esc(T("ILO task score {score} of 1 · {category}", { score: e.mean.toFixed(2), category: e.category }))}</p>`}
  </div>`;
}
function expSentence(e) {
  if (!e) return "";
  const g = expGrad(e);
  if (simple()) return T(g === "4" ? "AI can already do most of the daily tasks in this job." : g === "3" ? "AI can do many of the daily tasks in this job." : g === "2" ? "AI can do some tasks in this job." : "AI can do only a few tasks in this job.");
  return T("ILO mean task score {score} of 1 ({category}). Most exposed task: “{task}”.", { score: e.mean.toFixed(2), category: e.category, task: e.most_exposed_task.task });
}
const SCEN_SIMPLE = { moderate: "Steady change", fast: "AI moves fast", green: "Green jobs grow" };
// One line under the future switch saying what the chosen scenario assumes.
const scenBrief = () => `<p class="scen-brief small"><b>${esc(scenLabel(st.scen))}:</b> ${esc(TS(st.meta.scenarios[st.scen].note))}</p>`;
const scenLabel = (k) => simple() ? T(SCEN_SIMPLE[k]) : TS(st.meta.scenarios[k].label);
const I = {
  upload: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 16V4M6 10l6-6 6 6M4 20h16"/></svg>',
  pen: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>',
  skip: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  book: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M4 5c3-1 6-1 8 1 2-2 5-2 8-1v14c-3-1-6-1-8 1-2-2-5-2-8-1z"/><path d="M12 6v14"/></svg>',
  award: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><circle cx="12" cy="9" r="6"/><path d="M8.5 14 7 22l5-3 5 3-1.5-8"/></svg>',
  flag: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M5 21V4M5 4h11l-2 4 2 4H5"/></svg>',
  case: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5h6v2M3 13h18"/></svg>',
  check: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5 9-10"/></svg>',
  lock: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
  globe: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.8 3 2.8 15 0 18M12 3c-2.8 3-2.8 15 0 18"/></svg>'
};

// ---------- data flow ------------------------------------------------------------------
const profileBody = () => ({ skills: skillsNow(), interests: P().interests, hours: P().hours, country: P().country,
  budget: P().budget, age_band: P().age_band || null, situation: P().situation || null });
let tA = null;
function changed(opts) { save(); clearTimeout(tA); tA = setTimeout(() => refresh(opts || {}), 250); }
async function refresh(opts) {
  if (!A()) return;
  try {
    st.analysis = await api("/api/analyze", { ...profileBody(), compare: st.compare });
    st.whatif = {};  // skills may have changed
    if (opts.path !== false && A().role) await loadPath();
    await loadAdvice();
  } catch (e) { toast(T("Could not update: {e}", { e: e.message })); }
  render();
}
async function loadPath() {
  if (!A().role) return;
  st.busy.path = true;
  try { st.path = await api("/api/pathway", { ...profileBody(), skills: P().skills, role: A().role, scenario: st.scen }); }
  catch (e) { toast(T("Could not build the path: {e}", { e: e.message })); }
  st.busy.path = false;
}
async function loadAdvice() {
  const role = A().role || (st.analysis && st.analysis.scenarios[st.scen][0].role);
  try { st.advice = await api("/api/advice", { ...profileBody(), role, path_hours: st.path && st.path.role === role ? st.path.hours : null }); }
  catch (e) { st.advice = null; }
}
const rows = () => st.analysis ? st.analysis.scenarios[st.scen] : [];

// ---------- path model --------------------------------------------------------------------
function nodeKey(si, n) { return `${si}:${n.type}:${n.cluster || (n.item && n.item.id) || n.text}`; }
function flatNodes() {
  if (!st.path) return [];
  const out = [];
  st.path.stages.forEach((s, si) => s.nodes.forEach((n) => out.push({ ...n, si, key: nodeKey(si, n), stage: s })));
  return out;
}
const progressOf = () => (A().progress[A().role] = A().progress[A().role] || {});
const done = (key) => !!(A().progress[A().role] || {})[key];
const required = (n) => !(n.type === "cert" && n.optional) && n.type !== "checkpoint";
function currentNode() { return flatNodes().find((x) => !done(x.key) && !(x.type === "cert" && x.optional)) || null; }
function stageDone(si) { return flatNodes().filter((n) => n.si === si && required(n)).every((n) => done(n.key)); }
function unlockedStage() { if (!st.path) return -1; let u = -1; st.path.stages.forEach((s, i) => { if (u === i - 1 && stageDone(i)) u = i; }); return u; }
function stagePct(si) { const ns = flatNodes().filter((n) => n.si === si && required(n)); return ns.length ? Math.round(ns.filter((n) => done(n.key)).length / ns.length * 100) : 100; }
function setDone(n, val) {
  const p = progressOf();
  if (val) p[n.key] = true; else delete p[n.key];
  if (n.type === "skill") {
    if (val) P().pathSkills[n.cluster] = Math.max(P().pathSkills[n.cluster] || 0, n.to);
    else {
      const still = flatNodes().filter((x) => x.type === "skill" && x.cluster === n.cluster && x.key !== n.key && done(x.key));
      if (still.length) P().pathSkills[n.cluster] = Math.max(...still.map((x) => x.to)); else delete P().pathSkills[n.cluster];
    }
  }
  const nx = currentNode(); if (val && nx) st.sel = nx.key;
  changed({ path: false }); render();
}

// ---------- chrome -------------------------------------------------------------------------
const NAV = [["dashboard", "Home", '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>'],
  ["mycareer", "My career", '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4.5 4.4-6.5 8-6.5s7 2 8 6.5"/>'],
  ["careers", "Compare careers", '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>'],
  ["path", "My path", '<path d="M6 21c0-6 12-4 12-10S9 7 9 3"/><circle cx="9" cy="3" r="1.5"/><circle cx="6" cy="21" r="1.5"/>'],
  ["resume", "Resume", '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M10 13h6M10 17h6"/>']];
const NAV2 = [["sources", "Data and sources"], ["team", "For HR teams"]];
const NAV_JOB = ["jobcheck", "Job check", '<path d="M4 7h16v12H4z"/><path d="M9 7V4h6v3"/><path d="M8 13l3 3 5-6"/>'];
const NAV_IV = ["interview", "Interview practice", '<path d="M4 5h11v8H8l-4 3z"/><path d="M15 9h5v8l-3-2h-6v-2"/>'];
const NAV_UPD = ["updates", "Updates", '<path d="M20 11a8 8 0 0 0-14.6-4.5L4 8"/><path d="M4 4v4h4"/><path d="M4 13a8 8 0 0 0 14.6 4.5L20 16"/><path d="M20 20v-4h-4"/>'];
const NAV_NEWS = ["news", "News", '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 8h10M7 12h10M7 16h6"/>'];
function renderChrome() {
  const signed = !!A() && st.page !== "signin";
  const inWizard = st.page === "wizard";
  const showNav = signed && !inWizard && A().onboarded;
  document.body.classList.toggle("has-nav", showNav);
  document.body.classList.toggle("is-landing", st.page === "signin");
  const navBtn = ([k, l, icon]) => `<button type="button" data-page="${k}" ${st.page === k ? 'aria-current="page"' : ""}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icon}</svg><span>${T(l)}</span></button>`;
  const more = NAV2.some(([k]) => st.page === k);
  $("#nav").setAttribute("aria-label", T("Main"));
  const teamNav = [NAV[0], ["people", A() && A().profile && isCohort() ? "Students" : "People", '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.9-3.8 3.4-5.8 6.5-5.8s5.6 2 6.5 5.8"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18.5 14.6c1.6.8 2.6 2.6 3 5.4"/>'], ["team", "Skills table", '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 4v16"/>']];
  $("#nav").innerHTML = showNav ? (isTeamUser() ? `<div class="nav-group">${T("Plan")}</div>${teamNav.map(navBtn).join("")}` : `<div class="nav-group">${T("Plan")}</div>${NAV.slice(0, 3).map(navBtn).join("")}<div class="nav-group">${T("Act")}</div>${NAV.slice(3).map(navBtn).join("")}${navBtn(NAV_JOB).replace("<button ", '<button class="nav-info" ')}${navBtn(NAV_IV).replace("<button ", '<button class="nav-info" ')}<div class="nav-group nav-info">${T("Stay informed")}</div>${navBtn(NAV_NEWS).replace("<button ", '<button class="nav-info" ')}${navBtn(NAV_UPD).replace("<button ", '<button class="nav-info" ').replace("</span></button>", `</span>${updChanges() ? `<i class="nav-dot" title="${esc(T("{n} changes", { n: updChanges() }))}"></i>` : ""}</button>`)}`)
    + `<button type="button" class="nav-more" id="navMore" ${more ? 'aria-current="page"' : ""}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg><span>${T("More")}</span></button>`
    + `<div class="nav-2"><div class="nav-group">${T("Trust and teams")}</div>${NAV2.map(([k, l]) => `<button type="button" data-page="${k}" ${st.page === k ? 'aria-current="page"' : ""}><span>${T(l)}</span></button>`).join("")}</div>` : "";
  renderThemeBtn();
  $("#modePick").innerHTML = signed && A().onboarded ? `${selTip()}<div class="seg mode-seg" role="group" aria-label="${T("Explanations")}" title="${T("How much detail to show")}"><button type="button" data-mode="simple" aria-pressed="${simple()}">${T("Simple")}</button><button type="button" data-mode="detailed" aria-pressed="${!simple()}">${T("Detailed")}</button></div>` : "";
  $("#langPick").innerHTML = `<label class="lang-pick" title="${T("Language")}">${I.globe}<span class="sr-only">${T("Language")}</span><select id="uiLang">${LANGS.map(([k, short, full]) => `<option value="${k}" ${LANG === k ? "selected" : ""} title="${full}">${short}</option>`).join("")}</select></label>`;
  $("#account").innerHTML = signed ? `<details class="menu"><summary><span class="avatar">${esc(firstName()[0] || "?")}</span><span class="acct-name">${esc(firstName())}</span></summary>
    <div class="menu-body">
      <p class="tiny muted">${esc(T("Signed in as {name}", { name: A().name }))}${A().sample ? " " + T("(shared sample account)") : ""}</p>
      <div class="seg menu-mode" role="group" aria-label="${T("Explanations")}"><button type="button" data-mode="simple" aria-pressed="${simple()}">${T("Simple")}</button><button type="button" data-mode="detailed" aria-pressed="${!simple()}">${T("Detailed")}</button></div>
      ${A().onboarded ? `<button type="button" class="btn" data-page="wizard">${T("Edit about you")}</button>` : ""}
      ${A().onboarded ? `<button type="button" class="btn" id="tourStart">${T("Show the guide")}</button>${isTeamUser() ? "" : `<button type="button" class="btn" id="storyReplay">▶ ${T("Replay my story")}</button>`}` : ""}
      <div class="menu-nav">${isTeamUser() ? "" : `<button type="button" class="btn" data-page="updates">${T("Updates")}</button><button type="button" class="btn" data-page="news">${T("News")}</button><button type="button" class="btn" data-page="jobcheck">${T("Job check")}</button><button type="button" class="btn" data-page="interview">${T("Interview practice")}</button>`}<button type="button" class="btn" data-page="team">${T("Teams")}</button><button type="button" class="btn" data-page="sources">${T("Sources")}</button></div>
      <button type="button" class="btn" id="signOut">${T("Sign out")}</button>
    </div></details>` : "";
  document.querySelectorAll("[data-i18n]").forEach((el) => { el.textContent = T(el.dataset.i18n); });
  document.querySelectorAll("[data-i18n-label]").forEach((el) => { el.setAttribute("aria-label", T(el.dataset.i18nLabel)); });
  const l = st.meta.llm;
  $("#llmFoot").textContent = l.available ? T("AI model: {model} via {via}, only when you switch it on.", { model: l.model, via: l.via }) : T("No AI model connected.");
}
// Page header: title and one-line purpose, with the page's own action on the right.
const intro = (eyebrow, title, text, action) => `<div class="page-head"><div class="intro"><span class="eyebrow-row"><span class="geo-mark">${GEO[st.page] || GEO.dashboard}</span>${eyebrow ? `<span class="eyebrow">${esc(eyebrow)}</span>` : ""}</span><h2>${esc(title)}</h2>${text ? `<p class="muted">${text}</p>` : ""}</div>${action || ""}</div>`;

// ---------- sign in ----------------------------------------------------------------------------
function vSignin() {
  const testers = st.accounts.filter((a) => a.kind === "tester"), samples = st.accounts.filter((a) => a.kind === "sample");
  const fresh = st.accounts.find((a) => a.kind === "fresh");
  const m = st.meta, s = snap(), hn = s ? s.sources.hn || {} : {};
  const demo = samples.find((a) => a.onboarded) || samples[0];
  const checked = m.catalogue.items.map((c) => c.link_checked_on).filter(Boolean).sort().pop();
  const road = `<svg width="112" height="56" viewBox="0 0 112 56" aria-hidden="true"><path d="M10 44 C 34 44 28 12 56 12 S 84 40 102 24" fill="none" stroke="var(--line)" stroke-width="3" stroke-linecap="round"/><path d="M10 44 C 34 44 28 12 56 12" fill="none" stroke="var(--accent)" stroke-width="3" stroke-linecap="round"/>
    <circle cx="10" cy="44" r="7" fill="var(--accent)"/><path d="M6.5 44l2.5 2.5 4.5-5" stroke="var(--accent-ink)" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="56" cy="12" r="7" fill="var(--surface)" stroke="var(--accent)" stroke-width="2"/><circle cx="102" cy="24" r="7" fill="var(--surface)" stroke="var(--faint)" stroke-width="1.5"/><path d="M99.5 28v-8h5l-1 2 1 2h-5" stroke="var(--faint)" stroke-width="1.3" fill="none" stroke-linejoin="round"/></svg>`;
  return `<div class="landing-band">${GEO_HERO}<div class="landing">
    <section class="hero" aria-labelledby="heroTitle"><div class="hero-text">
      <span class="eyebrow">${T("For working adults, graduates, career switchers and career centres")}</span>
      <h2 id="heroTitle">${T("See how AI changes your career, and")} <em>${T("what to do next.")}</em></h2>
      <p class="lede">${T("Explore careers that fit your skills, see how AI is changing what employers ask for, and follow a practical path to your next role.")}</p></div>
      <ol class="flow" aria-label="${T("How it works")}">${["Your skills", "Careers that fit", "Your path", "Your resume"].map((t, i) => `<li><span class="n" aria-hidden="true">${i + 1}</span>${T(t)}</li>`).join("")}</ol>
    </section>
    <aside class="signin-card" aria-labelledby="signinTitle">
      <div class="stack" style="gap:4px"><h3 id="signinTitle">${T("Start your plan")}</h3><p class="muted small">${T("Choose your account. Your profile, career plan and resume are saved to it.")}</p></div>
      <div class="field"><label for="acctSel">${T("Account")}</label><select id="acctSel">
        ${fresh ? `<option value="${esc(fresh.id)}">${T("New account")} · ${T("starts fresh every time")}</option>` : ""}
        ${testers.length ? `<optgroup label="${T("Testers")}">${testers.map((a) => `<option value="${esc(a.id)}">${esc(a.name)}${a.onboarded ? "" : " · " + T("new")}</option>`).join("")}</optgroup>` : ""}
        <optgroup label="${T("Sample people (synthetic, shared)")}">${samples.map((a) => `<option value="${esc(a.id)}">${esc(a.name)}</option>`).join("")}</optgroup>
      </select></div>
      ${st.signin.error ? `<p class="note warn small">${esc(st.signin.error)}</p>` : ""}
      <button class="btn primary" type="button" id="signIn">${T("Continue")}</button>
      ${demo ? `<div class="or">${T("or")}</div><button class="btn secondary" type="button" data-trysample="${esc(demo.id)}">${esc(T("Look around as {name} (sample)", { name: demo.name.split(",")[0] }))}</button>` : ""}
      <p class="help">${T("Prototype sign-in without a password. New accounts start with a short setup. Sample people are synthetic.")}</p>
    </aside>
  </div><p class="bg-credit">${T("Background:")} <a href="https://unsplash.com/photos/deep-blue-and-purple-flowing-shapes-_nWaeTF6qo0" target="_blank" rel="noopener">Richard Horvath</a> / Unsplash</p></div>
  <div class="landing-below">
      <div class="numbers"><div class="numbers-head"><h3>${T("By the numbers")}</h3></div><div class="proof">
        <div class="kpi"><span class="k-label">${T("In Malaysia")}</span><span class="k-value">600,000+</span><span class="k-sub">${T("workers need reskilling in 3–5 years")}</span>${srcChip("MOSTI", fmtDate("2025-01-01", { month: "short", year: "numeric" }), [T("Figure given by the Minister of Science, Technology and Innovation in January 2025 (reported by Malay Mail). The Human Resources Minister gave the same figure in October 2024, citing TalentCorp."), T("Secondary report; check the original statement before quoting.")])}</div>
        <div class="kpi"><span class="k-label">${T("Career paths")}</span><span class="k-value">${m.roles.length}</span><span class="k-sub">${T("real ESCO jobs, entry to top role")}</span>${escoChip()}</div>
        <div class="kpi"><span class="k-label">${T("Live job data")}</span><span class="k-value">${s ? esc(fmtDate(s.as_of, { day: "numeric", month: "short" })) : "—"}</span><span class="k-sub">${hn.posts_current ? esc(T("{n} job posts checked", { n: hn.posts_current.toLocaleString(LOCALE[LANG]) })) : T("latest snapshot")}</span>${trendChip()}</div>
        <div class="kpi"><span class="k-label">${T("Courses")}</span><span class="k-value">${m.catalogue.items.length}</span><span class="k-sub">${T("hand-checked, free options first")}</span>${srcChip(T("Course list"), checked || "", [T("Closed list: the path only recommends these courses."), T("Every link is checked by a script. Check cost and HRD Corp status with the provider.")])}</div>
      </div></div>
      <div class="preview">${road}<div class="stack" style="gap:4px"><b>${T("Your path, one step at a time")}</b><span class="small muted">${T("Courses you can afford, ordered by what employers want most right now, rechecked every day.")}</span></div></div>
  </div>`;
}
async function signIn(id) {
  try {
    const r = await api(`/api/accounts/${encodeURIComponent(id)}/signin`, {});
    st.token = r.token;
    try { localStorage.setItem(TOKEN, r.token); } catch (e) { /* session lasts this tab only */ }
    useAccount(await api("/api/me"));
    await syncAccountLang();
  } catch (e) { st.signin.error = e.message; render(); return; }
  Object.assign(st, { analysis: null, path: null, advice: null, sel: null, open: null, explain: {}, exTried: {}, cvDraft: null, extractNote: "", polished: null, occ: { q: "", results: [], source: "" }, signin: { error: "" } });
  if (!A().onboarded) { st.page = "wizard"; st.wiz = 0; render(); return; }
  st.page = "dashboard"; render();
  await refresh({});
  if (st.updates && A().seen !== st.updates.snapshot.id) { if (A().seen) toast(T("New job data since your last visit. We rechecked your path.")); A().seen = st.updates.snapshot.id; save(); }
}

// ---------- About you: one question at a time ------------------------------------------------
const WIZ = [
  { id: "mode", title: "How should we explain things?", help: "You can change this any time from your account menu." },
  { id: "country", title: "Where do you want to work?", help: "We use this for local jobs, courses and help with costs." },
  { id: "you", title: "Tell us a little about yourself", help: "Optional. This only shapes cost and time advice. It never changes which careers match you." },
  { id: "time", title: "How much time and money can you put in?", help: "We plan your learning to fit." },
  { id: "experience", title: "What have you done so far?", help: "Import your CV, write a few lines, or skip and add skills yourself." },
  { id: "skills", title: "Rate your skills", help: "Rate each skill from 0 to 5. Open the areas that fit your work and skip the rest. Your answers only shape your matches and plan." },
  { id: "interests", title: "What do you enjoy?", help: "Pick as many as you like. We use this to rank careers." },
  { id: "team", title: "Who are you planning for?", help: "Use a sample group or type in your own. We rank careers for the whole group and build one learning plan." },
  { id: "done", title: "", help: "" }
];
function optionCard(group, value, title, text, on) { return `<button type="button" class="option" data-opt="${group}" data-val="${esc(value)}" aria-pressed="${on}"><b>${esc(title)}</b>${text ? `<span class="small muted">${esc(text)}</span>` : ""}</button>`; }
// ISO 3166-1 alpha-2 codes; names come from the browser (Intl.DisplayNames) in the chosen language
const ISO = "AF AX AL DZ AS AD AO AI AG AR AM AW AU AT AZ BS BH BD BB BY BE BZ BJ BM BT BO BA BW BR BN BG BF BI CV KH CM CA KY CF TD CL CN CO KM CG CD CK CR CI HR CU CW CY CZ DK DJ DM DO EC EG SV GQ ER EE SZ ET FK FO FJ FI FR GF PF GA GM GE DE GH GI GR GL GD GP GU GT GG GN GW GY HT HN HK HU IS IN ID IR IQ IE IM IL IT JM JP JE JO KZ KE KI KP KR KW KG LA LV LB LS LR LY LI LT LU MO MG MW MY MV ML MT MH MQ MR MU YT MX FM MD MC MN ME MS MA MZ MM NA NR NP NL NC NZ NI NE NG NU MK MP NO OM PK PW PS PA PG PY PE PH PL PT PR QA RE RO RU RW BL SH KN LC MF PM VC WS SM ST SA SN RS SC SL SG SX SK SI SB SO ZA SS ES LK SD SR SE CH SY TW TJ TZ TH TL TG TO TT TN TR TM TC TV UG UA AE GB US UY UZ VU VA VE VN VG VI WF EH YE ZM ZW".split(" ");
let regionNames = null, regionLang = "";
function regionName(code) {
  if (!code) return "";
  if (code === "OTHER") return TS(st.meta.countries.OTHER.name);
  if (regionLang !== LANG) { try { regionNames = new Intl.DisplayNames([LANG === "zh" ? "zh-CN" : LANG], { type: "region" }); } catch { regionNames = null; } regionLang = LANG; }
  try { return (regionNames && regionNames.of(code)) || code; } catch { return code; }
}
let regionEn = null;
const regionEnName = (code) => { try { regionEn = regionEn || new Intl.DisplayNames(["en"], { type: "region" }); return regionEn.of(code) || code; } catch { return code; } };
const hasLocal = (code) => code !== "OTHER" && !!st.meta.countries[code];
// type-to-search picker: the list is redrawn on each keystroke without re-rendering the page,
// so the input keeps focus
const norm = (s) => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
function pickMatches(kind, q) {
  const n = norm(q.trim());
  if (kind === "skill") {
    const sk = skillsNow();
    const hits = st.meta.clusters.filter((c) => !sk[c.id]).map((c) => {
      const words = [c.label, ...(c.aliases || [])].map(norm);
      const rank = !n ? 2 : words[0].startsWith(n) ? 0 : words.some((w) => w.includes(n)) ? 1 : -1;
      return { c, rank, alias: n && !words[0].includes(n) ? (c.aliases || []).find((a) => norm(a).includes(n)) : "" };
    }).filter((x) => x.rank >= 0).sort((a, b) => a.rank - b.rank || a.c.label.localeCompare(b.c.label)).slice(0, n ? 8 : 40)
      .map((x) => ({ val: x.c.id, title: x.c.label, sub: x.alias ? T("matches “{word}”", { word: x.alias }) : "" }));
    const own = q.trim().slice(0, 60);
    if (own.length >= 2 && !P().custom_skills.some((s) => norm(s) === n)) hits.push({ val: "custom:" + own, title: T("Add “{skill}” as my own skill", { skill: own }), sub: T("Shows on your resume. Not used to match careers."), own: true });
    return hits;
  }
  const list = ISO.map((code) => ({ code, name: regionName(code), en: regionEnName(code) }));
  return list.filter((x) => !n || norm(x.name).includes(n) || norm(x.en).includes(n) || x.code.toLowerCase() === n)
    .sort((a, b) => (hasLocal(b.code) - hasLocal(a.code)) || (n ? (norm(b.name).startsWith(n) - norm(a.name).startsWith(n)) : 0) || a.name.localeCompare(b.name, LANG))
    .slice(0, n ? 8 : 300).map((x) => ({ val: x.code, title: x.name, sub: hasLocal(x.code) ? T("Local jobs, courses and costs") : "" }));
}
const pickItems = (kind, q) => pickMatches(kind, q).map((h, i) => `<button type="button" class="pick-item ${h.own ? "own" : ""}" role="option" id="pick-${kind}-${i}" data-picked="${kind}" data-val="${esc(h.val)}"><span>${esc(h.title)}</span>${h.sub ? `<span class="tiny muted">${esc(h.sub)}</span>` : ""}</button>`).join("") || `<p class="small muted pick-none">${T("No match. Try another word.")}</p>`;
function picker(kind, label, placeholder, current) {
  return `<div class="field picker" data-kind="${kind}">
    <label for="pick-${kind}">${label}</label>
    ${current ? `<div class="picked"><b>${esc(current)}</b><button type="button" class="btn ghost small" data-unpick="${kind}">${T("Change")}</button></div>` : ""}
    <div class="pick-box" ${current ? "hidden" : ""}><input type="search" id="pick-${kind}" data-pick="${kind}" role="combobox" aria-expanded="false" aria-controls="list-${kind}" aria-autocomplete="list" autocomplete="off" placeholder="${esc(placeholder)}">
    <div class="pick-list" id="list-${kind}" role="listbox" hidden></div></div></div>`;
}
const langOptions = () => LANGS.map(([k, , full]) => `<option value="${k}" ${LANG === k ? "selected" : ""}>${full}</option>`).join("");
// ---------- skills questionnaire: every skill rated 0-5, grouped by area ----------------------------
// Answers are kept as given (profile.ratings) and converted to the three levels careers use:
// 0 none, 1-2 basic, 3 working, 4-5 strong.
const RATE_SCALE = ["Never done it", "Know a little", "Done it with help", "Do it on my own", "Do it well, often", "Could teach others"];
const AREAS = [
  ["everyday", "Everyday work", ["excel", "dataentry", "bookkeeping", "correspondence", "scheduling", "customer", "languages"]],
  ["people", "People & leadership", ["stakeholder", "problem", "coaching", "leadership", "strategy"]],
  ["ai", "AI & automation", ["genai", "processmap"]],
  ["data", "Data & IT", ["sql", "python", "dataviz", "dataquality", "mlds", "cyber", "networking", "helpdesk"]],
  ["marketing", "Marketing & design", ["digimarketing", "content", "design"]],
  ["green", "Green energy & environment", ["esg", "ghg", "fieldwork", "solar", "electrical", "energyaudit"]],
  ["lab", "Lab & science", ["labwork", "bioinfo"]],
  ["health", "Health", ["clinical", "healthdata"]],
  ["farming", "Farming", ["agronomy", "precisionag"]],
  ["making", "Manufacturing", ["automation", "quality"]],
];
const CORE_AREAS = ["everyday", "people", "ai"];
const rateToLevel = (r) => (r <= 0 ? 0 : r <= 2 ? 1 : r === 3 ? 2 : 3);
const levelToRate = (l) => [0, 2, 3, 4][l] || 0;
function quizAreas() {
  const known = new Set(AREAS.flatMap((a) => a[2]));
  const other = st.meta.clusters.map((c) => c.id).filter((id) => !known.has(id));
  return other.length ? [...AREAS, ["other", "Other skills", other]] : AREAS;
}
// the rating shown for a skill: the person's own answer, or one inferred from a CV, job or earlier level
function rateOf(cid) {
  const p = P(), lvl = skillsNow()[cid] || 0, own = p.ratings ? p.ratings[cid] : null;
  if (own != null && rateToLevel(own) === lvl) return own;  // still matches what the person said
  return lvl ? levelToRate(lvl) : own;
}
function setRating(cid, r) {
  const p = P(); p.ratings = p.ratings || {};
  p.ratings[cid] = r;
  const lvl = rateToLevel(r);
  if (lvl) p.skills[cid] = lvl; else { delete p.skills[cid]; delete p.pathSkills[cid]; }
  changed({ path: false });
}
function quizRow(cid) {
  const r = rateOf(cid), p = P(), ev = p.evidence[cid];
  return `<div class="q-row" data-qrow="${cid}"><div class="q-label"><b>${esc(cl(cid).label)}</b>${ev ? `<span class="tiny muted" title="${esc(ev.evidence)}">${T("from your CV or text")}</span>` : ""}</div>
    <div class="q-scale" role="radiogroup" aria-label="${esc(cl(cid).label)}">${RATE_SCALE.map((w, i) => `<button type="button" role="radio" data-rate="${cid}" data-val="${i}" aria-checked="${r === i}" title="${esc(T(w))}">${i}</button>`).join("")}</div>
    <span class="q-word small muted">${r == null ? "" : esc(T(RATE_SCALE[r]))}</span></div>`;
}
function quizCount() {
  const ids = quizAreas().flatMap((a) => a[2]);
  return { done: ids.filter((id) => rateOf(id) != null).length, total: ids.length };
}
function vSkillQuiz() {
  const sk = skillsNow(), p = P();
  st.openAreas = st.openAreas || new Set([...CORE_AREAS, ...quizAreas().filter((a) => a[2].some((id) => sk[id] || (p.current && p.current.suggested && p.current.suggested[id]))).map((a) => a[0])]);
  quizAreas().forEach(([id, , ids]) => { if (ids.some((c) => sk[c] && !(p.ratings && p.ratings[c] != null && rateToLevel(p.ratings[c]) === sk[c]))) st.openAreas.add(id); });
  const { done, total } = quizCount();
  return `<div class="q-key" aria-label="${T("Rating scale")}">${RATE_SCALE.map((w, i) => `<span><b>${i}</b> ${esc(T(w))}</span>`).join("")}</div>
    <p class="small q-count" aria-live="polite">${esc(T("Answered {n} of {total}. Skip any area that has nothing to do with you.", { n: done, total }))}</p>
    ${quizAreas().map(([id, name, ids]) => { const n = ids.filter((c) => rateOf(c) != null).length; return `<details class="q-area" data-area="${id}" ${st.openAreas.has(id) ? "open" : ""}><summary><span>${esc(T(name))}</span><span class="tiny muted" data-areacount="${id}">${esc(T("{n} of {total} rated", { n, total: ids.length }))}</span></summary>${ids.map(quizRow).join("")}</details>`; }).join("")}`;
}
function rateClick(btn) {
  const cid = btn.dataset.rate, r = +btn.dataset.val;
  setRating(cid, r);
  const row = btn.closest(".q-row");
  row.querySelectorAll("[data-rate]").forEach((b) => b.setAttribute("aria-checked", String(+b.dataset.val === r)));
  row.querySelector(".q-word").textContent = T(RATE_SCALE[r]);
  const { done, total } = quizCount(), cnt = document.querySelector(".q-count");
  if (cnt) cnt.textContent = T("Answered {n} of {total}. Skip any area that has nothing to do with you.", { n: done, total });
  const area = quizAreas().find((a) => a[2].includes(cid)), ac = area && document.querySelector(`[data-areacount="${area[0]}"]`);
  if (ac) ac.textContent = T("{n} of {total} rated", { n: area[2].filter((c) => rateOf(c) != null).length, total: area[2].length });
  const next = document.getElementById("wizNext");
  if (next) { const ok = Object.keys(skillsNow()).length >= 2; next.disabled = !ok; next.title = ok ? "" : T("Add at least two skills"); }
}
function vWizard() {
  const steps = wizSteps(), p = P(), s = steps[Math.min(st.wiz, steps.length - 1)], m = st.meta, last = steps.length - 1;
  let body = "";
  if (s.id === "mode") {
    body = `<div class="options">${optionCard("mode", "simple", T("Simple"), T("Short, plain words. Best if this is your first time planning a career."), simple())}${optionCard("mode", "detailed", T("Detailed"), T("Numbers, sources and the full reasoning."), !simple())}</div>
      <div class="field"><label for="langSel">${T("Language for the app and AI explanations")}</label><select id="langSel">${langOptions()}</select></div>`;
  } else if (s.id === "country") {
    body = `${picker("country", T("Country you want to work in"), T("Type a country, e.g. Japan"), p.country ? regionName(p.country) : "")}
      ${p.country && !hasLocal(p.country) ? `<p class="note small">${esc(T("We have local job sites, costs and shortage lists for Malaysia and Singapore only. For {country} we use global job sites and prices in US dollars.", { country: regionName(p.country) }))}</p>` : ""}
      ${picker("home_country", T("Where are you from? (optional)"), T("Type a country"), p.home_country ? regionName(p.home_country) : "")}
      ${p.home_country && p.country && p.home_country !== p.country && p.country !== "OTHER" ? `<p class="note small">${esc(T("Working outside your home country usually needs a work permit or visa. Check the official rules of {country} before you apply.", { country: regionName(p.country) }))}</p>` : ""}`;
  } else if (s.id === "you") {
    body = `<div class="field"><span class="label">${T("Age")}</span><div class="chips">${m.age_bands.map((a) => `<button type="button" class="chip" data-opt="age_band" data-val="${a}" aria-pressed="${p.age_band === a}">${a}</button>`).join("")}<button type="button" class="chip" data-opt="age_band" data-val="" aria-pressed="${!p.age_band}">${T("Prefer not to say")}</button></div></div>
      <div class="field"><span class="label">${T("Right now I am…")}</span><div class="options">${Object.entries(m.situations).filter(([k]) => !TEAM_ROLES.includes(k)).map(([k, v]) => optionCard("situation", k, TS(v), "", p.situation === k)).join("")}</div></div>
      <div class="field"><span class="label">${T("Planning for others")}</span><div class="options">${TEAM_ROLES.map((k) => optionCard("situation", k, T(k === "hr" ? "HR and learning & development managers" : "TVET and university career centres"), T(k === "hr" ? "See your team's best-fit careers and one shared learning plan." : "See your students' best-fit careers and one shared learning plan."), p.situation === k)).join("")}</div></div>`;
  } else if (s.id === "team") {
    body = vTeamStep();
  } else if (s.id === "time") {
    body = `<div class="field"><label for="hours">${T("Time to learn: {hours} hours a week", { hours: `<b id="hoursOut">${p.hours}</b>` })}</label><input type="range" id="hours" min="1" max="20" value="${p.hours}"></div>
      <div class="field"><span class="label">${T("Monthly learning budget")}</span><div class="options">${country().budgets.map(([k, v]) => optionCard("budget", k, TS(v), k === "free" ? T("Only free courses. Paid ones show as optional.") : "", p.budget === k)).join("")}</div></div>`;
  } else if (s.id === "experience") {
    const l = m.llm;
    body = `<div class="options">${[["cv", I.upload, "Import my CV", "PDF, Word or text"], ["write", I.pen, "Write a few lines", "Describe your work in your own words"], ["skip", I.skip, "Skip", "Add skills yourself next"]].map(([k, ic, t, d]) => `<button type="button" class="option" data-exp="${k}" aria-pressed="${st.expMode === k}"><span class="icon">${ic}</span><b>${T(t)}</b><span class="small muted">${T(d)}</span></button>`).join("")}</div>
      ${st.expMode === "cv" ? `<label class="drop" id="drop"><span class="small">${T("Drop your CV here, or")} <u>${T("choose a file")}</u></span><input type="file" id="cvFile" accept=".pdf,.docx,.txt" hidden></label>
        ${l.available ? `<label class="check"><input type="checkbox" id="useModel" ${p.useModel ? "checked" : ""}> <span class="small">${T("Let AI read it. Your name, phone, email and IC number are removed first.")}</span></label>` : ""}
        ${st.busy.cv ? `<p class="small muted"><span class="spin"></span> ${T("Reading your CV…")}</p>` : ""}
        <p class="tiny muted">${T("No CV handy? Try a sample:")} <a href="/static/samples/sample-cv-meiling.pdf" download>PDF</a> · <a href="/static/samples/sample-cv-aisha.docx" download>Word</a> · <a href="/static/samples/sample-cv-hafiz.txt" download>${T("text")}</a></p>` : ""}
      ${st.expMode === "write" ? `<div class="with-mic"><textarea id="about" maxlength="6000" placeholder="${esc(T("I have worked 10 years as an admin clerk. I prepare invoices in Excel and handle customer calls in Malay and English."))}">${esc(p.about)}</textarea>${micBtn("about")}</div>
        ${l.available ? `<label class="check"><input type="checkbox" id="useModel" ${p.useModel ? "checked" : ""}> <span class="small">${T("Let AI read it too (more accurate). It must quote your words for every skill.")}</span></label>` : ""}
        <button class="btn" type="button" id="extractBtn" ${st.busy.extract ? "disabled" : ""}>${st.busy.extract ? `<span class="spin"></span> ${T("Reading…")}` : T("Find my skills")}</button>` : ""}
      ${st.extractNote ? `<p class="note small">${esc(st.extractNote)}</p>` : ""}
      ${st.cvDraft ? vCvReview() : ""}`;
  } else if (s.id === "skills") {
    body = `<div class="field"><label for="occQ">${T("Your current or last job (optional)")}</label><input type="search" id="occQ" placeholder="${T("e.g. accounts clerk")}" value="${esc(st.occ.q)}" autocomplete="off">
        <span class="tiny muted">${T("Pick your job to pre-fill the skills it usually needs, then adjust the ratings.")}</span></div>
      ${st.busy.occ ? `<p class="small muted"><span class="spin"></span> ${T("Searching…")}</p>` : ""}
      ${st.occ.results.length ? `<div class="stack">${st.occ.results.map((r, i) => `<button type="button" class="btn" data-occ="${i}" style="justify-content:space-between"><span>${esc(r.title)}</span><span class="tiny muted">${r.exposure ? expBadge(r.exposure) : ""}</span></button>`).join("")}</div>` : ""}
      ${p.current ? `<div class="note stack"><div class="row" style="gap:6px"><b>${esc(p.current.title)}</b>${info("exposure")}</div>${aiCard(p.current.exposure)}
        ${p.current.suggested && Object.keys(p.current.suggested).length ? `<button class="btn ghost" type="button" id="addSuggested">+ ${T("Add skills typical of this job")}</button>` : ""}</div>` : ""}
      ${vSkillQuiz()}
      <div class="stack q-extra"><span class="label">${T("Add a skill we missed")}</span>
        ${p.custom_skills.length ? `<div class="chips">${p.custom_skills.map((cs, i) => `<span class="chip own">${esc(cs)}<button type="button" class="chip-x" data-uncustom="${i}" aria-label="${esc(T("Remove {skill}", { skill: cs }))}">✕</button></span>`).join("")}</div>` : ""}
        ${picker("skill", "", T("Type a skill, e.g. farming, lab work, Excel"), "")}</div>`;
  } else if (s.id === "interests") {
    const all = [...new Set(m.roles.flatMap((r) => r.tags))].sort();
    body = `<div class="chips big">${all.map((i) => `<button type="button" class="chip" data-interest="${esc(i)}" aria-pressed="${p.interests.includes(i)}">${esc(T(i))}</button>`).join("")}</div>`;
  } else {
    const sk = skillsNow();
    const budgetLabel = (country().budgets.find((b) => b[0] === p.budget) || [, ""])[1];
    body = `<div class="stack"><div class="done-mark">${I.check}</div><h2>${A().onboarded ? T("Ready to update your plan") : esc(T("All set, {name}", { name: firstName() }))}</h2>
      <p class="muted">${T("Here is what you told us. Go back to change anything.")}</p>
      <div class="summary">
        <div><span class="label">${T("Explanations")}</span><b>${T(simple() ? "Simple" : "Detailed")}</b></div>
        <div><span class="label">${T("Country")}</span><b>${esc(countryName())}${p.home_country && p.home_country !== p.country ? " · " + esc(T("from {country}", { country: regionName(p.home_country) })) : ""}</b></div>
        <div><span class="label">${T("Situation")}</span><b>${esc(m.situations[p.situation] ? TS(m.situations[p.situation]) : T("Not given"))}${p.age_band ? ", " + esc(T("age {age}", { age: p.age_band })) : ""}</b></div>
        <div><span class="label">${T("Time and budget")}</span><b>${esc(T("{hours} h a week", { hours: p.hours }))} · ${esc(TS(budgetLabel))}</b></div>
        ${isTeamUser() ? `<div><span class="label">${T("Group")}</span><b>${esc(TS(teamData().label))} · ${esc(T("{n} people", { n: teamData().people.length }))}</b></div>
        <div><span class="label">${T("Target career")}</span><b>${esc(roleOf(st.teamTarget || teamData().target_role).title)}</b></div>` : `<div><span class="label">${T("Skills")}</span><b>${esc(T("{n} skills", { n: Object.keys(sk).length }))}</b></div>
        <div><span class="label">${T("Interests")}</span><b>${esc(p.interests.map((x) => T(x)).join(", ") || T("None picked"))}</b></div>`}
      </div></div>`;
  }
  const canNext = s.id !== "skills" || Object.keys(skillsNow()).length >= 2;
  return `<div class="wizard">
    <div class="progress-bar" aria-label="${esc(T("Step {n} of {total}", { n: st.wiz + 1, total: steps.length }))}"><div style="width:${(st.wiz + 1) / steps.length * 100}%"></div></div>
    <div class="card stack lg wiz-card">
      ${s.title ? `<div class="stack" style="gap:6px"><span class="eyebrow">${esc(T("About you · {n} of {total}", { n: st.wiz + 1, total: last }))}</span><h2>${esc(T(s.title))}</h2><p class="muted">${esc(T(s.help))}</p></div>` : ""}
      ${body}
      <div class="row between wiz-actions">
        ${st.wiz > 0 ? `<button class="btn" type="button" id="wizBack">${T("Back")}</button>` : (A().onboarded ? `<button class="btn" type="button" data-page="dashboard">${T("Cancel")}</button>` : "<span></span>")}
        ${st.wiz < last ? `<button class="btn primary" type="button" id="wizNext" ${canNext ? "" : "disabled"} title="${canNext ? "" : T("Add at least two skills")}">${T("Next")}</button>` : `<button class="btn primary big" type="button" id="wizFinish" ${st.busy.finish ? "disabled" : ""}>${st.busy.finish ? `<span class="spin"></span> ${T("Building…")}` : A().onboarded ? T("Update my plan") : T(isTeamUser() ? "Build the team plan" : "Build my career plan")}</button>`}
      </div>
    </div></div>`;
}
const CONTACT = { name: "Name", email: "Email", phone: "Phone", location: "Location" };
function vCvReview() {
  const d = st.cvDraft;
  const exp = d.experience.map((e, i) => `<div class="entry"><div class="grid cols-2">
      <div class="field"><label>${T("Job title")}</label><input type="text" data-cv="experience.${i}.title" value="${esc(e.title)}"></div>
      <div class="field"><label>${T("Organisation")}</label><input type="text" data-cv="experience.${i}.organisation" value="${esc(e.organisation)}"></div>
      <div class="field"><label>${T("From")}</label><input type="text" data-cv="experience.${i}.start" value="${esc(e.start)}"></div>
      <div class="field"><label>${T("To")}</label><input type="text" data-cv="experience.${i}.end" value="${esc(e.end)}"></div></div>
      <div class="field"><label>${T("What you did (one per line)")}</label><textarea data-cv="experience.${i}.highlights">${esc((e.highlights || []).join("\n"))}</textarea></div>
      <button type="button" class="btn ghost" data-cvdel="experience.${i}">${T("Remove this job")}</button></div>`).join("");
  const edu = d.education.map((e, i) => `<div class="grid cols-3">
      <div class="field"><label>${T("Qualification")}</label><input type="text" data-cv="education.${i}.qualification" value="${esc(e.qualification)}"></div>
      <div class="field"><label>${T("Institution")}</label><input type="text" data-cv="education.${i}.institution" value="${esc(e.institution)}"></div>
      <div class="field"><label>${T("Year")}</label><input type="text" data-cv="education.${i}.year" value="${esc(e.year)}"></div></div>`).join("");
  return `<div class="stack lg review" id="cvReview">
    <div><span class="eyebrow">${T("Check before saving")}</span><h3>${T("Here is what we found")}</h3><p class="small muted">${esc(TS(d.note))} ${T("Fix anything that is wrong. When you save, these details are stored in your account so you can use them for your resume.")}</p></div>
    ${d.warnings && d.warnings.length ? `<p class="note warn small">${esc(d.warnings.map(TS).join(" "))}</p>` : ""}
    <div class="grid cols-2">${Object.keys(CONTACT).map((k) => `<div class="field"><label>${T(CONTACT[k])}</label><input type="text" data-cv="contact.${k}" value="${esc(d.contact[k] || "")}"></div>`).join("")}</div>
    <div class="field"><label>${T("Summary")}</label><textarea data-cv="summary">${esc(d.summary)}</textarea></div>
    <div class="stack"><span class="label">${T("Work experience")}</span>${exp || `<p class="small muted">${T("No jobs found.")}</p>`}<button type="button" class="btn" data-cvadd="experience">+ ${T("Add a job")}</button></div>
    <div class="stack"><span class="label">${T("Education")}</span>${edu || `<p class="small muted">${T("No education found.")}</p>`}<button type="button" class="btn" data-cvadd="education">+ ${T("Add education")}</button></div>
    <div class="grid cols-2"><div class="field"><label>${T("Certificates (one per line)")}</label><textarea data-cv="certifications">${esc(d.certifications.join("\n"))}</textarea></div>
      <div class="field"><label>${T("Languages (comma separated)")}</label><input type="text" data-cv="languages" value="${esc(d.languages.join(", "))}"></div></div>
    <div class="stack"><span class="label">${T("Skills we found")}</span>${Object.entries(d.skills).map(([k, v]) => `<label class="check"><input type="checkbox" data-cvskill="${k}" ${v.keep !== false ? "checked" : ""}>
        <span><b>${esc(cl(k).label)}</b> <select data-cvlevel="${k}" aria-label="${T("Level")}">${[1, 2, 3].map((n) => `<option value="${n}" ${v.level === n ? "selected" : ""}>${lv(n)}</option>`).join("")}</select><br><span class="tiny muted">“${esc(v.evidence)}”</span></span></label>`).join("") || `<p class="small muted">${T("None found.")}</p>`}</div>
    <div class="row between"><button type="button" class="btn ghost" id="cvDiscard">${T("Discard")}</button><button type="button" class="btn primary" id="cvSave">${T("Save and continue")}</button></div>
  </div>`;
}
async function finishWizard() {
  if (isTeamUser()) {
    const first = !A().onboarded;
    A().onboarded = true; teamSaved();
    st.page = "dashboard"; render(); window.scrollTo({ top: 0 });
    toast(T(first ? "Your team plan is ready." : "Your team plan is updated."));
    return;
  }
  st.busy.finish = true; render();
  const first = !A().onboarded;
  A().onboarded = true; save();
  try {
    st.analysis = await api("/api/analyze", { ...profileBody(), compare: false });
    if (first || !A().role) A().role = st.analysis.scenarios.moderate[0].role;
    st.path = null; await loadPath(); await loadAdvice();
    try { st.updates = await api("/api/updates"); A().seen = st.updates.snapshot.id; } catch (e) { /* optional */ }
  } catch (e) { toast(T("Could not build your plan: {e}", { e: e.message })); }
  st.busy.finish = false; save();
  st.page = "dashboard"; render(); window.scrollTo({ top: 0 });
  if (st.analysis && st.path) openStory(); else toast(T(first ? "Your career plan is ready." : "Your plan is updated."));
}

// ---------- Your story ----------------------------------------------------------------------------
// A short, Wrapped-style recap of the four steps (about you, the skills radar, your matches, your
// path) that plays after onboarding and from "Replay my story" on Home. Every number comes from the
// analysis and path the app just built. Cards advance on their own; tap right/left, arrow keys,
// hold to pause, Esc to skip.
const STORY_MS = 7000;
const story = { on: false, i: 0, elapsed: 0, paused: false, raf: 0, last: 0, downAt: 0, held: false };
const STORY_N = 6;
function storyData() {
  const sk = skillsNow(), mine = Object.entries(sk).sort((a, b) => b[1] - a[1]);
  const sig = Object.entries(st.analysis.signals).filter(([, v]) => v.demand_change != null && v.n >= 5).sort((a, b) => b[1].demand_change - a[1].demand_change);
  const up = sig.filter(([, v]) => v.demand_change > 0).slice(0, 3), down = sig.filter(([, v]) => v.demand_change < 0).slice(-3).reverse();
  const rs = rows(), byOut = [...rs].sort((a, b) => b.components.outlook - a.components.outlook);
  const nodes = flatNodes(), sdgs = [...new Set(nodes.flatMap((n) => n.sdg || []))];
  return { sk, mine, up, down, rolesUp: byOut.slice(0, 2), rolesDown: byOut.slice(-2).reverse(), top: rs.slice(0, 3), pw: st.path, nodes, sdgs };
}
// One small composition per card from the house shapes: ring, flat accent piece, stripes, dot, line.
function storyGeo(i) {
  const s = (inner) => `<svg class="story-geo" viewBox="0 0 200 200" aria-hidden="true"><defs><clipPath id="sgS${i}"><circle cx="150" cy="150" r="30"/></clipPath></defs>
    <line x1="0" y1="196" x2="200" y2="36" stroke="var(--ink)" stroke-opacity=".25"/>${inner}
    <g clip-path="url(#sgS${i})" stroke="var(--ink)" stroke-opacity=".55" stroke-width="4">${Array.from({ length: 9 }, (_, k) => `<line x1="110" x2="190" y1="${122 + k * 7}" y2="${122 + k * 7}"/>`).join("")}</g></svg>`;
  return [
    s('<circle cx="90" cy="90" r="70" fill="none" stroke="var(--ink)" stroke-opacity=".4" stroke-width="1.2"/><path class="sg-spin" d="M90 20a70 70 0 0 1 0 140z" fill="var(--accent)"/><circle cx="176" cy="24" r="6" fill="var(--ink)"/>'),
    s('<circle cx="90" cy="90" r="76" fill="none" stroke="var(--ink)" stroke-opacity=".35"/><circle cx="90" cy="90" r="52" fill="none" stroke="var(--ink)" stroke-opacity=".35"/><circle cx="90" cy="90" r="28" fill="none" stroke="var(--ink)" stroke-opacity=".35"/><path class="sg-sweep" d="M90 90 L90 14 A76 76 0 0 1 156 52 Z" fill="var(--accent)"/><circle cx="130" cy="40" r="5" fill="var(--ink)"/><circle cx="52" cy="120" r="5" fill="var(--ink)" fill-opacity=".5"/>'),
    s('<circle cx="90" cy="90" r="74" fill="none" stroke="var(--ink)" stroke-opacity=".35"/><circle cx="90" cy="90" r="46" fill="none" stroke="var(--ink)" stroke-opacity=".35"/><circle class="sg-pop" cx="90" cy="90" r="20" fill="var(--accent)"/><circle cx="176" cy="24" r="6" fill="var(--ink)"/>'),
    s('<rect x="20" y="40" width="150" height="16" fill="none" stroke="var(--ink)" stroke-opacity=".4"/><rect class="sg-grow" x="20" y="40" width="120" height="16" fill="var(--accent)"/><rect x="20" y="76" width="150" height="16" fill="none" stroke="var(--ink)" stroke-opacity=".4"/><rect x="20" y="76" width="80" height="16" fill="var(--ink)" fill-opacity=".6"/><circle cx="176" cy="24" r="6" fill="var(--ink)"/>'),
    s('<rect x="20" y="120" width="40" height="40" fill="none" stroke="var(--ink)" stroke-opacity=".4"/><rect x="60" y="80" width="40" height="80" fill="none" stroke="var(--ink)" stroke-opacity=".4"/><rect class="sg-rise" x="100" y="30" width="40" height="130" fill="var(--accent)"/><circle cx="176" cy="24" r="6" fill="var(--ink)"/>'),
    s('<circle class="sg-pop" cx="96" cy="96" r="64" fill="var(--accent)"/><circle cx="96" cy="96" r="84" fill="none" stroke="var(--ink)" stroke-opacity=".4"/><circle cx="176" cy="24" r="6" fill="var(--ink)"/>'),
  ][i];
}
function storyCard(i, d) {
  const k = (n, c = "") => `class="si ${c}" style="--k:${n}"`;
  const head = (n, eyebrow, h) => `<span ${k(0, "eyebrow")}>${n ? esc(T("{n} of 4", { n })) + " · " : ""}${esc(T(eyebrow))}</span><h2 ${k(1)}>${h}</h2>`;
  const bar = ([c, v], max, cls) => `<div class="st-bar ${cls}"><span class="st-lbl">${esc(cl(c).label)}${d.sk[c] ? ` <span class="badge">${T("You have this")}</span>` : ""}</span><span class="st-track"><i style="--w:${Math.max(6, Math.round(Math.abs(v.demand_change) / max * 100))}%"></i></span><span class="mono st-chg">${cls === "st-up" ? "▲" : "▼"} ${Math.abs(Math.round(v.demand_change * 100))}%</span></div>`;
  if (i === 0) {
    return `${head(1, "Tell us about yourself", esc(T("This is you today, {name}.", { name: firstName() })))}
      <p ${k(2)}><b class="st-big" data-count="${d.mine.length}">${d.mine.length}</b> <span class="st-unit">${T(d.mine.length === 1 ? "skill you told us about" : "skills you told us about")}</span></p>
      <div ${k(3)}><div class="st-chips">${d.mine.slice(0, 6).map(([c, v]) => `<span class="st-chip">${esc(cl(c).label)} ${lvlDots(v)}</span>`).join("")}</div></div>
      ${P().interests.length ? `<p ${k(4, "muted")}>${esc(T("You enjoy: {list}", { list: P().interests.map((x) => T(x)).join(", ") }))}</p>` : ""}`;
  }
  if (i === 1) {
    const max = Math.max(...[...d.up, ...d.down].map(([, v]) => Math.abs(v.demand_change)), 0.01);
    return `${head(2, "Future Skills Radar", esc(T("The job market is moving.")))}
      <div ${k(2)}><span class="label">${T("Rising in job posts")}</span>${d.up.map((x) => bar(x, max, "st-up")).join("")}</div>
      <div ${k(3)}><span class="label">${T("Cooling")}</span>${d.down.map((x) => bar(x, max, "st-down")).join("")}</div>
      <p ${k(4, "small")}>${esc(T("Careers heading up: {up}. Heading down: {down}.", { up: d.rolesUp.map((x) => roleOf(x.role).title).join(", "), down: d.rolesDown.map((x) => roleOf(x.role).title).join(", ") }))}</p>
      <p ${k(5, "tiny muted")}>${esc(T("Change in the share of job posts asking for each skill, last 3 months against the 3 before, to {date} (Hacker News “Who is hiring?”).", { date: fmtDate(st.analysis.snapshot.as_of) }))}</p>`;
  }
  if (i === 2) {
    const [b, ...rest] = d.top;
    return `${head(3, "Get matched", esc(T("Your best match")))}
      <p ${k(2, "st-role")}>${esc(roleOf(b.role).title)}</p>
      <p ${k(3)}><b class="st-big" data-count="${Math.round(b.score)}">${Math.round(b.score)}</b> <span class="st-unit">/ 100 · ${esc(fitLabel(b.score))}</span></p>
      <div ${k(4)}>${b.gaps.length ? `<span class="label">${T("Skills to close the gap")}</span><div class="st-chips">${b.gaps.slice(0, 5).map((g) => `<span class="st-chip">${esc(cl(g.cluster).label)} <span class="muted">→ ${esc(lv(g.need))}</span></span>`).join("")}</div>` : `<p>${T("You already have every entry skill.")}</p>`}</div>
      <div ${k(5, "st-rest")}>${rest.map((x, n) => `<div><span class="mono">#${n + 2}</span> ${esc(roleOf(x.role).title)} <span class="mono muted">${Math.round(x.score)}</span></div>`).join("")}</div>
      ${A().role && A().role !== b.role ? `<p ${k(6, "small")}>${esc(T("You chose to aim for {role}. The next card shows the path to it.", { role: roleOf(A().role).title }))}</p>` : ""}`;
  }
  if (i === 3) {
    const r = roleOf(A().role), res = rows().find((x) => x.role === A().role); if (!res) return "";
    const label = Object.fromEntries(CALC_PARTS.map(([kk, l]) => [kk, T(l)])), why = fitWhy(res, r);
    const parts = Object.entries(res.points).filter(([, v]) => Math.abs(v) >= 0.05).sort((p1, p2) => p2[1] - p1[1]);
    const max = Math.max(...parts.map(([, v]) => Math.abs(v)), 1);
    return `${head(3, "Get matched", esc(T("Why {role} suits you", { role: r.title })))}
      <p ${k(2)}><b class="st-big" data-count="${Math.round(res.score)}">${Math.round(res.score)}</b> <span class="st-unit">/ 100 · ${esc(fitLabel(res.score))}</span></p>
      <div ${k(3)}>${parts.map(([kk, v]) => `<div class="st-bar ${v < 0 ? "st-down" : "st-up"}"><span class="st-lbl"><b>${esc(label[kk] || kk)}</b><span class="tiny muted st-why">${esc(why[kk] || "")}</span></span><span class="st-track"><i style="--w:${Math.max(6, Math.round(Math.abs(v) / max * 100))}%"></i></span><span class="mono st-chg">${v > 0 ? "+" : "−"}${Math.abs(v).toFixed(1)}</span></div>`).join("")}</div>
      ${res.gaps.length ? `<div ${k(4)}><span class="label">${T("Still to learn for the entry job")}</span><div class="st-chips">${res.gaps.slice(0, 5).map((g) => `<span class="st-chip">${esc(cl(g.cluster).label)}</span>`).join("")}</div></div>` : ""}`;
  }
  if (i === 4) {
    const pw = d.pw, steps = d.nodes.filter((n) => n.type === "skill").length;
    return `${head(4, "Follow a pathway", esc(T("{n} steps to {role}", { n: d.nodes.length, role: pw.stages[pw.stages.length - 1].title })))}
      <ol ${k(2, "st-ladder")}>${pw.stages.map((s2, n) => `<li style="--k:${2 + n * 0.6}"><span class="mono">${esc(TS(s2.stage))}</span><b>${esc(s2.title)}</b><span class="tiny muted">${esc(s2.weeks[0] === s2.weeks[1] ? T("{n} weeks", { n: s2.weeks[0] }) : T("{a}–{b} weeks", { a: s2.weeks[0], b: s2.weeks[1] }))}</span></li>`).join("")}</ol>
      <p ${k(4)}>${esc(T("{s} skills to learn, about {h} hours at {w} hours a week.", { s: steps, h: pw.hours, w: pw.hours_per_week }))}</p>
      <div ${k(5)}><span class="label">${T("Every step is linked to the UN Sustainable Development Goals")}</span><div class="sdg-row">${d.sdgs.slice(0, 8).map(sdgTag).join(" ")}</div></div>`;
  }
  return `<span ${k(0, "eyebrow")}>${T("Your plan")}</span><h2 ${k(1)}>${esc(T("Ready when you are, {name}.", { name: firstName() }))}</h2>
    <p ${k(2)}>${esc(T("Your first step: {step}.", { step: d.nodes[0] ? nodeLabel(d.nodes[0]) : "—" }))}</p>
    <div ${k(3, "row")}><button type="button" class="btn primary big" id="storyDone">${T("Go to my dashboard")}</button><button type="button" class="btn" id="storyAgain">${T("Watch again")}</button></div>`;
}
function storyPaint() {
  const el = $("#story"); if (!el) return;
  const d = storyData();
  el.classList.toggle("final", story.i === STORY_N - 1);
  el.querySelector(".story-card").innerHTML = `${storyGeo(story.i)}<div class="story-body">${storyCard(story.i, d)}</div>`;
  el.querySelectorAll(".story-bars i").forEach((b, n) => { b.style.width = n < story.i ? "100%" : "0%"; });
  el.querySelector(".story-card").setAttribute("aria-label", T("Card {n} of {total}", { n: story.i + 1, total: STORY_N }));
  el.querySelectorAll("[data-count]").forEach((c) => {
    const to = +c.dataset.count; if (!motionOn() || !to) return;
    const t0 = performance.now(), tick = (t) => { const p = Math.min(1, (t - t0) / 900); c.textContent = Math.round(to * (1 - Math.pow(1 - p, 3))); if (p < 1) requestAnimationFrame(tick); };
    c.textContent = "0"; requestAnimationFrame(tick);
  });
  const done = el.querySelector("#storyDone"); if (done) done.focus();
}
function storyGo(i) {
  if (i < 0) i = 0;
  if (i >= STORY_N) return closeStory();
  story.i = i; story.elapsed = 0; storyPaint();
}
function storyLoop(t) {
  if (!story.on) return;
  const dt = story.last ? t - story.last : 0; story.last = t;
  if (!story.paused && story.i < STORY_N - 1) {
    story.elapsed += dt;
    const b = document.querySelectorAll("#story .story-bars i")[story.i];
    if (b) b.style.width = Math.min(100, story.elapsed / STORY_MS * 100) + "%";
    if (story.elapsed >= STORY_MS) storyGo(story.i + 1);
  }
  story.raf = requestAnimationFrame(storyLoop);
}
function openStory() {
  if (isTeamUser() || !st.analysis || !st.path || !rows().length) return;
  closeStory(true);
  if (tourAt >= 0) { document.querySelectorAll(".tour-layer").forEach((x) => x.remove()); tourAt = -1; }  // the guide comes back after the story
  const el = document.createElement("div");
  el.id = "story"; el.className = "story"; el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-label", T("Your plan in four steps"));
  el.innerHTML = `<div class="story-top"><div class="story-bars">${Array.from({ length: STORY_N }, () => "<span><i></i></span>").join("")}</div>
      <button type="button" class="btn ghost small" id="storySkip">${T("Skip")} ✕</button></div>
    <button type="button" class="story-tap prev" data-storynav="-1" aria-label="${T("Previous")}"></button><button type="button" class="story-tap next" data-storynav="1" aria-label="${T("Next")}"></button>
    <section class="story-card" aria-live="polite"></section>
    <p class="story-hint tiny">${T("Tap to go on · hold to pause")}</p>`;
  document.body.append(el); document.body.classList.add("story-open");
  // hold anywhere to pause; a long press does not count as a tap
  el.addEventListener("pointerdown", (e) => { if (e.target.closest("button:not(.story-tap)")) return; story.downAt = performance.now(); story.held = false; story.paused = true; });
  el.addEventListener("pointerup", () => { story.held = performance.now() - story.downAt > 250; story.paused = false; });
  Object.assign(story, { on: true, last: 0 });
  storyGo(0);
  story.raf = requestAnimationFrame(storyLoop);
  el.querySelector("#storySkip").focus();
}
function closeStory(quiet) {
  cancelAnimationFrame(story.raf); story.on = false;
  const el = $("#story"); if (el) el.remove();
  document.body.classList.remove("story-open");
  if (quiet || !A()) return;
  if (!A().prefs.story) { A().prefs.story = true; save(); }
  if (!A().prefs[tourKey()] && st.page === "dashboard") setTimeout(() => { if (tourAt < 0 && !story.on) tourShow(0); }, 500);
}

// ---------- dashboard ------------------------------------------------------------------------
// Loading lines only describe steps the app really performs.
const LOAD_LINES = ["Matching your skills to ESCO occupations…", "Reading the latest job-post signals…", "Checking ILO scores for how much AI can do in each job…", "Ordering your steps by what employers want now…"];
let tLoad = null;
function rotateLoading() {
  clearInterval(tLoad); let i = 0;
  tLoad = setInterval(() => {
    const el = document.querySelector(".load-msg[data-rotate]"); if (!el) { clearInterval(tLoad); return; }
    el.classList.add("fade"); setTimeout(() => { i = (i + 1) % LOAD_LINES.length; el.textContent = T(LOAD_LINES[i]); el.classList.remove("fade"); }, 300);
  }, 2600);
}
const skeleton = (n, label) => { setTimeout(rotateLoading, 0); return `<div class="page" aria-busy="true"><div class="skel skel-title"></div><p class="load-msg" ${label ? "" : "data-rotate"} role="status">${esc(label || T(LOAD_LINES[0]))}</p><div class="dash">${Array.from({ length: n }, (_, i) => `<div class="card skel-card ${i === 0 ? "hero-card" : ""}"><div class="skel"></div><div class="skel short"></div><div class="skel"></div></div>`).join("")}</div></div>`; };
const tipText = (t) => esc(simple() ? firstSentence(TS(t)) : TS(t));
// "What do you want to do?": the questions people come with, each answered in one line with their own
// data and one tap from the page that has the full answer. Also the only way to Job check and News on
// phones without opening More.
const QT_ICON = {
  careers: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
  path: '<path d="M6 21c0-6 12-4 12-10S9 7 9 3"/><circle cx="9" cy="3" r="1.5"/><circle cx="6" cy="21" r="1.5"/>',
  mycareer: '<rect x="4" y="7" width="16" height="12" rx="2"/><path d="M9 7V5h6v2M12 11v4M10 13h4"/>',
  jobcheck: '<path d="M4 7h16v12H4z"/><path d="M9 7V4h6v3"/><path d="M8 13l3 3 5-6"/>',
  resume: '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M10 13h6M10 17h6"/>',
  news: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 8h10M7 12h10M7 16h6"/>',
};
function quickTasks(r, res, cur, b) {
  const best = rows().find((x) => x.rank === 1), alt = best && best.role === A().role ? rows().find((x) => x.rank === 2) : best;
  const items = [
    ["careers", "Which careers suit me?", alt ? T("Also worth a look: {career}", { career: roleOf(alt.role).title }) : T("Compare every career side by side")],
    ["path", "What should I learn next?", cur ? T("Next step: {step}", { step: nodeLabel(cur) }) : T("You finished every step. Well done!")],
    ["mycareer", "Is AI changing my job?", b >= 0 ? T("AI impact: {level}", { level: T(EXP_BANDS[b][1]) }) : T("See which tasks AI can do")],
    ["jobcheck", "Does a job ad fit me?", T("Paste an ad, see what you have and what is missing")],
    ["resume", "Make my resume", T("Built from your profile, ready to save as PDF")],
    ["news", "What is new in jobs?", T("Headlines and trends from the last 45 days")],
  ];
  return `<section class="quick" aria-labelledby="quickH"><h3 id="quickH">${T("What do you want to do?")}</h3>
    <div class="quick-grid">${items.map(([k, q, a]) => `<button type="button" class="quick-btn" data-page="${k}"><span class="q-icon" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${QT_ICON[k]}</svg></span><span class="q-text"><b>${T(q)}</b><span class="tiny muted">${esc(a)}</span></span><span class="q-arrow" aria-hidden="true">→</span></button>`).join("")}</div>
  </section>`;
}
function vDashboard() {
  if (isTeamUser()) return vTeamHome();
  if (!st.analysis || (A().role && (!st.path || st.path.role !== A().role))) { if (!st.busy.dash) { st.busy.dash = true; refresh({}).then(() => { st.busy.dash = false; }); } return skeleton(6); }
  const r = roleOf(A().role), res = rows().find((x) => x.role === A().role), pw = st.path, cur = currentNode(), up = st.updates, adv = st.advice;
  const u = unlockedStage(), si = cur ? cur.si : pw.stages.length - 1;
  const moved = up ? up.moved.filter((x) => flatNodes().some((n) => n.cluster === x.cluster)) : [];
  const tech = [...new Set(flatNodes().flatMap((n) => (n.new_tech || []).map((w) => w.term)))];
  const allDone = flatNodes().filter(required).every((n) => done(n.key));
  const req = flatNodes().filter(required), pct = req.length ? Math.round(req.filter((n) => done(n.key)).length / req.length * 100) : 100;
  const b = r.exposure ? expBand(r.exposure) : -1;
  const changes = moved.length + tech.length;
  const top = pw.stages[pw.stages.length - 1].title;
  loadNews(); const heads = homeHeadlines(3);
  return `<div class="page home">
    <section class="home-hero">
      <div class="stack" style="gap:10px;min-width:0">
        <span class="eyebrow">${esc(T("Hi {name}", { name: firstName() }))}</span>
        <h2 class="hero-role"><span class="muted-serif">${T("You are becoming a")}</span> ${esc(r.title)}</h2>
        <div class="ladder hero-ladder">${pw.stages.map((s2, i) => `${i ? '<span class="arrow">→</span>' : ""}<span class="${i <= u ? "up" : i === si ? "now" : ""}">${esc(s2.title)}${i <= u ? " ✓" : ""}</span>`).join("")}</div>
        <p class="cheer">“${esc(cheerLine(pct, allDone))}”</p>
      </div>
      <div class="hero-side">
        ${progressGeo(pct)}
        <span class="tiny muted">${esc(T("of the way to {role}", { role: top }))}</span>
      </div>
    </section>
    <div class="card next-card">
      ${cur ? `<span class="disc-mini">${nodeIcon(cur, false)}</span>
        <div class="stack" style="gap:4px"><span class="eyebrow">${T("Your next step")}</span><h3>${esc(nodeLabel(cur))}</h3><p class="small muted">${esc(TS(cur.stage.stage))} · ${esc(cur.stage.title)}${cur.type === "skill" && cur.items[0] ? " · " + esc(cur.items[0].title) + ` (${cur.items[0].hours} h)` : ""}</p></div>
        <div class="act">${cur.type === "checkpoint" ? `<button class="btn big" type="button" data-interview="${cur.si}">${T("Practise the interview")}</button>` : ""}<button class="btn primary big" type="button" data-goto="${esc(cur.key)}">${T("Start this step")}</button></div>`
        : `<span class="done-mark">${I.check}</span><div class="stack" style="gap:4px"><span class="eyebrow">${T("Your path")}</span><h3>${T("You finished every step. Well done!")}</h3></div>`}
    </div>
    ${quickTasks(r, res, cur, b)}
    <section class="card stack updates" id="updates" aria-roledescription="${T("carousel")}" aria-label="${T("Updates")}">
      <div class="row between"><div class="row" style="gap:8px"><h3>${T("Updates")}</h3>${changes ? `<span class="badge accent">${esc(T(changes === 1 ? "{n} change" : "{n} changes", { n: changes }))}</span>` : `<span class="badge">${T("No changes")}</span>`}</div>
        <div class="row" style="gap:6px"><button type="button" class="btn ghost" data-page="news">${T("See all news")}</button><button type="button" class="deck-arrow sm" data-upd="-1" aria-label="${T("Previous")}">←</button><button type="button" class="deck-arrow sm" data-upd="1" aria-label="${T("Next")}">→</button></div></div>
      <div class="upd-track">
        <div class="upd-slide on" role="group" aria-label="${T("Today's brief")}">
          <span class="eyebrow">${T("Today's brief")} ${info("update")}</span>
          <h3 class="upd-title">${T(changes ? "What moved in your job market" : "A quiet day for your skills")}</h3>
          <p class="dateline">${esc(up ? fmtDate(up.checked_on, { weekday: "long", day: "numeric", month: "long" }) : T("Today"))} · ${esc(T("job posts to {date}", { date: "%DATE%" })).replace("%DATE%", `<span class="nowrap">${esc(pw.snapshot.as_of)}</span>`)}</p>
          ${changes ? `<div class="list">${moved.slice(0, 3).map((x) => `<div><span>${esc(cl(x.cluster).label)}</span><span class="mono ${x.after > x.before ? "up" : "down"}">${x.after > x.before ? "▲" : "▼"} ${simple() ? T(x.after > x.before ? "more jobs want it" : "fewer jobs want it") : `${demandText(x.before)} → ${demandText(x.after)}`}</span></div>`).join("")}</div>
            ${tech.length ? `<p class="small">${esc(T("Rising tools in your path: {tools}", { tools: tech.slice(0, 4).join(", ") }))}</p>` : ""}`
            : `<p class="small">${T("Nothing important changed. Your plan is still in the best order.")}</p>`}
          <div class="src-row">${trendChip()}</div>
        </div>
        ${heads.map((x) => `<div class="upd-slide" role="group" aria-label="${T("News")}">
          <span class="eyebrow">${T("News")} · ${esc(topicName(x.topics[0]))}</span>
          <h3 class="upd-title"><a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.title)}</a></h3>
          <p class="tiny muted">${esc(x.site)} · ${esc(fmtDate(x.date))} · ${esc(T(x.comments === 1 ? "1 comment on Hacker News" : "{n} comments on Hacker News", { n: x.comments }))}</p>
          <p class="small muted">${T(x.clusters.some((c) => reqOf(A().role).has(c)) ? "Related to your career's skills." : "One of the most discussed work headlines this month.")}</p>
        </div>`).join("")}
        <div class="upd-slide" role="group" aria-label="${T("AI impact")}">
          <span class="eyebrow">${T("AI impact")} ${info("exposure")}</span>
          <h3 class="upd-title">${esc(T("How AI touches {role}", { role: r.title }))}</h3>
          ${aiCard(r.exposure, true)}
          <div class="src-row">${iloChip()}</div>
        </div>
      </div>
      <div class="slide-dots upd-dots">${[T("Today's brief"), ...heads.map(() => T("News")), T("AI impact")].map((l, k) => `<button type="button" data-updto="${k}" class="${k ? "" : "on"}" aria-label="${esc(l)}" title="${esc(l)}"><span>${k + 1}</span></button>`).join("")}</div>
    </section>
    <div class="home-row">
      <div class="kpi geo-tile"><span class="kpi-geo" aria-hidden="true">${TILE_GEO.fit}</span><span class="k-label">${T(simple() ? "How well it fits" : "Fit score")} ${info("score")}</span>
        <div class="row" style="gap:12px">${res ? `<div class="ring" style="--p:${Math.round(res.score)}"><span>${Math.round(res.score)}</span></div><div><b>${fitLabel(res.score)}</b><p class="tiny muted">${esc(scenLabel(st.scen))}</p></div>` : "<b>—</b>"}</div></div>
      <div class="kpi geo-tile"><span class="kpi-geo" aria-hidden="true">${TILE_GEO.stage}</span><span class="k-label">${T("This stage")} ${info("stage")}</span>
        <div class="row" style="gap:12px"><div class="ring" style="--p:${stagePct(si)}"><span>${stagePct(si)}%</span></div><div><b>${esc(T("{stage} stage", { stage: TS(pw.stages[si].stage) }))}</b><p class="tiny muted">${esc(T("About {weeks} weeks at your pace", { weeks: pw.stages[si].weeks[1] }))}</p></div></div></div>
      <div class="kpi geo-tile"><span class="kpi-geo" aria-hidden="true">${TILE_GEO.resume}</span><span class="k-label">${T("Resume")} ${info("resume")}</span>
        ${u >= 0 ? `<b>${esc(T("Ready for {role}", { role: pw.stages[u].title }))}</b><div class="row"><button class="btn" type="button" data-page="resume">${T("Open my resume")}</button></div>`
          : `<b>${T("Ready to edit")}</b><p class="tiny muted">${T("Courses you finish are added automatically.")}</p><div class="row"><button class="btn" type="button" data-page="resume">${T("Open my resume")}</button></div>`}</div>
    </div>
  </div>`;
}
// Progress as a composition: an ink ring, a flat accent sector for the share done, a striped
// circle, a dot and one leading line, the same vocabulary as the landing page.
function progressGeo(pct, label) {
  const a = Math.min(pct, 99.99) / 100 * 2 * Math.PI, R = 70, cx = 100, cy = 100;
  const x = cx + R * Math.sin(a), y = cy - R * Math.cos(a), large = pct > 50 ? 1 : 0;
  const sector = pct <= 0 ? "" : `<path class="pg-sector" d="M ${cx} ${cy} L ${cx} ${cy - R} A ${R} ${R} 0 ${large} 1 ${x.toFixed(1)} ${y.toFixed(1)} Z" fill="var(--accent)"/>`;
  return `<div class="progress-geo" role="img" aria-label="${esc(label || T("{pct}% of your path done", { pct }))}">
    <svg viewBox="0 0 200 200" aria-hidden="true"><defs><clipPath id="pgStripe"><circle cx="40" cy="160" r="24"/></clipPath></defs>
      <line class="pg-line" x1="0" y1="190" x2="200" y2="40" stroke="var(--ink)" stroke-opacity=".25" stroke-width="1"/>
      <circle cx="${cx}" cy="${cy}" r="92" fill="none" stroke="var(--ink)" stroke-opacity=".35" stroke-width="1.2"/>
      <circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="var(--line)" stroke-width="1.5"/>${sector}
      <line x1="${cx}" y1="${cy - R - 8}" x2="${cx}" y2="${cy - R + 12}" stroke="var(--accent)" stroke-width="3"/>
      <g class="pg-stripes" clip-path="url(#pgStripe)" stroke="var(--ink)" stroke-opacity=".6" stroke-width="4">${Array.from({ length: 8 }, (_, i) => `<line x1="10" x2="70" y1="${138 + i * 7}" y2="${138 + i * 7}"/>`).join("")}</g>
      <circle class="pg-dot" cx="176" cy="30" r="6" fill="var(--ink)"/></svg>
    <b class="pg-num">${pct}<small>%</small></b></div>`;
}
const TILE_GEO = (() => {
  const o = (inner) => `<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2">${inner}</svg>`;
  return {
    fit: o('<circle cx="12" cy="12" r="10"/><path d="M12 2a10 10 0 0 1 0 20z" fill="var(--accent)" stroke="none"/>'),
    stage: o('<defs><clipPath id="tgS"><circle cx="12" cy="12" r="9"/></clipPath></defs><circle cx="12" cy="12" r="10"/><g clip-path="url(#tgS)" stroke="var(--accent)" stroke-width="2">' + [5, 9, 13, 17, 21].map((y) => `<line x1="0" x2="24" y1="${y}" y2="${y}"/>`).join("") + "</g>"),
    resume: o('<rect x="2" y="2" width="20" height="20"/><path d="M2 22V2a20 20 0 0 1 20 20z" fill="var(--accent)" stroke="none"/>'),
  };
})();
// A line of encouragement that follows how far along the path someone is. Two per stage of
// progress, alternating by day, so it changes without being random.
const CHEER = [
  [0, ["Every expert started with step one. Yours is waiting below.", "Starting is the hardest part, and you are here."]],
  [25, ["Good start. Small steps each week add up.", "You have begun. Keep the same pace next week."]],
  [50, ["You are building momentum. Keep the rhythm going.", "Each step you finish is a skill employers can see."]],
  [75, ["More than halfway. The hardest part is behind you.", "Look how far you have come. Keep going."]],
  [100, ["Almost there. Finish strong.", "Only a few steps left before your next role."]],
];
function cheerLine(pct, allDone) {
  if (allDone) return T("You did it. Time to put your new skills to work.");
  const lines = (CHEER.find(([max]) => pct <= max) || CHEER[0])[1];
  return T(lines[Math.floor(Date.now() / 86400000) % lines.length]);
}
// Updates slide by themselves every few seconds; hovering, focus or reduced motion stops them.
let updTimer = null;
function updatesSetup() {
  clearInterval(updTimer); updTimer = null;
  const box = document.getElementById("updates"); if (!box) return;
  const slides = [...box.querySelectorAll(".upd-slide")], dots = [...box.querySelectorAll("[data-updto]")];
  let i = 0, hold = false;
  const show = (j) => { i = (j + slides.length) % slides.length; slides.forEach((el, k) => el.classList.toggle("on", k === i)); dots.forEach((el, k) => el.classList.toggle("on", k === i)); };
  box.querySelectorAll("[data-upd]").forEach((b) => b.addEventListener("click", () => show(i + +b.dataset.upd)));
  dots.forEach((b) => b.addEventListener("click", () => show(+b.dataset.updto)));
  ["mouseenter", "focusin"].forEach((e) => box.addEventListener(e, () => { hold = true; }));
  ["mouseleave", "focusout"].forEach((e) => box.addEventListener(e, () => { hold = false; }));
  if (!reduceMotion()) updTimer = setInterval(() => { if (!hold && !document.hidden) show(i + 1); }, 7000);
}

// ---------- careers ------------------------------------------------------------------------
function bar(label, pts, neg) { const w = Math.min(100, Math.abs(pts) * 2.4); return `<div class="bar"><span class="muted">${esc(T(label))}</span><span class="track"><span class="fill ${neg ? "neg" : ""}" style="display:block;width:${w}%"></span></span><span class="mono">${neg ? "" : "+"}${pts.toFixed(1)}</span></div>`; }
function whySimple(x) {
  const out = [];
  out.push(T(x.components.skill >= 0.7 ? "You already have most of the skills." : x.components.skill >= 0.4 ? "You have some of the skills." : "You would need to learn many new skills."));
  out.push(T(x.components.outlook >= 0.55 ? "More jobs are asking for these skills." : x.components.outlook <= 0.45 ? "Fewer jobs are asking for these skills lately." : "Demand for these skills is steady."));
  if (x.components.interest >= 0.5) out.push(T("It matches what you enjoy."));
  out.push(expSentence(roleOf(x.role).exposure));
  return out;
}
function vCareers() {
  const a = st.analysis; if (!a) { refresh({}); return skeleton(3, T("Matching your skills to {n} careers…", { n: st.meta.roles.length })); }
  const all = rows(), adv = st.advice, diff = a.diff ? a.diff[st.scen] : null;
  return `<div class="page">
  ${intro(T("Compare careers"), T("Every career, side by side"), T(simple() ? "Look through all careers by zone. Tap one to see why it fits, in plain words. These are estimates, not promises." : "All careers ranked by your skills, where demand is heading, and how much of the work AI can already do. Estimates, not predictions."), A().role ? `<button class="btn" type="button" data-page="mycareer">${T("Back to my career")}</button>` : "")}
  <div class="row between">
    <div class="row"><div class="seg" role="group" aria-label="${T("Future")}">${Object.keys(st.meta.scenarios).map((k) => `<button type="button" data-scen="${k}" aria-pressed="${st.scen === k}">${esc(scenLabel(k))}</button>`).join("")}</div>${info("scenario")}</div>${scenBrief()}
    <label class="check small" style="align-items:center"><input type="checkbox" id="compareChk" ${st.compare ? "checked" : ""}> ${T("What changed recently")}</label>
  </div>
  ${diff ? `<div class="note accent small"><b>${T(simple() ? "What changed:" : "What changed with the latest data.")}</b> ${diff.length ? diff.map((x) => esc(simple() ? T(x.to < x.from ? "{role} moved up" : "{role} moved down", { role: roleOf(x.role).title }) : `${roleOf(x.role).title} ${x.from} → ${x.to} (${cl(x.driver).label} ${demandText(x.driver_before)} → ${demandText(x.driver_after)})`)).join("; ") : T("Your top careers stayed the same.")}</div>` : ""}
  <div class="careers-duo">${vCareerMap(all)}${vCareerDetailCard(all)}</div>
  </div>`;
}
// My career: the chosen career in full, a short list of alternatives, then advice.
function vMyCareer() {
  const a = st.analysis; if (!a) { refresh({}); return skeleton(3, T("Matching your skills to {n} careers…", { n: st.meta.roles.length })); }
  const all = rows(), adv = st.advice, x = all.find((y) => y.role === A().role);
  if (!x) return `<div class="page">${intro(T("My career"), T("Choose a career first"), T("Look through the careers overview and press Choose on the one you want."))}<div class="row"><button class="btn primary" type="button" data-page="careers">${T("Open the careers overview")}</button></div></div>`;
  const others = all.filter((y) => y.role !== x.role).slice(0, 3);
  return `<div class="page">
  ${intro(T("My career"), roleOf(x.role).title, T(simple() ? "Why it fits you, what to learn, and how AI touches it." : "Your chosen career: why it fits, the skill gap, AI impact and UN goals."), `<button class="btn primary" type="button" data-page="path">${T("Open my path")}</button>`)}
  <div class="row"><div class="seg" role="group" aria-label="${T("Future")}">${Object.keys(st.meta.scenarios).map((k) => `<button type="button" data-scen="${k}" aria-pressed="${st.scen === k}">${esc(scenLabel(k))}</button>`).join("")}</div>${info("scenario")}</div>${scenBrief()}
  <section class="card stack deck-card" data-row="${x.role}">${careerHead(x)}${vCareerDetail(x, false)}</section>
  ${vNextSkills()}
  ${vXray()}
  <section class="card stack">
    <div class="row between"><h3>${T("Other careers worth a look")}</h3><button class="btn ghost" type="button" data-page="careers">${T("See all careers")}</button></div>
    <div class="alt-list">${others.map((y) => `<div class="alt-row">
      <div class="ring sm" style="--p:${Math.round(y.score)}"><span>${Math.round(y.score)}</span></div>
      <div class="stack" style="gap:2px;min-width:0"><b>${esc(roleOf(y.role).title)}</b><span class="tiny muted">${esc(T("Rank {n}", { n: y.rank }))} · ${esc(fitLabel(y.score))}</span></div>
      <div class="row act"><button class="btn ghost" type="button" data-see="${y.role}">${T("Details")}</button><button class="btn" type="button" data-choose="${y.role}">${T("Choose")}</button></div></div>`).join("")}</div>
  </section>
  <div class="grid cols-2" style="align-items:start">
      ${adv ? `<div class="card stack"><h3>${T("Advice for your situation")}</h3>
        ${adv.tips.map((t, i) => `<div class="guide"><span class="num">${i + 1}</span><p class="small">${tipText(t)}</p></div>`).join("")}
        ${adv.side_income.length ? `<hr><span class="label">${T("Earn while you learn")}</span>${adv.side_income.map((s2) => `<p class="small">• ${esc(TS(s2.idea))}${s2.caution ? `<br><span class="tiny" style="color:var(--warn)">${esc(TS(s2.caution))}</span>` : ""}</p>`).join("")}` : ""}
        ${adv.funding.length ? `<hr><span class="label">${esc(T("Help with costs in {country}", { country: countryName() }))}</span>${adv.funding.map((f) => `<p class="small"><a href="${esc(f.url)}" target="_blank" rel="noopener">${esc(f.name)}</a>${simple() ? "" : ": " + esc(TS(f.text))}</p>`).join("")}` : ""}
        <p class="tiny muted">${esc(TS(adv.fairness_note))}</p></div>` : ""}
      ${vSkillMoves()}
  </div></div>`;
}
function rankDelta(roleId) {
  if (st.scen === "moderate") return "";
  const base = st.analysis.scenarios.moderate.find((y) => y.role === roleId).rank;
  const now = rows().find((y) => y.role === roleId).rank, d = base - now;
  const baseName = simple() ? T("Steady change") : TS("Moderate AI");
  return d ? `<span class="badge ${d > 0 ? "accent" : "warn"}" title="${esc(T("Rank {now} here, rank {base} in {scenario}", { now, base, scenario: baseName }))}">${d > 0 ? "▲" : "▼"} ${esc(T("{n} vs {scenario}", { n: Math.abs(d), scenario: baseName }))}</span>` : `<span class="badge">${esc(T("Same rank as {scenario}", { scenario: baseName }))}</span>`;
}
function vCareerRow(x, split) {
  const r = roleOf(x.role), open = st.open === x.role;
  const local = st.analysis.local_demand[`${x.role}@0`], mine = A().role === x.role;
  // At most two badges on the card: rank change (or local demand) and AI impact.
  const first = rankDelta(x.role) || (local ? `<span class="badge good" title="${esc(TS(st.analysis.local_demand_source))}">${esc(T("In demand in {country}", { country: countryName() }))}</span>` : "");
  const chooseBtn = mine ? `<span class="chosen">✓ ${T("My career")}</span>` : `<button class="btn" type="button" data-choose="${x.role}">${T("Choose")}</button>`;
  return `<article class="career ${split && open ? "is-open" : ""}" data-row="${x.role}" ${split ? 'role="listitem"' : ""}>
    <div class="ring" style="--p:${Math.round(x.score)}" role="img" aria-label="${esc(T("Rank {n}", { n: x.rank }) + " · " + T("Fit {n} of 100", { n: Math.round(x.score) }))}"><span>${Math.round(x.score)}</span><b class="rank-n" aria-hidden="true">${x.rank}</b></div>
    <div class="stack" style="gap:6px;min-width:0">
      <h3>${esc(r.title)} ${simple() ? `<span class="badge accent">${fitLabel(x.score)}</span>` : ""}</h3>
      ${split ? `<p class="tiny muted">${esc(T("Up to {role}", { role: r.ladder[r.ladder.length - 1].title }))}</p>` : `<div class="ladder">${r.ladder.map((s, i) => `${i ? '<span class="arrow">→</span>' : ""}<span>${esc(s.title)}</span>`).join("")}</div>`}
      <div class="row" style="gap:6px">${first}${expBadge(r.exposure)}</div>
    </div>
    <div class="row act">${split ? `<button class="btn ${open ? "" : "ghost"}" type="button" data-open="${x.role}" aria-pressed="${open}">${T(open ? "Showing details" : "Why this match?")}</button>` : `<button class="btn" type="button" data-open="${x.role}" aria-expanded="${open}">${T(open ? "Hide" : "Why?")}</button>`}${chooseBtn}</div>
    ${!split && open ? `<div class="details">${vCareerDetail(x, false)}</div>` : ""}
  </article>`;
}
// The standard explanation, written here so it follows the interface language.
// The server's English version is the same text; a model-written one is shown as is.
function explainText(ex) {
  if (ex.method === "llm" || LANG === "en" || !ex.facts) return ex.text;
  const f = ex.facts, e = f.ai_exposure;
  const have = (f.skills_you_have || []).join(", ") || T("none of its core skills yet");
  const gaps = (f.skills_to_build || []).map((g) => `${g.skill} (${T(g.have)} → ${T(g.need)})`).join("; ") || T("nothing");
  return T("{role} scores {score} for you under the {scenario} scenario. You already bring {have}. To be ready you would build: {gaps}. The ILO rates this occupation's tasks at {mean} on average for generative-AI exposure ({category}). The task most exposed is “{most}”; the least exposed is “{least}”. This is an estimate to support your decision, not a prediction.",
    { role: f.role, score: f.match_score, scenario: TS(f.scenario), have, gaps, mean: e.mean_task_score, category: e.category, most: e.most_exposed_task, least: e.least_exposed_task });
}
// Detail for one career, in four tabs: why it matches, the skill gap, AI impact, UN goals.
const CTABS = [["why", "Why this match"], ["skills", "Skills"], ["ai", "AI impact"], ["sdg", "UN goals"]];
function vCareerDetail(x, split) {
  const r = roleOf(x.role), rg = st.analysis.ranges[x.role], ex = st.explain[x.role], tab = ["gap", "what"].includes(st.ctab) ? "skills" : st.ctab || "why";
  let body = "";
  if (tab === "why") {
    body = `${simple() ? `<ul class="small plain">${whySimple(x).map((t) => `<li>${esc(t)}</li>`).join("")}</ul>`
      : `<div class="row" style="gap:6px"><span class="label">${T("Score parts")}</span>${info("score")}</div>
        <div class="bars">${bar("Skill match", x.points.skill)}${bar("Demand outlook", x.points.outlook)}${bar("Transferable skills", x.points.transfer)}${bar("Interest fit", x.points.interest)}${x.points.green ? bar("Green economy", x.points.green) : ""}${bar("AI exposure", x.points.exposure, true)}</div>
        <p class="small muted">${esc(T("Score {score} in {scenario}; {min}–{max} across the three futures. An estimate, not a prediction.", { score: Math.round(x.score), scenario: scenLabel(st.scen), min: rg.min.toFixed(0), max: rg.max.toFixed(0) }))}</p>`}
      ${ex ? `<div class="explain">${esc(explainText(ex))}</div><p class="tiny muted">${ex.method === "llm" ? esc(T("Written by {model} from the facts above; numbers checked. Check it before you act on it.", { model: ex.model })) : T("Standard explanation.")}</p>` : ""}
      ${vScoreCalc(x)}
      <div class="row"><button class="btn" type="button" data-explain="${x.role}" ${st.busy["ex_" + x.role] ? "disabled" : ""}>${st.busy["ex_" + x.role] ? `<span class="spin"></span> ${T("Writing…")}` : T(st.page === "careers" ? "Do I suit this job?" : "Explain it to me")}</button></div>
      <div class="src-row">${trendChip()}${escoChip(r.esco.uri)}</div>`;
  } else if (tab === "skills") {
    body = vSkillsTab(x);
  } else if (tab === "ai") {
    body = `${aiCard(r.exposure)}<div class="src-row">${iloChip()}</div>`;
  } else {
    body = `${r.sdg.map((l) => `<p class="small">${sdgTag(l.target)} ${esc(TS(l.why))}</p>`).join("") || `<p class="small muted">${T("No direct link.")}</p>`}
      <p class="tiny muted">${esc(gloss("sdg"))}</p>
      <div class="src-row">${srcChip("UN SDG API", st.meta.sources.sdg.retrieved, [st.meta.sources.sdg.source])}</div>`;
  }
  return `${split ? `<div class="row between" style="flex-wrap:nowrap;align-items:flex-start"><div class="stack" style="gap:4px;min-width:0"><span class="eyebrow">${esc(T("Rank {n}", { n: x.rank }))} · ${esc(scenLabel(st.scen))}</span><h3 style="font-size:1.2rem">${esc(r.title)}</h3></div>
      <div class="ring" style="--p:${Math.round(x.score)}"><span>${Math.round(x.score)}</span></div></div>` : ""}
    <div class="tabs" role="tablist" aria-label="${T("Career details")}">${CTABS.map(([k, l]) => `<button type="button" role="tab" data-ctab="${k}" aria-selected="${tab === k}">${T(l)}</button>`).join("")}</div>
    <div class="stack" role="tabpanel">${body}</div>`;
}
// Careers sorted into four plain zones by where jobs are heading (demand outlook) and how much of the
// work AI can already do (ILO exposure: high or very high counts as "more AI"). Each career is a card.
const ZONES = [
  ["grow", "Grow here", "More or steady demand · AI does less of the work"],
  ["change", "Changing with AI", "More or steady demand · AI does more of the work"],
  ["steady", "Steady", "Fewer openings · AI does less of the work"],
  ["shrink", "Shrinking", "Fewer openings · AI does more of the work"],
];
// Career icons: line drawings in the same 24px stroke style as the nav icons (no emoji).
const TAG_ICON = [
  ["farming", '<path d="M12 21v-9"/><path d="M12 12c0-4 3-6.5 7-6.5 0 4-3 6.5-7 6.5zM12 14.5c0-3-2.3-5-5.5-5 0 3 2.3 5 5.5 5z"/><path d="M6 21h12"/>'],
  ["health", '<path d="M6 4v5a4 4 0 0 0 8 0V4"/><path d="M10 13v2.5a4.5 4.5 0 0 0 9 0V13"/><circle cx="19" cy="11" r="2"/>'],
  ["science", '<path d="M9.5 3h5M10 3v6L4.8 18.2A1.9 1.9 0 0 0 6.5 21h11a1.9 1.9 0 0 0 1.7-2.8L14 9V3"/><path d="M7.5 15h9"/>'],
  ["making", '<path d="M14.5 6.5a4 4 0 0 1 5-5l-2.8 2.8.7 2.3 2.3.7 2.8-2.8a4 4 0 0 1-5 5L8 19a2.1 2.1 0 0 1-3-3z"/>'],
  ["energy", '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"/>'],
  ["environment", '<path d="M5 19c0-8 5-13 15-14-.5 10-5.5 15-13 15z"/><path d="M5 19c3-3.5 6-6 9.5-8"/>'],
  ["data", '<path d="M4 4v16h16"/><path d="M8 16v-4M12 16V8M16 16v-6"/>'],
  ["tech", '<rect x="3" y="4.5" width="18" height="12" rx="1.5"/><path d="M8 20.5h8M12 16.5v4"/>'],
  ["creative", '<path d="M12 3a9 9 0 1 0 0 18c1.4 0 2-1 1.4-2.2-.7-1.3.2-2.8 1.7-2.8H18a3 3 0 0 0 3-3c0-5.5-4-10-9-10z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7" r="1"/><circle cx="14.5" cy="7" r="1"/>'],
  ["people", '<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9.5h8M8 12.5h5"/>'],
  ["organising", '<path d="M3 6.5A1.5 1.5 0 0 1 4.5 5H9l2 2.5h8.5A1.5 1.5 0 0 1 21 9v9.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5z"/>'],
  ["hands-on", '<path d="M3 21l7.5-7.5M8 16l-3-3 4.5-4.5 3 3"/><path d="M14 4l6 6-3 3-6-6z"/><path d="M15 11l5 5"/>'],
];
const CASE_PATH = '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5h6v2M3 13h18"/>';
const careerIcon = (id) => { const tags = roleOf(id).tags || []; const p = (TAG_ICON.find(([t]) => tags.includes(t)) || [, CASE_PATH])[1];
  return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`; };
const zoneOf = (x) => {
  const e = roleOf(x.role).exposure, moreAI = e ? expBand(e) >= 2 : false, up = x.components.outlook >= 0.5;
  return up ? (moreAI ? "change" : "grow") : (moreAI ? "shrink" : "steady");
};
// "Where your careers sit" as a slideshow: one slide per zone, then the map. Arrows, the ← → keys or a
// swipe move between slides; tapping a career shows it in the detail card (or makes it the team target).
const slideKey = () => (isTeamUser() && st.page === "dashboard" ? "teamSlide" : "slide");
function zoneCard(x, team, mine) {
  const me = x.role === mine, sel = !team && x.role === st.open;
  return `<button type="button" class="zone-card ${x.rank <= 6 ? "top" : ""} ${me ? "mine" : ""} ${sel ? "sel" : ""}" data-mapdot="${x.role}" ${team ? 'data-mapkind="team"' : ""}>
    <span class="z-icon" aria-hidden="true">${careerIcon(x.role)}</span>
    <span class="z-text"><b>${esc(roleOf(x.role).title)}</b><span class="z-meta"><span class="tiny muted">${esc(T("#{rank} · fit {score}", { rank: x.rank, score: Math.round(x.score) }))}</span>${team ? "" : (() => { const g = sdgImpact(x.role).goals; return `<span class="z-sdg" title="${esc(T("Serves UN goals: {list}", { list: g.map((n) => "SDG " + n).join(", ") }))}">${g.map((n) => `<i class="${n === 7 ? "y" : ""}" style="background:${SDG_COL[n]}">${n}</i>`).join("")}</span>`; })()}</span></span>
    ${me ? `<span class="z-tag">${T(team ? "Target" : "My career")}</span>` : ""}</button>`;
}
function dotsSvg(list, team, mine, W) {
  const plain = simple(), narrow = W < 560, H = narrow ? 310 : 340, L = 34, R = 10, Tp = narrow ? 46 : 28, B = 34;
  const pts = list.map((x) => ({ x: roleOf(x.role).exposure.mean, y: x.components.outlook, r: x }));
  const ymin = Math.min(0.45, ...pts.map((p) => p.y)) - 0.03, ymax = Math.max(0.55, ...pts.map((p) => p.y)) + 0.03;
  const xs = (v) => L + (v - 0.1) / 0.6 * (W - L - R), ys = (v) => Tp + (1 - (v - ymin) / (ymax - ymin)) * (H - Tp - B);
  const name = (x) => esc(T("#{rank} {career}", { rank: x.rank, career: roleOf(x.role).title }));
  let s = `<svg viewBox="0 0 ${W} ${H}" role="group" aria-label="${T("Careers by AI exposure and demand")}"><rect x="${L}" y="${Tp}" width="${W - L - R}" height="${H - Tp - B}" rx="8" fill="var(--chip)"/>`;
  s += `<line x1="${L}" x2="${W - R}" y1="${ys(0.5)}" y2="${ys(0.5)}" stroke="var(--line)" stroke-dasharray="4 4"/><text x="${W - R - 6}" y="${ys(0.5) - 5}" font-size="10" text-anchor="end" fill="var(--muted)">${T(plain ? "jobs steady" : "flat demand")}</text>`;
  s += `<text x="${L}" y="${narrow ? 16 : Tp - 10}" font-size="11" font-weight="600" fill="var(--good)">↖ ${T("Safer: growing, less AI")}</text><text x="${W - R}" y="${Tp - 10}" font-size="11" font-weight="600" text-anchor="end" fill="var(--bad)">${T("Riskier: shrinking, more AI")} ↘</text>`;
  if (plain) s += `<text x="${L}" y="${H - B + 16}" font-size="10" fill="var(--muted)">${T("Less AI")}</text><text x="${W - R}" y="${H - B + 16}" font-size="10" text-anchor="end" fill="var(--muted)">${T("More AI")}</text>`;
  else [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7].forEach((v) => { s += `<text x="${xs(v)}" y="${H - B + 16}" font-size="10" text-anchor="middle" fill="var(--muted)">${v.toFixed(1)}</text>`; });
  s += `<text x="${(L + W) / 2}" y="${H - 4}" font-size="11" text-anchor="middle" fill="var(--muted)">${T(plain ? "How much of the work AI can do →" : "AI exposure →")}</text><text x="12" y="${(Tp + H - B) / 2}" font-size="11" text-anchor="middle" fill="var(--muted)" transform="rotate(-90 12 ${(Tp + H - B) / 2})">${T(plain ? "More jobs →" : "Demand →")}</text>`;
  pts.slice().reverse().forEach((p) => {
    const top = p.r.rank <= 6, me = p.r.role === mine, sel = !team && p.r.role === st.open, cx = xs(p.x), cy = ys(p.y), rad = top ? 11 : 6;
    s += `<g class="map-dot ${sel ? "sel" : ""}" data-mapdot="${p.r.role}" ${team ? 'data-mapkind="team"' : ""} role="button" tabindex="0" aria-label="${name(p.r)}"><title>${name(p.r)}</title>
      <circle cx="${cx}" cy="${cy}" r="${rad + 7}" fill="transparent"/>${me ? `<circle cx="${cx}" cy="${cy}" r="${rad + 4}" fill="none" stroke="var(--ink)" stroke-width="1.8"/>` : ""}
      <circle class="dot" cx="${cx}" cy="${cy}" r="${rad}" fill="${top ? "var(--accent)" : "var(--surface)"}" stroke="var(--accent)" stroke-width="1.8"/>${top ? `<text x="${cx}" y="${cy + 4}" font-size="11" font-weight="700" text-anchor="middle" fill="var(--accent-ink)" pointer-events="none">${p.r.rank}</text>` : ""}</g>`;
  });
  const others = list.length - Math.min(6, list.length);
  return `${s}</svg><p class="tiny muted map-legend"><span><span class="dot-f" aria-hidden="true"></span>${T(team ? "Numbered: the group's top 6 careers" : "Numbered: your top 6 matches, same numbers as the ranks in the cards")}</span>${others > 0 ? `<span><span class="dot-o" aria-hidden="true"></span>${esc(T("Hollow: the other {n} careers", { n: others }))}</span>` : ""}${mine ? `<span><span class="dot-r" aria-hidden="true"></span>${T(team ? "Ringed: the target career" : "Ringed: your career")}</span>` : ""}</p>`;
}
function vCareerMap(list, opts = {}) {
  if (!list.length) return "";
  const team = opts.kind === "team", mine = team ? opts.mine : A().role, key = team ? "teamSlide" : "slide", n = ZONES.length + 1;
  if (st[key] == null) {  // start on the slide that holds the selected career
    const x = list.find((y) => y.role === (team ? mine : st.open || mine));
    st[key] = x ? ZONES.findIndex((z) => z[0] === zoneOf(x)) : 0;
  }
  const i = Math.min(n - 1, Math.max(0, st[key])), dir = st.slideDir || 0; st.slideDir = 0;
  const appW = (($("#app") || document.body).clientWidth || 360), W = Math.round(Math.max(300, wide() && !team ? (appW - 20) / 2 - 44 : appW - (team ? 96 : 48)));
  let name, sub, body;
  if (i < ZONES.length) {
    const [id, zn, zs] = ZONES[i], items = list.filter((x) => zoneOf(x) === id).sort((a, b) => a.rank - b.rank);
    name = T(zn); sub = T(zs);
    body = `<div class="zone zone-${id} slide-zone"><div class="zone-cards">${items.length ? items.map((x) => zoneCard(x, team, mine)).join("") : `<p class="tiny muted">${T("No careers here right now.")}</p>`}</div></div>
      <p class="tiny muted">${T(team ? "Number = the group's rank; fit is the group's average out of 100. Estimates, not predictions." : "Number = your rank; fit is out of 100. Your top 6 are highlighted. Estimates, not predictions.")}</p>`;
  } else {
    name = T("Map"); sub = T("Left means AI can do less of the work; higher means more job posts want its skills.");
    body = dotsSvg(list, team, mine, W);
  }
  const counts = ZONES.map(([id]) => list.filter((x) => zoneOf(x) === id).length);
  return `<section class="card stack career-map slides" aria-roledescription="${T("carousel")}" aria-label="${T(team ? "Where careers sit for your group" : "Where your careers sit")}">
    <div class="row" style="gap:6px"><h3>${T(team ? "Where careers sit for your group" : "Where your careers sit")}</h3>${info("exposure")}</div>
    <div class="slide-bar">
      <button type="button" class="deck-arrow" id="slidePrev" aria-label="${T("Previous")}" ${i === 0 ? "disabled" : ""}>←</button>
      <div class="slide-title ${i < ZONES.length ? "zt-" + ZONES[i][0] : ""}"><b>${esc(name)}</b><span class="tiny muted">${esc(sub)}</span></div>
      <span class="small muted nowrap">${i + 1} / ${n}</span>
      <button type="button" class="deck-arrow" id="slideNext" aria-label="${T("Next")}" ${i === n - 1 ? "disabled" : ""}>→</button>
    </div>
    <div class="slide-body ${dir > 0 ? "in-next" : dir < 0 ? "in-prev" : ""}" aria-live="polite">${body}</div>
    <div class="slide-dots">${ZONES.map(([, zn], k) => `<button type="button" data-slide="${k}" class="${k === i ? "on" : ""}" aria-label="${esc(T(zn))}" title="${esc(T(zn))}"><span>${counts[k]}</span></button>`).join("")}<button type="button" data-slide="${ZONES.length}" class="${i === ZONES.length ? "on" : ""}" aria-label="${T("Map")}" title="${T("Map")}"><span>◎</span></button></div>
    <p class="tiny muted slide-hint">${T(team ? "Use ← → to move between zones and the map. Tap a career to make it the target." : (wide() ? "Use ← → to move between zones and the map. Tap a career to see it on the right." : "Swipe or use the arrows to move between zones and the map. Tap a career to see it below."))}</p>
  </section>`;
}
function slideMove(step, to) {
  const key = slideKey(), n = ZONES.length + 1, cur = st[key] || 0, j = to != null ? to : Math.min(n - 1, Math.max(0, cur + step));
  if (j === cur) return;
  st.slideDir = j > cur ? 1 : -1; st[key] = j; render();
}
// The selected career in full, next to the slides. The dropdown reaches any career.
function careerHead(x) {
  const r = roleOf(x.role), mine = A().role === x.role, local = st.analysis.local_demand[`${x.role}@0`];
  const first = rankDelta(x.role) || (local ? `<span class="badge good" title="${esc(TS(st.analysis.local_demand_source))}">${esc(T("In demand in {country}", { country: countryName() }))}</span>` : "");
  return `<div class="deck-head">
      <div class="ring" style="--p:${Math.round(x.score)}" role="img" aria-label="${esc(T("Rank {n}", { n: x.rank }) + " · " + T("Fit {n} of 100", { n: Math.round(x.score) }))}"><span>${Math.round(x.score)}</span></div>
      <div class="stack" style="gap:6px;min-width:0">
        <span class="eyebrow">${esc(T("Rank {n}", { n: x.rank }))} · ${esc(scenLabel(st.scen))}</span>
        <h3>${esc(r.title)} ${simple() ? `<span class="badge accent">${fitLabel(x.score)}</span>` : ""}</h3>
        <div class="ladder">${r.ladder.map((s2, k) => `${k ? '<span class="arrow">→</span>' : ""}<span>${esc(s2.title)}</span>`).join("")}</div>
        <div class="row" style="gap:6px">${first}${expBadge(r.exposure)}</div>
      </div>
      <div class="deck-choose">${mine ? `<span class="chosen">✓ ${T("My career")}</span>` : `<button class="btn primary" type="button" data-choose="${x.role}">${T("Choose")}</button>`}</div>
    </div>`;
}
function vCareerDetailCard(all) {
  const x = all.find((y) => y.role === st.open) || all.find((y) => y.role === A().role) || all[0];
  st.open = x.role;
  return `<section class="card stack deck-card detail-side" id="careerDeck" aria-live="polite" data-row="${x.role}">
    <select id="careerPick" aria-label="${T("See any career")}">${all.map((y) => `<option value="${y.role}" ${y.role === x.role ? "selected" : ""}>${esc(T("#{rank} {career}", { rank: y.rank, career: roleOf(y.role).title }))} · ${Math.round(y.score)}</option>`).join("")}</select>
    ${careerHead(x)}
    ${vCareerDetail(x, false)}
  </section>`;
}
// AI impact in plain words. The ILO numbers stay one tap away under "How we know".
function aiCard(e, compact) {
  if (!e) return `<p class="small muted">${T("No AI score for this job yet.")}</p>`;
  const b = expBand(e), word = T(EXP_BANDS[b][1]), g = expGrad(e);
  const plain = T(g === "4" ? "AI can already do most of the daily tasks in this job." : g === "3" ? "AI can do many of the daily tasks in this job." : g === "2" ? "AI can do some tasks in this job." : "AI can do only a few tasks in this job.");
  const task = (e.most_exposed_task && e.most_exposed_task.task || "").replace(/[;.\s]+$/, "");
  const short = task.length > 120 ? task.slice(0, 117).replace(/\s+\S*$/, "") + "…" : task;
  return `<div class="ai-card ai-${EXP_BANDS[b][0]}">
    <div class="ai-head"><span class="ai-dots" aria-hidden="true">${[0, 1, 2, 3].map((i) => `<i class="${i <= b ? "on" : ""}"></i>`).join("")}</span><b>${esc(word)}</b>${compact ? "" : `<span class="small muted">${T("AI impact")}</span>`}</div>
    <p class="small">${esc(plain)}</p>
    ${compact ? "" : `${short ? `<p class="small"><span class="muted">${T("Most affected task:")}</span> ${esc(short[0].toUpperCase() + short.slice(1))}</p>` : ""}
    <p class="small muted">${T("This means the job will change, not that it disappears. People who use AI tools well stay valuable.")}</p>
    <details class="ai-how"><summary class="small">${T("How we know")}</summary><p class="tiny muted">${esc(T("ILO task score {score} of 1 · {category}. From ILO Working Paper 140 (2025), which scores how much generative AI can do in each task of a job.", { score: e.mean.toFixed(2), category: e.category }))}</p></details>`}
  </div>`;
}
function vSkillMoves() {
  const sig = st.analysis.signals;
  const ids = Object.keys(sig).filter((k) => sig[k].demand_change != null).sort((a, b) => sig[b].demand_change - sig[a].demand_change);
  if (simple()) {
    return `<div class="card stack"><div class="row" style="gap:6px"><h3>${T("Skills on the rise")}</h3>${info("demand")}</div>
      <ul class="small plain">${ids.slice(0, 4).map((k) => `<li class="up">▲ ${esc(cl(k).label)}</li>`).join("")}</ul>
      <h3 style="margin-top:6px">${T("Skills cooling down")}</h3><ul class="small plain">${ids.slice(-3).map((k) => `<li class="down">▼ ${esc(cl(k).label)}</li>`).join("")}</ul></div>`;
  }
  return `<div class="card stack"><div class="row" style="gap:6px"><h3>${T("Skills moving in job posts")}</h3>${info("demand")}</div>
    <div class="list">${ids.slice(0, 4).map((k) => `<div><span>${esc(cl(k).label)}</span><span class="mono up">${demandText(sig[k].demand_change)}</span></div>`).join("")}${ids.slice(-2).map((k) => `<div><span>${esc(cl(k).label)}</span><span class="mono down">${demandText(sig[k].demand_change)}</span></div>`).join("")}</div>
    <p class="tiny muted">${esc(st.advice ? TS(st.advice.trend_note) : "")}</p></div>`;
}

// ---------- news ----------------------------------------------------------------------------
// Real headlines (Hacker News, titles and links only) plus our own trend signals, in one feed.
// The career filter keeps items that touch that career's skills; the summary covers what is shown.
function loadNews() {
  if (st.news || st.busy.news) return;
  st.busy.news = true;
  api("/api/news").then((d) => { st.news = d; }).catch((e) => { st.news = { items: [], topics: [], error: e.message }; })
    .finally(() => { st.busy.news = false; render(); });
}
const reqOf = (id) => new Set(roleOf(id).req.map((x) => x.cluster));
const NEWS_KINDS = [["all", "Everything"], ["headline", "Headlines only"], ["signal", "Trend signals only"]];
function signalItems() {
  const out = [], s = snap(), day = s ? s.as_of : "";
  if (st.updates) {
    st.updates.moved.forEach((x) => out.push({ kind: "signal", id: "m-" + x.cluster, clusters: [x.cluster], date: day, up: x.after > x.before,
      title: T(x.after > x.before ? "{skill}: more job posts want it since the last check" : "{skill}: fewer job posts want it since the last check", { skill: cl(x.cluster).label }),
      detail: `${demandText(x.before)} → ${demandText(x.after)}` }));
    st.updates.new_tech.forEach((x) => out.push({ kind: "signal", id: "t-" + x.cluster + x.term, clusters: [x.cluster], date: day, up: true,
      title: T("Rising tool for {skill}: {tool}", { skill: cl(x.cluster).label, tool: x.term }), detail: T("Mentioned more often in job posts") }));
  }
  const sig = st.analysis ? st.analysis.signals : {};
  Object.keys(sig).filter((k) => sig[k].demand_change != null && Math.abs(sig[k].demand_change) >= 0.15)
    .sort((a, b) => Math.abs(sig[b].demand_change) - Math.abs(sig[a].demand_change)).slice(0, 10)
    .forEach((k) => out.push({ kind: "signal", id: "d-" + k, clusters: [k], date: day, up: sig[k].demand_change > 0,
      title: T(sig[k].demand_change > 0 ? "Job posts asking for {skill} are up" : "Job posts asking for {skill} are down", { skill: cl(k).label }),
      detail: T("{change} over three months of job posts", { change: demandText(sig[k].demand_change) }) }));
  return out;
}
const NEWS_SORTS = [["new", "Newest first"], ["talk", "Most discussed"], ["points", "Most points"]];
function newsFeed() {
  const f = st.newsF || (st.newsF = { role: "", kind: "all", topic: "", q: "", sort: "new" });
  const heads = ((st.news && st.news.items) || []).map((x) => ({ ...x, kind: "headline" }));
  let all = f.kind === "signal" ? [] : heads;
  if (f.kind !== "headline") all = all.concat(signalItems());
  if (f.role) { const need = reqOf(f.role); all = all.filter((x) => x.clusters.some((c) => need.has(c))); }
  if (f.topic) all = all.filter((x) => x.kind === "headline" && x.topics.includes(f.topic));
  const q = norm(f.q || "");
  if (q) all = all.filter((x) => norm([x.title, x.site || "", ...(x.topics || []).map(topicName)].join(" ")).includes(q));
  const by = { new: (a, b) => (b.date || "").localeCompare(a.date || "") || (b.points || 0) - (a.points || 0),
    talk: (a, b) => (b.comments || 0) - (a.comments || 0), points: (a, b) => (b.points || 0) - (a.points || 0) }[f.sort || "new"];
  return all.sort(by);
}
const topicName = (id) => { const t = ((st.news && st.news.topics) || []).find((x) => x.id === id); return t ? T(t.label) : id; };
// A cover drawn in the app's style when an article has no preview image: one colour per topic,
// a few circles and stripes placed from the headline id, so each card looks different but calm.
const TOPIC_HUE = { work: 230, aiwork: 265, skills: 190, remote: 160, data: 205, software: 245, security: 0, marketing: 330, design: 300,
  office: 35, finance: 140, service: 25, health: 350, biotech: 120, farming: 95, industry: 20, energy: 50, leaders: 215 };
function newsCover(x) {
  let h = 0; for (const ch of x.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const hue = TOPIC_HUE[x.topics[0]] ?? 230, tall = [150, 190, 230][h % 3], r = (k) => ((h >>> k) % 100) / 100;
  const c1 = `hsl(${hue} 70% 62%)`, c2 = `hsl(${hue} 45% 22%)`;
  return `<svg class="news-cover" viewBox="0 0 320 ${tall}" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <rect width="320" height="${tall}" fill="${c2}"/>
    <circle cx="${60 + r(3) * 200}" cy="${tall * (0.3 + r(7) * 0.5)}" r="${50 + r(11) * 50}" fill="${c1}" opacity=".85"/>
    <circle cx="${40 + r(5) * 240}" cy="${tall * r(9)}" r="${18 + r(13) * 26}" fill="none" stroke="${c1}" stroke-width="2"/>
    ${[0, 1, 2, 3, 4].map((k) => `<line x1="${200 + k * 12}" y1="0" x2="${120 + k * 12}" y2="${tall}" stroke="hsl(${hue} 70% 80%)" stroke-opacity=".25" stroke-width="5"/>`).join("")}</svg>`;
}
function newsCard(x) {
  if (x.kind === "signal") return `<article class="news-card signal ${x.up ? "up" : "down"}">
      <div class="news-body"><span class="eyebrow">${T("Our trend signal")}</span>
      <h3>${x.up ? "▲" : "▼"} ${esc(x.title)}</h3><p class="small muted">${esc(x.detail)}</p>
      <div class="src-row">${trendChip()}</div></div></article>`;
  return `<article class="news-card" id="news-${esc(x.id)}">
      <a class="news-media" href="${esc(x.url)}" target="_blank" rel="noopener" tabindex="-1" aria-hidden="true">
        ${x.image ? `<img src="${esc(x.image)}" alt="" loading="lazy" referrerpolicy="no-referrer" data-cover="${esc(x.id)}">` : newsCover(x)}
        <span class="news-pill">${esc(topicName(x.topics[0]))}</span></a>
      <div class="news-body">
        <h3><a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.title)}</a></h3>
        <p class="tiny muted">${esc(x.site)}</p>
        <div class="news-meta"><span class="pill">${esc(fmtDate(x.date))}</span><span class="pill" title="${esc(T("{n} points", { n: x.points }))}">▲ ${x.points}</span>
          <a class="pill" href="${esc(x.hn_url)}" target="_blank" rel="noopener" title="${esc(T(x.comments === 1 ? "1 comment on Hacker News" : "{n} comments on Hacker News", { n: x.comments }))}">💬 ${x.comments}</a>
          ${x.topics.slice(1, 3).map((t) => `<span class="pill">${esc(topicName(t))}</span>`).join("")}</div>
      </div></article>`;
}
function vNewsResults() {
  const items = newsFeed(), heads = items.filter((x) => x.kind === "headline"), sigs = items.filter((x) => x.kind === "signal");
  const shown = st.newsMore || 18;
  return `<div class="row between news-count"><span class="small muted">${esc(T(Math.min(shown, heads.length) === 1 ? "Showing 1 headline" : "Showing {n} headlines", { n: Math.min(shown, heads.length) }))}${sigs.length ? " · " + esc(T(sigs.length === 1 ? "1 trend signal" : "{n} trend signals", { n: sigs.length })) : ""}</span><b class="small">${esc(T(items.length === 1 ? "1 result" : "{n} results", { n: items.length }))}</b></div>
  ${heads.length ? `<div class="news-masonry">${heads.slice(0, shown).map(newsCard).join("")}</div>` : ""}
  ${heads.length > shown ? `<div class="row" style="justify-content:center"><button class="btn" type="button" id="newsMore">${esc(T("Show more headlines ({n} left)", { n: heads.length - shown }))}</button></div>` : ""}
  ${sigs.length ? `<section class="stack news-signals"><div class="row" style="gap:6px"><h3>${T("Our trend signals")}</h3>${info("demand")}</div><div class="sig-strip">${sigs.map(newsCard).join("")}</div></section>` : ""}
  ${!items.length ? `<p class="note small">${T("No news for this filter yet. Try All careers or another topic.")}</p>` : ""}`;
}
function vNews() {
  if (!st.news) { loadNews(); return skeleton(4, T("Collecting this week's work news…")); }
  if (!st.analysis && A().onboarded && !isTeamUser()) refresh({});
  const f = st.newsF || (st.newsF = { role: "", kind: "all", topic: "", q: "", sort: "new" }), n = st.news, sum = st.newsSum;
  const heads = newsFeed().filter((x) => x.kind === "headline");
  const roles = st.meta.roles.slice().sort((a, b) => a.title.localeCompare(b.title)), mine = A().role;
  const sel = (id, label, opts, val) => `<label class="news-sel"><span class="sr-only">${T(label)}</span><select id="${id}">${opts.map(([v, l]) => `<option value="${esc(v)}" ${v === val ? "selected" : ""}>${esc(l)}</option>`).join("")}</select></label>`;
  return `<div class="page news-page">
  ${intro(T("News"), T("Work news and trends"), esc(T("Headlines about jobs and work from the last {days} days, with our own trend signals. Tap a headline to read it at the source.", { days: n.days || 45 })))}
  <div class="news-bar">
    <label class="news-search"><span aria-hidden="true">⌕</span><span class="sr-only">${T("Search news")}</span><input id="newsQ" type="search" value="${esc(f.q || "")}" placeholder="${T("Search headlines, sites or topics…")}" autocomplete="off"></label>
    ${sel("newsRole", "Show news for", [["", T("All careers")]].concat(mine ? [[mine, T("My career: {role}", { role: roleOf(mine).title })]] : [], roles.filter((r) => r.id !== mine).map((r) => [r.id, r.title])), f.role)}
    ${sel("newsKind", "Kind of news", NEWS_KINDS.map(([k, l]) => [k, T(l)]), f.kind)}
    ${sel("newsTopic", "Topic", [["", T("All topics")]].concat(n.topics.filter((t) => n.items.some((x) => x.topics.includes(t.id))).map((t) => [t.id, T(t.label)])), f.topic)}
    ${sel("newsSort", "Sort", NEWS_SORTS.map(([k, l]) => [k, T(l)]), f.sort || "new")}
  </div>
  <section class="card stack news-sum">
    <div class="row between"><div class="stack" style="gap:2px"><h3>${T("Quick summary")}</h3><p class="tiny muted">${T("Made from the headlines shown below, not the full articles.")}</p></div>
      <button class="btn primary" type="button" id="newsSumBtn" ${st.busy.newsSum || !heads.length ? "disabled" : ""}>${st.busy.newsSum ? `<span class="spin"></span> ${T("Writing…")}` : T(sum ? "Summarise again" : "Summarise with AI")}</button></div>
    ${sum ? `<ul class="news-points">${sum.points.map((p) => `<li>${esc(p.topic ? T(p.n === 1 ? "1 headline about {topic}" : "{n} headlines about {topic}", { n: p.n, topic: topicName(p.topic) }) : p.text)}${p.refs.length ? `<span class="refs">${p.refs.map((r) => { const it = (st.news.items || []).find((y) => y.id === sum.ids[r - 1]); return it ? `<a href="${esc(it.url)}" target="_blank" rel="noopener" title="${esc(it.title)}">${r}</a>` : ""; }).join("")}</span>` : ""}</li>`).join("")}</ul>
      <p class="tiny muted">${sum.method === "llm" ? esc(T("Written by {model} from the headline titles; numbers checked. Check it before you act on it.", { model: sum.model })) : T("A simple count of the headlines by topic.")}${sum.note ? " " + esc(T("The AI model was not used this time.")) : ""}</p>` : ""}
  </section>
  ${n.error && !n.items.length ? `<p class="note warn small">${T("Headlines could not be fetched right now. Our trend signals still show below.")}</p>` : ""}
  <div id="newsResults" class="stack">${vNewsResults()}</div>
  <p class="tiny muted">${esc(T("Headlines: {source}. Titles, links and each site's own preview image only; we do not copy articles. Hacker News leans toward tech, so some fields have few headlines. Trend signals: our job-post counts.", { source: n.source ? n.source.name : "Hacker News" }))}</p>
  </div>`;
}
async function summariseNews() {
  const f = st.newsF || {}, heads = newsFeed().filter((x) => x.kind === "headline").slice(0, 20);
  st.busy.newsSum = true; render();
  try {
    st.newsSum = await api("/api/news/summary", { ids: heads.map((x) => x.id), lang: LANG, focus: f.role ? roleOf(f.role).title : "", use_model: !!st.meta.llm.available });
  } catch (e) { toast(T("Could not summarise: {e}", { e: e.message })); }
  st.busy.newsSum = false; render();
}
// Headlines for Home's Updates: the user's career first, then the most discussed.
function homeHeadlines(k) {
  const items = (st.news && st.news.items) || [], need = A().role ? reqOf(A().role) : new Set();
  const mine = items.filter((x) => x.clusters.some((c) => need.has(c)));
  const others = items.filter((x) => !mine.includes(x)).sort((a, b) => b.points - a.points);
  return mine.slice(0, k).concat(others).slice(0, k);
}

// ---------- how the score is calculated ------------------------------------------------------
// The same arithmetic as engine.evaluate: each part (0–100%) times its weight in this future,
// divided by the sum of the positive weights; AI exposure is subtracted; the total is kept in 0–100.
const CALC_PARTS = [["skill", "Skill match", "Share of this career's entry skills you already have, by level."],
  ["outlook", "Demand outlook", "Whether job posts asking for its skills are rising (50% = flat)."],
  ["transfer", "Transferable skills", "Share of its people skills (communication, teamwork…) you already have."],
  ["interest", "Interest fit", "How many of the career's themes match what you enjoy."],
  ["green", "Green economy", "Counts only in the Green transition future, for low-carbon careers."],
  ["exposure", "AI exposure", "ILO score for how much of the work AI can already do. It is taken away."]];
function vScoreCalc(x) {
  const w = st.meta.scenarios[st.scen].weights, pos = Object.keys(w).filter((k) => k !== "exposure").reduce((a, k) => a + w[k], 0);
  const rows = CALC_PARTS.filter(([k]) => k !== "green" || w.green);
  const raw = rows.reduce((a, [k]) => a + x.points[k], 0);
  return `<details class="calc" ${st.calcOpen ? "open" : ""}><summary>${T("Show how the score is calculated")}</summary>
    <p class="small muted">${esc(T("Each part is scored from 0 to 100%. It is multiplied by its weight in the {scenario} future and divided by {sum} (the total of the positive weights). AI exposure is subtracted. The result is kept between 0 and 100.", { scenario: scenLabel(st.scen), sum: pos.toFixed(2) }))}</p>
    <div class="tablewrap"><table class="calc-table"><thead><tr><th>${T("Part")}</th><th>${T("Your value")}</th><th>${T("Weight")}</th><th>${T("Points")}</th></tr></thead><tbody>
      ${rows.map(([k, l, d]) => `<tr><td><b>${T(l)}</b><span class="tiny muted">${T(d)}</span></td><td class="mono">${Math.round(x.components[k] * 100)}%</td><td class="mono">${k === "exposure" ? "−" : "×"} ${w[k].toFixed(2)}</td><td class="mono ${k === "exposure" ? "down" : ""}">${k === "exposure" ? "" : "+"}${x.points[k].toFixed(1)}</td></tr>`).join("")}
    </tbody><tfoot><tr><td colspan="3"><b>${T("Fit score")}</b>${raw < 0 || raw > 100 ? ` <span class="tiny muted">${T("(kept between 0 and 100)")}</span>` : ""}</td><td class="mono"><b>${Math.round(x.score)}</b></td></tr></tfoot></table></div>
    <p class="tiny muted">${esc(T("Example: {part} {value}% × {weight} ÷ {sum} × 100 = {points} points.", { part: T("Skill match"), value: Math.round(x.components.skill * 100), weight: w.skill.toFixed(2), sum: pos.toFixed(2), points: x.points.skill.toFixed(1) }))}</p>
  </details>`;
}

// ---------- what it takes ---------------------------------------------------------------------
const whatKey = (role) => `${role}@${st.scen}@${P().budget}`;
function loadWhatIf(role) {
  const key = whatKey(role); st.whatif = st.whatif || {};
  if (st.whatif[key] || st.busy["wi_" + key]) return;
  st.busy["wi_" + key] = true;
  api("/api/whatif", { ...profileBody(), role, scenario: st.scen }).then((r) => { st.whatif[key] = r; })
    .catch((e) => { st.whatif[key] = { error: e.message }; }).finally(() => { st.busy["wi_" + key] = false; render(); });
}
const HELD = { outlook: "demand for its skills", transfer: "the people skills you already have", interest: "what you enjoy", green: "the green-economy bonus", exposure: "AI exposure" };
// One checklist of every entry skill the career asks for: what you have, and for each missing
// skill the level to reach, its course hours and the fit points it adds, in the order to learn them.
function vSkillsTab(x) {
  const r = roleOf(x.role), title = r.title, w = (st.whatif || {})[whatKey(x.role)];
  if (!w) loadWhatIf(x.role);
  const steps = w && !w.error ? w.steps : [], order = Object.fromEntries(steps.map((s2, i) => [s2.cluster, { ...s2, n: i + 1 }]));
  const have = r.req.filter((q) => (skillsNow()[q.cluster] || 0) >= q.level), miss = r.req.filter((q) => (skillsNow()[q.cluster] || 0) < q.level)
    .sort((a2, b2) => ((order[a2.cluster] || {}).n || 99) - ((order[b2.cluster] || {}).n || 99));
  const summary = !miss.length
    ? `<p class="sk-sum done">${esc(T("You have every entry skill for {role}. What is left is real work experience.", { role: title }))}</p>`
    : w && !w.error
      ? `<div class="sk-sum"><p>${esc(T(miss.length === 1 ? "Learn this 1 skill, about {hours} h of courses." : "Learn these {n} skills, about {hours} h of courses.", { n: miss.length, hours: w.hours }))}</p>
          <div class="sk-move"><span><small>${T("Fit")}</small><b>${Math.round(w.start.score)}</b></span><i aria-hidden="true">→</i><span class="on"><small>${T("Fit")}</small><b>${Math.round(w.end.score)}</b></span>
          <span><small>${T("Rank")}</small><b>#${w.start.rank}</b></span><i aria-hidden="true">→</i><span class="on"><small>${T("Rank")}</small><b>#${w.end.rank}</b></span></div></div>`
      : `<p class="small muted"><span class="spin"></span> ${T("Working out what it takes…")}</p>`;
  const row = (q, ok) => { const o = order[q.cluster], own = skillsNow()[q.cluster] || 0;
    return `<li class="sk-row ${ok ? "ok" : ""}"><span class="sk-mark" aria-hidden="true">${ok ? "✓" : o ? o.n : "·"}</span>
      <div class="stack" style="gap:2px;min-width:0"><b>${esc(cl(q.cluster).label)}</b><span class="tiny muted">${ok ? esc(T("You have it: {level}", { level: lv(own) })) : `${lv(own)} → ${lv(q.level)}${o ? " · " + (o.hours ? esc(T("{n} h", { n: o.hours })) : T("practise at work")) : ""}`}</span></div>
      ${!ok && o ? `<span class="sk-gain mono small">+${o.gain.toFixed(1)}</span>` : ""}</li>`; };
  return `${summary}
    ${miss.length ? `<span class="label">${T("To learn, in this order")}</span><ol class="sk-list">${miss.map((q) => row(q, false)).join("")}</ol>` : ""}
    ${have.length ? `<span class="label">${T("Already have")}</span><ul class="sk-list">${have.map((q) => row(q, true)).join("")}</ul>` : ""}
    ${w && w.held_back ? `<p class="note small">${esc(T("Even with every skill, {other} stays ahead of {role} because of {part}. Learning can't change that part, so weigh it when you choose.", { other: roleOf(w.held_back.by).title, role: title, part: T(HELD[w.held_back.part]) }))}</p>` : ""}
    <p class="tiny muted">${T("The order gives the most fit points per hour of study. +points = how much each skill adds to your fit score. An estimate, not a promise.")}</p>
    <div class="src-row">${escoChip(r.esco.uri)}</div>`;
}
function vNextSkills() {
  const role = A().role; if (!role) return "";
  const w = (st.whatif || {})[whatKey(role)];
  if (!w) { loadWhatIf(role); return `<section class="card stack"><h3>${T("Best next skills for your time")}</h3><p class="small muted"><span class="spin"></span> ${T("Working out what it takes…")}</p></section>`; }
  if (w.error || !w.next || !w.next.length) return "";
  const max = Math.max(...w.next.map((n) => n.per_hour || 0), 0.01);
  return `<section class="card stack next-skills"><div class="row between"><h3>${T("Best next skills for your time")}</h3><span class="tiny muted">${T("fit points per hour of study")}</span></div>
    <div class="ns-list">${w.next.slice(0, 5).map((n) => `<div class="ns-row"><div class="stack" style="gap:2px;min-width:0"><b>${esc(cl(n.cluster).label)}</b><span class="tiny muted">${lv(n.from)} → ${lv(n.to)} · ${n.hours ? esc(T("{n} h", { n: n.hours })) : T("practise at work")}</span></div>
      <span class="track"><span class="fill" style="display:block;width:${n.per_hour ? Math.round(n.per_hour / max * 100) : 0}%"></span></span>
      <span class="mono small">+${n.gain.toFixed(1)}${n.per_hour ? ` <span class="muted">(${n.per_hour.toFixed(1)}/h)</span>` : ""}</span></div>`).join("")}</div>
    <p class="tiny muted">${T("Each skill on its own: how many fit points it adds to your career and how long its checked course takes.")}</p></section>`;
}

// ---------- task X-ray ------------------------------------------------------------------------
const BAND_LABEL = { ai: "AI can do much of this", help: "AI can help with this", human: "Mostly human work" };
function loadXray(isco) {
  st.xray = st.xray || {};
  if (st.xray[isco] || st.busy["xr_" + isco]) return;
  st.busy["xr_" + isco] = true;
  api(`/api/tasks/${isco}`).then((r) => { st.xray[isco] = r; }).catch((e) => { st.xray[isco] = { error: e.message }; })
    .finally(() => { st.busy["xr_" + isco] = false; render(); });
}
async function taskTip(i) {
  const x = st.xray[st.xrayIsco], t = x.tasks[i], k = st.xrayIsco + ":" + i; st.tips = st.tips || {};
  st.busy["tip_" + k] = true; render();
  try { st.tips[k] = await api("/api/tasks/tip", { task: t.task, band: t.band, job: x.title, lang: LANG }); }
  catch (e) { st.tips[k] = { ok: false, note: e.message }; }
  st.busy["tip_" + k] = false; render();
}
function vXray() {
  const cur = P().current, mine = roleOf(A().role), careerIsco = mine.exposure && mine.exposure.isco;
  const which = st.xrayWhich || (cur && cur.isco ? "current" : "career");
  const isco = which === "current" ? cur && cur.isco : careerIsco;
  st.xrayIsco = isco;
  const tabs = `<div class="seg" role="group" aria-label="${T("Whose tasks")}"><button type="button" data-xray="current" aria-pressed="${which === "current"}">${T("My current job")}</button><button type="button" data-xray="career" aria-pressed="${which === "career"}">${T("My chosen career")}</button></div>`;
  const head = `<div class="row between"><div class="stack" style="gap:2px"><span class="eyebrow">${T("Task X-ray")}</span><h3>${T("Which daily tasks AI can do, and where you stay ahead")}</h3></div>${tabs}</div>`;
  if (!isco) return `<section class="card stack xray">${head}<p class="small">${T("Add your current job in About you to see its tasks.")}</p><div class="row"><button type="button" class="btn" data-page="wizard">${T("Edit about you")}</button></div></section>`;
  const x = (st.xray || {})[isco];
  if (!x) { loadXray(isco); return `<section class="card stack xray">${head}<p class="small muted"><span class="spin"></span> ${T("Reading the ILO task list…")}</p></section>`; }
  if (x.error) return `<section class="card stack xray">${head}<p class="small muted">${T("The ILO has no task scores for this job yet.")}</p></section>`;
  const n = x.tasks.length, all = st.xrayAll, shown = all ? x.tasks : x.tasks.slice(0, 6);
  return `<section class="card stack xray">${head}
    <p class="small">${esc(T("{job}: {n} tasks scored by the ILO. Average exposure {mean}.", { job: which === "current" ? cur.title : mine.title, n, mean: x.mean.toFixed(2) }))}</p>
    <div class="xr-bar" role="img" aria-label="${esc(x.bands.map((b) => `${T(b.label)}: ${x.counts[b.id]}`).join(", "))}">${x.bands.map((b) => x.counts[b.id] ? `<span class="xr-${b.id}" style="flex:${x.counts[b.id]}"><b>${x.counts[b.id]}</b></span>` : "").join("")}</div>
    <div class="xr-legend tiny">${x.bands.map((b) => `<span><i class="xr-${b.id}"></i>${T(b.label)}</span>`).join("")}</div>
    <ol class="xr-list">${shown.map((t, i) => { const k = isco + ":" + i, tip = (st.tips || {})[k];
      const head = i === 0 || shown[i - 1].band !== t.band  // tasks are sorted by score, so each band is one run
        ? `<li class="xr-band xr-b-${t.band}"><i class="xr-${t.band}" aria-hidden="true"></i><b>${T(BAND_LABEL[t.band])}</b><span class="tiny muted">${esc(T(x.counts[t.band] === 1 ? "1 task" : "{n} tasks", { n: x.counts[t.band] }))}</span></li>` : "";
      return `${head}<li class="xr-task xr-t-${t.band}"><div class="xr-score"><span class="mono">${t.score.toFixed(2)}</span><span class="track"><span class="fill" style="display:block;width:${Math.round(t.score * 100)}%"></span></span></div>
        <div class="stack" style="gap:6px;min-width:0"><span>${esc(t.task)}</span>
          <div class="row" style="gap:6px">${t.band === "ai" ? `<span class="small">${T("Let AI tools do the routine part, then check it yourself:")}</span> <span class="badge accent">${esc(cl("genai").label)}</span>`
            : t.skills.length ? `<span class="small">${T(t.band === "human" ? "Your human edge:" : "Keep the human part sharp:")}</span> ${t.skills.map((c) => `<span class="badge">${esc(cl(c).label)}</span>`).join("")}` : ""}
            <button type="button" class="btn ghost xr-tip-btn" data-tip="${i}" ${st.busy["tip_" + k] || !st.meta.llm.available ? "disabled" : ""}>${st.busy["tip_" + k] ? `<span class="spin"></span>` : "✦"} ${T("Ask AI for a tip")}</button></div>
          ${tip ? tip.ok ? `<p class="small xr-tip">${esc(tip.tip)} <span class="tiny muted">${esc(T("AI tip ({model}). Check before you act.", { model: tip.model }))}</span></p>` : `<p class="tiny muted">${esc(TS(tip.note))}</p>` : ""}</div></li>`; }).join("")}</ol>
    ${n > 6 ? `<div class="row"><button type="button" class="btn ghost" data-xrayall>${esc(T(all ? "Show fewer" : "Show all {n} tasks", { n }))}</button></div>` : ""}
    <p class="tiny muted">${T("Task scores: ILO Working Paper 140 (2025), CC BY 4.0. The three bands and the linked skills are this app's reading of those scores.")}</p>
    <div class="src-row">${iloChip()}</div></section>`;
}

// ---------- job check -------------------------------------------------------------------------
// Sample ads for trying the page. Invented for this demo: no real employer, salary or link.
const SAMPLE_ADS = [
  ["Junior data analyst", `Junior Data Analyst (Kuala Lumpur)
We are a mid-sized logistics company looking for a junior data analyst to join our operations team.
What you will do:
- Write SQL queries to pull delivery and warehouse data
- Build weekly dashboards in Power BI for the operations managers
- Clean and check data in Excel before it is reported
- Present findings to team leads and suggest improvements
What we look for:
- Strong analytical thinking and attention to detail
- Good communication with non-technical colleagues
- Experience with Python is a plus
- Comfortable using AI tools such as ChatGPT or Copilot to speed up routine work`],
  ["Medical lab assistant", `Medical Laboratory Assistant (Penang)
A private hospital laboratory is hiring a medical laboratory assistant.
Responsibilities:
- Receive, label and prepare patient specimens for testing
- Follow laboratory safety and quality control procedures
- Keep accurate records in the laboratory information system
- Support patients and nurses with sample collection questions
Requirements:
- Diploma in medical laboratory technology or related field
- Careful, organised and good at record keeping
- Basic spreadsheet skills
- Good communication in Malay and English`],
  ["Digital marketing executive", `Digital Marketing Executive (Singapore, hybrid)
A growing online retailer is looking for a digital marketing executive.
You will:
- Plan and run social media campaigns and paid ads
- Track results with Google Analytics and report on what works
- Write product descriptions, emails and blog posts
- Create simple visuals in Canva or Figma
- Work with the sales team and outside agencies
You have:
- Experience in SEO and growth marketing
- Strong copywriting skills
- Data-driven mindset; Excel skills are a must
- Bonus: experience using generative AI tools for content`],
];
function jcState() { return st.jc || (st.jc = { text: "", url: "", busy: false, res: null, note: "" }); }
async function runJobCheck() {
  const j = jcState(); if (j.busy || (!j.text.trim() && !j.url.trim())) return;
  j.busy = true; j.note = ""; render();
  try {
    const r = await api("/api/jobcheck", { text: j.text, url: j.text.trim() ? "" : j.url, skills: skillsNow(), budget: P().budget || "free", use_model: !!st.meta.llm.available });
    if (r.ok) j.res = r; else { j.res = null; j.note = r.note; }
  } catch (e) { j.note = T("Could not check the job: {e}", { e: e.message }); }
  j.busy = false; render();
  const out = document.getElementById("jcResult"); if (out) out.scrollIntoView({ block: "start" });
}
// The gaps become a track the person can tick off, with the checked course for each.
function jobTrack(r) {
  const gaps = r.asks.filter((a) => a.status !== "have"), id = "job-" + Date.now().toString(36), title = r.title || T("This job");
  return { id, title: T("Get ready for: {job}", { job: title }).slice(0, 80), about: T("Built from a job ad you checked."), job: true, chapters: [
    { title: T("Close the gaps"), steps: gaps.map((a, i) => ({ id: "g" + i, title: T("Learn {skill} to {level}", { skill: cl(a.cluster).label, level: lv(a.need) }),
      why: T("The ad asks for it: “{quote}”", { quote: a.evidence }),
      how: a.course ? [T("Take {course} by {provider} ({hours} h).", { course: a.course.title, provider: a.course.provider, hours: a.course.hours })] : [T("No checked course yet. Practise it at work or in a small project.")],
      links: a.course && a.course.url ? [{ label: a.course.title, url: a.course.url }] : [] })) },
    { title: T("Apply"), steps: [
      { id: "cv", title: T("Tailor your resume to this ad"), why: T("Using the ad's own words helps you pass the first screening."), how: [T("Put the skills you already have from this ad at the top."), T("Add one line of proof for each.")] },
      { id: "send", title: T("Apply and follow up"), why: T("A polite follow-up after a week keeps you in mind."), how: [T("Send the application with a two-line note on why you fit."), T("Follow up after about a week.")] }] }] };
}
function vJobCheck() {
  const j = jcState(), r = j.res;
  const group = (st2, label) => { const xs = r.asks.filter((a) => a.status === st2); return xs.length ? `<div class="jc-group jc-${st2}"><span class="label">${T(label)} · ${xs.length}</span>${xs.map((a) => `<div class="jc-ask">
      <div class="stack" style="gap:3px;min-width:0"><b>${esc(cl(a.cluster).label)}</b><span class="tiny muted">“${esc(a.evidence)}”</span></div>
      <div class="jc-lv"><span class="small">${a.status === "have" ? `${lv(a.have)} ✓` : `${lv(a.have)} → ${lv(a.need)}`}</span>${a.hours ? `<span class="tiny muted">${esc(T("{n} h course", { n: a.hours }))}</span>` : ""}</div></div>`).join("")}</div>` : ""; };
  return `<div class="page">
  ${intro(T("Job check"), T("Check a real job ad against your skills"), T("Paste a job ad (or a link to one). We find the skills it asks for and show what you already have and what is missing. The ad is not saved."))}
  <section class="card stack jc-form">
    <div class="row jc-samples" style="gap:6px"><span class="small muted">${T("No ad at hand? Try a sample:")}</span>${SAMPLE_ADS.map(([l], i) => `<button type="button" class="chip" data-sample="${i}">${esc(T(l))}</button>`).join("")}</div>
    <label class="field"><span class="label">${T("The job ad")}</span><div class="with-mic"><textarea id="jobText" rows="7" maxlength="20000" placeholder="${T("Paste the full ad text here…")}">${esc(j.text)}</textarea>${micBtn("jobText")}</div></label>
    <label class="field"><span class="label">${T("Or a link to the ad")}</span><input id="jobUrl" type="url" maxlength="600" value="${esc(j.url)}" placeholder="https://"></label>
    <p class="tiny muted">${T("Many job sites block automatic reading. If the link doesn't work, paste the text instead.")}</p>
    <div class="row"><button type="button" class="btn primary" id="jcRun" ${j.busy ? "disabled" : ""}>${j.busy ? `<span class="spin"></span> ${T("Checking…")}` : T("Check this job")}</button></div>
    ${j.note ? `<p class="note warn small">${esc(TS(j.note))}</p>` : ""}
  </section>
  ${r ? `<section class="card stack jc-result" id="jcResult">${j.sample ? `<p class="note small">${T("Sample ad made up for this demo. No real employer.")}</p>` : ""}
    <div class="jc-top">${progressGeo(r.fit || 0, T("You have {pct}% of what this ad asks", { pct: r.fit || 0 }))}
      <div class="stack" style="gap:6px;min-width:0"><span class="eyebrow">${T("Your match for this ad")}</span><h3>${esc(r.title || T("This job"))}</h3>
        <p class="small">${esc(T("It asks for {n} skills from our list. You have {have}; {miss} need work, about {hours} h of checked courses.", { n: r.asks.length, have: r.asks.filter((a) => a.status === "have").length, miss: r.asks.filter((a) => a.status !== "have").length, hours: r.hours }))}</p>
        ${r.close.length ? `<div class="row" style="gap:6px"><span class="small muted">${T("Closest careers in this app:")}</span>${r.close.map((c) => `<button type="button" class="chip" data-see="${c.role}">${esc(roleOf(c.role).title)}</button>`).join("")}</div>` : ""}</div></div>
    ${r.asks.length ? group("missing", "Missing") + group("part", "Part way") + group("have", "You have") : `<p class="small muted">${T("We couldn't match this ad to skills in our list. It may be for a field we don't cover yet.")}</p>`}
    ${r.asks.some((a) => a.status !== "have") ? `<div class="row"><button type="button" class="btn primary" data-jctrack>＋ ${T("Turn the gaps into a track")}</button><button type="button" class="btn ghost" data-page="resume">${T("Open my resume")}</button></div>` : ""}
    <p class="tiny muted">${esc(r.method === "keywords" ? T("Skills found by keyword matching.") : T("Skills found by {model} and checked against the ad's own words.", { model: r.model }))} ${T("Levels are estimates from the ad's wording.")}</p>
  </section>` : ""}
  </div>`;
}

// ---------- voice input -----------------------------------------------------------------------
// Speak instead of typing: the browser's speech service turns speech into text in the chosen language.
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
const SPEECH_LANG = { en: "en-MY", ms: "ms-MY", zh: "zh-CN" };
const MIC = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>';
let rec = null, recTarget = null;
const micBtn = (target) => SR ? `<button type="button" class="mic-btn" data-mic="${target}" aria-pressed="${recTarget === target}" aria-label="${T("Speak instead of typing")}" title="${T("Speak instead of typing. Your browser turns speech into text; in Chrome and Edge this uses an online speech service.")}">${MIC}</button>` : "";
function toggleMic(target) {
  if (rec) { const same = recTarget === target; rec.stop(); if (same) return; }
  const el = document.getElementById(target); if (!el || !SR) return;
  rec = new SR(); rec.lang = SPEECH_LANG[LANG] || "en-MY"; rec.interimResults = true; rec.continuous = false; recTarget = target;
  const base = el.value ? el.value.replace(/\s+$/, "") + " " : "";
  rec.onresult = (e) => { let t = ""; for (const r of e.results) t += r[0].transcript; const box = document.getElementById(target) || el; box.value = base + t; box.dispatchEvent(new Event("input", { bubbles: true })); };
  rec.onerror = (e) => { if (e.error !== "aborted" && e.error !== "no-speech") toast(T(e.error === "not-allowed" ? "Allow the microphone to speak instead of typing." : "Speech input stopped: {e}", { e: e.error })); };
  rec.onend = () => { rec = null; recTarget = null; document.querySelectorAll("[data-mic]").forEach((b) => b.setAttribute("aria-pressed", "false")); };
  try { rec.start(); document.querySelectorAll(`[data-mic="${target}"]`).forEach((b) => b.setAttribute("aria-pressed", "true")); } catch (e) { rec = null; recTarget = null; }
}

// ---------- Update button ----------------------------------------------------------------------
// Asks the server to fetch new job posts, research counts and headlines (at most every 15 minutes),
// shows each step while it runs, then reloads everything that depends on the data.
const UPD_STEPS = { start: "Starting…", jobs: "Reading job posts…", research: "Counting research papers…", news: "Collecting work headlines…", saving: "Saving and re-scoring…" };
const upd = { running: false, step: null, snap: null, msg: "", timer: 0 };
function agoText(iso) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  return s < 90 ? T("just now") : s < 5400 ? T("{n} min ago", { n: Math.round(s / 60) }) : s < 129600 ? T("{n} h ago", { n: Math.round(s / 3600) }) : fmtDate(iso.slice(0, 10));
}
function vUpdateBar() {
  const sn = upd.snap || (st.updates && st.updates.snapshot && { as_of: st.updates.snapshot.as_of, created_at: st.updates.snapshot.created_at });
  return `<div class="update-bar" id="updateBar" aria-live="polite">
    <span class="live-dot ${upd.running ? "busy" : ""}" aria-hidden="true"></span>
    <span class="small">${upd.running ? esc(T(UPD_STEPS[upd.step] || UPD_STEPS.start)) : upd.msg ? esc(upd.msg) : sn ? esc(T("Job data from {date}", { date: fmtDate(sn.as_of) })) + (sn.created_at ? ` · <span class="muted">${esc(T("fetched {ago}", { ago: agoText(sn.created_at) }))}</span>` : "") : T("Live job data")}</span>
    <button type="button" class="btn ${upd.running ? "" : "primary"} upd-btn" id="updateBtn" ${upd.running ? "disabled" : ""}>${upd.running ? `<span class="spin"></span> ${T("Updating…")}` : "↻ " + T("Update data")}</button>
  </div>`;
}
function paintUpdateBar() { document.querySelectorAll("#updateBar").forEach((el) => { el.outerHTML = vUpdateBar(); }); }
async function reloadAfterUpdate() {
  const before = st.updates && st.updates.snapshot && st.updates.snapshot.id;
  try { st.updates = await api("/api/updates"); } catch (e) { /* keep the old brief */ }
  st.newsSum = null; st.whatif = {}; st.explain = {};
  await refresh({});  // re-scores careers, the path and the advice with the new snapshot
  try { st.news = await api("/api/news"); } catch (e) { st.news = null; }
  return st.updates && st.updates.snapshot && st.updates.snapshot.id !== before;
}
async function runUpdate() {
  if (upd.running) return;
  upd.msg = "";
  if (!st.news) { try { st.news = await api("/api/news"); } catch (e) { /* compare without headlines */ } }
  const before = updCapture();
  let r;
  try { r = await api("/api/refresh", {}); } catch (e) { toast(T("Could not update: {e}", { e: e.message })); return; }
  upd.snap = r.snapshot;
  if (!r.running) {  // fetched in the last 15 minutes: just bring this page up to date
    await reloadAfterUpdate(); upd.report = updDiff(before);
    upd.msg = T("Already up to date. Next fetch possible in {n} min.", { n: Math.max(1, Math.ceil(r.cooldown / 60)) });
    render(); return;
  }
  upd.running = true; upd.step = r.step; paintUpdateBar();
  clearInterval(upd.timer);
  upd.timer = setInterval(async () => {
    let s; try { s = await api("/api/refresh"); } catch (e) { return; }
    upd.step = s.step; upd.snap = s.snapshot;
    if (s.running) { paintUpdateBar(); return; }
    clearInterval(upd.timer); upd.running = false;
    if (s.error) { upd.msg = T("Update failed: {e}", { e: s.error }); render(); return; }
    await reloadAfterUpdate(); upd.report = updDiff(before);
    const n = updChanges();
    upd.msg = T(n ? "Updated just now: {n} changes since the last check." : "Updated just now. Nothing important changed.", { n });
    render(); toast(upd.msg);
  }, 2000);
}

// ---------- team members: a profile the manager keeps for each person ----------------------------
// Members do not sign in. The manager gives each person a job title, notes and (if needed) a different
// target career, then ticks path steps as the person completes them. Ticked skill steps raise that
// person's level everywhere (skills table, group plan). Kept on this device, like the team list.
const MEM_KEY = () => `wfe.members.${A().id}`;
function memAll() {
  if (!st.members || st.members.id !== A().id) {
    let d = {}; try { d = JSON.parse(localStorage.getItem(MEM_KEY()) || "{}"); } catch (e) { /* start empty */ }
    st.members = { id: A().id, d };
  }
  return st.members.d;
}
const memSave = () => { try { localStorage.setItem(MEM_KEY(), JSON.stringify(memAll())); } catch (e) { /* this visit only */ } };
function mem(i) { const all = memAll(), g = (all[st.team] = all[st.team] || {}); return (g[i] = g[i] || { title: "", notes: "", target: null, done: {} }); }
const memTarget = (i) => mem(i).target || st.teamTarget || teamData().target_role;
function achieved(i, base) { const s = { ...base }; Object.values(mem(i).done).forEach((x) => { if (x.cluster) s[x.cluster] = Math.max(s[x.cluster] || 0, x.to); }); return s; }
const teamPeople = () => teamData().people.map(([nm, sk], i) => [nm, achieved(i, sk)]);
const memDoneTotal = () => Object.values(memAll()[st.team] || {}).reduce((a, m) => a + Object.keys(m.done || {}).length, 0);
// typed-in list: removing a row shifts the profiles below it up by one
function memShift(from) { const g = memAll()[st.team]; if (!g) return; const n = {}; Object.entries(g).forEach(([k, v]) => { const i = +k; if (i < from) n[i] = v; else if (i > from) n[i - 1] = v; }); memAll()[st.team] = n; memSave(); }
// each person's path is built once from the levels they started with, so ticking steps does not reshuffle it
function memPathKey(i) { const m = mem(i); return [st.team, i, memTarget(i), st.scen, P().budget || "free"].join("|") + "|" + JSON.stringify(m.base || teamData().people[i][1]); }
function memPath(i) {
  st.memPaths = st.memPaths || {};
  const k = memPathKey(i), hit = st.memPaths[k];
  if (hit) return hit.data || null;
  const m = mem(i); if (!m.base) { m.base = { ...teamData().people[i][1] }; memSave(); }
  st.memPaths[k] = { busy: true };
  api("/api/pathway", { skills: m.base, interests: [], hours: P().hours || 5, country: P().country || "MY", budget: P().budget || "free", age_band: null, situation: null, role: memTarget(i), scenario: st.scen })
    .then((d) => { st.memPaths[k] = { data: d }; }).catch(() => { delete st.memPaths[k]; }).finally(() => { if (["people", "member", "teams"].includes(st.page)) render(); });
  return null;
}
const memNodes = (pw) => pw.stages.flatMap((s, si) => s.nodes.map((n) => ({ ...n, si, key: nodeKey(si, n), stage: s })));
function memProgress(i) {
  const pw = memPath(i); if (!pw) return null;
  const req = memNodes(pw).filter(required), d = mem(i).done;
  return { pw, req, n: req.filter((x) => d[x.key]).length, next: req.find((x) => !d[x.key]) || null };
}
function vTeamTabs() {
  const tab = (id) => `<button type="button" data-team="${id}" aria-pressed="${st.page !== "teams" && st.team === id}">${esc(teamName(id))}${isOwn(id) ? "" : ` <span class="tiny muted">${T("sample")}</span>`}</button>`;
  return `<div class="row between team-tabs-row"><div class="seg team-tabs" role="group" aria-label="${T("Teams")}"><button type="button" data-page="teams" aria-pressed="${st.page === "teams"}">${T("All teams")}</button>${allTeamIds().map(tab).join("")}</div>
    <div class="row">${ownTeam() ? `<button type="button" class="btn ghost small" id="teamEdit">${T("Edit this team")}</button>` : ""}<button type="button" class="btn small" id="teamNew">+ ${T("New team")}</button></div></div>`;
}
// One card per team: size, target, readiness, path progress and the gap most people share.
function teamRepFor(id) {
  st.allRep = st.allRep || {};
  const key = withTeam(id, teamKey), hit = st.allRep[key];
  if (hit) return hit.data || null;
  st.allRep[key] = { busy: true };
  const body = withTeam(id, () => ({ people: teamPeople(), target_role: st.teamTarget || teamData().target_role, budget: P().budget || "free" }));
  api("/api/team", body).then((d) => { st.allRep[key] = { data: d }; }).catch(() => { delete st.allRep[key]; }).finally(() => { if (st.page === "teams") render(); });
  return null;
}
function vTeams() {
  if (!isTeamUser()) { st.page = "dashboard"; return vDashboard(); }
  const cur = st.team;  // withTeam swaps st.team while each card is built
  const cards = allTeamIds().map((id) => withTeam(id, () => {
    const Tm = teamData(), target = st.teamTarget || Tm.target_role, rep = teamRepFor(id);
    const prs = Tm.people.map((_, i) => memProgress(i)), loaded = prs.every(Boolean);
    const doneN = loaded ? prs.reduce((a, x) => a + x.n, 0) : 0, totalN = loaded ? prs.reduce((a, x) => a + x.req.length, 0) : 0;
    const ppl = rep ? rep.people[st.scen] : [], avg = ppl.length ? ppl.reduce((a, x) => a + x.readiness, 0) / ppl.length : null, gap = rep && rep.plan.steps[0];
    return `<section class="card stack team-card ${cur === id ? "current" : ""}">
      <div class="row between" style="flex-wrap:nowrap"><h3>${esc(teamName(id))}</h3>${isOwn(id) ? "" : `<span class="badge">${T("sample")}</span>`}</div>
      <p class="small muted">${esc(T("{n} people · preparing for {role}", { n: Tm.people.length, role: roleOf(target).title }))}</p>
      <div class="list">
        <div><span>${T("Average readiness")}</span><span class="mono">${avg == null ? "…" : Math.round(avg * 100) + "%"}</span></div>
        <div><span>${T("Path steps done")}</span><span class="mono">${loaded ? `${doneN} / ${totalN}` : "…"}</span></div>
        <div><span>${T("Most shared gap")}</span><span class="small">${gap ? esc(T("{skill} ({n} of {total})", { skill: cl(gap.cluster).label, n: gap.n, total: Tm.people.length })) : rep ? T("None") : "…"}</span></div>
      </div>
      ${loaded && totalN ? `<span class="pc-prog"><span class="track"><span class="fill" style="display:block;width:${Math.round(doneN / totalN * 100)}%"></span></span></span>` : ""}
      <div class="row"><button type="button" class="btn small" data-goteam="${id}">${T("Open team")} →</button></div>
    </section>`;
  }));
  return `<div class="page">
  ${intro(T("For HR and career centres"), T("All teams"), esc(T("Every team you look after, side by side. Each team has its own people, target career and profiles.")))}
  ${vTeamTabs()}
  <div class="teams-grid">${cards.join("")}</div></div>`;
}
function vPeople() {
  if (!isTeamUser()) { st.page = "dashboard"; return vDashboard(); }
  const Tm = teamData(), rep = teamReady() ? st.teamReport.people[st.scen] : [];
  const ready = Object.fromEntries(rep.map((x) => [x.name, x.readiness]));
  return `<div class="page">
  ${intro(T("For HR and career centres"), T(isCohort() ? "Students" : "People"), esc(T("One profile for each person in {group}. Open a profile to set their job title and target, and tick path steps as they finish them. Profiles are kept on this device.", { group: TS(Tm.label) })))}
  ${vTeamTabs()}
  <div class="people-grid">${Tm.people.map(([nm], i) => {
    const m = mem(i), pr = memProgress(i), pct = pr && pr.req.length ? Math.round(pr.n / pr.req.length * 100) : 0;
    return `<button type="button" class="card person-card" data-member="${i}">
      <span class="row between" style="flex-wrap:nowrap"><b class="person-name">${esc(nm)}</b>${ready[nm] != null ? `<span class="mono small">${esc(T("{p}% ready", { p: Math.round(ready[nm] * 100) }))}</span>` : ""}</span>
      <span class="small muted">${esc(m.title || T("No job title yet"))}</span>
      <span class="small">${esc(T("Preparing for {role}", { role: roleOf(memTarget(i)).title }))}${m.target ? ` <span class="badge">${T("own target")}</span>` : ""}</span>
      ${pr ? `<span class="pc-prog"><span class="track"><span class="fill" style="display:block;width:${pct}%"></span></span><span class="small">${esc(T("{n} of {total} steps done", { n: pr.n, total: pr.req.length }))}</span></span>
        <span class="tiny muted">${esc(pr.next ? T("Next: {step}", { step: nodeLabel(pr.next) }) : T("Path complete"))}</span>` : `<span class="tiny muted"><span class="spin"></span> ${T("Building the path…")}</span>`}
    </button>`; }).join("")}</div></div>`;
}
function vMember() {
  const Tm = teamData(), i = st.member, p = Tm.people[i];
  if (!isTeamUser() || !p) { st.page = isTeamUser() ? "people" : "dashboard"; return VIEWS[st.page](); }
  const m = mem(i), target = memTarget(i), pr = memProgress(i), now = achieved(i, p[1]);
  const teamRole = st.teamTarget || Tm.target_role;
  const profile = `<section class="card stack member-profile">
      <div class="field"><label for="memTitle">${T("Job title now")}</label><input type="text" id="memTitle" data-memf="title" value="${esc(m.title)}" maxlength="60" placeholder="${esc(T("For example: Contact centre agent"))}"></div>
      <div class="field"><label for="memTarget">${T("Career to prepare for")}</label><select id="memTarget"><option value="">${esc(T("Team target: {role}", { role: roleOf(teamRole).title }))}</option>${st.meta.roles.filter((x) => x.id !== teamRole).map((x) => `<option value="${x.id}" ${m.target === x.id ? "selected" : ""}>${esc(x.title)}</option>`).join("")}</select></div>
      <div class="field"><label for="memNotes">${T("Manager notes")}</label><textarea id="memNotes" data-memf="notes" rows="4" maxlength="2000" placeholder="${esc(T("What you agreed in your last 1-to-1, support needed, dates…"))}">${esc(m.notes)}</textarea></div>
    </section>`;
  if (!pr) return `<div class="page">${intro(T("Team member"), p[0], esc(m.title || ""))}<div class="member-grid">${profile}<section class="card"><p class="small muted"><span class="spin"></span> ${T("Building the path…")}</p></section></div></div>`;
  const pct = pr.req.length ? Math.round(pr.n / pr.req.length * 100) : 100, nodes = memNodes(pr.pw);
  const gained = Object.keys(now).filter((k) => (now[k] || 0) > (p[1][k] || 0));
  const step = (n) => { const d = !!m.done[n.key], c = n.type === "skill" && n.items && n.items[0];
    return `<li class="mstep ${d ? "done" : ""} ${required(n) ? "" : "opt"}"><label class="check"><input type="checkbox" data-memdone="${esc(n.key)}" ${d ? "checked" : ""}>
      <span class="stack" style="gap:2px;min-width:0"><b>${esc(nodeLabel(n))}${required(n) ? "" : ` <span class="badge">${T("Optional")}</span>`}</b>
        ${n.type === "skill" ? `<span class="small muted">${esc(lv(n.from))} → ${esc(lv(n.to))}${c ? ` · <a href="${esc(c.url)}" target="_blank" rel="noopener">${esc(c.title)}</a> (${esc(c.provider)}, ${c.hours} h)` : ""}</span>` : n.type === "cert" && n.item ? `<span class="small muted">${esc(n.item.provider || "")}</span>` : ""}
        ${n.sdg && n.sdg.length ? `<span class="sdg-row">${n.sdg.slice(0, 3).map(sdgTag).join(" ")}</span>` : ""}</span></label></li>`; };
  return `<div class="page">
  ${intro(T("Team member"), p[0], esc([m.title, T("Preparing for {role}", { role: roleOf(target).title })].filter(Boolean).join(" · ")), `<button type="button" class="btn ghost" data-page="people">← ${T(isCohort() ? "All students" : "All people")}</button>`)}
  <div class="member-grid">
    <div class="stack">
      <section class="card member-top">${progressGeo(pct, T("{pct}% of the path done", { pct }))}
        <div class="stack" style="gap:6px;min-width:0"><span class="eyebrow">${T("Path progress")}</span><b>${esc(T("{n} of {total} steps done", { n: pr.n, total: pr.req.length }))}</b>
          <span class="small muted">${esc(pr.next ? T("Next: {step}", { step: nodeLabel(pr.next) }) : T("Path complete"))}</span>
          ${gained.length ? `<span class="small">${esc(T("Skills gained: {list}", { list: gained.map((k) => `${cl(k).label} (${lv(p[1][k] || 0)} → ${lv(now[k])})`).join(", ") }))}</span>` : ""}</div></section>
      ${profile}
    </div>
    <div class="stack">${pr.pw.stages.map((s, si) => { const ns = nodes.filter((n) => n.si === si), rq = ns.filter(required), dn = rq.filter((n) => m.done[n.key]).length;
      return `<section class="card stack mstage"><div class="row between"><div class="stack" style="gap:2px"><span class="eyebrow">${esc(TS(s.stage))}</span><h3>${esc(s.title)}</h3></div><span class="small mono">${dn}/${rq.length}</span></div>
        <ol class="msteps">${ns.map(step).join("")}</ol></section>`; }).join("")}
      <p class="tiny muted">${T("Ticking a skill step raises this person's level in the skills table and the group plan. For training plans only, never for selection.")}</p></div>
  </div></div>`;
}

// ---------- Updates page --------------------------------------------------------------------------
// One place for fresh data: the Update button, then what changed in each part of the plan. Before a
// fetch we note ranks, scores, step order and headlines; afterwards each section shows the difference.
function updCapture() {
  return { ranks: Object.fromEntries(rows().map((x) => [x.role, { rank: x.rank, score: x.score }])),
    order: st.path ? flatNodes().map((n) => n.key) : [], news: new Set(((st.news && st.news.items) || []).map((x) => x.url)) };
}
function updDiff(b) {
  const now = rows(), moves = now.map((x) => ({ role: x.role, rank: x.rank, was: b.ranks[x.role] ? b.ranks[x.role].rank : null, score: x.score, before: b.ranks[x.role] ? b.ranks[x.role].score : null }))
    .filter((x) => x.was != null && x.was !== x.rank).sort((p, q) => Math.abs(q.was - q.rank) - Math.abs(p.was - p.rank));
  const order = st.path ? flatNodes().map((n) => n.key) : [];
  const stepsMoved = order.filter((k, i) => b.order.indexOf(k) > i).length;
  const fresh = ((st.news && st.news.items) || []).filter((x) => !b.news.has(x.url));
  return { at: Date.now(), moves, mine: moves.find((x) => x.role === A().role) || null,
    myBefore: b.ranks[A().role] ? b.ranks[A().role].score : null, stepsMoved, fresh, newsBefore: b.news.size };
}
const updChanges = () => (st.updates ? st.updates.moved.length + st.updates.new_tech.length : 0) + (upd.report ? upd.report.moves.length + upd.report.stepsMoved + (upd.report.newsBefore ? upd.report.fresh.length : 0) : 0);
function vUpdates() {
  if (isTeamUser()) { st.page = "dashboard"; return vDashboard(); }
  if (!st.analysis || !st.path) { if (!st.busy.dash) { st.busy.dash = true; refresh({}).then(() => { st.busy.dash = false; }); } return skeleton(4); }
  loadNews();
  const up = st.updates, rp = upd.report, pw = st.path, r = roleOf(A().role), res = rows().find((x) => x.role === A().role);
  const tag = (n) => `<span class="badge ${n ? "accent" : ""}">${esc(n ? T(n === 1 ? "{n} change" : "{n} changes", { n }) : T("No changes"))}</span>`;
  const sec = (page, title, n, body, open) => `<section class="card stack upd-sec"><div class="row between"><div class="row" style="gap:8px"><span class="geo-mark">${GEO[page]}</span><h3>${esc(title)}</h3></div>${tag(n)}</div>${body}
    <div class="row"><button type="button" class="btn ghost small" data-page="${page}">${esc(T("Open {page}", { page: open || title }))} →</button></div></section>`;
  const moved = up ? up.moved : [], tech = up ? up.new_tech : [];
  const market = `<p class="small muted">${esc(up && up.previous ? T("Job posts to {date}, compared with the check before ({prev}).", { date: fmtDate(up.snapshot.as_of), prev: fmtDate(up.previous.as_of) }) : T("Job posts to {date}.", { date: fmtDate(pw.snapshot.as_of) }))}</p>
    ${moved.length ? `<div class="list">${moved.slice(0, 4).map((x) => `<div><span>${esc(cl(x.cluster).label)}</span><span class="mono ${x.after > x.before ? "up" : "down"}">${x.after > x.before ? "▲" : "▼"} ${demandText(x.before)} → ${demandText(x.after)}</span></div>`).join("")}</div>` : `<p class="small">${T("No skill moved much in job posts.")}</p>`}
    ${tech.length ? `<p class="small">${esc(T("Rising tools: {tools}", { tools: tech.slice(0, 5).map((x) => x.term).join(", ") }))}</p>` : ""}`;
  const mine = rp && rp.myBefore != null && res ? `<p class="upd-num"><b>${Math.round(rp.myBefore) === Math.round(res.score) ? Math.round(res.score) : `${Math.round(rp.myBefore)} → ${Math.round(res.score)}`}</b> <span class="small muted">${esc(T("fit for {role}", { role: r.title }))}</span></p>${rp.mine ? `<p class="small">${esc(T("Rank {was} → {now} among all careers.", { was: rp.mine.was, now: rp.mine.rank }))}</p>` : Math.round(rp.myBefore) === Math.round(res.score) ? `<p class="small">${T("Your fit did not change.")}</p>` : ""}`
    : `<p class="upd-num"><b>${res ? Math.round(res.score) : "—"}</b> <span class="small muted">${esc(T("fit for {role}", { role: r.title }))}</span></p><p class="small muted">${T("Press Update data to see how this moves.")}</p>`;
  const careers = rp ? (rp.moves.length ? `<div class="list">${rp.moves.slice(0, 5).map((x) => `<div><span>${esc(roleOf(x.role).title)}</span><span class="mono ${x.rank < x.was ? "up" : "down"}">${x.rank < x.was ? "▲" : "▼"} #${x.was} → #${x.rank}</span></div>`).join("")}</div>` : `<p class="small">${T("The career ranking did not change.")}</p>`)
    : `<div class="list">${rows().slice(0, 3).map((x) => `<div><span>#${x.rank} ${esc(roleOf(x.role).title)}</span><span class="mono">${Math.round(x.score)}</span></div>`).join("")}</div><p class="small muted">${T("Press Update data to see which careers move.")}</p>`;
  const pathTools = [...new Set(flatNodes().flatMap((n) => (n.new_tech || []).map((w) => w.term)))];
  const stepsN = rp ? rp.stepsMoved : pw.priorities_changed || 0;
  const path = `<p class="small">${esc(stepsN ? T("{n} step(s) moved because demand changed.", { n: stepsN }) : T("Your plan is still in the best order."))}</p>
    ${pathTools.length ? `<p class="small">${esc(T("Rising tools in your path: {tools}.", { tools: pathTools.slice(0, 4).join(", ") }))}</p>` : ""}`;
  const items = (st.news && st.news.items) || [], fresh = rp && rp.newsBefore ? rp.fresh : null;
  const news = !st.news ? `<p class="small muted">${T("Loading headlines…")}</p>`
    : `<p class="small">${esc(fresh ? (fresh.length ? T(fresh.length === 1 ? "1 new headline since your last update." : "{n} new headlines since your last update.", { n: fresh.length }) : T("No new headlines since your last update.")) : T("{n} headlines this month.", { n: items.length }))}</p>
      <ul class="small plain upd-heads">${(fresh && fresh.length ? fresh : items).slice(0, 3).map((x) => `<li><a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.title)}</a> <span class="tiny muted">${esc(x.site)}</span></li>`).join("")}</ul>`;
  return `<div class="page">
  ${intro(T("Updates"), T("What changed"), T("Fetch the newest job posts, research counts and headlines, then see what changed in each part of your plan."))}
  ${vUpdateBar()}
  <div class="upd-grid">
    ${sec("dashboard", T("Job market"), moved.length + tech.length, market, T("Home"))}
    ${sec("mycareer", T("My career"), rp && rp.myBefore != null && res && Math.round(rp.myBefore) !== Math.round(res.score) ? 1 : 0, mine)}
    ${sec("careers", T("Careers overview"), rp ? rp.moves.length : 0, careers)}
    ${sec("path", T("Path"), stepsN, path)}
    ${sec("news", T("News"), fresh ? fresh.length : 0, news)}
  </div></div>`;
}

// ---------- path ----------------------------------------------------------------------------
function nodeLabel(n) { return n.type === "skill" ? cl(n.cluster).label : n.type === "cert" ? n.item.title : n.type === "gate" ? T(simple() ? "Real work" : "Experience") : T("Ready to apply"); }
function nodeIcon(n, isDone) { return isDone ? I.check : { skill: I.book, cert: I.award, gate: I.flag, checkpoint: I.case }[n.type]; }
function vPath() {
  if (!A().role) return `<div class="page">${intro(T("My path"), T("Choose a career first"), "")}<button class="btn primary" type="button" data-page="careers">${T("Go to careers")}</button></div>`;
  if (!st.path || st.path.role !== A().role) { if (!st.busy.path) loadPath().then(render); return skeleton(3, T("Building your path…")); }
  const pw = st.path, nodes = flatNodes(), cur = currentNode();
  if (!st.sel || !nodes.find((n) => n.key === st.sel)) st.sel = cur ? cur.key : nodes[0].key;
  const peak = pw.stages[pw.stages.length - 1].title;
  const tab = st.pathTab && st.pathTab !== "basic" && myTracks().includes(st.pathTab) ? st.pathTab : "basic";
  const firstOpenKey = (nodes.find((x) => !done(x.key)) || {}).key;
  const oc = st.chOpen && st.chOpen.role === A().role ? st.chOpen : (st.chOpen = { role: A().role, open: { [cur ? cur.si : 0]: true } });
  const flagMoved = T(simple() ? "do sooner" : "priority ↑"), flagTool = T("new tool");
  const nodeBtn = (n, x, y) => {
    const isDone = done(n.key), cls = [isDone ? "done" : "", cur && n.key === cur.key ? "current" : "", n.type === "cert" && n.optional ? "optional" : "", n.key === st.sel ? "selected" : ""].join(" ");
    const flag = n.moved > 0 ? flagMoved : (n.new_tech && n.new_tech.length ? flagTool : "");
    const state = T(isDone ? "done" : cur && n.key === cur.key ? "next step" : n.type === "cert" && n.optional ? "optional" : "to do");
    return `<button type="button" class="node ${cls}" data-node="${esc(n.key)}" style="left:${x}%;top:${y}px" aria-label="${esc(T("{step}, {stage} stage, {state}", { step: nodeLabel(n), stage: TS(n.stage.stage), state }))}${flag && !isDone ? ", " + esc(flag) : ""}"><span class="disc">${nodeIcon(n, isDone)}${flag && !isDone ? `<span class="flag">${esc(flag)}</span>` : ""}</span><span class="cap">${esc(nodeLabel(n))}</span></button>`;
  };
  // One chapter: a folded header, and when open the road winding down through its steps.
  const chapter = (st2, si) => {
    const ns = nodes.filter((n) => n.si === si), pct = stagePct(si), open = !!oc.open[si], now = cur && cur.si === si;
    const req = ns.filter(required), doneN = req.filter((n) => done(n.key)).length, TOP = 56, STEP = 96;
    const pts = ns.map((n, i) => ({ n, x: 50 + 18 * Math.sin(i * 1.05), y: TOP + i * STEP }));
    const h = TOP + (ns.length - 1) * STEP + 80;
    const curve = (arr) => arr.map((q, i) => { if (!i) return `M ${q.x} ${q.y}`; const o = arr[i - 1], my = (o.y + q.y) / 2; return `C ${o.x} ${my} ${q.x} ${my} ${q.x} ${q.y}`; }).join(" ");
    const stop = pts.findIndex((q) => q.n.key === firstOpenKey), donePts = stop === -1 ? (pct === 100 ? pts : []) : pts.slice(0, stop + 1);
    const weeks = simple() ? T("About {weeks} weeks", { weeks: st2.weeks[1] }) : (st2.weeks[0] === st2.weeks[1] ? T("{hours} h · {weeks} wk", { hours: st2.hours, weeks: st2.weeks[1] }) : T("{hours} h · {from}–{to} wk", { hours: st2.hours, from: st2.weeks[0], to: st2.weeks[1] }));
    return `<section class="chapter ${open ? "open" : ""} ${now ? "now" : ""} ${pct === 100 ? "complete" : ""}">
      <button type="button" class="ch-head" data-chapter="${si}" aria-expanded="${open}">
        <span class="ch-num">${pct === 100 ? "✓" : si + 1}</span>
        <span class="ch-text"><span class="tiny muted">${esc(TS(st2.stage))}${now ? " · " + T("now") : ""}${st2.local_demand ? " · " + T("in demand") : ""}</span><b>${esc(st2.title)}</b></span>
        <span class="ch-prog"><span class="small">${esc(T("{done} of {total} done", { done: doneN, total: req.length }))}</span><span class="tiny muted">${esc(weeks)}</span><span class="track" role="img" aria-label="${esc(T("{pct}% done", { pct }))}"><span class="fill" style="display:block;width:${pct}%"></span></span></span>
        <span class="ch-chev" aria-hidden="true">${open ? "▴" : "▾"}</span></button>
      ${open ? `<div class="map ch-map" style="height:${h}px">
        <svg class="road" viewBox="0 0 100 ${h}" preserveAspectRatio="none" aria-hidden="true"><path d="${curve(pts)}" fill="none" stroke="var(--line)" stroke-width="10" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>${donePts.length > 1 ? `<path d="${curve(donePts)}" fill="none" stroke="var(--accent)" stroke-width="10" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" opacity=".35"/>` : ""}</svg>
        ${pts.map((q) => nodeBtn(q.n, q.x, q.y)).join("")}</div>` : ""}
    </section>`;
  };
  return `<div class="page">
  ${intro(T("My path"), T("Your path to {role}", { role: peak }), simple() ? T("Follow the road from the top. Tap a circle to see what to do. Dashed circles are optional.") : esc(T("Start as {role}. Steps are ordered by prerequisites and current demand. Paid certificates outside your budget are dashed and optional.", { role: pw.stages[0].title })), `<button class="btn" type="button" data-cal="toggle" aria-expanded="${calState().open}">📅 ${T("Add to my calendar")}</button>`)}
  ${vCalPanel()}
  ${vTrackTabs(tab)}
  ${tab !== "basic" ? vTrackBoard(trackOf(tab)) : `<div class="row between">
    <div class="legend" aria-label="${T("Legend")}"><span><i class="l-done"></i>${T("Done")}</span><span><i class="l-now"></i>${T("Next step")}</span><span><i></i>${T("To do")}</span><span><i class="l-opt"></i>${T("Optional")}</span><span><b class="flag-s">${esc(flagMoved)}</b>${T("Moved up today")}</span><span><b class="flag-s">${esc(flagTool)}</b>${T("Rising tool")}</span>${info("stage")}</div>
    <label class="small row" style="gap:6px">${T("Budget")} ${info("budget")}<select id="budgetPath">${country().budgets.map(([kk, v]) => `<option value="${kk}" ${P().budget === kk ? "selected" : ""}>${esc(TS(v))}</option>`).join("")}</select></label>
  </div>
  <div class="map-wrap"><div class="path-board">${pw.stages.map(chapter).join("")}</div>
    <div class="sheet ${st.sheetOpen ? "open" : ""}" role="region" aria-label="${T("Step details")}">${vNodeSheet(nodes.find((n) => n.key === st.sel))}</div></div>
  ${st.sheetOpen ? `<button type="button" class="scrim" data-closesheet aria-label="${T("Close step details")}"></button>` : ""}`}
  </div>`;
}
// ---------- action tracks ----------------------------------------------------------------------
// Practical tracks people add next to the basic learning path (LinkedIn, experience, networking,
// job hunting). Steps are habits, not courses; wording and examples follow the career family.
const TRACK_ICON = {
  linkedin: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c1-4.5 4.4-6.5 8-6.5s7 2 8 6.5"/></svg>',
  experience: I.case,
  network: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="8" cy="9" r="3"/><circle cx="17" cy="9" r="3"/><path d="M2.5 20c.8-3.4 3-5 5.5-5s4.7 1.6 5.5 5M12.5 16.2c1-.8 2.4-1.2 4.5-1.2 2.5 0 4.7 1.6 5.5 5"/></svg>',
  jobhunt: I.flag,
};
const trackOf = (id) => (st.meta.tracks.tracks || []).concat(A() ? A().prefs.customTracks || [] : []).find((t) => t.id === id);
const myTracks = () => (A().prefs.tracks || []).filter(trackOf);
const familyOf = (role) => Object.keys(st.meta.tracks.families).find((f) => st.meta.tracks.families[f].includes(role)) || "";
const tKey = (tid, sid) => `t:${tid}:${sid}`;
// {role} is the career being aimed for; {skills} names the first two skills on the path.
function tFill(s) {
  const skills = flatNodes().filter((n) => n.type === "skill").slice(0, 2).map((n) => cl(n.cluster).label).join(" · ");
  return T(s).replace(/\{role\}/g, roleOf(A().role).title).replace(/\{skills\}/g, skills);
}
function trackSteps(t) { return t.chapters.flatMap((c, ci) => c.steps.map((s) => ({ ...s, ci, key: tKey(t.id, s.id) }))); }
function trackPct(t) { const s = trackSteps(t); return s.length ? Math.round(s.filter((x) => done(x.key)).length / s.length * 100) : 0; }
// Custom tracks: the AI model drafts one from the person's own words; they preview it, ask for
// changes in a sentence, then add it. Stored with the account, next to the ready-made tracks.
const SPARK = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/></svg>';
const customTracks = () => A().prefs.customTracks || [];
const trackIcon = (t) => TRACK_ICON[t.id] || (t.job ? I.case : SPARK);
function aiState() { return st.aiT || (st.aiT = { open: false, goal: "", dir: "", change: "", busy: false, draft: null, model: "", note: "" }); }
async function draftAiTrack(withChange) {
  const a = aiState(); if (!a.goal.trim() || a.busy) return;
  a.busy = true; a.note = ""; render();
  try {
    const r = await api("/api/tracks/draft", { goal: a.goal, direction: a.dir, change: withChange ? a.change : "", previous: withChange ? a.draft : null,
      role: A().role, country: P().country, hours: P().hours, budget: P().budget, lang: LANG });
    if (r.ok) { a.draft = r.track; a.model = r.model; a.change = ""; } else a.note = r.note;
  } catch (e) { a.note = T("Could not draft the track: {e}", { e: e.message }); }
  a.busy = false; render();
  const box = document.querySelector(".ai-compose"); if (box) box.scrollIntoView({ block: "nearest" });
}
function vAiCompose() {
  const a = aiState(); if (!a.open) return "";
  const ready = st.meta.llm.available, d = a.draft;
  return `<section class="card stack ai-compose" aria-label="${T("Create a track with AI")}">
    <div class="row between"><div class="row" style="gap:10px"><span class="t-icon">${SPARK}</span><h3>${T("Create a track with AI")}</h3></div><button type="button" class="icon-btn" data-aiclose aria-label="${T("Close")}">✕</button></div>
    ${ready ? "" : `<p class="note warn small">${T("No AI model is connected, so custom tracks cannot be drafted right now.")}</p>`}
    <label class="field"><span class="label">${T("What do you want to do?")}</span><div class="with-mic"><textarea id="aiGoal" rows="2" maxlength="400" placeholder="${T("e.g. Start freelancing in digital marketing on weekends")}">${esc(a.goal)}</textarea>${micBtn("aiGoal")}</div></label>
    <label class="field"><span class="label">${T("Any direction? (optional)")}</span><input id="aiDir" maxlength="300" value="${esc(a.dir)}" placeholder="${T("e.g. 5 hours a week, stay in Penang, prefer online")}"></label>
    <div class="row"><button type="button" class="btn primary" data-aidraft="0" ${!ready || a.busy ? "disabled" : ""}>${a.busy && !d ? `<span class="spin"></span> ${T("Drafting…")}` : SPARK.replace('width="22" height="22"', 'width="16" height="16"') + " " + T(d ? "Draft again from scratch" : "Draft my track")}</button></div>
    ${a.note ? `<p class="note warn small">${esc(TS(a.note))}</p>` : ""}
    ${d ? `<div class="ai-preview stack">
      <div><span class="eyebrow">${T("Draft")}</span><h3>${esc(d.title)}</h3><p class="small muted">${esc(d.about)}</p></div>
      <ol class="ai-chapters">${d.chapters.map((c) => `<li><b>${esc(c.title)}</b><ul>${c.steps.map((s) => `<li><span>${esc(s.title)}</span><span class="tiny muted">${esc(s.why)}</span></li>`).join("")}</ul></li>`).join("")}</ol>
      <div class="ai-actions"><button type="button" class="btn primary" data-aiadd>＋ ${T("Add this track")}</button>
        <input id="aiChange" maxlength="300" value="${esc(a.change)}" placeholder="${T("Change something… e.g. fewer steps, more online")}">
        <button type="button" class="btn" data-aidraft="1" ${a.busy ? "disabled" : ""}>${a.busy ? `<span class="spin"></span> ${T("Redoing…")}` : T("Redo with this change")}</button>
        <button type="button" class="btn ghost" data-aidiscard>${T("Discard")}</button></div>
      <p class="tiny muted">${esc(T("Made by {model} from your words. Links are suggested by the AI and not checked by us. Check before you act.", { model: a.model }))}</p></div>` : ""}
  </section>`;
}
function vTrackBoard(t) {
  const steps = trackSteps(t), next = steps.find((x) => !done(x.key));
  const op = (st.tOpen = st.tOpen || {})[t.id] || (st.tOpen[t.id] = { [next ? next.ci : 0]: true });
  if (!st.tsel || !steps.find((x) => x.key === st.tsel)) st.tsel = (next || steps[0]).key;
  const chapter = (c, ci) => {
    const ns = steps.filter((x) => x.ci === ci), doneN = ns.filter((x) => done(x.key)).length, pct = Math.round(doneN / ns.length * 100), open = !!op[ci], now = next && next.ci === ci;
    const TOP = 56, STEP = 96, pts = ns.map((n, i) => ({ n, x: 50 + 18 * Math.sin(i * 1.05), y: TOP + i * STEP })), h = TOP + (ns.length - 1) * STEP + 80;
    const curve = (arr) => arr.map((q, i) => { if (!i) return `M ${q.x} ${q.y}`; const o = arr[i - 1], my = (o.y + q.y) / 2; return `C ${o.x} ${my} ${q.x} ${my} ${q.x} ${q.y}`; }).join(" ");
    const stop = pts.findIndex((q) => !done(q.n.key)), donePts = stop === -1 ? pts : pts.slice(0, stop + 1);
    return `<section class="chapter ${open ? "open" : ""} ${now ? "now" : ""} ${pct === 100 ? "complete" : ""}">
      <button type="button" class="ch-head" data-tchapter="${ci}" aria-expanded="${open}">
        <span class="ch-num">${pct === 100 ? "✓" : ci + 1}</span>
        <span class="ch-text"><span class="tiny muted">${esc(T(t.title))}${now ? " · " + T("now") : ""}</span><b>${esc(T(c.title))}</b></span>
        <span class="ch-prog"><span class="small">${esc(T("{done} of {total} done", { done: doneN, total: ns.length }))}</span><span class="track" role="img" aria-label="${esc(T("{pct}% done", { pct }))}"><span class="fill" style="display:block;width:${pct}%"></span></span></span>
        <span class="ch-chev" aria-hidden="true">${open ? "▴" : "▾"}</span></button>
      ${open ? `<div class="map ch-map" style="height:${h}px">
        <svg class="road" viewBox="0 0 100 ${h}" preserveAspectRatio="none" aria-hidden="true"><path d="${curve(pts)}" fill="none" stroke="var(--line)" stroke-width="10" stroke-linecap="round" vector-effect="non-scaling-stroke"/>${donePts.length > 1 ? `<path d="${curve(donePts)}" fill="none" stroke="var(--accent)" stroke-width="10" stroke-linecap="round" vector-effect="non-scaling-stroke" opacity=".35"/>` : ""}</svg>
        ${pts.map((q) => { const isDone = done(q.n.key), cur = next && q.n.key === next.key;
          return `<button type="button" class="node ${isDone ? "done" : ""} ${cur ? "current" : ""} ${q.n.key === st.tsel ? "selected" : ""}" data-tnode="${esc(q.n.key)}" style="left:${q.x}%;top:${q.y}px" aria-label="${esc(tFill(q.n.title))}, ${esc(T(isDone ? "done" : cur ? "next step" : "to do"))}"><span class="disc">${isDone ? I.check : trackIcon(t)}</span><span class="cap">${esc(tFill(q.n.title))}</span></button>`; }).join("")}</div>` : ""}
    </section>`;
  };
  return `<div class="row between"><p class="small muted" style="margin:0">${esc(T(t.about))}</p><button type="button" class="btn ghost" data-rmtrack="${t.id}">${T("Remove this track")}</button></div>
  <div class="map-wrap"><div class="path-board">${t.chapters.map(chapter).join("")}</div>
    <div class="sheet ${st.sheetOpen ? "open" : ""}" role="region" aria-label="${T("Step details")}">${vTrackSheet(t, steps.find((x) => x.key === st.tsel))}</div></div>
  ${st.sheetOpen ? `<button type="button" class="scrim" data-closesheet aria-label="${T("Close step details")}"></button>` : ""}`;
}
function vTrackSheet(t, s) {
  if (!s) return "";
  const fam = familyOf(A().role), isDone = done(s.key), ex = s.examples && s.examples[fam];
  const links = (s.links || []).filter((l) => (!l.country || l.country === P().country) && (!l.family || l.family === fam));
  return `<div class="card stack"><div class="row between"><span class="eyebrow">${esc(T(t.title))} · ${esc(T(t.chapters[s.ci].title))}</span><button type="button" class="btn ghost sheet-close" data-closesheet aria-label="${T("Close")}">✕</button></div>
    <h3>${esc(tFill(s.title))}</h3>${t.ai && t.goal ? `<p class="tiny muted">${esc(T("Your goal: {goal}", { goal: t.goal }))}</p>` : ""}
    <p class="small"><b>${T("Why it helps:")}</b> ${esc(tFill(s.why))}</p>
    <div class="stack" style="gap:6px"><span class="label">${T("How to do it")}</span><ol class="small how">${s.how.map((h) => `<li>${esc(tFill(h))}</li>`).join("")}</ol></div>
    ${ex ? `<div class="note accent small"><b>${esc(T("For {role}:", { role: roleOf(A().role).title }))}</b> ${esc(tFill(ex))}</div>` : ""}
    ${links.length ? `<div class="stack" style="gap:4px"><span class="label">${T("Useful links")}</span>${links.map((l) => `<a class="small" href="${esc(l.url)}" target="_blank" rel="noopener nofollow">${esc(T(l.label))} ↗</a>${t.ai ? ` <span class="badge warn">${T("not checked by us")}</span>` : ""}`).join("")}</div>` : ""}
    ${t.ai ? `<p class="tiny muted">${SPARK.replace('width="22" height="22"', 'width="12" height="12"')} ${esc(T("Made by AI from your words. Check before you act."))}</p>` : ""}
    <button class="btn ${isDone ? "" : "primary"}" type="button" data-ttoggle="${esc(s.key)}">${T(isDone ? "Mark as not done" : "Mark as done")}</button></div>`;
}
function vTrackTabs(tab) {
  const mine = myTracks(), rest = (st.meta.tracks.tracks || []).filter((t) => !mine.includes(t.id));
  return `<div class="path-tabs" role="tablist" aria-label="${T("Paths")}">
    <button type="button" role="tab" data-ptab="basic" aria-selected="${tab === "basic"}">${I.book}<span>${T("Basic path")}</span><small>${esc(T("{pct}%", { pct: Math.round(flatNodes().filter(required).filter((n) => done(n.key)).length / Math.max(1, flatNodes().filter(required).length) * 100) }))}</small></button>
    ${mine.map((id) => { const t = trackOf(id); return `<button type="button" role="tab" data-ptab="${id}" aria-selected="${tab === id}">${trackIcon(t)}<span>${esc(T(t.title))}</span><small>${trackPct(t)}%</small></button>`; }).join("")}
    <button type="button" class="add-track" data-addmenu aria-expanded="${!!st.addTrack}">＋ ${T("Add a track")}</button>
  </div>
  ${st.addTrack ? `<div class="track-menu"><div class="track-opt ai-opt">
      <div class="row" style="gap:12px;flex-wrap:nowrap"><span class="t-icon">${SPARK}</span><b>${T("Create with AI")}</b></div>
      <p class="small muted">${T("Tell the AI what you want to do and in which direction. It drafts a track just for you to check first.")}</p>
      <div class="t-foot"><span class="tiny muted">${T("Your own track")}</span><button type="button" class="btn primary" data-aicompose>${T("Start")}</button></div></div>${rest.map((t) => `<div class="track-opt">
      <div class="row" style="gap:12px;flex-wrap:nowrap"><span class="t-icon">${trackIcon(t)}</span><b>${esc(T(t.title))}</b></div>
      <p class="small muted">${esc(T(t.about))}</p>
      <div class="t-foot"><span class="tiny muted">${esc(T("{c} chapters · {n} steps", { c: t.chapters.length, n: trackSteps(t).length }))}</span><button type="button" class="btn primary" data-addtrack="${t.id}">＋ ${T("Add")}</button></div></div>`).join("")}</div>` : ""}
  ${vAiCompose()}`;
}
// Price band from the checked price (US$), or "Free"; unknown prices point to the provider.
function priceBand(c) {
  if (c.cost === "free") return ["free", T("Free")];
  const p = c.price; if (!p) return ["unknown", T("Price: see provider")];
  const a = p.amount, per = p.per === "month" ? T("/month") : "";
  return [a < 100 ? "low" : a <= 500 ? "mid" : "high", (a < 100 ? T("Under US$100") : a <= 500 ? T("US$100–500") : T("Over US$500")) + per];
}
function course(c, label, kind = "rec") {
  const [band, bandText] = priceBand(c), p = c.price;
  return `<div class="course ${kind}"><div class="row" style="gap:6px"><span class="course-tag">${esc(label)}</span><span class="price-band pb-${band}">${esc(bandText)}</span></div><b>${esc(c.title)}</b><span class="tiny muted">${esc(c.provider)} · ${c.hours} h${c.hrdc && !simple() ? " · HRD Corp: " + esc(TS(c.hrdc)) : ""}</span>
    ${p ? `<span class="tiny price-line">${esc(T(p.text))} · <a href="${esc(p.source)}" target="_blank" rel="noopener">${esc(T("checked {date}", { date: fmtDate(p.checked_on) }))}</a></span>` : ""}
    ${c.url ? `<a class="small" href="${esc(c.url)}" target="_blank" rel="noopener">${T("Open course ↗")}</a>` : ""}</div>`;
}
// Free tutorials and docs for a skill. They do not complete the step; the person still ticks it.
function selfStudy(cid) {
  const list = (st.meta.selfstudy.resources || {})[cid] || [];
  if (!list.length) return "";
  return `<div class="selfstudy"><span class="label">${T("Learn on your own (free)")}</span>
    <ul>${list.map((r) => `<li><a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.title)} ↗</a><span class="tiny muted"> · ${esc(r.provider)}</span></li>`).join("")}</ul>
    <p class="tiny muted">${T("Tutorials and docs to practise with. Tick the step yourself when you can do it.")}</p></div>`;
}
const fact = (label, value) => `<div><dt>${esc(label)}</dt><dd>${value}</dd></div>`;
function vNodeSheet(n) {
  if (!n) return "";
  const isDone = done(n.key), s = st.path.stages[n.si];
  let body = "";
  if (n.type === "skill") {
    const dir = n.demand_change == null ? "" : n.demand_change >= 0.005 ? "up" : n.demand_change <= -0.005 ? "down" : "";
    const was = !simple() && n.demand_change_before != null ? ` <span class="muted small">${esc(T("(was {value})", { value: demandText(n.demand_change_before) }))}</span>` : "";
    const moved = n.moved > 0 ? T(simple() ? "More jobs need this now, so we moved it earlier." : "Moved earlier because demand rose.") : n.moved < 0 && !simple() ? T("Moved later because other skills became more urgent.") : "";
    const tools = n.new_tech && n.new_tech.length ? n.new_tech.map((w) => simple() ? `<b>${esc(w.term)}</b>` : `<b>${esc(w.term)}</b> <span class="muted small">${esc(T("{before} → {after} posts", { before: w.prev, after: w.cur }))}</span>`).join(", ") : "";
    const notes = [n.budget_blocked && "No course fits your budget yet. See the option below or ask about funding.", n.partial && "Courses only get you part of the way. Practise it at work or in a project.", n.no_resource && "No checked course yet. Practise it at work or ask a counsellor."].filter(Boolean);
    const courses = [...n.items.map((c) => course(c, T(simple() ? "Do this course" : "Recommended"))), ...(n.upgrade || []).map((c) => course(c, T(simple() ? "Optional paid course" : "Stronger option, outside your budget"), "alt"))];
    body = `<dl class="facts">
        ${fact(T("Level"), `${esc(lv(n.from))} → <b>${esc(lv(n.to))}</b>${n.basis === "future" && cl(n.cluster).ai ? ` <span class="course-tag">${T("new AI-era skill")}</span> ${info("future")}` : ""}`)}
        ${fact(T("Job demand"), `<b class="fig ${simple() ? "word" : ""} ${dir}">${esc(demandText(n.demand_change))}</b>${was} ${info(n.moved ? "priority" : "demand")}${moved ? `<span class="small muted fact-sub">${esc(moved)}</span>` : ""}`)}
        ${tools ? fact(T(simple() ? "New tool" : "Rising tools"), `${tools} ${info("newtech")}`) : ""}
      </dl>
      ${notes.map((x) => `<p class="note warn small">${T(x)}</p>`).join("")}
      ${courses.length || n.covered_earlier ? `<div class="courses"><span class="label">${T("Courses")}</span>${courses.join("")}${n.covered_earlier ? `<p class="small muted">${T("You already covered this in an earlier course.")}</p>` : ""}</div>` : ""}
      ${selfStudy(n.cluster)}
      ${simple() ? "" : `<p class="tiny muted sdg-row">${T("Supports")} ${n.sdg.map(sdgTag).join(" ")} ${info("sdg")}</p>`}`;
  } else if (n.type === "cert") {
    body = `<div class="courses">${course(n.item, T(n.optional ? "Optional: outside your budget" : "Certificate"), n.optional ? "alt" : "rec")}</div><p class="small muted">${T(simple() ? "A certificate shows employers your level." : "Certificates help employers trust your level. Check the provider's current fee and exam rules.")}</p>`;
  } else if (n.type === "gate") {
    body = `<p class="small">${esc(TS(n.text))}</p><p class="small muted">${T(simple() ? "No course for this one. Mark it done when you have done it." : "This step needs real work, not a course.")}</p>`;
  } else {
    const q = encodeURIComponent(s.title), qd = s.title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    body = `<p class="small">${esc(TS(n.text))}</p>
      ${s.local_demand ? `<p class="note accent small">${esc(simple() ? T("Employers in {country} are short of these people.", { country: countryName() }) : T("{group} are listed as critical occupations in {country}.", { group: TS(s.local_demand), country: countryName() }) + " " + TS(st.path.local_demand_source))}</p>` : ""}
      <div class="stack"><span class="label">${esc(T("Look for jobs in {country}", { country: countryName() }))}</span>${(st.advice ? st.advice.job_search : []).map((j) => `<a class="btn" href="${esc(j.url.replace("{q}", q).replace("{q_dash}", qd))}" target="_blank" rel="noopener">${esc(j.name)} ↗</a>`).join("")}</div>
      <div class="row"><button class="btn primary" type="button" data-interview="${n.si}">${T("Practise the interview")}</button><button class="btn" type="button" data-page="resume">${T("Build my resume →")}</button></div>`;
  }
  return `<div class="card stack"><div class="row between"><span class="eyebrow">${esc(TS(s.stage))} · ${esc(s.title)}</span><button type="button" class="btn ghost sheet-close" data-closesheet aria-label="${T("Close")}">✕</button></div><h3>${esc(nodeLabel(n))}</h3>${body}
    ${n.type !== "checkpoint" ? `<button class="btn ${isDone ? "" : "primary"}" type="button" data-toggle="${esc(n.key)}">${T(isDone ? "Mark as not done" : "Mark as done")}</button>` : ""}</div>`;
}

// ---------- resume --------------------------------------------------------------------------
// The resume document itself stays in English: employers in the region expect it, and
// skill and course names come from English sources. The form around it is translated.
function resumeData() {
  const cv = P().cv, u = unlockedStage(), stage = st.path.stages[Math.max(u, 0)];  // aims at the first job until a stage is done
  const skills = [...Object.entries(skillsNow()).filter(([, v]) => v >= 2).sort((a, b) => b[1] - a[1]).map(([k]) => cl(k).label), ...(P().custom_skills || [])];
  const courses = flatNodes().filter((n) => done(n.key) && (n.type === "cert" || n.type === "skill")).flatMap((n) => n.type === "cert" ? [n.item] : n.items).map((c) => `${c.title}, ${c.provider}`);
  const job = /^[A-Z]{2}/.test(stage.title) ? stage.title : stage.title[0].toLowerCase() + stage.title.slice(1);
  const summary = cv.summary || `${stage.title} candidate with skills in ${skills.slice(0, 4).join(", ").toLowerCase()}. ${u >= 0 ? "Completed" : "Following"} a structured learning path towards ${job} roles.`;
  return { stage, skills, courses, summary };
}
// Resume sections: the built-in ones (from the profile and the path) plus sections the person adds
// (ready-made kinds or their own title). Each can be moved or hidden; extra ones hold one entry per line.
const SECTION_KINDS = [["languages", "Languages", "e.g. Malay — native"], ["strengths", "Personal strengths", "e.g. Patient with customers — handled 30 calls a day"],
  ["projects", "Projects & volunteering", "e.g. Ran social media for a food bank — grew followers"], ["awards", "Awards & activities", "e.g. Employee of the month (2024)"]];
const BUILTIN = [["summary", "Summary"], ["skills", "Skills"], ["experience", "Experience"], ["courses", "Courses and certificates"], ["education", "Education"]];
// Sections in display order; older profiles get their CV languages as a Languages section once.
function resumeSections() {
  const cv = P().cv;
  if (!cv.sections) {
    cv.sections = (cv.languages || []).length ? [{ id: "s-lang", kind: "languages", title: "Languages", lines: [...cv.languages] }] : [];
    cv.order = [...BUILTIN.map(([k]) => k), ...cv.sections.map((x) => x.id)]; cv.hidden = [];
  }
  const ids = new Set([...BUILTIN.map(([k]) => k), ...cv.sections.map((x) => x.id)]);
  cv.order = cv.order.filter((k) => ids.has(k)).concat([...ids].filter((k) => !cv.order.includes(k)));
  return cv.order.map((id) => { const b = BUILTIN.find(([k]) => k === id), x = cv.sections.find((y) => y.id === id);
    return b ? { id, builtin: true, title: b[1] } : { ...x, builtin: false }; });
}
const sectionTitle = (s) => (SECTION_KINDS.find(([k]) => k === s.kind) || [])[1] === s.title ? T(s.title) : s.title;
// What the AI may use when drafting a section: only what the person entered or finished.
function sectionContext() {
  const cv = P().cv, R = resumeData();
  return { about: P().about || "", experience: cv.experience.map((e) => ({ title: e.title, organisation: e.organisation, highlights: e.highlights })),
    education: cv.education, languages: cv.languages, skills: R.skills, finished_courses: R.courses,
    finished_track_steps: myTracks().flatMap((id) => { const t = trackOf(id); return trackSteps(t).filter((s) => done(s.key)).map((s) => tFill(s.title)); }),
    career_goal: R.stage.title };
}
async function draftSection(id) {
  const s = P().cv.sections.find((x) => x.id === id); if (!s) return;
  st.busy["sec_" + id] = true; render();
  try {
    const r = await api("/api/resume/section", { kind: s.kind, title: s.title, context: sectionContext() });
    if (r.ok) { s.lines = [...s.lines.filter(Boolean), ...r.lines.filter((l) => !s.lines.includes(l))]; s.ai = r.model; save(); }
    (st.secNote = st.secNote || {})[id] = r.note;
  } catch (e) { (st.secNote = st.secNote || {})[id] = T("Could not draft the section: {e}", { e: e.message }); }
  st.busy["sec_" + id] = false; render();
}
// Fields for a built-in section, edited in place. Summary and the CV lists write to the profile's CV.
function vBuiltinFields(id) {
  const cv = P().cv, R = resumeData(), f = (path, label, val, wide) => `<div class="field ${wide ? "wide" : ""}"><label>${T(label)}</label><input type="text" data-res="${path}" value="${esc(val || "")}"></div>`;
  const del = (k, i) => `<button type="button" class="btn ghost" data-cvrm="${k}.${i}">✕ ${T("Remove")}</button>`;
  if (id === "summary") return `<textarea rows="4" data-res="summary">${esc(R.summary)}</textarea>`;
  if (id === "skills") return `<p class="small">${esc(R.skills.join(" · ") || T("No skills yet."))}</p><div class="row"><button type="button" class="btn" data-wizto="skills">${T("Change my skills")}</button></div>`;
  if (id === "experience") return `${cv.experience.map((e, i) => `<div class="cv-entry">
      <div class="grid cols-2">${f(`experience.${i}.title`, "Job title", e.title)}${f(`experience.${i}.organisation`, "Organisation", e.organisation)}${f(`experience.${i}.start`, "Start", e.start)}${f(`experience.${i}.end`, "End", e.end)}</div>
      <div class="field"><label>${T("What you did (one per line)")}</label><textarea rows="3" data-res="experience.${i}.highlights">${esc((e.highlights || []).join("\n"))}</textarea></div>${del("experience", i)}</div>`).join("")}
    <button type="button" class="btn" data-cvnew="experience">＋ ${T("Add a job")}</button>`;
  if (id === "education") return `${cv.education.map((e, i) => `<div class="cv-entry"><div class="grid cols-2">${f(`education.${i}.qualification`, "Qualification", e.qualification)}${f(`education.${i}.institution`, "Institution", e.institution)}${f(`education.${i}.year`, "Year", e.year)}</div>${del("education", i)}</div>`).join("")}
    <button type="button" class="btn" data-cvnew="education">＋ ${T("Add education")}</button>`;
  if (id === "courses") return `<p class="tiny muted">${T("Courses you finish on your path are added by themselves. Add other certificates here, one per line.")}</p>
    ${R.courses.length ? `<ul class="small plain">${R.courses.map((c) => `<li>✓ ${esc(c)}</li>`).join("")}</ul>` : ""}
    <textarea rows="3" data-res="certifications" placeholder="${T("e.g. Google Analytics certificate, 2024")}">${esc(cv.certifications.join("\n"))}</textarea>`;
  return "";
}
function vSectionsEditor() {
  const list = resumeSections(), hidden = new Set(P().cv.hidden || []), ai = st.meta.llm.available;
  const row = (s, i) => `<li class="sec-row ${hidden.has(s.id) ? "is-hidden" : ""}">
      <div class="sec-head"><b>${esc(s.builtin ? T(s.title) : sectionTitle(s))}</b>${s.builtin ? `<span class="tiny muted">${T("from your profile")}</span>` : ""}
        <div class="sec-tools">
          <button type="button" class="icon-btn" data-secmove="${s.id}:-1" ${i === 0 ? "disabled" : ""} aria-label="${T("Move up")}">↑</button>
          <button type="button" class="icon-btn" data-secmove="${s.id}:1" ${i === list.length - 1 ? "disabled" : ""} aria-label="${T("Move down")}">↓</button>
          <button type="button" class="icon-btn" data-sechide="${s.id}" aria-pressed="${hidden.has(s.id)}" aria-label="${T(hidden.has(s.id) ? "Show on resume" : "Hide from resume")}" title="${T(hidden.has(s.id) ? "Show on resume" : "Hide from resume")}">${hidden.has(s.id) ? "◌" : "◉"}</button>
          ${s.builtin ? `<button type="button" class="btn ${st.secOpen === s.id ? "primary" : ""} sec-edit" data-secopen="${s.id}" aria-expanded="${st.secOpen === s.id}">${T(st.secOpen === s.id ? "Done" : "Edit")}</button>` : ""}
          ${s.builtin ? "" : `<button type="button" class="icon-btn" data-secdel="${s.id}" aria-label="${T("Remove section")}" title="${T("Remove section")}">✕</button>`}
        </div></div>
      ${s.builtin && st.secOpen === s.id ? `<div class="sec-fields">${vBuiltinFields(s.id)}</div>` : ""}
      ${s.builtin ? "" : `<textarea rows="3" data-secline="${s.id}" placeholder="${esc(T((SECTION_KINDS.find(([k]) => k === s.kind) || [, , "One entry per line"])[2]))}">${esc(s.lines.join("\n"))}</textarea>
        <div class="row" style="gap:8px">${ai ? `<button type="button" class="btn ghost" data-secai="${s.id}" ${st.busy["sec_" + s.id] ? "disabled" : ""}>${st.busy["sec_" + s.id] ? `<span class="spin"></span> ${T("Drafting…")}` : "✦ " + T("Draft with AI")}</button>` : ""}<span class="tiny muted">${T("One entry per line.")}</span></div>
        ${(st.secNote || {})[s.id] ? `<p class="tiny muted">${esc(TS(st.secNote[s.id]))}</p>` : ""}
        ${s.ai ? `<p class="tiny muted">${esc(T("Drafted by {model} from your own profile. Check every line before you send it.", { model: s.ai }))}</p>` : ""}`}
    </li>`;
  const have = new Set(P().cv.sections.map((x) => x.kind));
  return `<div class="card stack"><div class="row between"><h3>${T("Sections")}</h3><span class="tiny muted">${T("Move, hide or add sections.")}</span></div>
    <ol class="sec-list">${list.map(row).join("")}</ol>
    <div class="stack" style="gap:8px"><span class="label">${T("Add a section")}</span>
      <div class="chips">${SECTION_KINDS.filter(([k]) => !have.has(k)).map(([k, l]) => `<button type="button" class="chip" data-secadd="${k}">＋ ${T(l)}</button>`).join("")}</div>
      <div class="row" style="gap:8px;flex-wrap:nowrap"><input id="secCustom" maxlength="60" placeholder="${T("Your own section title, e.g. Hobbies")}" value="${esc(st.secCustom || "")}"><button type="button" class="btn" data-secadd="custom">＋ ${T("Add")}</button></div>
    </div></div>`;
}
// The paper: every visible section in order. Built-in sections keep their own content.
function resumeBlocks(R, cv, expHtml) {
  const hidden = new Set(cv.hidden || []);
  return resumeSections().filter((s) => !hidden.has(s.id)).map((s) => {
    if (s.id === "summary") return `<h4>Summary</h4><p>${esc(R.summary)}</p>`;
    if (s.id === "skills") return R.skills.length ? `<h4>Skills</h4><p>${esc(R.skills.join(" · "))}</p>` : "";
    if (s.id === "experience") return expHtml ? `<h4>Experience</h4>${expHtml}` : "";
    if (s.id === "courses") return R.courses.length || cv.certifications.some((c) => c.trim()) ? `<h4>Courses and certificates</h4><ul>${[...R.courses, ...cv.certifications.filter((c) => c.trim())].map((c) => `<li>${esc(c)}</li>`).join("")}</ul>` : "";
    if (s.id === "education") return cv.education.length ? `<h4>Education</h4>${cv.education.map((e) => `<p>${esc(e.qualification)}${e.institution ? ", " + esc(e.institution) : ""} <span class="meta">${esc(e.year)}</span></p>`).join("")}` : "";
    const lines = (s.lines || []).filter((l) => l.trim());
    if (!lines.length) return "";
    return `<h4>${esc(s.title)}</h4>${s.kind === "languages" ? `<p>${esc(lines.join(" · "))}</p>` : `<ul>${lines.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>`}`;
  }).join("");
}
function vResume() {
  if (!A().role) return `<div class="page">${intro(T("Resume"), T("Choose a career first"), "")}<button class="btn primary" type="button" data-page="careers">${T("Go to careers")}</button></div>`;
  if (!st.path || st.path.role !== A().role) { if (!st.busy.path) loadPath().then(render); return skeleton(2, T("Loading your resume…")); }
  const cv = P().cv, R = resumeData();
  const expHtml = cv.experience.map((e) => `<p><b>${esc(e.title)}</b>${e.organisation ? ", " + esc(e.organisation) : ""} <span class="meta">${esc([e.start, e.end].filter(Boolean).join(" – "))}</span></p>${(e.highlights || []).some((h) => h.trim()) ? `<ul>${(e._polished || e.highlights.filter((h) => h.trim())).map((h) => `<li>${esc(h)}</li>`).join("")}</ul>` : ""}`).join("");
  return `<div class="page">
  ${intro(T("Resume"), T("Resume for {role}", { role: R.stage.title }), T("Built from your profile and the steps you finished. Check it, then save it as a PDF.") + (LANG === "en" ? "" : " " + T("The resume itself is in English, as most employers expect.")))}
  ${unlockedStage() < 0 ? `<p class="note small">${T("You can build your resume now. Each path step you finish adds its course here.")}</p>` : ""}
  <div class="resume-wrap">
    <div class="stack lg no-print">
      <div class="card stack"><h3>${T("Your details")}</h3>
        <div class="grid cols-2">${Object.keys(CONTACT).map((k) => `<div class="field"><label>${T(CONTACT[k])}</label><input type="text" data-res="contact.${k}" value="${esc(cv.contact[k] || "")}"></div>`).join("")}</div>
        <p class="small muted">${T("Fill each section below with Edit, or import your CV in About you.")} <button class="btn ghost" type="button" data-page="wizard">${T("Edit about you")}</button></p></div>
      ${vSectionsEditor()}
      <div class="card stack"><h3>${T("Finish")}</h3>
        ${st.meta.llm.available ? `<button class="btn" type="button" id="polishBtn" ${st.busy.polish ? "disabled" : ""}>${st.busy.polish ? `<span class="spin"></span> ${T("Improving…")}` : T("Improve wording with AI")}</button>` : ""}
        ${st.polished ? `<p class="tiny muted">${esc(TS(st.polished.note))}</p>` : ""}
        <div class="row"><button class="btn primary" type="button" id="printBtn">${T("Save as PDF")}</button><button class="btn" type="button" id="txtBtn">${T("Download text")}</button></div>
        <p class="tiny muted">${T("Only list what you can show an employer.")}</p></div>
    </div>
    <div class="paper" id="paper" lang="en" data-lenis-prevent>
      <h1>${esc(cv.contact.name || A().name)}</h1>
      <p class="meta">${esc([cv.contact.email, cv.contact.phone, cv.contact.location].filter(Boolean).join(" · ") || "email · phone · city")}</p>
      <p style="margin-top:6px"><b>${esc(R.stage.title)}</b></p>
      ${resumeBlocks(R, cv, expHtml)}
    </div>
  </div></div>`;
}
function resumeText() {
  const cv = P().cv, R = resumeData();
  const lines = [cv.contact.name || A().name, [cv.contact.email, cv.contact.phone, cv.contact.location].filter(Boolean).join(" | "), R.stage.title, ""];
  const hidden = new Set(cv.hidden || []);
  resumeSections().filter((x) => !hidden.has(x.id)).forEach((x) => {
    if (x.id === "summary") lines.push("SUMMARY", R.summary, "");
    else if (x.id === "skills") { if (R.skills.length) lines.push("SKILLS", R.skills.join(", "), ""); }
    else if (x.id === "experience") { if (cv.experience.length) { lines.push("EXPERIENCE"); cv.experience.forEach((e) => { lines.push(`${e.title}${e.organisation ? ", " + e.organisation : ""} (${[e.start, e.end].filter(Boolean).join(" - ")})`); (e._polished || (e.highlights || []).filter((h) => h.trim())).forEach((h) => lines.push("- " + h)); }); lines.push(""); } }
    else if (x.id === "courses") { const cs = [...R.courses, ...cv.certifications.filter((c) => c.trim())]; if (cs.length) lines.push("COURSES AND CERTIFICATES", ...cs.map((c) => "- " + c), ""); }
    else if (x.id === "education") { if (cv.education.length) lines.push("EDUCATION", ...cv.education.map((e) => `${e.qualification}, ${e.institution} ${e.year}`), ""); }
    else { const ls = (x.lines || []).filter((l) => l.trim()); if (ls.length) lines.push(x.title.toUpperCase(), ...ls.map((l) => "- " + l), ""); }
  });
  return lines.join("\n");
}

// ---------- teams and sources ---------------------------------------------------------------
// A manager can keep several teams. Samples are fixed; their own teams are typed in or imported and
// kept on this device. Each team has its own target career (st.teamTarget reads the current team's).
const isOwn = (id) => /^t_/.test(id || "");
const ownTeam = () => isOwn(st.team) ? st.ownTeams.find((t) => t.id === st.team) || null : null;
const OWN_KEY = () => `wfe.teams.${A().id}`;
function loadOwnTeams() {
  let list = null; try { list = JSON.parse(localStorage.getItem(OWN_KEY()) || "null"); } catch (e) { /* none yet */ }
  if (!list) {  // the single typed list from before becomes the first team, with its profiles
    list = st.legacyUpload ? [{ ...st.legacyUpload, id: "t_1", label: st.legacyUpload.label === "Your list" || st.legacyUpload.label === "Your team" ? T("My team") : st.legacyUpload.label }] : [];
    const all = memAll(); if (all.upload) { all.t_1 = all.upload; delete all.upload; memSave(); }
  }
  st.ownTeams = list; saveOwnTeams();
}
function saveOwnTeams() { try { localStorage.setItem(OWN_KEY(), JSON.stringify(st.ownTeams)); } catch (e) { /* this visit only */ } }
const allTeamIds = () => [...st.meta.samples.teams.map((t) => t.id), ...st.ownTeams.map((t) => t.id)];
const teamName = (id) => { const o = st.ownTeams.find((t) => t.id === id); return o ? o.label : TS(st.meta.samples.teams.find((t) => t.id === id).label); };
function withTeam(id, fn) { const was = st.team; st.team = id; try { return fn(); } finally { st.team = was; } }
function teamData() { return ownTeam() || st.meta.samples.teams.find((t) => t.id === st.team) || st.meta.samples.teams[0]; }
function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/).map((l) => l.split(",").map((c) => c.trim()));
  const head = lines.shift(); const cols = head.slice(1).filter((c) => st.meta.clusters.some((x) => x.id === c));
  if (!cols.length) throw new Error(T("The header must be: name, then skill codes such as excel, genai, customer"));
  const people = lines.filter((l) => l[0]).map((l) => [l[0], Object.fromEntries(cols.map((c) => [c, Math.max(0, Math.min(3, parseInt(l[head.indexOf(c)], 10) || 0))]))]);
  return { id: newTeamId(), who: "Your upload", label: T("Imported team"), desc: T("{n} people from your file. Kept on this device; skill levels are sent only to score them, never stored.", { n: people.length }), target_role: st.meta.roles[0].id, columns: cols, people };
}
// Typing the group in: start with the skills the chosen career needs and three empty rows.
const newTeamId = () => "t_" + Date.now().toString(36);
function newTeam() {
  const role = roleOf(st.teamTarget || teamData().target_role) || st.meta.roles[0];
  return { id: newTeamId(), who: "Your list", label: T("Team {n}", { n: st.ownTeams.length + 1 }), desc: "", target_role: role.id, columns: role.req.map((q) => q.cluster), people: [1, 2, 3].map((i) => [T("Person {n}", { n: i }), {}]) };
}
function addOwnTeam(t) { st.ownTeams.push(t); st.team = t.id; st.teamTarget = st.teamTarget || t.target_role; saveOwnTeams(); teamEdited(); }
function openTeamEditor() { st.page = "wizard"; st.wiz = Math.max(0, wizSteps().findIndex((w) => w.id === "team")); render(); scrollTop(); }
function teamEdited(paint) {
  const U = ownTeam();
  if (U) U.desc = T("{n} people you entered. Kept on this device; skill levels are sent only to score them, never stored.", { n: U.people.length });
  st.teamRev = (st.teamRev || 0) + 1;
  saveOwnTeams();
  teamSaved();
  if (paint) render();
}
function vTeamEditor() {
  const U = ownTeam(), free = st.meta.clusters.filter((c) => !U.columns.includes(c.id));
  const lvSel = (i, k, v) => `<select data-tlv="${i}|${k}" aria-label="${esc(cl(k).label)}">${[0, 1, 2, 3].map((n) => `<option value="${n}" ${n === v ? "selected" : ""}>${esc(lv(n))}</option>`).join("")}</select>`;
  return `<div class="card stack team-editor" id="teamEditor">
    <div class="row between"><div class="field" style="flex:1;min-width:200px"><label for="teamName">${T("Team name")}</label><input type="text" id="teamName" value="${esc(U.label)}" maxlength="60"></div>
      <button type="button" class="btn ghost small" id="teamDel">${T("Delete this team")}</button></div>
    <div class="tablewrap"><table><thead><tr><th>${T("Name or ID")}</th><th>${T("Job title now")}</th>${U.columns.map((k) => `<th><span>${esc(cl(k).label)}</span><button type="button" class="x-btn" data-tcoldel="${k}" aria-label="${esc(T("Remove {skill}", { skill: cl(k).label }))}">×</button></th>`).join("")}<th></th></tr></thead>
      <tbody>${U.people.map(([nm, sk], i) => `<tr><td><input type="text" data-tname="${i}" value="${esc(nm)}" maxlength="40" aria-label="${esc(T("Name or ID"))}"></td><td><input type="text" data-ttitle="${i}" value="${esc(mem(i).title)}" maxlength="60" aria-label="${esc(T("Job title now"))}" placeholder="${esc(T("Job title"))}"></td>${U.columns.map((k) => `<td>${lvSel(i, k, sk[k] || 0)}</td>`).join("")}<td><button type="button" class="x-btn" data-tdel="${i}" aria-label="${esc(T("Remove {name}", { name: nm }))}" ${U.people.length < 2 ? "disabled" : ""}>×</button></td></tr>`).join("")}</tbody></table></div>
    <div class="row"><button type="button" class="btn" id="teamAddPerson">+ ${T("Add person")}</button>
      ${free.length ? `<select id="teamAddSkill" aria-label="${esc(T("Add a skill column"))}"><option value="">+ ${T("Add a skill column")}</option>${free.map((c) => `<option value="${c.id}">${esc(c.label)}</option>`).join("")}</select>` : ""}</div>
    <p class="tiny muted">${T("Levels: None, Basic, Working, Strong. Use staff or student IDs instead of full names. For training plans only, never for selection.")}</p>
  </div>`;
}
// ---------- teams and cohorts: HR / L&D managers, TVET and university career centres -------------
// Picking one of these in About you swaps the personal steps for a team step, and Home shows the
// group's best careers, one shared learning plan and each person's best fit.
const TEAM_ROLES = ["hr", "tvet"];
const isTeamUser = () => !!A() && !!A().profile && TEAM_ROLES.includes(P().situation);
const wizSteps = () => WIZ.filter((w) => isTeamUser() ? !["experience", "skills", "interests"].includes(w.id) : w.id !== "team");
const teamWord = () => T(P().situation === "tvet" ? "cohort" : "team");
Object.defineProperty(st, "teamTarget", { get: () => st.teamTargets[st.team] || null, set: (v) => { st.teamTargets = { ...st.teamTargets, [st.team]: v || undefined }; } });
const teamKey = () => { const Tm = teamData(); return [st.team, st.teamTarget || Tm.target_role, P().budget, Tm.people.length, isOwn(st.team) ? st.teamRev || 0 : 0, memDoneTotal()].join("|"); };
const teamReady = () => st.teamReport && st.teamKey === teamKey();
function teamSaved() {
  if (isTeamUser()) { A().team = { source: st.team, targets: st.teamTargets }; save(); }
}
function setTeamTarget(role) { st.teamTarget = role; teamSaved(); render(); window.scrollTo({ top: 0, behavior: "smooth" }); }
async function loadTeamReport() {
  const Tm = teamData(), key = teamKey();
  st.busy.team = true;
  try { st.teamReport = await api("/api/team", { people: teamPeople(), target_role: st.teamTarget || Tm.target_role, budget: P().budget || "free" }); st.teamKey = key; }
  catch (e) { st.teamError = { key, msg: e.message === "Not Found" ? T("Team plans need the latest server. Restart the app, then press Retry.") : T("Could not score the group: {e}", { e: e.message }) }; }
  st.busy.team = false;
}
function vTeamStep() {
  const Tm = teamData(), target = st.teamTarget || Tm.target_role;
  const samples = st.meta.samples.teams.map((t) => `<button type="button" class="option" data-team="${t.id}" aria-pressed="${st.team === t.id}"><b>${esc(T("Sample: {label}", { label: TS(t.label) }))}</b><span class="small muted">${esc(TS(t.desc))}</span></button>`).join("");
  const own = st.ownTeams.map((t) => `<button type="button" class="option" data-team="${t.id}" aria-pressed="${st.team === t.id}"><b>${esc(t.label)}</b><span class="small muted">${esc(T("{n} people so far", { n: t.people.length }))}</span></button>`).join("")
    + `<button type="button" class="option" id="teamNew"><b>+ ${T(st.ownTeams.length ? "New team" : "Type your own")}</b><span class="small muted">${T("Enter each person and their skill levels here")}</span></button>`;
  return `<div class="options">${samples}${own}</div>
    ${ownTeam() ? vTeamEditor() : ""}
    <div class="field"><label for="teamTarget">${esc(T("Career to prepare your {group} for", { group: teamWord() }))}</label><select id="teamTarget">${st.meta.roles.map((x) => `<option value="${x.id}" ${x.id === target ? "selected" : ""}>${esc(x.title)}</option>`).join("")}</select>
      <span class="tiny muted">${T("You can change this later. Home also ranks every career for the whole group.")}</span></div>
    <p class="tiny muted">${T("Have a spreadsheet?")} <label class="text-link">${T("Import a CSV")}<input type="file" id="teamCsv" accept=".csv,text/csv" hidden></label> ${T("(name, then skill codes such as excel, genai, customer with levels 0–3).")}</p>`;
}
// Team Home: four guided steps. Each answers one question, says what the numbers mean and what to do.
// Built on common reskilling practice: check current skills first, pick realistic target roles, train the
// gaps most people share, then agree a plan with each person. HR and career-centre wording differ slightly.
const isCohort = () => P().situation === "tvet";
const pct = (x) => Math.round(x * 100);
const today = () => { const d = new Date(), iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; return fmtDate(iso, { day: "numeric", month: "long", year: "numeric" }); };  // local date, not UTC
function tstep(n, q, means, todo, body) {
  return `<section class="tstep card stack" id="tstep-${n}"><div class="tstep-head"><span class="tstep-n" aria-hidden="true">${n}</span><div class="stack" style="gap:4px;min-width:0"><span class="eyebrow">${esc(T("Step {n} of 4", { n }))}</span><h2>${esc(q)}</h2><p class="muted small">${esc(means)}</p></div></div>
    ${body}
    <p class="todo"><b>${T("What to do:")}</b> ${esc(todo)}</p></section>`;
}
function teamPlanStep(s, i, N) {
  return `<li class="plan-step"><span class="rank-n">${i + 1}</span><div class="stack" style="gap:6px;min-width:0">
      <div class="row between" style="flex-wrap:nowrap;align-items:baseline"><b>${esc(cl(s.cluster).label)}</b><span class="small muted nowrap">${esc(T("to {level}", { level: lv(s.to) }))}</span></div>
      <div class="share"><span class="track"><span class="fill" style="display:block;width:${Math.round(s.n / N * 100)}%"></span></span><span class="small">${esc(T("{n} of {total} people need this", { n: s.n, total: N }))}</span></div>
      <div class="courses">${s.items.map((c) => course(c, T("Group course"))).join("")}${(s.upgrade || []).map((c) => course(c, T("Stronger option, outside your budget"), "alt")).join("")}</div>
      ${s.no_resource ? `<p class="note warn small">${T("No checked course yet. Practise it at work or ask a counsellor.")}</p>` : s.budget_blocked ? `<p class="note warn small">${T("No course fits your budget yet. See the option below or ask about funding.")}</p>` : s.partial ? `<p class="note warn small">${T("Courses only get you part of the way. Practise it at work or in a project.")}</p>` : s.covered_earlier ? `<p class="small muted">${T("The course in an earlier step covers this too.")}</p>` : ""}
      ${simple() ? "" : `<p class="tiny muted sdg-row">${T("Supports")} ${s.sdg.map(sdgTag).join(" ")}</p>`}</div></li>`;
}
const readyBar = (r) => `<span class="ready"><span class="track"><span class="fill ${r >= 0.8 ? "good" : ""}" style="display:block;width:${pct(r)}%"></span></span><span class="mono small">${pct(r)}%</span></span>`;
function vTeamHome() {
  const Tm = teamData(), target = st.teamTarget || Tm.target_role;
  if (!teamReady()) {
    if (st.teamError && st.teamError.key === teamKey()) return `<div class="page"><div class="card stack"><p class="note warn">${esc(st.teamError.msg)}</p><div class="row"><button type="button" class="btn primary" id="teamRetry">${T("Retry")}</button></div></div></div>`;
    if (!st.busy.team) loadTeamReport().then(render);
    return skeleton(4, T("Scoring your {group}…", { group: teamWord() }));
  }
  const rep = st.teamReport, careers = rep.careers[st.scen], ppl = rep.people[st.scen], plan = rep.plan, N = rep.size, sm = rep.summary;
  const title = (id) => roleOf(id).title, tgtTitle = title(target);
  const hrs = Object.values(plan.hours), avgH = hrs.length ? Math.round(hrs.reduce((a, b) => a + b, 0) / hrs.length) : 0;
  const ready = ppl.filter((p) => p.readiness >= 0.8).length, avgReady = ppl.reduce((a, p) => a + p.readiness, 0) / N;
  const shared = plan.steps[0], exp = sm.target_exposure;
  const top = careers.slice(0, 6), tgt = careers.find((x) => x.role === target);
  const rowHtml = (x) => `<div class="team-career ${x.role === target ? "is-target" : ""}"><span class="rank-n">${x.rank}</span><div class="stack" style="gap:2px;min-width:0"><b>${esc(title(x.role))}</b><span class="tiny muted">${esc(T("Average fit {avg} · from {min} to {max} across people", { avg: Math.round(x.score), min: Math.round(x.min), max: Math.round(x.max) }))}</span></div>${x.role === target ? `<span class="chosen">✓ ${T("Target")}</span>` : `<button type="button" class="btn ghost" data-target="${x.role}">${T("Make target")}</button>`}</div>`;
  const tile = (label, value, sub) => `<div class="kpi"><span class="k-label">${esc(label)}</span><span class="k-value">${value}</span><span class="k-sub">${esc(sub)}</span></div>`;
  const my = P().country === "MY";
  const s1 = tstep(1, T(isCohort() ? "Where do your students stand?" : "Where does your team stand?"),
    T("Readiness is the share of the target career's entry skills a person already has, from the levels in your file or sample."),
    T("Check the levels in the skills table. Asking people to rate themselves first, then reviewing together, makes ratings more accurate."),
    `<div class="proof team-kpis">
      ${tile(T("People"), N, T(isCohort() ? "students in this cohort" : "people in this team"))}
      ${tile(T("Average readiness"), `${pct(avgReady)}%`, T("for {role}", { role: tgtTitle }))}
      ${tile(T("Nearly ready"), `${ready}/${N}`, T("have 80% or more of the entry skills"))}
      ${shared ? tile(T("Most shared gap"), `${shared.n}/${N}`, cl(shared.cluster).label) : tile(T("Most shared gap"), "0", T("No gaps for this career"))}
      ${exp ? tile(T("AI exposure of the target"), esc(exp.mean.toFixed(2)), TS(exp.category)) : ""}
    </div><div class="row"><button type="button" class="btn" data-page="team">${T("Open the skills table")}</button></div>`);
  const s2 = tstep(2, T(isCohort() ? "Which careers could they go into?" : "Where could they go?"),
    T("Careers ranked by the whole group's average fit, in the future you pick above. Moving people into a new role keeps their experience in the organisation."),
    T(isCohort() ? "Pick the career your programme prepares them for. Prefer one most students can reach, with lower AI exposure and rising demand." : "Pick the target career. Prefer one most people can reach, with lower AI exposure and rising demand. Tap a dot or press Make target."),
    `${vCareerMap(careers, { kind: "team", mine: target })}
     <div class="stack"><h3>${esc(T("Best careers for your {group}", { group: teamWord() }))}</h3><div class="team-list">${top.map(rowHtml).join("")}${top.some((x) => x.role === target) || !tgt ? "" : rowHtml(tgt)}</div></div>`);
  const s3 = tstep(3, T("What should they learn first?"),
    T("Gaps that most people share come first, so one course can train several people together. Only checked courses within your budget are used."),
    my ? T("Book the first course for everyone who needs it. To pay from the HRD Corp levy, get the grant approved in eTRiS before the training starts; approval is not retrospective, and you claim afterwards.")
       : T("Book the first course for everyone who needs it, and check your local training-fund rules before anyone starts."),
    plan.steps.length ? `<div class="row between"><p class="small">${esc(T("{k} skills to build for {role}. Each person needs {min}–{max} h of courses (about {avg} h on average).", { k: plan.steps.length, role: tgtTitle, min: Math.min(...hrs), max: Math.max(...hrs), avg: avgH }))}</p><span class="small muted">${esc(T("Budget: {budget}", { budget: TS((country().budgets.find((b) => b[0] === P().budget) || [, ""])[1]) }))}</span></div>
      <ol class="plan-steps">${plan.steps.map((s, i) => teamPlanStep(s, i, N)).join("")}</ol>` : `<p class="small">${esc(T("Everyone already meets the entry skills for {role}.", { role: tgtTitle }))}</p>`);
  const s4 = tstep(4, T(isCohort() ? "What does each student need?" : "What does each person need?"),
    T("Readiness for the target, the two biggest gaps, and the career each person fits best on their own."),
    T(isCohort() ? "Print a one-page plan for each advising session, and let the student choose their own goals." : "Print a one-page plan for each 1-to-1, and agree the goals with the person rather than for them."),
    `<div class="tablewrap"><table class="people-table"><thead><tr><th>${T("Person")}</th><th>${esc(T("Readiness for {role}", { role: tgtTitle }))}</th><th>${T("Biggest gaps")}</th><th>${T("Best fit")}</th><th></th></tr></thead>
      <tbody>${ppl.map((p) => `<tr><td><button type="button" class="link-btn" data-member="${Tm.people.findIndex((x) => x[0] === p.name)}"><b>${esc(p.name)}</b></button></td><td>${readyBar(p.readiness)}</td><td class="small">${p.gaps.length ? p.gaps.slice(0, 2).map((g) => `${esc(cl(g.cluster).label)} <span class="muted">${esc(lv(g.have))} → ${esc(lv(g.need))}</span>`).join("<br>") : `<span class="muted">${T("None")}</span>`}</td><td class="small">${esc(title(p.top[0].role))} <span class="mono muted">${Math.round(p.top[0].score)}</span></td><td><button type="button" class="btn ghost small" data-person="${esc(p.name)}">${T("One-page plan")}</button></td></tr>`).join("")}</tbody></table></div>`);
  return `<div class="page team-home">
  ${intro(T("For HR and career centres"), T(isCohort() ? "Your cohort: {label}" : "Your team: {label}", { label: TS(Tm.label) }), esc(T("A reskilling plan for {n} people, preparing for {role}. Work through the four steps below. Scores are group averages: estimates, not predictions.", { n: N, role: tgtTitle })))}
  ${vTeamTabs()}
  <div class="row between team-tools">
    <div class="row"><div class="seg" role="group" aria-label="${T("Future")}">${Object.keys(st.meta.scenarios).map((k) => `<button type="button" data-scen="${k}" aria-pressed="${st.scen === k}">${esc(scenLabel(k))}</button>`).join("")}</div>${info("scenario")}</div>${scenBrief()}
    <div class="row"><button type="button" class="btn" data-page="teamreport">${T("Report for leadership")}</button></div>
  </div>
  ${s1}${s2}${s3}${s4}
  <p class="tiny muted">${T("For training plans only, never for hiring, promotion or selection decisions.")}</p>
  </div>`;
}
// One page per person, for a 1-to-1 or advising session. Printable.
function vTeamPerson() {
  if (!teamReady()) { if (!st.busy.team) loadTeamReport().then(render); return skeleton(2, T("Scoring your {group}…", { group: teamWord() })); }
  const rep = st.teamReport, p = rep.people[st.scen].find((x) => x.name === st.teamPerson);
  if (!p) { st.page = "dashboard"; return vTeamHome(); }
  const target = st.teamTarget || teamData().target_role, title = (id) => roleOf(id).title, s = st.teamReport.snapshot;
  const mine = rep.plan.steps.filter((x) => x.people.includes(p.name));
  return `<div class="page print-page">
   <div class="row between no-print"><button type="button" class="btn ghost" data-page="dashboard">← ${T("Back to the team plan")}</button><button type="button" class="btn primary" id="printPage">${T("Print or save as PDF")}</button></div>
   <article class="one-pager card stack">
    <header class="stack" style="gap:4px"><span class="eyebrow">${esc(T("Learning plan · {date}", { date: today() }))}</span><h2>${esc(p.name)}</h2>
      <p class="muted">${esc(T("Preparing for {role}. These are estimates to discuss together, not a decision.", { role: title(target) }))}</p></header>
    <section class="stack"><h3>${esc(T("Readiness for {role}", { role: title(target) }))}</h3>${readyBar(p.readiness)}
      <p class="small muted">${T("The share of the entry skills for this career you already have.")}</p></section>
    <section class="stack"><h3>${T("Skills to build, in order")}</h3>
      ${mine.length ? `<ol class="plan-steps">${mine.map((x, i) => { const g = p.gaps.find((y) => y.cluster === x.cluster); return `<li class="plan-step"><span class="rank-n">${i + 1}</span><div class="stack" style="gap:6px;min-width:0"><div class="row between" style="flex-wrap:nowrap;align-items:baseline"><b>${esc(cl(x.cluster).label)}</b><span class="small muted nowrap">${esc(g ? `${lv(g.have)} → ${lv(g.need)}` : T("to {level}", { level: lv(x.to) }))}</span></div><div class="courses">${x.items.map((c) => course(c, T("Course"))).join("")}</div>${x.no_resource ? `<p class="note warn small">${T("No checked course yet. Practise it at work or ask a counsellor.")}</p>` : ""}</div></li>`; }).join("")}</ol>` : `<p class="small">${T("You already have the entry skills for this career.")}</p>`}
      <p class="small">${esc(T("About {h} hours of courses in total, plus practice at work.", { h: rep.plan.hours[p.name] || 0 }))}</p></section>
    <section class="stack"><h3>${T("Careers that fit you best")}</h3><ol class="small">${p.top.map((x) => `<li>${esc(title(x.role))} <span class="mono muted">${Math.round(x.score)}</span></li>`).join("")}</ol>
      <p class="tiny muted">${T("Fit scores out of 100 from your skills, job demand and AI exposure.")}</p></section>
    <section class="stack"><h3>${T("Our goals")}</h3><div class="write-lines"><span></span><span></span><span></span></div></section>
    <p class="tiny muted">${esc(T("Sources: ESCO v1.2 careers and skills; ILO Working Paper 140 AI exposure; job posts to {date}; checked course list. For training plans only, never for hiring, promotion or selection decisions.", { date: s ? s.as_of : "—" }))}</p>
   </article></div>`;
}
// Summary of the whole group for leadership. Printable.
function vTeamReport() {
  if (!teamReady()) { if (!st.busy.team) loadTeamReport().then(render); return skeleton(3, T("Scoring your {group}…", { group: teamWord() })); }
  const Tm = teamData(), target = st.teamTarget || Tm.target_role, rep = st.teamReport, N = rep.size, s = rep.snapshot;
  const careers = rep.careers[st.scen], ppl = rep.people[st.scen], title = (id) => roleOf(id).title;
  const hrs = Object.values(rep.plan.hours), avgH = hrs.length ? Math.round(hrs.reduce((a, b) => a + b, 0) / hrs.length) : 0;
  const ready = ppl.filter((p) => p.readiness >= 0.8).length, avgReady = ppl.reduce((a, p) => a + p.readiness, 0) / N;
  const exp = rep.summary.target_exposure;
  return `<div class="page print-page">
   <div class="row between no-print"><button type="button" class="btn ghost" data-page="dashboard">← ${T("Back to the team plan")}</button><button type="button" class="btn primary" id="printPage">${T("Print or save as PDF")}</button></div>
   <article class="one-pager card stack">
    <header class="stack" style="gap:4px"><span class="eyebrow">${esc(T("Reskilling report · {date}", { date: today() }))}</span><h2>${esc(TS(Tm.label))}</h2>
      <p class="muted">${esc(T("{n} people, preparing for {role}. Future scenario: {scen}. Scores are estimates, not predictions.", { n: N, role: title(target), scen: scenLabel(st.scen) }))}</p></header>
    <section class="stack"><h3>${T("Summary")}</h3><ul class="small">
      <li>${esc(T("Average readiness for {role}: {p}%. {k} of {n} people are nearly ready (80% or more of the entry skills).", { role: title(target), p: pct(avgReady), k: ready, n: N }))}</li>
      ${rep.plan.steps[0] ? `<li>${esc(T("Most shared gap: {skill}, needed by {k} of {n} people.", { skill: cl(rep.plan.steps[0].cluster).label, k: rep.plan.steps[0].n, n: N }))}</li>` : ""}
      <li>${esc(T("Course time per person: {min}–{max} hours (about {avg} on average), plus practice at work.", { min: hrs.length ? Math.min(...hrs) : 0, max: hrs.length ? Math.max(...hrs) : 0, avg: avgH }))}</li>
      ${exp ? `<li>${esc(T("AI exposure of {role}: {v} ({cat}, ILO).", { role: title(target), v: exp.mean.toFixed(2), cat: TS(exp.category) }))}</li>` : ""}
    </ul></section>
    <section class="stack"><h3>${T("Best careers for the group")}</h3><div class="tablewrap"><table><thead><tr><th>#</th><th>${T("Career")}</th><th>${T("Average fit")}</th><th>${T("Range across people")}</th></tr></thead>
      <tbody>${careers.slice(0, 6).map((x) => `<tr><td>${x.rank}</td><td>${esc(title(x.role))}${x.role === target ? ` <b>· ${T("Target")}</b>` : ""}</td><td class="mono">${Math.round(x.score)}</td><td class="mono">${Math.round(x.min)}–${Math.round(x.max)}</td></tr>`).join("")}</tbody></table></div></section>
    <section class="stack"><h3>${T("Learning plan")}</h3><div class="tablewrap"><table><thead><tr><th>#</th><th>${T("Skill")}</th><th>${T("People")}</th><th>${T("Course")}</th><th>${T("Hours")}</th><th>${T("Cost")}</th></tr></thead>
      <tbody>${rep.plan.steps.map((x, i) => { const c = x.items[0]; return `<tr><td>${i + 1}</td><td>${esc(cl(x.cluster).label)} <span class="muted small">→ ${esc(lv(x.to))}</span></td><td class="mono">${x.n}/${N}</td><td class="small">${c ? `${esc(c.title)}<br><span class="muted">${esc(c.provider)}</span>` : `<span class="muted">${T("No checked course yet")}</span>`}</td><td class="mono">${c ? c.hours : "—"}</td><td class="small">${c ? esc(TS(c.cost)) : "—"}</td></tr>`; }).join("")}</tbody></table></div>
      ${P().country === "MY" ? `<p class="small">${T("Funding: to pay from the HRD Corp levy, the grant must be approved in eTRiS before training starts (not retrospective); the claim is filed after the training.")}</p>` : ""}</section>
    <section class="stack"><h3>${T("People")}</h3><div class="tablewrap"><table><thead><tr><th>${T("Person")}</th><th>${T("Readiness")}</th><th>${T("Best fit")}</th></tr></thead>
      <tbody>${ppl.map((p) => `<tr><td>${esc(p.name)}</td><td class="mono">${pct(p.readiness)}%</td><td>${esc(title(p.top[0].role))} <span class="mono muted">${Math.round(p.top[0].score)}</span></td></tr>`).join("")}</tbody></table></div></section>
    <p class="tiny muted">${esc(T("Method: fit = skills, demand outlook, transferable skills and interests, minus AI exposure. Sources: ESCO v1.2; ILO Working Paper 140; job posts to {date}; checked course list. For training plans only, never for hiring, promotion or selection decisions.", { date: s ? s.as_of : "—" }))}</p>
   </article></div>`;
}
// First-use guide: highlights each step in turn. Replay with "Show the guide".
const TEAM_TOUR = [
  { sel: "#tstep-1", t: "Start here", x: "See where your group stands for the target career: readiness, who is nearly ready, and the gap most people share." },
  { sel: "#tstep-2 .career-map", t: "Where they could go", x: "Careers are grouped into four zones by where jobs are heading and how much AI can do. Tap a career or press Make target to change the target." },
  { sel: "#tstep-3", t: "What to train first", x: "One plan for the group, most shared gaps first, with checked courses in your budget and the hours each person needs." },
  { sel: "#tstep-4", t: "Each person", x: "Readiness and the biggest gaps for each person. Print a one-page plan for a 1-to-1 or advising session." },
  { sel: ".team-tools", t: "Share it", x: "Switch futures to test the plan, and print a report for leadership. You can come back to this guide any time." },
  { sel: "#helper", t: "Ask Lambtae", x: "Lambtae answers questions about your group, such as where to start or how to fund it, using only the group's data." },
];
const ME_TOUR = [
  { sel: ".home-hero", t: "Your goal", fn: "goal" },
  { sel: ".home-row .geo-tile:first-child", t: "Why this career suits you", fn: "why" },
  { sel: ".next-card", t: "Your next step", fn: "next" },
  { sel: ".home-row .geo-tile:nth-child(2)", t: "This stage", fn: "stage" },
  { sel: ".home-row .geo-tile:nth-child(3)", t: "Your resume", x: "Your resume fills in by itself as you finish courses. Open it to edit sections, add experience or let AI draft a section, then download it." },
  { sel: "#updates", t: "Today's brief", x: "What moved in your job market, work headlines and how AI touches your career. It flips on its own; use the arrows to go back." },
  { sel: '#nav [data-page="mycareer"]', t: "My career", x: "The full picture of your career: how the score is calculated, which skills you have and which you still need, which tasks AI can do, and a Do I suit this job? check." },
  { sel: '#nav [data-page="careers"]', t: "Compare careers", x: "Compare every career side by side. Switch between the three futures to see how the ranking changes, and pick a different goal at any time." },
  { sel: '#nav [data-page="path"]', t: "Your path", x: "Every step to your goal, stage by stage. Tap a circle for the course, the hours and the UN Sustainable Development Goals it supports. Add tracks such as LinkedIn, real experience or networking." },
  { sel: '#nav [data-page="jobcheck"]', t: "Job check", x: "Paste a real job ad to see how well you match it and what to learn before you apply." },
  { sel: '#nav [data-page="updates"]', t: "Fresh data", x: "Open Updates to fetch the newest job posts and headlines, and see what changed in your career, the rankings, your path and the news." },
  { sel: "#helper", t: "Ask Lambtae", x: "Ask anything about your plan, such as what to learn first or whether a job suits you. You can replay this guide or your story from the menu under your name." },
];
const TOUR = () => isTeamUser() ? TEAM_TOUR : ME_TOUR;
// Text for the guide stops that explain the user's own numbers.
function fitWhy(res, r) {
  return {
    skill: res.matched.length ? T("you already have {skills}", { skills: res.matched.map((m) => cl(m.cluster).label).join(", ") }) : T("you have none of its entry skills yet"),
    outlook: T(res.components.outlook > 0.55 ? "job posts asking for its skills are rising" : res.components.outlook < 0.45 ? "job posts asking for its skills are falling" : "demand for its skills is about flat"),
    transfer: T("your people skills carry over"), interest: T("it matches what you enjoy"), green: T("it is a low-carbon career"),
    exposure: r.exposure ? T("points taken off because AI can already do some of its tasks ({cat}, ILO)", { cat: TS(r.exposure.category) }) : T("AI can do part of the work"),
  };
}
const TOUR_FN = {
  goal: () => { const pw = st.path, r = roleOf(A().role); return `<p class="small">${esc(T("You are working towards {role}. The line under it shows the jobs on the way: {ladder}.", { role: r.title, ladder: pw.stages.map((x) => x.title).join(" → ") }))}</p><p class="small">${esc(T("The ring shows how much of the path you have done. It fills as you mark steps done."))}</p>`; },
  why: () => {
    const r = roleOf(A().role), res = rows().find((x) => x.role === A().role); if (!res) return "";
    const label = Object.fromEntries(CALC_PARTS.map(([k, l]) => [k, T(l)]));
    const why = fitWhy(res, r);
    const parts = Object.entries(res.points).filter(([, v]) => Math.abs(v) >= 0.05).sort((p1, p2) => p2[1] - p1[1]);
    const best = rows()[0];
    return `<p class="small">${esc(T("{role} scores {score} out of 100 for you ({fit}). Here is where the points come from:", { role: r.title, score: Math.round(res.score), fit: fitLabel(res.score) }))}</p>
      <ul class="small tour-why">${parts.map(([k, v]) => `<li><b class="mono ${v < 0 ? "down" : ""}">${v > 0 ? "+" : ""}${v.toFixed(1)}</b> <span><b>${esc(label[k] || k)}</b>: ${esc(why[k] || "")}</span></li>`).join("")}</ul>
      ${res.gaps.length ? `<p class="small">${esc(T("Still to learn for the entry job: {skills}.", { skills: res.gaps.map((g) => cl(g.cluster).label).join(", ") }))}</p>` : ""}
      ${best && best.role !== A().role ? `<p class="small muted">${esc(T("Your highest score overall is {role} ({score}). You chose {mine}; you can change your goal in Careers overview.", { role: roleOf(best.role).title, score: Math.round(best.score), mine: r.title }))}</p>` : ""}`;
  },
  next: () => {
    const n = currentNode(); if (!n) return `<p class="small">${T("You finished every step. Well done!")}</p>`;
    const c = n.type === "skill" && n.items[0];
    return `<p class="small">${esc(T("Your next step is {step}, in the {stage} stage.", { step: nodeLabel(n), stage: n.stage.title }))}${c ? " " + esc(T("Suggested course: {course} by {provider}, about {h} hours.", { course: c.title, provider: c.provider, h: c.hours })) : ""}</p>
      ${n.type === "skill" ? `<p class="small">${esc(n.basis === "future" ? T("It comes early because employers increasingly ask for it in this kind of job.") : T("It comes early because it is an entry skill for {role}.", { role: n.stage.title }))}${n.demand_change != null ? " " + esc(T("Job posts asking for it: {d}.", { d: demandText(n.demand_change) })) : ""}</p>` : ""}
      <p class="small muted">${T("Press Start this step to open it on your path.")}</p>`;
  },
  stage: () => { const pw = st.path, n = currentNode(), sg = pw.stages[n ? n.si : pw.stages.length - 1]; return `<p class="small">${esc(T("You are in the {stage} stage, aiming for {role}. At {h} hours a week this stage takes about {a}–{b} weeks.", { stage: TS(sg.stage), role: sg.title, h: pw.hours_per_week, a: sg.weeks[0], b: sg.weeks[1] }))}</p><p class="small">${esc(T("The first tile is your fit score. Tap the ? next to any number to see how it is worked out."))}</p>`; },
};
const tourKey = () => isTeamUser() ? "teamTour" : "meTour";
let tourAt = -1;
// stop wheel and touch scrolling (and Lenis) so the page cannot slide away from the highlight
function tourLock(on) {
  document.documentElement.classList.toggle("tour-lock", on);
  if (lenis) { if (on) lenis.stop(); else lenis.start(); }
}
function tourShow(i, dir = 1) {
  tourAt = i;
  document.querySelectorAll(".tour-layer").forEach((x) => x.remove());
  if (i < 0 || i >= TOUR().length) { tourLock(false); tourAt = -1; if (A() && !A().prefs[tourKey()]) { A().prefs[tourKey()] = true; save(); } return; }
  const step = TOUR()[i], el = document.querySelector(step.sel);
  if (!el || !el.getClientRects().length) { tourShow(i + dir, dir); return; }
  tourLock(false);
  el.scrollIntoView({ block: "center" });
  setTimeout(() => {
    tourLock(true);
    const r = el.getBoundingClientRect(), pad = 8;
    const layer = document.createElement("div");
    layer.className = "tour-layer"; layer.setAttribute("role", "dialog"); layer.setAttribute("aria-modal", "true"); layer.setAttribute("aria-labelledby", "tourTitle");
    const top = Math.max(8, r.top - pad), left = Math.max(8, r.left - pad), w = Math.min(window.innerWidth - 16, r.width + pad * 2), h = Math.min(window.innerHeight - 16, r.height + pad * 2);
    const below = top + h + 220 < window.innerHeight, cardTop = below ? top + h + 12 : Math.max(12, top - 212);
    layer.innerHTML = `<div class="tour-spot" style="top:${top}px;left:${left}px;width:${w}px;height:${h}px"></div>
      <div class="tour-card card stack" style="top:${Math.min(cardTop, window.innerHeight - 200)}px;left:${Math.max(12, Math.min(left, window.innerWidth - 372))}px">
        <span class="eyebrow">${esc(T("Guide · {n} of {total}", { n: i + 1, total: TOUR().length }))}</span><h3 id="tourTitle">${esc(T(step.t))}</h3>${step.fn ? TOUR_FN[step.fn]() : `<p class="small">${esc(T(step.x))}</p>`}
        <div class="row between"><button type="button" class="btn ghost small" id="tourSkip">${T("Skip guide")}</button><div class="row">${i ? `<button type="button" class="btn small" id="tourBack">${T("Back")}</button>` : ""}<button type="button" class="btn primary small" id="tourNext">${T(i === TOUR().length - 1 ? "Done" : "Next")}</button></div></div></div>`;
    document.body.append(layer);
    const card = layer.querySelector(".tour-card"), ch = card.offsetHeight, vh = window.innerHeight;
    const cw = card.offsetWidth, vw = window.innerWidth;
    if (top + h + 12 + ch < vh) card.style.top = top + h + 12 + "px";
    else if (top - 12 - ch > 0) card.style.top = top - 12 - ch + "px";
    else {  // no room above or below: sit beside the highlight
      card.style.top = Math.max(12, Math.min(top, vh - ch - 12)) + "px";
      if (left + w + 12 + cw < vw) card.style.left = left + w + 12 + "px";
      else if (left - 12 - cw > 0) card.style.left = left - 12 - cw + "px";
      else card.style.top = Math.max(12, vh - ch - 12) + "px";
    }
    layer.querySelector("#tourNext").focus();
  }, 350);
}
function vTeam() {
  const Tm = teamData(), target = st.teamTarget || Tm.target_role, r = roleOf(target);
  if (!teamReady() && !st.busy.team && !(st.teamError && st.teamError.key === teamKey())) loadTeamReport().then(render);
  const best = teamReady() ? Object.fromEntries(st.teamReport.people[st.scen].map((x) => [x.name, x.top[0]])) : {};
  const need = Object.fromEntries(r.req.map((x) => [x.cluster, x.level]));
  const cols = [...new Set([...Tm.columns, ...Object.keys(need)])];
  const cell = (v, nd) => { const c = nd ? (v >= nd ? 3 : v === nd - 1 ? 2 : v > 0 ? 1 : 0) : Math.min(v, 3); return `<span class="cell c${c}">${lvlDots(v)}<span>${esc(lv(v))}</span></span>`; };
  const gaps = Object.keys(need).map((k) => ({ k, n: Tm.people.filter(([, s]) => (s[k] || 0) < need[k]).length })).sort((a, b) => b.n - a.n);
  return `<div class="page">${intro(T("For HR and career centres"), TS(Tm.label), esc(TS(Tm.desc)))}
   ${vTeamTabs()}
   <div class="row between"><span></span>
     <div class="row"><label class="small">${T("Target")} <select id="teamTarget">${st.meta.roles.map((x) => `<option value="${x.id}" ${x.id === target ? "selected" : ""}>${esc(x.title)}</option>`).join("")}</select></label></div></div>
   <div class="card"><div class="tablewrap"><table class="skills-tbl"><thead><tr><th>${T("Person")}</th><th>${T("Best fit")}</th>${cols.map((k) => `<th>${esc(cl(k).label)}${need[k] ? `<br><span class="mono">${esc(T("needs {level}", { level: lv(need[k]) }))}</span>` : ""}</th>`).join("")}</tr></thead>
     <tbody>${teamPeople().map(([nm, s], i) => `<tr><td><button type="button" class="link-btn nowrap" data-member="${i}">${esc(nm)}</button></td><td class="small">${best[nm] ? `${esc(roleOf(best[nm].role).title)} <span class="mono muted">${Math.round(best[nm].score)}</span>` : "…"}</td>${cols.map((k) => `<td>${cell(s[k] || 0, need[k])}</td>`).join("")}</tr>`).join("")}</tbody></table></div>
     <p class="tiny muted" style="margin-top:8px">${T("Have a spreadsheet?")} <label class="text-link">${T("Import a CSV")}<input type="file" id="teamCsv" accept=".csv,text/csv" hidden></label> ${T("(name, then skill codes such as excel, genai, customer with levels 0–3).")}</p></div>
   <div class="card stack"><h3>${T("Biggest shared gaps")}</h3><div class="list">${gaps.map((g) => `<div><span>${esc(cl(g.k).label)}</span><span class="mono">${esc(T("{n} of {total} people", { n: g.n, total: Tm.people.length }))}</span></div>`).join("")}</div></div></div>`;
}
function vSources() {
  const m = st.meta, s = snap() || (st.analysis ? st.analysis.snapshot : null), l = m.llm;
  // Live sources are Fresh within a week of the last refresh, otherwise Stale; datasets are fixed versions.
  const age = s ? Math.round((Date.now() - Date.parse(s.as_of)) / 864e5) : null;
  const live = age != null && age <= 7 ? `<span class="status fresh">● ${T("Fresh")}</span>` : `<span class="status stale">! ${T("Stale")}</span>`;
  const fixed = `<span class="status fixed">${T("Fixed version")}</span>`;
  const LIC = { hn: "Public API; counts only", arxiv: "Metadata CC0", adzuna: "Adzuna terms" };
  const checked = m.catalogue.items.map((c) => c.link_checked_on).filter(Boolean).sort().pop();
  const rows2 = [[T("AI exposure by occupation"), m.sources.ilo.source, T("Research dataset"), m.sources.ilo.retrieved, "CC BY 4.0", fixed],
    [T("Occupations and skills"), m.sources.esco.source, T("Official classification"), m.sources.esco.retrieved, T("EU reuse, attribution"), fixed],
    [T("SDG targets"), m.sources.sdg.source, T("Official API"), m.sources.sdg.retrieved, T("UN terms of use"), fixed],
    ...(s ? Object.entries(s.sources).map(([k, x]) => [x.name, x.url || "", T("Live signal") + (x.posts_current ? ` · n = ${x.posts_current}` : ""), s.as_of, T(LIC[k] || "Provider terms"), live]) : []),
    [T("Landing background (decoration only)"), "Unsplash: Richard Horvath", T("Image"), "2026-10-21", "Unsplash License", fixed],
    [T("Courses"), T("Hand-curated catalogue; every link checked by script; a person reviews content and cost before marking it reviewed"), T("Closed list"), checked || T("see each course"), T("Links only"), fixed]];
  const sc = Object.entries(m.scenarios).map(([k, v]) => `<tr><td>${esc(TS(v.label))}</td>${["skill", "outlook", "transfer", "interest", "green", "exposure"].map((x) => `<td class="mono">${(x === "exposure" ? "−" : "") + v.weights[x].toFixed(2)}</td>`).join("")}</tr>`).join("");
  return `<div class="page">${intro(T("How it works"), T("Sources and method"), T("Every number comes from one of these sources. Careers come from ESCO, courses from a checked list, trends from dated snapshots."))}
   <div class="card"><div class="tablewrap"><table><thead><tr><th>${T("Layer")}</th><th>${T("Source")}</th><th>${T("Type")}</th><th>${T("Retrieved")}</th><th>${T("Licence")}</th><th>${T("Status")}</th></tr></thead><tbody>${rows2.map((r) => `<tr><td><b>${esc(r[0])}</b></td><td class="small">${esc(r[1])}</td><td class="small">${esc(r[2])}</td><td class="mono small">${esc(r[3])}</td><td class="small">${esc(r[4])}</td><td>${r[5]}</td></tr>`).join("")}</tbody></table></div>
     <p class="tiny muted" style="margin-top:8px">${T("Live signals refresh daily. Stale means the last refresh is more than a week old, so trend advice may be out of date.")}</p>
     <p class="small" style="margin-top:6px">${m.refresh && m.refresh.auto ? (m.refresh.running ? `<span class="spin"></span> ${T("Fetching today's job-post and research data now…")}` : `● ${esc(T("Automatic refresh is on: the app fetches new data once a day. Latest data: {date}.", { date: s ? s.as_of : "—" }))}`) : esc(T("Automatic refresh is off. Run python -m ingest.refresh to update."))}${m.refresh && m.refresh.error ? ` <span class="tiny" style="color:var(--warn)">${esc(T("Last attempt failed; it will retry within an hour."))}</span>` : ""}</p></div>
   <div class="grid cols-2"><div class="card stack"><h3>${T("Score")}</h3><pre lang="en">score = ( skill·match + outlook·demand + transfer·human skills
        + interest·fit + green·low-carbon role − exposure·AI )
        ÷ (sum of positive weights) × 100</pre><p class="small muted">${T("Green only counts in the Green transition scenario. Age, situation and explanation style are never used.")}</p></div>
   <div class="card stack"><h3>${T("Weights")}</h3><div class="tablewrap"><table><thead><tr><th></th>${["skill", "outlook", "transfer", "interest", "green", "exposure"].map((h) => `<th>${T(h)}</th>`).join("")}</tr></thead><tbody>${sc}</tbody></table></div></div></div>
   <div class="card stack"><h3>${T("Words we use")}</h3><div class="list">${Object.keys(GLOSSARY).map((k) => `<div><span><b>${T(GLOSS_LABEL[k])}</b></span><span class="small" style="text-align:right">${esc(gloss(k))}</span></div>`).join("")}</div></div>
   <div class="card stack"><h3>${T("AI model")}</h3><p class="small">${l.available ? esc(T("{model} via {via}. It may only pick skills it can quote from your text, reword explanations and resume lines without adding facts, and read a CV after contact details are removed. It never picks careers, courses or scores.", { model: l.model, via: l.via })) : T("Not connected.")}</p></div></div>`;
}

// ---------- assistant: the lamb in the suitcase ------------------------------------------
// A work suitcase sits at the bottom right of every signed-in page. Opening it sends a few
// resumes flying and the lamb pops out with a chat box. Answers come from /api/chat, which
// only uses the person's own plan and the app's data; history is saved to the account.
// The artwork is original SVG drawn for this project.
// The suitcase is drawn in two layers so the lamb and the resumes can rise from inside it:
// the back (handle and lid, which lifts from the front) and the front body that hides them.
const CASE_BACK = `<svg class="case-back" viewBox="0 0 120 100" aria-hidden="true">
  <g class="lid"><path d="M46 24v-7a6 6 0 0 1 6-6h16a6 6 0 0 1 6 6v7" fill="none" stroke="#111" stroke-width="5" stroke-linecap="round"/>
    <rect x="8" y="22" width="104" height="22" rx="7" fill="#1E1E21" stroke="#111" stroke-width="2"/>
    <rect x="53" y="36" width="14" height="9" rx="2" fill="#1F3BD9" stroke="#111" stroke-width="1.5"/></g>
  <rect x="12" y="38" width="96" height="10" fill="#0B0B0C"/>
</svg>`;
const CASE_FRONT = `<svg class="case-front" viewBox="0 0 120 100" aria-hidden="true">
  <rect x="8" y="42" width="104" height="52" rx="7" fill="#1E1E21" stroke="#111" stroke-width="2"/>
  <rect x="14" y="48" width="92" height="40" rx="4" fill="none" stroke="rgba(244,242,236,.28)" stroke-width="1.2" stroke-dasharray="3 4"/>
  <line x1="8" y1="44" x2="112" y2="44" stroke="rgba(244,242,236,.4)" stroke-width="1.2"/>
  <rect x="55" y="42" width="10" height="6" rx="1.5" fill="#1F3BD9" stroke="#111" stroke-width="1.2"/>
  <circle cx="92" cy="72" r="9" fill="#F4F2EC"/><path d="M92 63a9 9 0 0 1 0 18z" fill="#1F3BD9"/>
</svg>`;
// The lamb is a separate image so the team can swap in their own art (static/art/lamb.png).
const lambSrc = () => (st.meta && st.meta.art && st.meta.art.lamb) || "/static/art/lamb.svg";
const lambImg = (cls) => `<img class="${cls}" src="${lambSrc()}" alt="" draggable="false">`;
const PAPER = `<svg viewBox="0 0 30 38" aria-hidden="true"><rect x="1" y="1" width="28" height="36" rx="2" fill="#FAF9F5" stroke="#111" stroke-width="1.5"/><circle cx="8" cy="9" r="3.5" fill="#1F3BD9"/><path d="M14 8h10M14 12h7M6 19h18M6 24h18M6 29h12" stroke="#111" stroke-width="1.4" stroke-linecap="round"/></svg>`;
// The corner behind Lambtae, drawn like the landing composition: a ring, one flat accent
// quarter disc, a striped circle, a dot and one leading line.
const HELPER_GEO = `<svg class="helper-geo" viewBox="0 0 220 220" aria-hidden="true">
  <defs><clipPath id="hgStripe"><circle cx="70" cy="150" r="26"/></clipPath></defs>
  <circle cx="220" cy="220" r="196" fill="none" stroke="var(--ink)" stroke-opacity=".35" stroke-width="1.2"/>
  <circle cx="220" cy="220" r="138" fill="var(--accent)" fill-opacity=".9"/>
  <g clip-path="url(#hgStripe)" stroke="var(--ink)" stroke-opacity=".55" stroke-width="4">${Array.from({ length: 8 }, (_, i) => `<line x1="40" x2="100" y1="${126 + i * 7}" y2="${126 + i * 7}"/>`).join("")}</g>
  <circle cx="150" cy="40" r="6" fill="var(--ink)"/>
  <line x1="0" y1="206" x2="220" y2="96" stroke="var(--ink)" stroke-opacity=".3" stroke-width="1"/>
</svg>`;
const HELPER_NAME = "Lambtae";  // a name, so the same in every language
const SUGGEST = ["What should I do next?", "Which careers fit me best?", "How do I build my resume?", "Where does the data come from?"];
st.chat = { open: false, opening: false, loaded: false, busy: false, messages: [], draft: "", quote: null };
const TEAM_SUGGEST = ["Where should we start?", "Which careers suit the group?", "How do we fund this?", "How do I read the map?"];
const helperVisible = () => !!A() && A().onboarded && !["signin", "wizard", "teamperson", "teamreport"].includes(st.page);
function chatMsg(m) {
  if (m.role === "user") return `<div class="msg me">${m.quote ? `<blockquote class="msg-quote">${m.section ? `<span>${esc(m.section)}</span>` : ""}${esc(m.quote)}</blockquote>` : ""}<p>${esc(m.text)}</p>${!m.quote && !isTeamUser() && A().role && m.text.length >= 12 ? `<button type="button" class="chat-track" data-trackgoal="${esc(m.text)}">${SPARK.replace('width="22" height="22"', 'width="13" height="13"')} ${T("Make this a track")}</button>` : ""}</div>`;
  const links = (m.links || []).map((p) => `<button type="button" class="btn chat-link" data-page="${esc(p)}">${esc(T(PAGE_NAME[p] || p))} →</button>`).join("");
  const srcs = (m.sources || []).map((s) => { const i = s.indexOf(": "); return `<span class="chat-src">${SRC_ICON}${esc(i > 0 ? T(s.slice(0, i)) + ": " + s.slice(i + 2) : s)}</span>`; }).join("");
  const how = m.method === "llm" ? T("AI answer from your plan ({model}). Check before you act.", { model: m.model }) : T("Quick answer from your plan.");
  return `<div class="msg bot"><p>${esc(TS(m.text))}</p>${links ? `<div class="chat-links">${links}</div>` : ""}${srcs ? `<div class="chat-srcs">${srcs}</div>` : ""}<span class="chat-how">${esc(how)}</span></div>`;
}
const PAGE_NAME = { dashboard: "Home", interview: "Interview practice", jobcheck: "Job check", news: "News", mycareer: "My career", careers: "Compare careers", path: "My path", resume: "Resume", wizard: "Edit about you", sources: "Data and sources", team: "For HR teams" };
function renderHelper() {
  const root = $("#helper"); if (!root) return;
  if (!helperVisible()) { root.innerHTML = ""; root.className = ""; return; }
  const c = st.chat, typing = document.activeElement && document.activeElement.id === "chatInput";
  root.className = "helper" + (c.open ? " is-open" : "") + (c.opening ? " opening" : "") + (A().prefs.helperSeen ? "" : " is-new");
  const papers = [[-18, -12], [18, 10], [-4, -4]].map(([x, r], i) => `<span class="cv-sheet p${i}" style="--x:${x}px;--r:${r}deg">${PAPER}</span>`).join("");
  const panel = c.open ? `<section class="chat" role="dialog" aria-modal="false" aria-labelledby="chatTitle">
      <header class="chat-head"><span class="chat-peek">${lambImg("lamb-art")}</span><div><h2 id="chatTitle">${HELPER_NAME}</h2><p>${T("Your career helper")}</p></div>
        <div class="chat-tools"><button type="button" class="icon-btn" id="chatClear" title="${T("Clear chat")}" aria-label="${T("Clear chat")}"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg></button>
        <button type="button" class="icon-btn" id="chatClose" title="${T("Close")}" aria-label="${T("Close")}">✕</button></div></header>
      <div class="chat-log" id="chatLog" aria-live="polite">
        ${!c.loaded ? `<p class="chat-note"><span class="spin"></span> ${T("Opening…")}</p>` : ""}
        ${c.loaded && !c.messages.length ? `<div class="msg bot"><p>${esc(T("Hi {name}! I can explain your plan, your next step, the careers that fit you and how this app works. What would you like to know?", { name: firstName() }))}</p><p class="chat-hint">${esc(T("Tip: highlight any text to ask {name} about it", { name: HELPER_NAME }))}</p></div>
          <div class="chat-suggest">${(isTeamUser() ? TEAM_SUGGEST : SUGGEST).map((q) => `<button type="button" class="chip" data-ask="${esc(q)}">${esc(T(q))}</button>`).join("")}</div>` : ""}
        ${c.messages.map(chatMsg).join("")}
        ${c.busy ? `<div class="msg bot typing" aria-label="${esc(T("{name} is thinking", { name: HELPER_NAME }))}"><span></span><span></span><span></span></div>` : ""}
      </div>
      ${c.quote ? `<div class="chat-quote"><blockquote>${esc(c.quote.text)}</blockquote><button type="button" class="icon-btn" id="quoteDrop" aria-label="${T("Remove highlighted text")}" title="${T("Remove highlighted text")}">✕</button></div>` : ""}
      <form class="chat-form" id="chatForm"><label class="sr-only" for="chatInput">${esc(T("Ask {name}", { name: HELPER_NAME }))}</label>
        <textarea id="chatInput" rows="1" maxlength="600" placeholder="${T(c.quote ? "What do you want to know about it?" : "Ask about your plan or this app…")}" ${c.busy ? "disabled" : ""}>${esc(c.draft)}</textarea>
        ${micBtn("chatInput")}<button type="submit" class="btn primary" ${c.busy ? "disabled" : ""} aria-label="${T("Send")}">${T("Send")}</button></form>
      <p class="chat-foot">${T("Answers use only your plan and the app's data. They are estimates; check before you act.")}</p>
    </section>` : "";
  root.innerHTML = `${panel}${HELPER_GEO}${c.open ? "" : `<span class="case-label" aria-hidden="true">${esc(T("Ask {name}", { name: HELPER_NAME }))}</span>`}<button type="button" class="case-btn" id="caseBtn" aria-expanded="${c.open}" aria-label="${T(c.open ? "Close the career helper" : "Open the career helper")}" title="${T(c.open ? "Close the career helper" : "Open the career helper")}">
      ${CASE_BACK}<span class="peek">${papers}${lambImg("peek-lamb")}</span>${CASE_FRONT}</button>`;
  const log = $("#chatLog"); if (log) log.scrollTop = log.scrollHeight;
  const inp = $("#chatInput"); if (typing && inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
}
async function openChat() {
  const c = st.chat;
  if (c.open) { c.open = false; c.quote = null; selClear(); renderHelper(); $("#caseBtn").focus(); return; }
  const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!calm) { c.opening = true; renderHelper(); await new Promise((r) => setTimeout(r, 420)); }
  c.opening = false; c.open = true; renderHelper();
  const inp = $("#chatInput"); if (inp) inp.focus();
  if (!c.loaded) {
    try { c.messages = (await api("/api/chat")).messages; } catch (e) { c.messages = []; }
    c.loaded = true; renderHelper(); const i2 = $("#chatInput"); if (i2) i2.focus();
  }
}
async function sendChat(text) {
  const c = st.chat, msg = String(text || "").trim(); if (!msg || c.busy) return;
  const q = c.quote; c.quote = null;
  c.messages.push({ role: "user", text: msg, ...(q ? { quote: q.text, section: q.section } : {}) }); c.draft = ""; c.busy = true; renderHelper();
  try {
    clearTimeout(tSave); if (A()) await api("/api/me", Object.fromEntries(DATA_KEYS.map((k) => [k, A()[k]])), false, "PUT");
    const body = { message: msg, lang: LANG, page: st.page, ...(q ? { quote: q.text, section: q.section || null } : {}) };
    if (isTeamUser()) {  // skill levels only: names are replaced before anything leaves the browser
      const Tm = teamData();
      body.team = { people: Tm.people.map(([, sk], i) => [`Person ${i + 1}`, sk]), target_role: st.teamTarget || Tm.target_role, budget: P().budget || "free", kind: P().situation };
    }
    const r = await api("/api/chat", body);
    c.messages.push({ role: "assistant", ...r });
  } catch (e) { c.messages.push({ role: "assistant", text: T("Sorry, I could not answer just now: {e}", { e: e.message }), links: [], sources: [], method: "rules" }); }
  c.busy = false; renderHelper(); const inp = $("#chatInput"); if (inp) inp.focus();
}

// ---------- Ask Lambtae about anything on the page ------------------------------------------
// Select any text in the app and a small bar appears next to it: "Explain this", "What it means
// for me" or "Ask…". The highlighted words, and the heading of the card they came from, go to
// /api/chat as page content (never as instructions), so Lambtae explains them with the person's own
// plan. The words stay marked on the page while Lambtae answers (CSS Custom Highlight API, where the
// browser has it).
const SEL_MAX = 500;
let selRange = null, tSel = null;
const selHL = () => (window.CSS && CSS.highlights && window.Highlight ? CSS.highlights : null);
function selSection(node) {
  const el = node && (node.nodeType === 1 ? node : node.parentElement); if (!el) return "";
  const box = el.closest(".card, section, .kpi, .page-head, .zone-card, .quick-btn, tr");
  const h = box && (box.querySelector("h2, h3") || box.querySelector(".k-label, .eyebrow"));
  const head = h && !h.contains(el) ? h.textContent.replace(/\s+/g, " ").trim().slice(0, 80) : "";
  return [T(PAGE_NAME[st.page] || ""), head].filter(Boolean).join(" · ").slice(0, 120);
}
function selHide() { const b = $("#askSel"); if (b) b.hidden = true; selRange = null; }
function selCheck() {
  const sel = window.getSelection(), bar = $("#askSel");
  if (!bar || !helperVisible() || !sel || sel.isCollapsed || !sel.rangeCount) return selHide();
  const r = sel.getRangeAt(0), n = r.commonAncestorContainer, host = n.nodeType === 1 ? n : n.parentElement;
  if (!host || !host.closest("#app") || host.closest("input, textarea, select, [contenteditable], .chat, #askSel")) return selHide();
  if (sel.toString().replace(/\s+/g, " ").trim().length < 2) return selHide();
  selRange = r.cloneRange(); bar.hidden = false; selPlace();
}
function selPlace() {
  const bar = $("#askSel"); if (!bar || bar.hidden || !selRange) return;
  const rects = [...selRange.getClientRects()].filter((x) => x.width || x.height);
  const first = rects[0] || selRange.getBoundingClientRect(), last = rects[rects.length - 1] || first;
  const vw = document.documentElement.clientWidth, vh = window.innerHeight, bw = bar.offsetWidth, bh = bar.offsetHeight, gap = 10;
  // touch screens show their own copy menu above the selection, so the bar goes below it there
  const touch = window.matchMedia("(pointer: coarse)").matches;
  let top = touch ? last.bottom + gap + 18 : first.top - bh - gap;
  if (!touch && top < 64) top = last.bottom + gap;
  const floor = document.body.classList.contains("has-nav") && vw < 1024 ? vh - 80 : vh - 8;
  top = Math.max(8, Math.min(top, floor - bh));
  const mid = touch ? (last.left + last.right) / 2 : (first.left + first.right) / 2;
  bar.style.left = `${Math.max(8, Math.min(mid - bw / 2, vw - bw - 8))}px`; bar.style.top = `${top}px`;
}
async function askAbout(kind) {
  if (!selRange) return;
  let text = selRange.toString().replace(/\s+/g, " ").trim();
  if (text.length > SEL_MAX) text = text.slice(0, SEL_MAX - 1) + "…";
  const section = selSection(selRange.commonAncestorContainer), hl = selHL();
  if (hl) hl.set("lambtae", new Highlight(selRange.cloneRange()));
  window.getSelection().removeAllRanges(); selHide(); selTipDone();
  const c = st.chat; c.quote = { text, section };
  if (!c.open) await openChat(); else renderHelper();
  if (kind === "own") { const inp = $("#chatInput"); if (inp) inp.focus(); return; }
  sendChat(T(kind === "me" ? "What does this mean for me?" : "Explain this in simple words."));
}
// A reminder in the top bar that any text can be highlighted and asked about. It goes away when the
// person closes it or uses the feature once.
const selTip = () => (A().prefs.selTipSeen ? "" : `<p class="sel-tip"><span class="sel-tip-mark" aria-hidden="true">${LAMB_FACE}</span><span>${esc(T("Tip: highlight any text to ask {name} about it", { name: HELPER_NAME }))}</span><button type="button" id="selTipX" aria-label="${T("Hide tip")}" title="${T("Hide tip")}">✕</button></p>`);
function selTipDone() { if (A() && !A().prefs.selTipSeen) { A().prefs.selTipSeen = true; save(); } document.querySelector(".sel-tip")?.remove(); }
const selClear = () => { const hl = selHL(); if (hl) hl.delete("lambtae"); };
const LAMB_FACE = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 9.5a2.5 2.5 0 1 1 1.8-4.3A3 3 0 0 1 15.2 5.2 2.5 2.5 0 1 1 17 9.5"/><path d="M7.5 9.5c0 5 2 9 4.5 9s4.5-4 4.5-9"/><circle cx="10.2" cy="12" r=".6" fill="currentColor"/><circle cx="13.8" cy="12" r=".6" fill="currentColor"/></svg>`;
function renderAskSel() {
  let bar = $("#askSel");
  if (!bar) {
    bar = document.createElement("div"); bar.id = "askSel"; bar.className = "ask-sel"; bar.hidden = true; bar.setAttribute("role", "toolbar");
    document.body.appendChild(bar);
    bar.addEventListener("mousedown", (ev) => ev.preventDefault());  // keep the selection while the bar is pressed
    bar.addEventListener("click", (ev) => { const b = ev.target.closest("[data-asksel]"); if (b) askAbout(b.dataset.asksel); });
  }
  bar.setAttribute("aria-label", T("Ask {name}", { name: HELPER_NAME }));
  bar.innerHTML = `<span class="ask-sel-who">${LAMB_FACE}<span>${esc(HELPER_NAME)}</span></span>
    <button type="button" data-asksel="explain">${T("Explain this")}</button>
    <button type="button" data-asksel="me">${T("What it means for me")}</button>
    <button type="button" data-asksel="own" title="${T("Ask your own question")}">${T("Ask…")}</button>`;
}
document.addEventListener("selectionchange", () => { clearTimeout(tSel); tSel = setTimeout(selCheck, 180); });
window.addEventListener("scroll", () => requestAnimationFrame(selPlace), { passive: true });
window.addEventListener("resize", () => requestAnimationFrame(selPlace));

// ---------- mock interview with Lambtae ------------------------------------------------------------
// Five questions for the job the person is about to apply for (from /api/interview): who they are,
// two skills they already have, one they are still building, and working with AI. Each answer gets
// a checklist from simple rules and, when the model is switched on, a few kind sentences and a
// stronger first line. Answers stay in this browser tab; the server checks them and keeps nothing.
const IV_CHECKS = [["example", "A real example"], ["action", "What you did"], ["result", "The result"], ["skill", "Skill named"], ["length", "Good length"]];
const ivState = () => (st.iv = st.iv || { stage: null, data: null, i: 0, answers: {}, fb: {}, busy: false, started: false, loading: false });
const ivQ = (q) => T(q.text, Object.fromEntries(Object.entries(q.params || {}).map(([k, v]) => [k, k === "skill" && q.skill ? cl(q.skill).label : v])));
async function ivLoad() {
  const v = ivState(); if (v.loading) return; v.loading = true;
  const stage = v.stage != null ? v.stage : (currentNode() ? currentNode().si : 0);
  try { v.data = await api(`/api/interview?stage=${stage}`); v.stage = v.data.stage; } catch (e) { v.data = { job: null, questions: [], error: e.message }; }
  v.loading = false; render();
}
function ivSpeak(text) {
  if (!window.speechSynthesis) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text); u.lang = SPEECH_LANG[LANG] || "en-MY"; u.rate = 0.95;
  speechSynthesis.speak(u);
}
function vInterview() {
  if (!A().role) return `<div class="page">${intro(T("Interview practice"), T("Choose a career first"), "")}<button class="btn primary" type="button" data-page="careers">${T("Go to careers")}</button></div>`;
  const v = ivState();
  if (!v.data || v.data.job === undefined) { ivLoad(); return skeleton(2, T("Lambtae is preparing your questions…")); }
  const qs = v.data.questions || [], job = v.data.job;
  const head = intro(T("Interview practice"), T("Practise for {job}", { job: job || "" }),
    T("Lambtae asks five questions for this job and gives feedback on each answer. Your answers are not saved."),
    `<button class="btn" type="button" data-page="path">${T("Back to my path")}</button>`);
  if (!qs.length) return `<div class="page">${head}<p class="note warn small">${esc(v.data.error || T("No questions for this career yet."))}</p></div>`;
  const lamb = `<span class="iv-lamb" aria-hidden="true">${lambImg("lamb-art")}</span>`;
  if (!v.started) {
    return `<div class="page iv">${head}
      <section class="card iv-start">${lamb}
        <div class="stack" style="gap:10px;min-width:0"><h3>${T("Ready when you are")}</h3>
          <ul class="iv-list">${qs.map((q, k) => `<li><span class="n">${k + 1}</span>${esc(T(IV_KIND[q.kind] || q.kind))}</li>`).join("")}</ul>
          <p class="small muted">${T("Answer as you would in a real interview: a real example, what you did, and the result. Type or tap the microphone to speak.")}</p>
          <div class="row"><button class="btn primary big" type="button" data-iv="start">${T("Start the interview")}</button></div></div>
      </section></div>`;
  }
  if (v.i >= qs.length) return `<div class="page iv">${head}${ivSummary(qs)}</div>`;
  const q = qs[v.i], fb = v.fb[v.i], text = ivQ(q), ans = v.answers[v.i] || "";
  const checks = fb ? `<ul class="iv-checks">${IV_CHECKS.filter(([k]) => fb.checks[k] !== null && fb.checks[k] !== undefined).map(([k, l]) => `<li class="${fb.checks[k] ? "ok" : ""}"><span aria-hidden="true">${fb.checks[k] ? "✓" : "○"}</span>${T(l)}</li>`).join("")}</ul>` : "";
  return `<div class="page iv">${head}
    <div class="iv-progress" role="img" aria-label="${esc(T("Question {n} of {total}", { n: v.i + 1, total: qs.length }))}">${qs.map((_, k) => `<i class="${k < v.i ? "done" : k === v.i ? "now" : ""}"></i>`).join("")}</div>
    <section class="card iv-q">
      <div class="iv-ask">${lamb}<div class="stack" style="gap:6px;min-width:0"><span class="eyebrow">${esc(T("Question {n} of {total}", { n: v.i + 1, total: qs.length }))} · ${esc(T(IV_KIND[q.kind] || q.kind))}</span>
        <h3 class="iv-text">${esc(text)}</h3>
        ${window.speechSynthesis ? `<button type="button" class="btn ghost iv-listen" data-iv="listen">🔊 ${T("Listen")}</button>` : ""}</div></div>
      <label class="sr-only" for="ivAnswer">${T("Your answer")}</label>
      <div class="iv-answer"><textarea id="ivAnswer" rows="6" maxlength="2000" placeholder="${T("Type your answer, or tap the microphone and speak…")}" ${fb || v.busy ? "readonly" : ""}>${esc(ans)}</textarea>${fb ? "" : micBtn("ivAnswer")}</div>
      ${fb ? `<div class="iv-fb" aria-live="polite">
          ${checks}
          ${fb.text ? `<p>${esc(fb.text)}</p>` : `<ul class="iv-tips">${fb.tips.map((t) => `<li>${esc(T(t))}</li>`).join("")}</ul>`}
          ${fb.better_start ? `<p class="iv-better"><span class="label">${T("A stronger first line")}</span>“${esc(fb.better_start)}”</p>` : ""}
          <span class="chat-how">${esc(fb.method === "llm" ? T("Feedback from {model}, checked against your answer.", { model: fb.model }) : T("Feedback from a simple checklist."))}</span>
        </div>
        <div class="row between"><button class="btn ghost" type="button" data-iv="retry">${T("Try this one again")}</button><button class="btn primary" type="button" data-iv="next">${T(v.i + 1 < qs.length ? "Next question →" : "See my summary →")}</button></div>`
      : `<div class="row between"><button class="btn ghost" type="button" data-iv="skip">${T("Skip")}</button><button class="btn primary" type="button" data-iv="check" ${v.busy ? "disabled" : ""}>${v.busy ? `<span class="spin"></span> ${T("Lambtae is listening…")}` : T("Get feedback")}</button></div>`}
    </section></div>`;
}
const IV_KIND = { intro: "About you", skill: "A skill you have", gap: "A skill you are building", ai: "Working with AI", close: "Why you" };
function ivSummary(qs) {
  const v = st.iv, got = qs.map((_, k) => v.fb[k]).filter(Boolean);
  const tot = IV_CHECKS.map(([k, l]) => { const rel = got.filter((f) => f.checks[k] !== null && f.checks[k] !== undefined); return [k, l, rel.filter((f) => f.checks[k]).length, rel.length]; }).filter((x) => x[3]);
  const score = got.reduce((s, f) => s + f.score, 0), of = got.reduce((s, f) => s + f.of, 0), pct = of ? Math.round(score / of * 100) : 0;
  const weak = tot.filter((x) => x[2] < x[3]).sort((a, b) => a[2] / a[3] - b[2] / b[3])[0];
  return `<section class="card iv-sum">
    <div class="row" style="gap:18px;flex-wrap:nowrap">${progressGeo(pct, T("{pct}% of the checklist covered", { pct }))}<div class="stack" style="gap:6px;min-width:0">
      <span class="eyebrow">${T("Your practice")}</span><h3>${T(pct >= 80 ? "Strong answers. You are ready to apply." : pct >= 50 ? "Good base. One habit will make it stronger." : "A good first try. Practise once more.")}</h3>
      <p class="small muted">${esc(T("{n} of {total} questions answered", { n: got.length, total: qs.length }))}</p></div></div>
    <ul class="iv-bars">${tot.map(([k, l, a, b]) => `<li><span>${T(l)}</span><span class="track"><span class="fill" style="display:block;width:${Math.round(a / b * 100)}%"></span></span><span class="mono small">${a}/${b}</span></li>`).join("")}</ul>
    ${weak ? `<p class="note accent small"><b>${T("Practise next:")}</b> ${esc(T(TIPS_IV[weak[0]]))}</p>` : ""}
    <div class="row"><button class="btn primary" type="button" data-iv="restart">${T("Practise again")}</button><button class="btn" type="button" data-page="resume">${T("Open my resume")}</button></div>
  </section>`;
}
const TIPS_IV = {
  example: "Start with a real example: where you were and what was happening.",
  action: "Say what you did yourself, with words like \"I set up\" or \"I checked\".",
  result: "End with the result: what changed, how much time it saved, or what you learned.",
  skill: "Name the skill they asked about, so the interviewer hears it clearly.",
  length: "Aim for about 4 to 8 sentences: long enough for an example, short enough to keep attention.",
};
async function ivAction(a) {
  const v = ivState(), qs = (v.data && v.data.questions) || [];
  if (a === "start") { v.started = true; v.i = 0; render(); scrollTop(); return; }
  if (a === "listen") { if (qs[v.i]) ivSpeak(ivQ(qs[v.i])); return; }
  if (a === "skip" || a === "next") { if (window.speechSynthesis) speechSynthesis.cancel(); v.i += 1; render(); scrollTop(); if (v.i < qs.length) setTimeout(() => $("#ivAnswer")?.focus(), 50); return; }
  if (a === "retry") { delete v.fb[v.i]; render(); setTimeout(() => $("#ivAnswer")?.focus(), 50); return; }
  if (a === "restart") { Object.assign(v, { i: 0, answers: {}, fb: {}, started: true }); render(); scrollTop(); return; }
  if (a === "check") {
    const ans = (v.answers[v.i] || "").trim(); if (!ans) { $("#ivAnswer")?.focus(); toast(T("Write or say your answer first.")); return; }
    v.busy = true; render();
    try { v.fb[v.i] = await api("/api/interview/feedback", { question: qs[v.i], answer: ans, lang: LANG, use_model: !!st.meta.llm.available }); }
    catch (e) { toast(T("Sorry, I could not answer just now: {e}", { e: e.message })); }
    v.busy = false; render();
  }
}

// ---------- learning plan in the calendar ------------------------------------------------------------
// Turns the steps still to do into study sessions on the days and time the person picks, sized
// from each course's hours, and downloads them as one .ics file that Google Calendar, Outlook and
// phone calendars can import. Times are local ("floating"), so they stay at 8 pm wherever the
// phone is. Built in the browser; nothing is sent anywhere.
const CAL_DAYS = [[1, "Mon"], [2, "Tue"], [3, "Wed"], [4, "Thu"], [5, "Fri"], [6, "Sat"], [0, "Sun"]];
const CAL_SPREAD = [2, 4, 6, 1, 3, 5, 0];  // default days: Tue, Thu, Sat, then the rest
const CAL_MAX = 150;
const isoDay = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
function calState() {
  if (!st.cal) {
    const per = Math.min(7, Math.max(1, Math.round((P().hours || 5) / 1)));
    const t = new Date(); t.setDate(t.getDate() + 1);
    st.cal = { open: false, days: CAL_SPREAD.slice(0, Math.min(per, 4)), time: "20:00", len: per > 4 ? 90 : 60, start: isoDay(t) };
  }
  return st.cal;
}
function calSteps() {
  return flatNodes().filter((n) => !done(n.key) && (n.type === "skill" || (n.type === "cert" && !n.optional))).map((n, i) => {
    const c = n.type === "cert" ? n.item : (n.items || [])[0];
    return { n, no: i + 1, label: nodeLabel(n), course: c || null, hours: c && c.hours ? c.hours : 2 };
  });
}
function calPlan() {
  const c = calState(), out = [];
  if (!c.days.length) return out;
  const [hh, mm] = c.time.split(":").map(Number), len = c.len;
  const day = new Date(`${c.start}T00:00:00`);
  for (const s of calSteps()) {
    const n = Math.max(1, Math.ceil(s.hours * 60 / len));
    for (let k = 1; k <= n && out.length < CAL_MAX; k++) {
      while (!c.days.includes(day.getDay())) day.setDate(day.getDate() + 1);
      const a = new Date(day); a.setHours(hh, mm, 0, 0);
      out.push({ step: s, k, n, start: a, end: new Date(a.getTime() + len * 60000) });
      day.setDate(day.getDate() + 1);
    }
  }
  return out;
}
const icsTime = (d) => `${isoDay(d).replace(/-/g, "")}T${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}00`;
const icsText = (s) => String(s).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
function icsFold(line) {  // lines longer than 75 bytes continue on the next line after a space
  const enc = new TextEncoder(), out = []; let cur = "", n = 0;
  for (const ch of line) { const b = enc.encode(ch).length; if (n + b > (out.length ? 74 : 75)) { out.push(cur); cur = ""; n = 0; } cur += ch; n += b; }
  out.push(cur); return out.join("\r\n ");
}
function calDownload() {
  const plan = calPlan(); if (!plan.length) { toast(T("Pick at least one day.")); return; }
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z"), uid = Date.now().toString(36), role = roleOf(A().role).title;
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Workforce Futures//Learning plan//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    `X-WR-CALNAME:${icsText(T("Learning plan: {role}", { role }))}`];
  plan.forEach((p, i) => {
    const c = p.step.course, desc = [T("Step {n} on your path to {role}.", { n: p.step.no, role }),
      c ? T("Course: {course} by {provider}, about {h} hours.", { course: c.title, provider: c.provider, h: c.hours }) : T("No course for this step: practise it on real tasks."),
      c && c.url ? c.url : "", T("Mark the step done in Workforce Futures when you finish.")].filter(Boolean).join("\n");
    lines.push("BEGIN:VEVENT", `UID:wf-${uid}-${i}@workforce-futures`, `DTSTAMP:${stamp}`, `DTSTART:${icsTime(p.start)}`, `DTEND:${icsTime(p.end)}`,
      `SUMMARY:${icsText(`${p.step.label} · ${p.k}/${p.n}`)}`, `DESCRIPTION:${icsText(desc)}`, ...(c && c.url ? [`URL:${c.url}`] : []),
      "BEGIN:VALARM", "TRIGGER:-PT10M", "ACTION:DISPLAY", `DESCRIPTION:${icsText(p.step.label)}`, "END:VALARM", "END:VEVENT");
  });
  lines.push("END:VCALENDAR");
  const blob = new Blob([lines.map(icsFold).join("\r\n") + "\r\n"], { type: "text/calendar;charset=utf-8" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "learning-plan.ics"; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  toast(T("Saved {n} study sessions. Open the file to add them to your calendar.", { n: plan.length }));
}
function vCalPanel() {
  const c = calState(); if (!c.open) return "";
  const plan = calPlan(), steps = calSteps(), last = plan[plan.length - 1];
  const capped = plan.length >= CAL_MAX;
  return `<section class="card cal-panel" aria-labelledby="calH">
    <div class="row between"><h3 id="calH">${T("Put your plan in your calendar")}</h3><button type="button" class="icon-btn" data-cal="close" aria-label="${T("Close")}">✕</button></div>
    <p class="small muted">${esc(T("Study sessions for the {n} steps still to do, sized from each course's hours. Works with Google Calendar, Outlook and phone calendars.", { n: steps.length }))}</p>
    <div class="cal-grid">
      <div class="field"><span class="label">${T("Days")}</span><div class="cal-days" role="group" aria-label="${T("Days")}">${CAL_DAYS.map(([d, l]) => `<button type="button" class="chip" data-calday="${d}" aria-pressed="${c.days.includes(d)}">${T(l)}</button>`).join("")}</div></div>
      <div class="field"><label for="calTime">${T("Time")}</label><input type="time" id="calTime" value="${esc(c.time)}"></div>
      <div class="field"><label for="calLen">${T("Each session")}</label><select id="calLen">${[30, 45, 60, 90, 120].map((m) => `<option value="${m}" ${c.len === m ? "selected" : ""}>${esc(T("{n} min", { n: m }))}</option>`).join("")}</select></div>
      <div class="field"><label for="calStart">${T("Start on")}</label><input type="date" id="calStart" value="${esc(c.start)}"></div>
    </div>
    ${plan.length ? `<p class="cal-sum"><b>${esc(T("{n} sessions", { n: plan.length }))}</b> · ${esc(T("{d} days a week", { d: c.days.length }))} · ${esc(T("last one on {date}", { date: fmtDate(isoDay(last.start), { day: "numeric", month: "short", year: "numeric" }) }))}${capped ? ` · ${esc(T("first {n} sessions only", { n: CAL_MAX }))}` : ""}</p>
      <ol class="cal-preview">${plan.slice(0, 3).map((p) => `<li><span class="mono small">${esc(fmtDate(isoDay(p.start), { weekday: "short", day: "numeric", month: "short" }))} ${esc(c.time)}</span><span class="small">${esc(p.step.label)} · ${p.k}/${p.n}</span></li>`).join("")}${plan.length > 3 ? `<li class="tiny muted">${esc(T("and {n} more", { n: plan.length - 3 }))}</li>` : ""}</ol>`
      : `<p class="note warn small">${T(steps.length ? "Pick at least one day." : "Every step is done. Nothing left to plan.")}</p>`}
    <div class="row"><button class="btn primary" type="button" data-cal="download" ${plan.length ? "" : "disabled"}>${T("Download calendar file (.ics)")}</button><span class="tiny muted">${T("Made in your browser. Nothing is sent anywhere.")}</span></div>
  </section>`;
}

const VIEWS = { interview: vInterview, teams: vTeams, people: vPeople, member: vMember, updates: vUpdates, signin: vSignin, wizard: vWizard, dashboard: vDashboard, mycareer: vMyCareer, careers: vCareers, news: vNews, jobcheck: vJobCheck, path: vPath, resume: vResume, team: vTeam, sources: vSources, teamperson: vTeamPerson, teamreport: vTeamReport };
// ---------- motion: GSAP + ScrollTrigger animations, Lenis smooth scrolling ------------------------
// The landing gets the full treatment; inside the app, cards below the fold rise in once per page.
// Everything is skipped when the device asks for reduced motion.
const reduceMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const motionOn = () => !!window.gsap && !!window.ScrollTrigger && !reduceMotion();
let lenis = null, motionPage = null, motionPending = false, countedOnce = false;
function initMotion() {
  if (!motionOn()) return;
  gsap.registerPlugin(ScrollTrigger);
  if (!window.Lenis) return;
  // panels that scroll on their own keep native scrolling
  lenis = new Lenis({ lerp: 0.11, prevent: (node) => !!(node.closest && node.closest(".pick-list, .chat, .sheet, .menu-body, .tablewrap, [data-lenis-prevent]")) });
  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
}
function scrollTop() { if (lenis) lenis.scrollTo(0, { immediate: true }); else window.scrollTo({ top: 0 }); }
function splitWords(el) {
  [...el.childNodes].forEach((n) => {
    if (n.nodeType === 3) {
      const frag = document.createDocumentFragment();
      n.textContent.split(/(\s+)/).forEach((w) => {
        if (!w) return;
        if (/^\s+$/.test(w)) { frag.append(w); return; }
        const o = document.createElement("span"), i = document.createElement("span");
        o.className = "w"; i.textContent = w; o.append(i); frag.append(o);
      });
      n.replaceWith(frag);
    } else if (n.nodeType === 1) splitWords(n);
  });
}
function landingMotion(intro) {
  const band = $(".landing-band"), below = $(".landing-below"); if (!band || !below) return;
  const wide = window.innerWidth >= 900;
  // the dark band stays put once its bottom reaches the screen edge, and the paper section slides over it
  if (wide) {
    const head = $("header.top"), top = Math.min(head ? head.offsetHeight : 0, window.innerHeight - band.offsetHeight);
    band.style.top = `${top}px`; band.classList.add("is-sticky"); below.classList.add("is-sheet");
    gsap.to(".landing", { opacity: 0.3, scale: 0.97, transformOrigin: "50% 30%", ease: "none",
      scrollTrigger: { trigger: below, start: "top bottom", end: "top 30%", scrub: true } });
  }
  [...band.querySelectorAll(".geo-hero > :not(defs)")].forEach((el, i) => {
    gsap.to(el, { y: -(40 + i * 28), ease: "none", scrollTrigger: { trigger: below, start: "top bottom", end: "top top", scrub: 0.6 } });
  });
  gsap.to(".geo-edge", { xPercent: 18, rotate: -8, ease: "none", scrollTrigger: { trigger: below, start: "top bottom", end: "top top", scrub: 0.6 } });
  if (intro) {
    const h = $("#heroTitle"); splitWords(h);
    gsap.timeline({ defaults: { ease: "power3.out" } })
      .from(".geo-hero > :not(defs)", { opacity: 0, scale: 0.7, transformOrigin: "50% 50%", duration: 1.4, stagger: 0.09 }, 0)
      .from(".geo-edge", { xPercent: 60, duration: 1.2 }, 0.1)
      .from(".hero .eyebrow", { y: 14, opacity: 0, duration: 0.6 }, 0.15)
      .from("#heroTitle .w > span", { yPercent: 110, duration: 0.9, stagger: 0.045 }, 0.25)
      .from(".hero .lede", { y: 18, opacity: 0, duration: 0.7 }, "-=0.55")
      .from(".flow li", { y: 16, opacity: 0, duration: 0.5, stagger: 0.08 }, "-=0.45")
      .from(".signin-card", { y: 44, opacity: 0, duration: 1 }, 0.45);
  }
  ScrollTrigger.batch(".landing-below .kpi, .landing-below .preview", { start: "top 92%", once: true,
    // fromTo with an explicit end: a plain .from() that starts while an earlier one is still running takes
    // the half-way offset as its end, which left the number columns stuck at different heights
    onEnter: (els) => gsap.fromTo(els, { y: 36, opacity: 0 }, { y: 0, opacity: 1, duration: 0.9, stagger: 0.1, ease: "power3.out", overwrite: true, clearProps: "transform,opacity" }) });
  if (!countedOnce) {
    ScrollTrigger.create({ trigger: ".landing-below .proof", start: "top 85%", once: true, onEnter: () => {
      countedOnce = true;
      document.querySelectorAll(".landing-below .k-value").forEach((el) => {
        const m = el.textContent.trim().match(/^(\d[\d,]*)(\+?)$/); if (!m) return;
        const end = +m[1].replace(/,/g, ""), o = { v: 0 };
        gsap.to(o, { v: end, duration: 1.6, ease: "power2.out", onUpdate: () => { el.textContent = Math.round(o.v).toLocaleString("en") + m[2]; } });
      });
    } });
  }
  document.querySelectorAll(".landing-below .preview svg path").forEach((p) => {
    if (!p.getTotalLength) return;
    const len = p.getTotalLength();
    gsap.fromTo(p, { strokeDasharray: len, strokeDashoffset: len }, { strokeDashoffset: 0, duration: 1.4, ease: "power2.inOut",
      scrollTrigger: { trigger: ".landing-below .preview", start: "top 90%", once: true } });
  });
}
function appMotion() {
  if (document.hidden) return;  // a background tab pauses animation frames, which would leave cards hidden
  const els = [...document.querySelectorAll("#app .page .card, #app .page .kpi")].filter((e) => e.getBoundingClientRect().top > window.innerHeight * 0.92);
  if (!els.length) return;
  gsap.set(els, { y: 28, opacity: 0 });
  ScrollTrigger.batch(els, { start: "top 94%", once: true,
    onEnter: (b) => gsap.to(b, { y: 0, opacity: 1, duration: 0.75, ease: "power3.out", stagger: 0.08, overwrite: true }) });
}
// Network pattern behind the About you steps: drifting nodes, links between near neighbours and
// small pulses travelling along them. One canvas for the whole visit; it only runs during setup.
const net = { cv: null, ctx: null, nodes: [], pulses: [], on: false, raf: 0, w: 0, h: 0, last: 0 };
function netResize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  net.w = window.innerWidth; net.h = window.innerHeight;
  net.cv.width = net.w * dpr; net.cv.height = net.h * dpr; net.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const count = Math.round(Math.min(90, Math.max(28, net.w * net.h / 16000)));
  net.nodes = Array.from({ length: count }, () => ({ x: Math.random() * net.w, y: Math.random() * net.h,
    vx: (Math.random() - 0.5) * 0.25, vy: (Math.random() - 0.5) * 0.25, r: 1.2 + Math.random() * 1.6 }));
  net.pulses = [];
}
function netDraw(dt) {
  const { ctx, nodes, w, h } = net, link = Math.min(170, Math.max(110, w / 9));
  const accent = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#1F3BD9";
  ctx.clearRect(0, 0, w, h);
  ctx.strokeStyle = accent; ctx.fillStyle = accent;
  for (const n of nodes) {
    n.x += n.vx * dt; n.y += n.vy * dt;
    if (n.x < -20) n.x = w + 20; if (n.x > w + 20) n.x = -20; if (n.y < -20) n.y = h + 20; if (n.y > h + 20) n.y = -20;
  }
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i], b = nodes[j], d = Math.hypot(a.x - b.x, a.y - b.y);
      if (d > link) continue;
      ctx.globalAlpha = (1 - d / link) * 0.35; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      if (net.on && net.pulses.length < 14 && Math.random() < 0.0008 * dt) net.pulses.push({ a, b, t: 0 });
    }
  }
  ctx.globalAlpha = 0.6;
  for (const n of nodes) { ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2); ctx.fill(); }
  net.pulses = net.pulses.filter((p) => (p.t += 0.012 * dt) < 1 && Math.hypot(p.a.x - p.b.x, p.a.y - p.b.y) < link * 1.2);
  for (const p of net.pulses) {
    const x = p.a.x + (p.b.x - p.a.x) * p.t, y = p.a.y + (p.b.y - p.a.y) * p.t;
    ctx.globalAlpha = Math.sin(p.t * Math.PI) * 0.9;
    ctx.beginPath(); ctx.arc(x, y, 2.4, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
}
function netLoop(t) {
  if (!net.on) return;
  const dt = Math.min(3, net.last ? (t - net.last) / 16.7 : 1); net.last = t;
  netDraw(dt);
  net.raf = requestAnimationFrame(netLoop);
}
function netBackground(show) {
  if (show && !net.cv) {
    net.cv = document.createElement("canvas"); net.cv.className = "net-bg"; net.cv.setAttribute("aria-hidden", "true");
    document.body.prepend(net.cv); net.ctx = net.cv.getContext("2d"); netResize();
    window.addEventListener("resize", () => { if (net.cv) { netResize(); if (!net.on) netDraw(0); } });
  }
  if (!net.cv) return;
  net.cv.classList.toggle("show", show);
  if (show && !net.on) {
    if (reduceMotion()) { netDraw(0); return; }  // a still pattern, no movement
    net.on = true; net.last = 0; net.raf = requestAnimationFrame(netLoop);
  } else if (!show && net.on) { net.on = false; cancelAnimationFrame(net.raf); }
}
// Called after every render. Old triggers belong to replaced elements, so they are cleared each time;
// entrance animations run once per page visit, after its loading skeleton has gone.
function afterRender() {
  if (!motionOn()) return;
  ScrollTrigger.getAll().forEach((t) => t.kill());
  if (st.page !== motionPage) { motionPage = st.page; motionPending = true; }
  const loading = !!$("#app [aria-busy='true']");
  const intro = motionPending && !loading;
  if (intro) motionPending = false;
  if (st.page === "signin") landingMotion(intro);
  else if (intro) appMotion();
  ScrollTrigger.refresh();
}
// The career on show is explained without a click; the button asks for a fresh one.
async function explainRole(role, auto) {
  const scen = st.scen, lang = LANG; st.busy["ex_" + role] = true; render();
  try {
    const ex = await api("/api/explain", { ...profileBody(), role, scenario: scen, lang, use_model: !!st.meta.llm.available });
    if (scen === st.scen && lang === LANG) st.explain[role] = ex;  // ignore answers for a future or language left behind
  } catch (e) { if (!auto) toast(T("Could not explain: {e}", { e: e.message })); }
  st.busy["ex_" + role] = false; render();
}
function autoExplain() {
  if (!A() || !st.analysis || isTeamUser()) return;
  const role = st.page === "mycareer" ? A().role : null, key = `${role}@${st.scen}@${LANG}`;
  if (!role || st.explain[role] || st.busy["ex_" + role] || st.exTried[key]) return;
  st.exTried[key] = true; explainRole(role, true);
}
function render() {
  if (!A() && st.page !== "signin") st.page = "signin";
  renderChrome();
  $("#app").innerHTML = VIEWS[st.page]();
  bindDrop();
  renderHelper(); renderAskSel(); selHide(); selClear();
  netBackground(st.page === "wizard");
  afterRender();
  updatesSetup();
  setTimeout(autoExplain);
  const home = st.page === "dashboard" && (isTeamUser() ? teamReady() : !!document.querySelector(".home-hero"));
  if (tourAt >= 0) { if (home) tourShow(tourAt); else tourShow(TOUR().length + 1); }
  else if (home && !A().prefs[tourKey()]) setTimeout(() => { if (tourAt < 0 && !story.on && st.page === "dashboard") tourShow(0); }, 900);
}

// ---------- events ------------------------------------------------------------------------------
function bindDrop() {
  const d = $("#drop"); if (!d) return;
  ["dragenter", "dragover"].forEach((e) => d.addEventListener(e, (ev) => { ev.preventDefault(); d.classList.add("over"); }));
  ["dragleave", "drop"].forEach((e) => d.addEventListener(e, (ev) => { ev.preventDefault(); d.classList.remove("over"); }));
  d.addEventListener("drop", (ev) => { const f = ev.dataTransfer.files[0]; if (f) importCv(f); });
}
async function importCv(file) {
  st.busy.cv = true; render();
  const fd = new FormData(); fd.append("file", file); fd.append("use_model", P().useModel ? "true" : "false");
  try { const r = await api("/api/cv", fd, true); st.cvDraft = { ...r, contact: { location: "", ...r.contact } }; }
  catch (e) { toast(T("Could not read the CV: {e}", { e: e.message })); }
  st.busy.cv = false; render();
  const el = $("#cvReview"); if (el) el.scrollIntoView({ behavior: "smooth" });
}
function setPath(obj, path, val) { const ks = path.split("."); let o = obj; ks.slice(0, -1).forEach((k) => { o = o[k]; }); o[ks[ks.length - 1]] = val; }
let tOcc = null;
async function searchOcc(q) {
  st.occ.q = q; if (q.trim().length < 2) { st.occ.results = []; render(); return; }
  st.busy.occ = true; render(); refocus();
  try { const r = await api("/api/occupations/search?q=" + encodeURIComponent(q)); st.occ.results = r.results; }
  catch (e) { toast(T("Job search failed: {e}", { e: e.message })); }
  st.busy.occ = false; render(); refocus();
}
function refocus() { const el = $("#occQ"); if (el && st.focusOcc) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); } }
function go(page) { st.page = page; st.sheetOpen = false; if (page === "wizard") { st.wiz = 0; st.expMode = null; st.extractNote = ""; } render(); scrollTop(); const m = document.querySelector("details.menu"); if (m) m.open = false; }

document.addEventListener("click", async (ev) => {
  const dot = ev.target.closest("[data-mapdot]"); if (dot) { if (dot.dataset.mapkind === "team") setTeamTarget(dot.dataset.mapdot); else openFromMap(dot.dataset.mapdot); return; }
  const t = ev.target.closest("button,a[data-page]"); if (!t) return;
  const d = t.dataset;
  if (d.storynav) { if (!story.held) storyGo(story.i + +d.storynav); story.held = false; return; }
  if (d.info !== undefined) {
    const box = t.parentElement, open = !box.classList.contains("open"), pop = box.querySelector(".info-pop");
    closeInfo(box); box.classList.toggle("open", open); t.setAttribute("aria-expanded", String(open));
    pop.style.marginLeft = "";
    if (open && getComputedStyle(pop).position === "absolute") {  // keep the popup on screen near the edges
      const r = pop.getBoundingClientRect(), pad = 8, vw = document.documentElement.clientWidth;
      const shift = r.right > vw - pad ? vw - pad - r.right : r.left < pad ? pad - r.left : 0;
      if (shift) pop.style.marginLeft = shift + "px";
    }
    return;
  }
  if (d.iv) { ivAction(d.iv); return; }
  if (d.interview !== undefined) { const v = ivState(); if (v.stage !== +d.interview) Object.assign(v, { stage: +d.interview, data: null, started: false, i: 0, answers: {}, fb: {} }); go("interview"); return; }
  if (d.cal) { const c = calState(); if (d.cal === "download") calDownload(); else { c.open = d.cal === "toggle" ? !c.open : false; render(); } return; }
  if (d.calday !== undefined) { const c = calState(), k = +d.calday; c.days = c.days.includes(k) ? c.days.filter((x) => x !== k) : [...c.days, k]; render(); return; }
  if (d.page) { if (!t.disabled) { if (t.closest(".chat") && !wide()) st.chat.open = false; go(d.page); } return; }
  if (d.ask) { sendChat(T(d.ask)); return; }
  if (d.mode) { A().prefs.mode = d.mode; save(); render(); return; }
  if (d.rate) { rateClick(t); return; }
  if (d.slide !== undefined) { slideMove(0, +d.slide); return; }
  if (d.picked) { choosePick(d.picked, d.val); return; }
  if (d.unpick) { const f = t.closest(".picker"); f.querySelector(".picked").hidden = true; f.querySelector(".pick-box").hidden = false; f.querySelector("[data-pick]").focus(); return; }
  if (d.uncustom !== undefined) { P().custom_skills.splice(+d.uncustom, 1); save(); render(); return; }
  if (d.opt) {
    const v = d.val;
    if (d.opt === "mode") A().prefs.mode = v;
    else {
      P()[d.opt] = v; if (d.opt === "country") P().budget = "free";
      if (d.opt === "situation" && TEAM_ROLES.includes(v) && !isOwn(st.team)) { st.team = v; }
    }
    save(); render(); return;
  }
  if (d.exp) { st.expMode = d.exp; if (d.exp === "skip") { st.wiz++; } render(); return; }
  if (d.cycle) { const s = P().skills, k = d.cycle; const cur = Math.max(s[k] || 0, P().pathSkills[k] || 0); const nx = (cur + 1) % 4; if (nx) s[k] = nx; else { delete s[k]; delete P().pathSkills[k]; delete P().evidence[k]; } changed({ path: false }); render(); return; }
  if (d.interest) { const a = P().interests, i = a.indexOf(d.interest); if (i >= 0) a.splice(i, 1); else a.push(d.interest); save(); render(); return; }
  if (d.occ) { const h = st.occ.results[+d.occ]; P().current = { title: h.title, isco: h.isco, exposure: h.exposure, suggested: h.suggested_skills }; st.occ.results = []; save(); render(); return; }
  if (d.scen) { st.scen = d.scen; st.explain = {}; st.path = null; render(); if (A().role && !isTeamUser()) await loadPath(); render(); return; }
  if (d.newskind) { st.newsF.kind = d.newskind; if (d.newskind === "signal") st.newsF.topic = ""; st.newsSum = null; render(); return; }
  if (d.newstopic !== undefined) { st.newsF.topic = d.newstopic; st.newsSum = null; render(); return; }
  if (d.mic) { toggleMic(d.mic); return; }
  if (d.xray) { st.xrayWhich = d.xray; st.xrayAll = false; render(); return; }
  if (d.xrayall !== undefined) { st.xrayAll = !st.xrayAll; render(); return; }
  if (d.tip !== undefined) { taskTip(+d.tip); return; }
  if (d.sample !== undefined) { const j = jcState(); j.text = SAMPLE_ADS[+d.sample][1]; j.url = ""; j.sample = true; render(); runJobCheck(); return; }
  if (d.jctrack !== undefined) {
    const t = jobTrack(st.jc.res); A().prefs.customTracks = [...customTracks(), t]; A().prefs.tracks = [...myTracks(), t.id];
    st.pathTab = t.id; save(); go("path"); toast(T("Track added.")); return;
  }
  if (d.secadd) {
    const cv = P().cv; resumeSections();
    const kind = d.secadd, title = kind === "custom" ? (st.secCustom || "").trim() : SECTION_KINDS.find(([k]) => k === kind)[1];
    if (!title) { toast(T("Type a title for your section first.")); return; }
    const id = "s-" + Date.now().toString(36); cv.sections.push({ id, kind, title, lines: [] }); cv.order.push(id);
    st.secCustom = ""; save(); render(); const box = document.querySelector(`[data-secline="${id}"]`); if (box) box.focus(); return;
  }
  if (d.secopen) { st.secOpen = st.secOpen === d.secopen ? null : d.secopen; render(); return; }
  if (d.cvnew) { P().cv[d.cvnew].push(d.cvnew === "experience" ? { title: "", organisation: "", start: "", end: "", highlights: [] } : { qualification: "", institution: "", year: "" }); save(); render(); return; }
  if (d.cvrm) { const [k, i] = d.cvrm.split("."); P().cv[k].splice(+i, 1); save(); render(); return; }
  if (d.wizto) { go("wizard"); st.wiz = Math.max(0, wizSteps().findIndex((w) => w.id === d.wizto)); render(); return; }
  if (d.secmove) { const [id, step] = d.secmove.split(":"), o = P().cv.order, i = o.indexOf(id), j = i + +step; if (j >= 0 && j < o.length) { [o[i], o[j]] = [o[j], o[i]]; save(); render(); } return; }
  if (d.sechide) { const h = P().cv.hidden = P().cv.hidden || []; const i = h.indexOf(d.sechide); if (i >= 0) h.splice(i, 1); else h.push(d.sechide); save(); render(); return; }
  if (d.secdel) { const cv = P().cv; cv.sections = cv.sections.filter((x) => x.id !== d.secdel); cv.order = cv.order.filter((x) => x !== d.secdel); save(); render(); return; }
  if (d.secai) { draftSection(d.secai); return; }
  if (d.see) { st.open = d.see; st.slide = null; go("careers"); return; }
  if (d.open) { st.open = wide() ? d.open : (st.open === d.open ? null : d.open); render(); return; }
  if (d.ctab) { st.ctab = d.ctab; render(); return; }
  if (d.trysample) { st.signin = { error: "" }; signIn(d.trysample); return; }
  if (d.choose) { A().role = d.choose; st.path = null; st.sel = null; st.polished = null; save(); go("path"); await loadPath(); await loadAdvice(); render(); return; }
  if (d.node) { st.sel = d.node; st.sheetOpen = window.innerWidth < 860; render(); return; }
  if (d.ptab) { st.pathTab = d.ptab; st.sheetOpen = false; st.addTrack = false; render(); return; }
  if (d.addmenu !== undefined) { st.addTrack = !st.addTrack; render(); return; }
  if (d.addtrack) { A().prefs.tracks = [...myTracks(), d.addtrack]; st.pathTab = d.addtrack; st.addTrack = false; save(); render(); return; }
  if (d.aicompose !== undefined) { aiState().open = true; st.addTrack = false; render(); const g = $("#aiGoal"); if (g) g.focus(); return; }
  if (d.aiclose !== undefined || d.aidiscard !== undefined) { st.aiT = null; render(); return; }
  if (d.aidraft !== undefined) { draftAiTrack(d.aidraft === "1"); return; }
  if (d.aiadd !== undefined) {
    const a = aiState(), id = "ai-" + Date.now().toString(36);
    A().prefs.customTracks = [...customTracks(), { ...a.draft, id, ai: true, model: a.model, goal: a.goal }];
    A().prefs.tracks = [...myTracks(), id]; st.pathTab = id; st.aiT = null; save(); render(); toast(T("Track added.")); return;
  }
  if (d.trackgoal) { st.chat.open = false; renderHelper(); st.aiT = { ...aiState(), open: true, goal: d.trackgoal, draft: null, note: "" }; st.addTrack = false; go("path"); draftAiTrack(false); return; }
  if (d.rmtrack) { A().prefs.customTracks = customTracks().filter((x) => x.id !== d.rmtrack);
    A().prefs.tracks = myTracks().filter((x) => x !== d.rmtrack); st.pathTab = "basic"; save(); render(); toast(T("Track removed. Ticked steps are kept if you add it again.")); return; }
  if (d.tnode) { st.tsel = d.tnode; st.sheetOpen = window.innerWidth < 860; render(); return; }
  if (d.tchapter !== undefined) { const o = st.tOpen[st.pathTab]; o[d.tchapter] = !o[d.tchapter]; render(); return; }
  if (d.ttoggle) { const p = progressOf(); if (p[d.ttoggle]) delete p[d.ttoggle]; else p[d.ttoggle] = true; save(); render(); return; }
  if (d.chapter !== undefined) { st.chOpen.open[d.chapter] = !st.chOpen.open[d.chapter]; render(); return; }
  if (d.closesheet !== undefined) { st.sheetOpen = false; render(); return; }
  if (d.goto) { st.sel = d.goto; go("path"); return; }
  if (d.toggle) { const n = flatNodes().find((x) => x.key === d.toggle); if (n) setDone(n, !done(n.key)); return; }
  if (d.tdel) { ownTeam().people.splice(+d.tdel, 1); memShift(+d.tdel); teamEdited(true); return; }
  if (d.tcoldel) { const U = ownTeam(); U.columns = U.columns.filter((k) => k !== d.tcoldel); U.people.forEach(([, sk]) => delete sk[d.tcoldel]); teamEdited(true); return; }
  if (d.member !== undefined) { st.member = +d.member; st.page = "member"; render(); scrollTop(); return; }
  if (d.goteam) { st.team = d.goteam; teamSaved(); st.page = "dashboard"; render(); scrollTop(); return; }
  if (d.team) { st.team = d.team; teamSaved(); render(); return; }
  if (d.target) { setTeamTarget(d.target); return; }
  if (d.person) { st.teamPerson = d.person; go("teamperson"); return; }
  if (d.cvadd) { st.cvDraft[d.cvadd].push(d.cvadd === "experience" ? { title: "", organisation: "", start: "", end: "", highlights: [] } : { qualification: "", institution: "", year: "" }); render(); return; }
  if (d.cvdel) { const [k, i] = d.cvdel.split("."); st.cvDraft[k].splice(+i, 1); render(); return; }
  if (d.explain) { explainRole(d.explain, false); return; }
  switch (t.id) {
    case "caseBtn": if (!A().prefs.helperSeen) { A().prefs.helperSeen = true; save(); } openChat(); return;
    case "chatClose": st.chat.open = false; st.chat.quote = null; selClear(); renderHelper(); $("#caseBtn").focus(); return;
    case "selTipX": selTipDone(); return;
    case "quoteDrop": st.chat.quote = null; selClear(); renderHelper(); { const inp = $("#chatInput"); if (inp) inp.focus(); } return;
    case "chatClear": try { await api("/api/chat", null, false, "DELETE"); } catch (e) { /* nothing to clear */ } st.chat.messages = []; renderHelper(); return;
    case "themeBtn": { const nx = theme() === "dark" ? "light" : "dark"; document.documentElement.dataset.theme = nx; try { localStorage.setItem("wfe.theme", nx); } catch (e) { /* this visit only */ } renderThemeBtn(); return; }
    case "navMore": { const m = document.querySelector("details.menu"); if (m) { m.open = !m.open; if (m.open) m.querySelector("summary").focus(); } return; }
    case "signIn": st.signin = { error: "" }; signIn($("#acctSel").value); return;
    case "signOut": { clearTimeout(tSave); const data = Object.fromEntries(DATA_KEYS.map((k) => [k, A()[k]])); try { await api("/api/me", data, false, "PUT"); await api("/api/signout", {}); } catch (e) { /* already signed out */ } signedOut(); return; }
    case "wizNext": st.wiz = Math.min(wizSteps().length - 1, st.wiz + 1); st.extractNote = ""; render(); window.scrollTo({ top: 0 }); return;
    case "wizBack": st.wiz = Math.max(0, st.wiz - 1); render(); window.scrollTo({ top: 0 }); return;
    case "wizFinish": finishWizard(); return;
    case "teamRetry": st.teamError = null; render(); return;
    case "printPage": window.print(); return;
    case "newsSumBtn": summariseNews(); return;
    case "updateBtn": runUpdate(); return;
    case "teamAddPerson": ownTeam().people.push([T("Person {n}", { n: ownTeam().people.length + 1 }), {}]); teamEdited(true); return;
    case "teamNew": addOwnTeam(newTeam()); if (st.page === "wizard") render(); else openTeamEditor(); return;
    case "teamEdit": openTeamEditor(); return;
    case "teamDel": {
      const U = ownTeam(); if (!U || !window.confirm(T("Delete {team} and its profiles from this device?", { team: U.label }))) return;
      st.ownTeams = st.ownTeams.filter((x) => x.id !== U.id); delete memAll()[U.id]; memSave(); saveOwnTeams();
      st.team = (st.ownTeams[0] || st.meta.samples.teams[0]).id; teamSaved(); render(); return;
    }
    case "jcRun": runJobCheck(); return;
    case "newsMore": { st.newsMore = (st.newsMore || 18) + 18; const r = $("#newsResults"); if (r) r.innerHTML = vNewsResults(); return; }
    case "slidePrev": slideMove(-1); return;
    case "slideNext": slideMove(1); return;
    case "tourStart": document.querySelector("details.menu")?.removeAttribute("open"); if (st.page !== "dashboard") { st.page = "dashboard"; tourAt = 0; render(); window.scrollTo({ top: 0 }); } else tourShow(0); return;
    case "tourNext": tourShow(tourAt + 1); return;
    case "tourBack": tourShow(tourAt - 1, -1); return;
    case "tourSkip": tourShow(TOUR().length); return;
    case "storyReplay": document.querySelector("details.menu")?.removeAttribute("open"); if (st.page !== "dashboard") { st.page = "dashboard"; render(); } if (!st.analysis || !st.path) { refresh({}).then(openStory); } else openStory(); return;
    case "storySkip": case "storyDone": closeStory(); return;
    case "storyAgain": storyGo(0); return;
    case "extractBtn": {
      const text = ($("#about") || {}).value || ""; P().about = text;
      if (text.trim().length < 15) { toast(T("Write a few sentences about your work first.")); return; }
      st.busy.extract = true; render();
      try {
        const r = await api("/api/extract", { text, use_model: !!P().useModel });
        Object.entries(r.skills).forEach(([k, v]) => { P().skills[k] = Math.max(P().skills[k] || 0, v.level); P().evidence[k] = v; });
        const n = Object.keys(r.skills).length;
        st.extractNote = r.model ? T("Found {n} skills with {model}. Press Next to check them.", { n, model: r.model }) : T("Found {n} skills. Press Next to check them.", { n }); save();
      } catch (e) { toast(T("Could not read the text: {e}", { e: e.message })); }
      st.busy.extract = false; render(); return;
    }
    case "cvSave": {
      const dft = st.cvDraft;
      Object.entries(dft.skills).forEach(([k, v]) => { if (v.keep !== false) { P().skills[k] = Math.max(P().skills[k] || 0, v.level); P().evidence[k] = v; } });
      P().cv = { contact: dft.contact, headline: dft.headline, summary: dft.summary, experience: dft.experience, education: dft.education, certifications: dft.certifications, languages: dft.languages };
      if (dft.experience[0] && !st.occ.q) st.occ.q = dft.experience[0].title;
      st.cvDraft = null; save(); st.wiz++; render(); window.scrollTo({ top: 0 }); toast(T("Saved. Now check your skills.")); return;
    }
    case "cvDiscard": st.cvDraft = null; render(); return;
    case "addSuggested": { let n = 0; Object.entries(P().current.suggested || {}).forEach(([k, v]) => { if (!skillsNow()[k]) { P().skills[k] = v.level; P().evidence[k] = { evidence: "ESCO: " + v.esco_skills.join(", "), method: "esco" }; n++; } }); toast(n ? T("Added {n} skills.", { n }) : T("Already in your profile.")); save(); render(); return; }
    case "printBtn": window.print(); return;
    case "txtBtn": { const blob = new Blob([resumeText()], { type: "text/plain" }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "resume.txt"; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); return; }
    case "polishBtn": {
      const cv = P().cv, R = resumeData(), bullets = cv.experience.flatMap((e) => e.highlights || []);
      st.busy.polish = true; render();
      try {
        const r = await api("/api/resume/polish", { role: A().role, summary: R.summary, bullets });
        st.polished = r; let i = 0; cv.experience.forEach((e) => { e._polished = (e.highlights || []).map(() => r.bullets[i++]); });
        if (r.summary) cv.summary = r.summary; save();
      } catch (e) { toast(T("Could not improve wording: {e}", { e: e.message })); }
      st.busy.polish = false; render(); return;
    }
  }
});
document.addEventListener("change", (ev) => {
  const t = ev.target, d = t.dataset;
  if (t.id === "uiLang" || t.id === "langSel") { setLang(t.value); return; }
  if (t.id === "cvFile" && t.files[0]) { importCv(t.files[0]); return; }
  if (t.id === "calTime" || t.id === "calLen" || t.id === "calStart") { const c = calState(); if (t.id === "calLen") c.len = +t.value; else if (t.value) c[t.id === "calTime" ? "time" : "start"] = t.value; render(); return; }
  if (t.id === "useModel") { P().useModel = t.checked; save(); return; }
  if (t.id === "careerPick" && t.value) { openFromMap(t.value); return; }
  if (t.id === "newsRole" || t.id === "newsKind" || t.id === "newsTopic" || t.id === "newsSort") {
    st.newsF[{ newsRole: "role", newsKind: "kind", newsTopic: "topic", newsSort: "sort" }[t.id]] = t.value;
    if (t.id === "newsKind" && t.value === "signal") st.newsF.topic = "";
    if (t.id !== "newsSort") st.newsSum = null;
    st.newsMore = 0; render(); return;
  }
  if (t.id === "budgetPath") { P().budget = t.value; st.path = null; changed(); render(); return; }
  if (t.id === "compareChk") { st.compare = t.checked; changed({ path: false }); return; }
  if (d.cvskill) { st.cvDraft.skills[d.cvskill].keep = t.checked; return; }
  if (d.cvlevel) { st.cvDraft.skills[d.cvlevel].level = +t.value; return; }
  if (t.id === "teamTarget") { st.teamTarget = t.value; teamSaved(); render(); return; }
  if (t.id === "memTarget") { mem(st.member).target = t.value || null; memSave(); render(); return; }
  if (d.memdone) {
    const pr = memProgress(st.member), n = pr && memNodes(pr.pw).find((x) => x.key === d.memdone); if (!n) return;
    const m = mem(st.member);
    if (t.checked) m.done[n.key] = n.type === "skill" ? { cluster: n.cluster, to: n.to } : {}; else delete m.done[n.key];
    memSave(); render(); return;
  }
  if (d.tlv) { const [i, k] = d.tlv.split("|"); ownTeam().people[+i][1][k] = +t.value; teamEdited(); return; }
  if (t.id === "teamAddSkill" && t.value) { ownTeam().columns.push(t.value); teamEdited(true); return; }
  if (t.id === "teamCsv" && t.files[0]) { const f = new FileReader(); f.onload = () => { try { addOwnTeam(parseCsv(String(f.result))); if (st.page === "wizard") render(); else openTeamEditor(); } catch (e) { toast(e.message); } }; f.readAsText(t.files[0]); }
});
document.addEventListener("submit", (ev) => { if (ev.target.id === "chatForm") { ev.preventDefault(); sendChat($("#chatInput").value); } });
document.addEventListener("input", (ev) => {
  const t = ev.target, d = t.dataset;
  if (t.id === "chatInput") { st.chat.draft = t.value; return; }
  if (t.id === "ivAnswer") { ivState().answers[st.iv.i] = t.value; return; }
  if (d.memf) { mem(st.member)[d.memf] = t.value; memSave(); return; }
  if (d.ttitle !== undefined) { mem(+d.ttitle).title = t.value; memSave(); return; }
  if (t.id === "teamName") { ownTeam().label = t.value.trim() || T("Team {n}", { n: st.ownTeams.indexOf(ownTeam()) + 1 }); saveOwnTeams(); const b = document.querySelector(`.options [data-team="${st.team}"] b`); if (b) b.textContent = ownTeam().label; return; }
  if (d.tname) { ownTeam().people[+d.tname][0] = t.value.trim() || T("Person {n}", { n: +d.tname + 1 }); teamEdited(); return; }
  if (t.id === "hours") { P().hours = +t.value; const o = $("#hoursOut"); if (o) o.textContent = t.value; st.path = null; save(); return; }
  if (t.id === "about") { P().about = t.value; save(); return; }
  if (d.pick) { openPick(t); return; }
  if (t.id === "aiGoal") { aiState().goal = t.value; return; }
  if (t.id === "jobText") { jcState().text = t.value; jcState().sample = false; return; }
  if (t.id === "jobUrl") { jcState().url = t.value; return; }
  if (t.id === "aiDir") { aiState().dir = t.value; return; }
  if (t.id === "aiChange") { aiState().change = t.value; return; }
  if (t.id === "newsQ") { st.newsF.q = t.value; st.newsMore = 0; const r = $("#newsResults"); if (r) r.innerHTML = vNewsResults(); return; }
  if (t.id === "occQ") { st.focusOcc = true; clearTimeout(tOcc); const q = t.value; tOcc = setTimeout(() => searchOcc(q), 350); return; }
  if (d.cv) {
    let v = t.value;
    if (d.cv.endsWith(".highlights") || d.cv === "certifications") v = v.split("\n").map((x) => x.trim()).filter(Boolean);
    if (d.cv === "languages") v = v.split(",").map((x) => x.trim()).filter(Boolean);
    setPath(st.cvDraft, d.cv, v); return;
  }
  if (t.id === "secCustom") { st.secCustom = t.value; return; }
  if (d.secline) {
    const x = P().cv.sections.find((y) => y.id === d.secline); if (!x) return;
    x.lines = t.value.split("\n"); save();
    $("#app").innerHTML = VIEWS[st.page]();  // redraw the paper; keep the cursor in the box
    const again = document.querySelector(`[data-secline="${d.secline}"]`); if (again) { again.focus(); again.setSelectionRange(t.selectionStart, t.selectionStart); }
    return;
  }
  if (d.res) {
    setPath(P().cv, d.res, d.res.endsWith(".highlights") || d.res === "certifications" ? t.value.split("\n") : t.value); save();  // blank lines are dropped on the resume
    const pos = t.selectionStart;
    $("#app").innerHTML = VIEWS[st.page]();
    const again = document.querySelector(`[data-res="${d.res}"]`); if (again) { again.focus(); again.setSelectionRange(pos, pos); }
  }
});

// type-to-search pickers (country, home country, skills)
function openPick(input) {
  const list = input.parentElement.querySelector(".pick-list");
  list.innerHTML = pickItems(input.dataset.pick, input.value); list.hidden = false; input.setAttribute("aria-expanded", "true");
}
function closePicks(except) {
  document.querySelectorAll(".pick-list:not([hidden])").forEach((l) => { if (l !== except) { l.hidden = true; const i = l.parentElement.querySelector("[data-pick]"); if (i) i.setAttribute("aria-expanded", "false"); } });
}
function pickKey(ev) {
  const t = ev.target, box = t.closest(".pick-box"); if (!box) return;
  const items = [...box.querySelectorAll(".pick-item")], at = items.indexOf(t), input = box.querySelector("[data-pick]");
  if (ev.key === "ArrowDown") { ev.preventDefault(); if (box.querySelector(".pick-list").hidden) openPick(input); (items[at + 1] || box.querySelector(".pick-item") || input).focus(); }
  else if (ev.key === "ArrowUp") { ev.preventDefault(); (at > 0 ? items[at - 1] : input).focus(); }
  else if (ev.key === "Enter" && t === input) { ev.preventDefault(); const first = box.querySelector(".pick-item"); if (first) first.click(); }
  else if (ev.key === "Escape" && !box.querySelector(".pick-list").hidden) { ev.preventDefault(); closePicks(); input.focus(); }
}
document.addEventListener("focusin", (ev) => { const t = ev.target; if (t.dataset && t.dataset.pick) { closePicks(t.parentElement.querySelector(".pick-list")); openPick(t); } });
function choosePick(kind, val) {
  const p = P();
  if (kind === "skill") {
    if (val.startsWith("custom:")) p.custom_skills.push(val.slice(7));
    else { setRating(val, 2); const area = quizAreas().find((x) => x[2].includes(val)); if (area && st.openAreas) st.openAreas.add(area[0]); }
    changed({ path: false }); render();
    const i = $("#pick-skill"); if (i) i.focus();
    return;
  }
  p[kind] = val; if (kind === "country") p.budget = "free";
  save(); render();
}

function openFromMap(role) {
  st.open = role;
  if (st.page === "careers") { const x = rows().find((y) => y.role === role); if (x) st.slide = ZONES.findIndex((z) => z[0] === zoneOf(x)); }
  render();
  setTimeout(() => {  // after layout settles; a smooth scroll started during render gets cancelled on phones
    const row = document.getElementById("careerDeck") || document.querySelector(`[data-row="${CSS.escape(role)}"]`);
    if (!row || (wide() && row.id === "careerDeck" && row.getBoundingClientRect().top >= 0 && row.getBoundingClientRect().top < window.innerHeight * 0.6)) return;
    row.scrollIntoView({ block: "start" });
    const btn = row.querySelector("[data-open]"); if (btn) btn.focus({ preventScroll: true });
  });
}

// Esc closes the step sheet and any open popover or menu, and returns focus to its trigger.
document.addEventListener("keydown", (ev) => {
  if (story.on && (ev.key === "ArrowRight" || ev.key === "ArrowLeft")) { ev.preventDefault(); storyGo(story.i + (ev.key === "ArrowRight" ? 1 : -1)); return; }
  if (story.on && ev.key === " " && !ev.target.closest("button")) { ev.preventDefault(); story.paused = !story.paused; return; }
  if (ev.target.id === "chatInput" && ev.key === "Enter" && !ev.shiftKey && !ev.isComposing) { ev.preventDefault(); sendChat(ev.target.value); return; }
  if (ev.target.dataset && ev.target.dataset.mapdot && (ev.key === "Enter" || ev.key === " ")) { ev.preventDefault(); if (ev.target.dataset.mapkind === "team") setTeamTarget(ev.target.dataset.mapdot); else openFromMap(ev.target.dataset.mapdot); return; }
  if (ev.target.dataset && (ev.target.dataset.pick || ev.target.dataset.picked)) { pickKey(ev); if (ev.defaultPrevented) return; }
  if ((ev.key === "ArrowLeft" || ev.key === "ArrowRight") && (st.page === "careers" || (st.page === "dashboard" && isTeamUser())) && !st.chat.open && tourAt < 0
      && !ev.target.closest("input, select, textarea, [role=tablist], [role=radiogroup]")) { ev.preventDefault(); slideMove(ev.key === "ArrowRight" ? 1 : -1); return; }
  if (ev.key !== "Escape") return;
  if (story.on) { closeStory(); return; }
  if (tourAt >= 0) { tourShow(TOUR().length); return; }
  if ($("#askSel") && !$("#askSel").hidden) { window.getSelection().removeAllRanges(); selHide(); return; }
  if (st.chat.open) { st.chat.open = false; st.chat.quote = null; selClear(); renderHelper(); $("#caseBtn").focus(); return; }
  if (st.sheetOpen) { st.sheetOpen = false; render(); const b = document.querySelector(`[data-node="${CSS.escape(st.sel || "")}"]`); if (b) b.focus(); return; }
  const tip = document.querySelector(".info.open"); if (tip) { closeInfo(); tip.querySelector(".info-btn").focus(); return; }
  document.querySelectorAll("details[open]").forEach((d) => { if (d.matches(".menu, .src")) { d.open = false; d.querySelector("summary").focus(); } });
});
document.addEventListener("toggle", (ev) => {
  if (ev.target.matches && ev.target.matches("details.calc")) { st.calcOpen = ev.target.open; return; }
  const a = ev.target.dataset && ev.target.dataset.area; if (!a || !st.openAreas) return;
  if (ev.target.open) st.openAreas.add(a); else st.openAreas.delete(a);
}, true);
let swipeX = null;
document.addEventListener("touchstart", (ev) => { swipeX = ev.target.closest(".slides") ? ev.touches[0].clientX : null; }, { passive: true });
document.addEventListener("touchend", (ev) => {
  if (swipeX == null) return;
  const dx = ev.changedTouches[0].clientX - swipeX; swipeX = null;
  if (Math.abs(dx) > 60) slideMove(dx < 0 ? 1 : -1);
}, { passive: true });
document.addEventListener("error", (ev) => {
  const img = ev.target; if (!(img instanceof HTMLImageElement) || !img.dataset.cover) return;
  const x = ((st.news && st.news.items) || []).find((y) => y.id === img.dataset.cover);
  if (x) img.outerHTML = newsCover(x);
}, true);
// Close popovers when tapping elsewhere.
document.addEventListener("click", (ev) => { if (!ev.target.closest(".info")) closeInfo(); if (!ev.target.closest(".picker")) closePicks(); document.querySelectorAll("details.src[open], details.menu[open]").forEach((d) => { if (!d.contains(ev.target) && ev.target.id !== "navMore" && !ev.target.closest("#navMore")) d.open = false; }); });
// Careers switch between split view and inline details at the desktop breakpoint.
let wasWide = wide();
window.addEventListener("resize", () => {
  const w = wide(); if (w !== wasWide) { wasWide = w; if (A() && st.page === "careers") render(); }
});
window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", renderThemeBtn);

// ---------- start ------------------------------------------------------------------------------
(async function start() {
  initMotion();
  let saved = null; try { saved = localStorage.getItem(LANG_KEY); } catch (e) { /* ignore */ }
  await loadLang(saved || "en");
  renderThemeBtn();
  try { st.meta = await api("/api/meta"); }
  catch (e) { $("#app").innerHTML = `<p class="note warn">${esc(T("The server is not ready: {e}", { e: e.message }))}</p>`; return; }
  try { st.updates = await api("/api/updates"); } catch (e) { st.updates = null; }
  try { st.legacyUpload = JSON.parse(localStorage.getItem("wfe.teamUpload") || "null"); } catch (e) { st.legacyUpload = null; }
  try { st.token = localStorage.getItem(TOKEN); } catch (e) { st.token = null; }
  if (st.token) { try { useAccount(await api("/api/me")); await syncAccountLang(); } catch (e) { st.token = null; st.acct = null; try { localStorage.removeItem(TOKEN); } catch (e2) { /* ignore */ } } }
  if (A()) {
    if (!A().onboarded) { st.page = "wizard"; render(); return; }
    st.page = "dashboard"; render(); await refresh({});
    if (st.updates && A().seen !== st.updates.snapshot.id) { if (A().seen) toast(T("New job data since your last visit. We rechecked your path.")); A().seen = st.updates.snapshot.id; save(); }
  } else { st.page = "signin"; await loadAccounts(); }
})();
})();

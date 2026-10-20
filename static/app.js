/* Workforce Futures Engine: web client.
   Sign in → step-by-step "About you" setup → personal dashboard with career, path and
   resume. Accounts live in the server database; this browser keeps only the session token. */
(function () {
"use strict";

// ---------- accounts and state -----------------------------------------------------
const TOKEN = "wfe.token";
const DATA_KEYS = ["onboarded", "prefs", "profile", "progress", "role", "seen"];
const st = {
  meta: null, page: "signin", wiz: 0, scen: "moderate", compare: false,
  analysis: null, advice: null, path: null, updates: null, sel: null, open: null,
  explain: {}, busy: {}, cvDraft: null, extractNote: "", occ: { q: "", results: [], source: "" }, expMode: null,
  team: "hr", teamUpload: null, teamTarget: null, polished: null,
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
    catch (e) { if (/sign in/i.test(e.message)) { toast(e.message); signedOut(); } else toast("Could not save: " + e.message); }
  }, 600);
}
function useAccount(u) { st.acct = { id: u.id, name: u.name, sample: u.kind === "sample", kind: u.kind, ...u.data }; }
function signedOut() {
  st.acct = null; st.token = null;
  try { localStorage.removeItem(TOKEN); } catch (e) { /* ignore */ }
  st.page = "signin"; st.signin = { error: "" }; loadAccounts();
}
async function loadAccounts() { try { st.accounts = (await api("/api/accounts")).accounts; } catch (e) { st.accounts = []; } render(); }

// ---------- helpers -------------------------------------------------------------------
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const LV = ["none", "basic", "working", "strong"];
const cl = (id) => st.meta.clusters.find((c) => c.id === id) || { label: id, sdg: [] };
const roleOf = (id) => st.meta.roles.find((r) => r.id === id);
const country = () => st.meta.countries[P().country] || st.meta.countries.OTHER;
const firstName = () => (A().name || "").split(",")[0].trim();
const skillsNow = () => { const s = { ...P().skills }; Object.entries(P().pathSkills).forEach(([k, v]) => { s[k] = Math.max(s[k] || 0, v); }); return s; };
function toast(m) { const t = $("#toast"); t.textContent = m; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => { t.hidden = true; }, 2800); }
async function api(path, body, isForm, method) {
  const headers = isForm || !body ? {} : { "Content-Type": "application/json" };
  if (st.token) headers.Authorization = "Bearer " + st.token;
  const opt = body ? { method: method || "POST", body: isForm ? body : JSON.stringify(method === "PUT" ? { data: body } : body), headers } : { headers };
  const r = await fetch(path, opt);
  if (!r.ok) { let m = r.statusText; try { m = (await r.json()).detail || m; } catch (e) { /* not json */ } throw new Error(m); }
  return r.json();
}
const lvlDots = (n) => `<span class="lvl" aria-hidden="true">${[1, 2, 3].map((i) => `<i class="${i <= n ? "on" : ""}"></i>`).join("")}</span>`;
const SDG_COL = { 1: "#E5243B", 2: "#DDA63A", 3: "#4C9F38", 4: "#C5192D", 5: "#FF3A21", 6: "#26BDE2", 7: "#FCC30B", 8: "#A21942", 9: "#FD6925", 10: "#DD1367", 11: "#FD9D24", 12: "#BF8B2E", 13: "#3F7E44", 14: "#0A97D9", 15: "#56C02B", 16: "#00689D", 17: "#19486A" };
const sdgTag = (t) => { const g = parseInt(t, 10); const d = st.meta.sdg_targets[t]; return `<span class="sdg ${g === 7 ? "y" : ""}" style="background:${SDG_COL[g]}" title="${esc(d ? "SDG " + t + ": " + d.text : "SDG " + t)}">SDG ${esc(t)}</span>`; };

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
  sdg: ["The UN's 17 goals for a better world. This shows how the work helps them.", "Links to official UN SDG targets with a reason. They do not change rankings, except in the Green transition scenario."],
  esco: ["The EU's official list of jobs and skills. We use it so careers are real.", "ESCO v1.2 occupations and essential skills, linked to ISCO-08 codes."],
  future: ["A skill employers now want because of AI. Official job lists don't include it yet.", "Requirement added by the team because ESCO predates generative AI."],
  resume: ["Your resume opens when you finish a stage, so it only shows what you can really do.", "The resume lists skills at working level or above and only courses marked done."],
  update: ["We check the latest job and research data every time you visit.", "The newest trend snapshot is compared with the previous one to re-rank steps and spot rising tools."]
};
const info = (key) => `<details class="info"><summary aria-label="What does this mean?" title="What does this mean?">?</summary><span>${esc(GLOSSARY[key][simple() ? 0 : 1])}</span></details>`;
const fitLabel = (s) => s >= 70 ? "Great fit" : s >= 55 ? "Good fit" : s >= 40 ? "Some fit" : "Long shot";
function demandText(x) {
  if (x == null) return simple() ? "not enough data" : "no data";
  if (!simple()) return (x >= 0 ? "+" : "") + Math.round(x * 100) + "%";
  return x >= 0.05 ? "more jobs want this" : x <= -0.05 ? "fewer jobs want this" : "about the same";
}
function expBadge(e) {
  if (!e) return '<span class="badge">No AI score</span>';
  const g = (e.category.match(/Gradient (\d)/) || [])[1];
  const lvl = g === "4" || g === "3" ? "high" : g === "2" ? "medium" : "low";
  const label = simple() ? `AI impact: ${lvl}` : `AI exposure: ${e.category.replace("Exposed: ", "")} (${e.mean.toFixed(2)})`;
  return `<span class="badge ${lvl === "high" ? "warn" : ""}">${esc(label)}</span>`;
}
function expSentence(e) {
  if (!e) return "";
  const g = (e.category.match(/Gradient (\d)/) || [])[1];
  if (simple()) return g === "4" ? "AI can already do most of the daily tasks in this job." : g === "3" ? "AI can do many of the daily tasks in this job." : g === "2" ? "AI can do some tasks in this job." : "AI can do only a few tasks in this job.";
  return `ILO mean task score ${e.mean.toFixed(2)} of 1 (${e.category}). Most exposed task: “${e.most_exposed_task.task}”.`;
}
const SCEN_SIMPLE = { moderate: "Steady change", fast: "AI moves fast", green: "Green jobs grow" };
const scenLabel = (k) => simple() ? SCEN_SIMPLE[k] : st.meta.scenarios[k].label;
const I = {
  upload: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 16V4M6 10l6-6 6 6M4 20h16"/></svg>',
  pen: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>',
  skip: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  book: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M4 5c3-1 6-1 8 1 2-2 5-2 8-1v14c-3-1-6-1-8 1-2-2-5-2-8-1z"/><path d="M12 6v14"/></svg>',
  award: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><circle cx="12" cy="9" r="6"/><path d="M8.5 14 7 22l5-3 5 3-1.5-8"/></svg>',
  flag: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M5 21V4M5 4h11l-2 4 2 4H5"/></svg>',
  case: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5h6v2M3 13h18"/></svg>',
  check: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5 9-10"/></svg>',
  lock: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>'
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
    if (opts.path !== false && A().role) await loadPath();
    await loadAdvice();
  } catch (e) { toast("Could not update: " + e.message); }
  render();
}
async function loadPath() {
  if (!A().role) return;
  st.busy.path = true;
  try { st.path = await api("/api/pathway", { ...profileBody(), skills: P().skills, role: A().role, scenario: st.scen }); }
  catch (e) { toast("Could not build the path: " + e.message); }
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
const NAV = [["dashboard", "Home"], ["careers", "Careers"], ["path", "Path"], ["resume", "Resume"]];
function renderChrome() {
  const signed = !!A() && st.page !== "signin";
  const inWizard = st.page === "wizard";
  $("#nav").innerHTML = signed && !inWizard && A().onboarded ? NAV.map(([k, l]) => `<button type="button" data-page="${k}" ${st.page === k ? 'aria-current="page"' : ""}>${l}</button>`).join("") : "";
  $("#account").innerHTML = signed ? `<details class="menu"><summary><span class="avatar">${esc(firstName()[0] || "?")}</span><span class="acct-name">${esc(firstName())}</span></summary>
    <div class="menu-body">
      <p class="tiny muted">Signed in as ${esc(A().name)}${A().sample ? " (shared sample account)" : ""}</p>
      <div class="seg" role="group" aria-label="Explanations"><button type="button" data-mode="simple" aria-pressed="${simple()}">Simple</button><button type="button" data-mode="detailed" aria-pressed="${!simple()}">Detailed</button></div>
      ${A().onboarded ? '<button type="button" class="btn" data-page="wizard">Edit about you</button>' : ""}
      <button type="button" class="btn" data-page="team">Teams</button><button type="button" class="btn" data-page="sources">Sources</button>
      <button type="button" class="btn" id="signOut">Sign out</button>
    </div></details>` : "";
  const l = st.meta.llm;
  $("#llmFoot").textContent = l.available ? `AI model: ${l.model} via ${l.via}, only when you switch it on.` : "No AI model connected.";
}
const intro = (eyebrow, title, text) => `<div class="intro">${eyebrow ? `<span class="eyebrow">${esc(eyebrow)}</span>` : ""}<h2>${esc(title)}</h2>${text ? `<p class="muted">${text}</p>` : ""}</div>`;

// ---------- sign in ----------------------------------------------------------------------------
function vSignin() {
  const testers = st.accounts.filter((a) => a.kind === "tester"), samples = st.accounts.filter((a) => a.kind === "sample");
  return `<div class="signin"><div class="card stack lg">
    <div class="stack" style="gap:4px"><span class="logo big" aria-hidden="true"><svg width="22" height="22" viewBox="0 0 18 18"><path d="M2 14 L7 8 L10 11 L16 3" stroke="#fff" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
      <h2>Sign in</h2><p class="muted small">Choose your account. Your profile, career plan and resume are saved to it.</p></div>
    <div class="field"><label for="acctSel">Account</label><select id="acctSel">
      ${testers.length ? `<optgroup label="Testers">${testers.map((a) => `<option value="${esc(a.id)}">${esc(a.name)}${a.onboarded ? "" : " · new"}</option>`).join("")}</optgroup>` : ""}
      <optgroup label="Sample people (synthetic, shared)">${samples.map((a) => `<option value="${esc(a.id)}">${esc(a.name)}</option>`).join("")}</optgroup>
    </select></div>
    ${st.signin.error ? `<p class="note warn small">${esc(st.signin.error)}</p>` : ""}
    <button class="btn primary big" type="button" id="signIn">Continue</button>
    <p class="tiny muted">Prototype sign-in without a password. New accounts start with a short setup.</p>
  </div></div>`;
}
async function signIn(id) {
  try {
    const r = await api(`/api/accounts/${encodeURIComponent(id)}/signin`, {});
    st.token = r.token;
    try { localStorage.setItem(TOKEN, r.token); } catch (e) { /* session lasts this tab only */ }
    useAccount(await api("/api/me"));
  } catch (e) { st.signin.error = e.message; render(); return; }
  Object.assign(st, { analysis: null, path: null, advice: null, sel: null, open: null, explain: {}, cvDraft: null, extractNote: "", polished: null, occ: { q: "", results: [], source: "" }, signin: { error: "" } });
  if (!A().onboarded) { st.page = "wizard"; st.wiz = 0; render(); return; }
  st.page = "dashboard"; render();
  await refresh({});
  if (st.updates && A().seen !== st.updates.snapshot.id) { if (A().seen) toast("New job data since your last visit. We rechecked your path."); A().seen = st.updates.snapshot.id; save(); }
}

// ---------- About you: one question at a time ------------------------------------------------
const WIZ = [
  { id: "mode", title: "How should we explain things?", help: "You can change this any time from your account menu." },
  { id: "country", title: "Where do you want to work?", help: "We use this for local jobs, courses and help with costs." },
  { id: "you", title: "Tell us a little about yourself", help: "Optional. This only shapes cost and time advice. It never changes which careers match you." },
  { id: "time", title: "How much time and money can you put in?", help: "We plan your learning to fit." },
  { id: "experience", title: "What have you done so far?", help: "Import your CV, write a few lines, or skip and add skills yourself." },
  { id: "skills", title: "Check your skills", help: "Tap a skill to change its level. Add anything we missed." },
  { id: "interests", title: "What do you enjoy?", help: "Pick as many as you like. We use this to rank careers." },
  { id: "done", title: "", help: "" }
];
function optionCard(group, value, title, text, on) { return `<button type="button" class="option" data-opt="${group}" data-val="${esc(value)}" aria-pressed="${on}"><b>${esc(title)}</b>${text ? `<span class="small muted">${esc(text)}</span>` : ""}</button>`; }
function vWizard() {
  const p = P(), s = WIZ[st.wiz], m = st.meta, last = WIZ.length - 1;
  let body = "";
  if (s.id === "mode") {
    body = `<div class="options">${optionCard("mode", "simple", "Simple", "Short, plain words. Best if this is your first time planning a career.", simple())}${optionCard("mode", "detailed", "Detailed", "Numbers, sources and the full reasoning.", !simple())}</div>
      <div class="field"><label for="langSel">AI explanations in</label><select id="langSel"><option value="en" ${A().prefs.lang === "en" ? "selected" : ""}>English</option><option value="ms" ${A().prefs.lang === "ms" ? "selected" : ""}>Bahasa Malaysia</option><option value="zh" ${A().prefs.lang === "zh" ? "selected" : ""}>中文</option></select></div>`;
  } else if (s.id === "country") {
    body = `<div class="options">${Object.entries(m.countries).map(([k, v]) => optionCard("country", k, v.name, "", p.country === k)).join("")}</div>`;
  } else if (s.id === "you") {
    body = `<div class="field"><span class="label">Age</span><div class="chips">${m.age_bands.map((a) => `<button type="button" class="chip" data-opt="age_band" data-val="${a}" aria-pressed="${p.age_band === a}">${a}</button>`).join("")}<button type="button" class="chip" data-opt="age_band" data-val="" aria-pressed="${!p.age_band}">Prefer not to say</button></div></div>
      <div class="field"><span class="label">Right now I am…</span><div class="options">${Object.entries(m.situations).map(([k, v]) => optionCard("situation", k, v, "", p.situation === k)).join("")}</div></div>`;
  } else if (s.id === "time") {
    body = `<div class="field"><label for="hours">Time to learn: <b id="hoursOut">${p.hours}</b> hours a week</label><input type="range" id="hours" min="1" max="20" value="${p.hours}"></div>
      <div class="field"><span class="label">Monthly learning budget</span><div class="options">${country().budgets.map(([k, v]) => optionCard("budget", k, v, k === "free" ? "Only free courses. Paid ones show as optional." : "", p.budget === k)).join("")}</div></div>`;
  } else if (s.id === "experience") {
    const l = m.llm;
    body = `<div class="options">${[["cv", I.upload, "Import my CV", "PDF, Word or text"], ["write", I.pen, "Write a few lines", "Describe your work in your own words"], ["skip", I.skip, "Skip", "Add skills yourself next"]].map(([k, ic, t, d]) => `<button type="button" class="option" data-exp="${k}" aria-pressed="${st.expMode === k}"><span class="icon">${ic}</span><b>${t}</b><span class="small muted">${d}</span></button>`).join("")}</div>
      ${st.expMode === "cv" ? `<label class="drop" id="drop"><span class="small">Drop your CV here, or <u>choose a file</u></span><input type="file" id="cvFile" accept=".pdf,.docx,.txt" hidden></label>
        ${l.available ? `<label class="check"><input type="checkbox" id="useModel" ${p.useModel ? "checked" : ""}> <span class="small">Let AI read it. Your name, phone, email and IC number are removed first.</span></label>` : ""}
        ${st.busy.cv ? '<p class="small muted"><span class="spin"></span> Reading your CV…</p>' : ""}
        <p class="tiny muted">No CV handy? Try a sample: <a href="/static/samples/sample-cv-meiling.pdf" download>PDF</a> · <a href="/static/samples/sample-cv-aisha.docx" download>Word</a> · <a href="/static/samples/sample-cv-hafiz.txt" download>text</a></p>` : ""}
      ${st.expMode === "write" ? `<textarea id="about" maxlength="6000" placeholder="I have worked 10 years as an admin clerk. I prepare invoices in Excel and handle customer calls in Malay and English.">${esc(p.about)}</textarea>
        ${l.available ? `<label class="check"><input type="checkbox" id="useModel" ${p.useModel ? "checked" : ""}> <span class="small">Let AI read it too (more accurate). It must quote your words for every skill.</span></label>` : ""}
        <button class="btn" type="button" id="extractBtn" ${st.busy.extract ? "disabled" : ""}>${st.busy.extract ? '<span class="spin"></span> Reading…' : "Find my skills"}</button>` : ""}
      ${st.extractNote ? `<p class="note small">${esc(st.extractNote)}</p>` : ""}
      ${st.cvDraft ? vCvReview() : ""}`;
  } else if (s.id === "skills") {
    const sk = skillsNow();
    body = `<div class="chips">${Object.entries(sk).length ? Object.entries(sk).map(([k, v]) => `<button type="button" class="chip" data-cycle="${k}" title="${esc(LV[v] + (p.evidence[k] ? " · " + p.evidence[k].evidence : ""))}">${esc(cl(k).label)} ${lvlDots(v)}</button>`).join("") : '<span class="small muted">No skills yet.</span>'}</div>
      <select id="addSkill" aria-label="Add a skill"><option value="">+ Add a skill</option>${m.clusters.filter((c) => !sk[c.id]).map((c) => `<option value="${c.id}">${esc(c.label)}</option>`).join("")}</select>
      <div class="field"><label for="occQ">Your current or last job (optional)</label><input type="search" id="occQ" placeholder="e.g. accounts clerk" value="${esc(st.occ.q)}" autocomplete="off"></div>
      ${st.busy.occ ? '<p class="small muted"><span class="spin"></span> Searching…</p>' : ""}
      ${st.occ.results.length ? `<div class="stack">${st.occ.results.map((r, i) => `<button type="button" class="btn" data-occ="${i}" style="justify-content:space-between"><span>${esc(r.title)}</span><span class="tiny muted">${r.exposure ? expBadge(r.exposure) : ""}</span></button>`).join("")}</div>` : ""}
      ${p.current ? `<div class="note"><b>${esc(p.current.title)}</b> ${expBadge(p.current.exposure)} ${info("exposure")}<p class="small" style="margin-top:6px">${esc(expSentence(p.current.exposure))}</p>
        ${p.current.suggested && Object.keys(p.current.suggested).length ? '<button class="btn ghost" type="button" id="addSuggested">+ Add skills typical of this job</button>' : ""}</div>` : ""}`;
  } else if (s.id === "interests") {
    const all = [...new Set(m.roles.flatMap((r) => r.tags))].sort();
    body = `<div class="chips big">${all.map((i) => `<button type="button" class="chip" data-interest="${esc(i)}" aria-pressed="${p.interests.includes(i)}">${esc(i)}</button>`).join("")}</div>`;
  } else {
    const sk = skillsNow();
    body = `<div class="stack"><div class="done-mark">${I.check}</div><h2>${A().onboarded ? "Ready to update your plan" : `All set, ${esc(firstName())}`}</h2>
      <p class="muted">Here is what you told us. Go back to change anything.</p>
      <div class="summary">
        <div><span class="label">Explanations</span><b>${simple() ? "Simple" : "Detailed"}</b></div>
        <div><span class="label">Country</span><b>${esc(country().name)}</b></div>
        <div><span class="label">Situation</span><b>${esc(m.situations[p.situation] || "Not given")}${p.age_band ? ", age " + esc(p.age_band) : ""}</b></div>
        <div><span class="label">Time and budget</span><b>${p.hours} h a week · ${esc((country().budgets.find((b) => b[0] === p.budget) || [, ""])[1])}</b></div>
        <div><span class="label">Skills</span><b>${Object.keys(sk).length} skills</b></div>
        <div><span class="label">Interests</span><b>${esc(p.interests.join(", ") || "None picked")}</b></div>
      </div></div>`;
  }
  const canNext = s.id !== "skills" || Object.keys(skillsNow()).length >= 2;
  return `<div class="wizard">
    <div class="progress-bar" aria-label="Step ${st.wiz + 1} of ${WIZ.length}"><div style="width:${(st.wiz + 1) / WIZ.length * 100}%"></div></div>
    <div class="card stack lg wiz-card">
      ${s.title ? `<div class="stack" style="gap:6px"><span class="eyebrow">About you · ${st.wiz + 1} of ${last}</span><h2>${esc(s.title)}</h2><p class="muted">${esc(s.help)}</p></div>` : ""}
      ${body}
      <div class="row between">
        ${st.wiz > 0 ? '<button class="btn" type="button" id="wizBack">Back</button>' : (A().onboarded ? '<button class="btn" type="button" data-page="dashboard">Cancel</button>' : "<span></span>")}
        ${st.wiz < last ? `<button class="btn primary" type="button" id="wizNext" ${canNext ? "" : "disabled"} title="${canNext ? "" : "Add at least two skills"}">Next</button>` : `<button class="btn primary big" type="button" id="wizFinish" ${st.busy.finish ? "disabled" : ""}>${st.busy.finish ? '<span class="spin"></span> Building…' : A().onboarded ? "Update my plan" : "Build my career plan"}</button>`}
      </div>
    </div></div>`;
}
function vCvReview() {
  const d = st.cvDraft;
  const exp = d.experience.map((e, i) => `<div class="entry"><div class="grid cols-2">
      <div class="field"><label>Job title</label><input type="text" data-cv="experience.${i}.title" value="${esc(e.title)}"></div>
      <div class="field"><label>Organisation</label><input type="text" data-cv="experience.${i}.organisation" value="${esc(e.organisation)}"></div>
      <div class="field"><label>From</label><input type="text" data-cv="experience.${i}.start" value="${esc(e.start)}"></div>
      <div class="field"><label>To</label><input type="text" data-cv="experience.${i}.end" value="${esc(e.end)}"></div></div>
      <div class="field"><label>What you did (one per line)</label><textarea data-cv="experience.${i}.highlights">${esc((e.highlights || []).join("\n"))}</textarea></div>
      <button type="button" class="btn ghost" data-cvdel="experience.${i}">Remove this job</button></div>`).join("");
  const edu = d.education.map((e, i) => `<div class="grid cols-3">
      <div class="field"><label>Qualification</label><input type="text" data-cv="education.${i}.qualification" value="${esc(e.qualification)}"></div>
      <div class="field"><label>Institution</label><input type="text" data-cv="education.${i}.institution" value="${esc(e.institution)}"></div>
      <div class="field"><label>Year</label><input type="text" data-cv="education.${i}.year" value="${esc(e.year)}"></div></div>`).join("");
  return `<div class="stack lg review" id="cvReview">
    <div><span class="eyebrow">Check before saving</span><h3>Here is what we found</h3><p class="small muted">${esc(d.note)} Fix anything that is wrong. When you save, these details are stored in your account so you can use them for your resume.</p></div>
    ${d.warnings && d.warnings.length ? `<p class="note warn small">${esc(d.warnings.join(" "))}</p>` : ""}
    <div class="grid cols-2">${["name", "email", "phone", "location"].map((k) => `<div class="field"><label>${k[0].toUpperCase() + k.slice(1)}</label><input type="text" data-cv="contact.${k}" value="${esc(d.contact[k] || "")}"></div>`).join("")}</div>
    <div class="field"><label>Summary</label><textarea data-cv="summary">${esc(d.summary)}</textarea></div>
    <div class="stack"><span class="label">Work experience</span>${exp || '<p class="small muted">No jobs found.</p>'}<button type="button" class="btn" data-cvadd="experience">+ Add a job</button></div>
    <div class="stack"><span class="label">Education</span>${edu || '<p class="small muted">No education found.</p>'}<button type="button" class="btn" data-cvadd="education">+ Add education</button></div>
    <div class="grid cols-2"><div class="field"><label>Certificates (one per line)</label><textarea data-cv="certifications">${esc(d.certifications.join("\n"))}</textarea></div>
      <div class="field"><label>Languages (comma separated)</label><input type="text" data-cv="languages" value="${esc(d.languages.join(", "))}"></div></div>
    <div class="stack"><span class="label">Skills we found</span>${Object.entries(d.skills).map(([k, v]) => `<label class="check"><input type="checkbox" data-cvskill="${k}" ${v.keep !== false ? "checked" : ""}>
        <span><b>${esc(cl(k).label)}</b> <select data-cvlevel="${k}" aria-label="Level">${[1, 2, 3].map((n) => `<option value="${n}" ${v.level === n ? "selected" : ""}>${LV[n]}</option>`).join("")}</select><br><span class="tiny muted">“${esc(v.evidence)}”</span></span></label>`).join("") || '<p class="small muted">None found.</p>'}</div>
    <div class="row between"><button type="button" class="btn ghost" id="cvDiscard">Discard</button><button type="button" class="btn primary" id="cvSave">Save and continue</button></div>
  </div>`;
}
async function finishWizard() {
  st.busy.finish = true; render();
  const first = !A().onboarded;
  A().onboarded = true; save();
  try {
    st.analysis = await api("/api/analyze", { ...profileBody(), compare: false });
    if (first || !A().role) A().role = st.analysis.scenarios.moderate[0].role;
    st.path = null; await loadPath(); await loadAdvice();
    try { st.updates = await api("/api/updates"); A().seen = st.updates.snapshot.id; } catch (e) { /* optional */ }
  } catch (e) { toast("Could not build your plan: " + e.message); }
  st.busy.finish = false; save();
  st.page = "dashboard"; render(); window.scrollTo({ top: 0 });
  toast(first ? "Your career plan is ready." : "Your plan is updated.");
}

// ---------- dashboard ------------------------------------------------------------------------
function vDashboard() {
  if (!st.analysis || (A().role && (!st.path || st.path.role !== A().role))) { if (!st.busy.dash) { st.busy.dash = true; refresh({}).then(() => { st.busy.dash = false; }); } return '<p class="muted"><span class="spin"></span> Loading your plan…</p>'; }
  const r = roleOf(A().role), res = rows().find((x) => x.role === A().role), pw = st.path, cur = currentNode(), up = st.updates, adv = st.advice;
  const u = unlockedStage(), si = cur ? cur.si : pw.stages.length - 1;
  const moved = up ? up.moved.filter((x) => flatNodes().some((n) => n.cluster === x.cluster)) : [];
  const tech = [...new Set(flatNodes().flatMap((n) => (n.new_tech || []).map((w) => w.term)))];
  return `<div class="page">
    ${intro("", `Hi ${firstName()}`, simple() ? "Here is your plan. Do the next step when you are ready." : `Your plan towards ${esc(pw.stages[pw.stages.length - 1].title)}. Trend data from ${esc(pw.snapshot.as_of)}.`)}
    <div class="dash">
      <div class="card stack hero-card">
        <span class="eyebrow">Your next step</span>
        ${cur ? `<div class="row" style="gap:14px;align-items:center"><span class="disc-mini">${nodeIcon(cur, false)}</span><div><h3>${esc(nodeLabel(cur))}</h3><p class="small muted">${esc(cur.stage.stage)} · ${esc(cur.stage.title)}${cur.type === "skill" && cur.items[0] ? " · " + esc(cur.items[0].title) + ` (${cur.items[0].hours} h)` : ""}</p></div></div>
          <div class="row"><button class="btn primary" type="button" data-goto="${esc(cur.key)}">Start this step</button></div>` : '<h3>You finished every step. Well done!</h3>'}
      </div>
      <div class="card stack">
        <span class="eyebrow">Your career ${info("stage")}</span>
        <h3>${esc(r.title)}</h3>
        <div class="ladder">${pw.stages.map((s, i) => `${i ? '<span class="arrow">→</span>' : ""}<span class="${i <= u ? "up" : ""}">${esc(s.title)}${i <= u ? " ✓" : ""}</span>`).join("")}</div>
        <div class="row">${res ? `<span class="badge accent">${simple() ? fitLabel(res.score) : "Score " + Math.round(res.score)}</span>` : ""}${expBadge(r.exposure)}</div>
        <button class="btn" type="button" data-page="careers">Compare careers</button>
      </div>
      <div class="card stack">
        <span class="eyebrow">Progress</span>
        <div class="row" style="gap:16px;align-items:center"><div class="ring" style="--p:${stagePct(si)}"><span>${stagePct(si)}%</span></div>
          <div><b>${esc(pw.stages[si].stage)} stage</b><p class="small muted">${simple() ? `About ${pw.stages[si].weeks[1]} weeks at your pace` : `${pw.stages[si].hours} h of study · ${pw.stages[si].weeks[0]}–${pw.stages[si].weeks[1]} weeks at ${pw.hours_per_week} h/week`}</p></div></div>
        <button class="btn" type="button" data-page="path">Open my path</button>
      </div>
      <div class="card stack">
        <span class="eyebrow">Today's check ${info("update")}</span>
        ${simple() ? `<p class="small">${moved.length || tech.length ? "Jobs are changing:" : "Nothing important changed in your plan."}</p>
          <ul class="small plain">${moved.slice(0, 3).map((x) => `<li>${esc(cl(x.cluster).label)}: ${x.after > x.before ? "more" : "fewer"} jobs want it now</li>`).join("")}${tech.slice(0, 3).map((t) => `<li>New tool to know: ${esc(t)}</li>`).join("")}</ul>`
          : `<div class="list">${moved.slice(0, 4).map((x) => `<div><span>${esc(cl(x.cluster).label)}</span><span class="mono ${x.after > x.before ? "up" : "down"}">${demandText(x.before)} → ${demandText(x.after)}</span></div>`).join("") || '<div><span class="small muted">No big moves in your skills.</span></div>'}</div>
          ${tech.length ? `<p class="small">Rising tools in your path: ${esc(tech.join(", "))}</p>` : ""}`}
        <p class="tiny muted">Checked ${esc(up ? up.checked_on : "today")}</p>
      </div>
      <div class="card stack">
        <span class="eyebrow">Resume ${info("resume")}</span>
        ${u >= 0 ? `<h3>Ready for ${esc(pw.stages[u].title)}</h3><button class="btn primary" type="button" data-page="resume">Open my resume</button>` : `<h3 class="muted">Locked</h3><p class="small">Finish the ${esc(pw.stages[0].stage.toLowerCase())} stage to unlock it (${stagePct(0)}% done).</p>`}
      </div>
      ${adv ? `<div class="card stack">
        <span class="eyebrow">Advice for you</span>
        ${adv.tips.slice(0, simple() ? 2 : 4).map((t) => `<p class="small">• ${esc(simple() ? t.split(". ")[0] + "." : t)}</p>`).join("")}
        ${adv.side_income.length ? `<p class="small"><b>Earn while you learn:</b> ${esc(adv.side_income[0].idea)}</p>` : ""}
        <button class="btn ghost" type="button" data-page="careers">More advice</button>
      </div>` : ""}
    </div>
    <div class="row between"><p class="small muted">Something changed in your life?</p><button class="btn" type="button" data-page="wizard">Edit about you</button></div>
  </div>`;
}

// ---------- careers ------------------------------------------------------------------------
function bar(label, pts, neg) { const w = Math.min(100, Math.abs(pts) * 2.4); return `<div class="bar"><span class="muted">${esc(label)}</span><span class="track"><span class="fill ${neg ? "neg" : ""}" style="display:block;width:${w}%"></span></span><span class="mono">${neg ? "" : "+"}${pts.toFixed(1)}</span></div>`; }
function whySimple(x) {
  const out = [];
  out.push(x.components.skill >= 0.7 ? "You already have most of the skills." : x.components.skill >= 0.4 ? "You have some of the skills." : "You would need to learn many new skills.");
  out.push(x.components.outlook >= 0.55 ? "More jobs are asking for these skills." : x.components.outlook <= 0.45 ? "Fewer jobs are asking for these skills lately." : "Demand for these skills is steady.");
  if (x.components.interest >= 0.5) out.push("It matches what you enjoy.");
  out.push(expSentence(roleOf(x.role).exposure));
  return out;
}
function vCareers() {
  const a = st.analysis; if (!a) { refresh({}); return '<p class="muted"><span class="spin"></span> Loading…</p>'; }
  const list = rows().slice(0, 6), adv = st.advice, diff = a.diff ? a.diff[st.scen] : null;
  return `<div class="page">
  ${intro("Careers", "Careers that fit you", simple() ? "The best matches are at the top. Tap “Why?” to see the reasons in plain words." : "Ranked by your skills, where demand is heading, and how much of the work AI can already do.")}
  <div class="row between">
    <div class="row"><div class="seg" role="group" aria-label="Future">${Object.keys(st.meta.scenarios).map((k) => `<button type="button" data-scen="${k}" aria-pressed="${st.scen === k}">${esc(scenLabel(k))}</button>`).join("")}</div>${info("scenario")}</div>
    <label class="check small" style="align-items:center"><input type="checkbox" id="compareChk" ${st.compare ? "checked" : ""}> What changed recently</label>
  </div>
  ${diff ? `<div class="note accent small"><b>${simple() ? "What changed:" : "What changed with the latest data."}</b> ${diff.length ? diff.map((x) => simple() ? `${esc(roleOf(x.role).title)} moved ${x.to < x.from ? "up" : "down"}` : `${esc(roleOf(x.role).title)} ${x.from} → ${x.to} (${esc(cl(x.driver).label)} ${demandText(x.driver_before)} → ${demandText(x.driver_after)})`).join("; ") : "Your top careers stayed the same."}</div>` : ""}
  <div class="split">
    <div class="card pad0">${list.map((x) => vCareerRow(x)).join("")}</div>
    <div class="stack lg">
      ${adv ? `<div class="card stack"><h3>Advice for your situation</h3>
        ${adv.tips.map((t, i) => `<div class="guide"><span class="num">${i + 1}</span><p class="small">${esc(simple() ? t.split(". ")[0] + "." : t)}</p></div>`).join("")}
        ${adv.side_income.length ? `<hr><span class="label">Earn while you learn</span>${adv.side_income.map((s2) => `<p class="small">• ${esc(s2.idea)}${s2.caution ? `<br><span class="tiny" style="color:var(--warn)">${esc(s2.caution)}</span>` : ""}</p>`).join("")}` : ""}
        ${adv.funding.length ? `<hr><span class="label">Help with costs in ${esc(country().name)}</span>${adv.funding.map((f) => `<p class="small"><a href="${esc(f.url)}" target="_blank" rel="noopener">${esc(f.name)}</a>${simple() ? "" : ": " + esc(f.text)}</p>`).join("")}` : ""}
        <p class="tiny muted">${esc(adv.fairness_note)}</p></div>` : ""}
      ${vRadarCard()}
    </div>
  </div></div>`;
}
function vCareerRow(x) {
  const r = roleOf(x.role), rg = st.analysis.ranges[x.role], open = st.open === x.role, ex = st.explain[x.role];
  const local = st.analysis.local_demand[`${x.role}@0`], mine = A().role === x.role;
  return `<article class="career">
    <div class="ring" style="--p:${Math.round(x.score)}"><span>${Math.round(x.score)}</span></div>
    <div class="stack" style="gap:6px;min-width:0">
      <h3>${esc(r.title)} ${simple() ? `<span class="badge accent">${fitLabel(x.score)}</span>` : ""}</h3>
      <div class="ladder">${r.ladder.map((s, i) => `${i ? '<span class="arrow">→</span>' : ""}<span>${esc(s.title)}</span>`).join("")}</div>
      <div class="row" style="gap:6px">${expBadge(r.exposure)}${local ? `<span class="badge accent" title="${esc(st.analysis.local_demand_source)}">In demand in ${esc(country().name)}</span>` : ""}${simple() ? "" : `<span class="badge">${rg.min.toFixed(0)}–${rg.max.toFixed(0)} across futures</span>`}</div>
    </div>
    <div class="row act"><button class="btn" type="button" data-open="${x.role}">${open ? "Hide" : "Why?"}</button><button class="btn ${mine ? "primary" : ""}" type="button" data-choose="${x.role}">${mine ? "My career ✓" : "Choose"}</button></div>
    ${open ? `<div class="details">
      ${simple() ? `<ul class="small plain">${whySimple(x).map((t) => `<li>${esc(t)}</li>`).join("")}</ul>
        <p class="small"><b>You would learn:</b> ${x.gaps.map((g) => esc(cl(g.cluster).label)).join(", ") || "nothing new"}.</p>`
      : `<p class="small"><b>You have:</b> ${x.matched.map((mm) => esc(cl(mm.cluster).label)).join(", ") || "none of the core skills yet"}.</p>
        <p class="small"><b>To build:</b> ${x.gaps.map((g) => `${esc(cl(g.cluster).label)} (${LV[g.have]} → ${LV[g.need]}${g.basis === "future" ? ", AI-era skill" : ""})`).join("; ") || "nothing"}.</p>
        <div class="row" style="gap:6px"><span class="label">Score parts</span>${info("score")}</div>
        <div class="bars">${bar("Skill match", x.points.skill)}${bar("Demand outlook", x.points.outlook)}${bar("Transferable skills", x.points.transfer)}${bar("Interest fit", x.points.interest)}${x.points.green ? bar("Green economy", x.points.green) : ""}${bar("AI exposure", x.points.exposure, true)}</div>
        <p class="tiny muted">${esc(expSentence(r.exposure))} <a href="${esc(r.esco.uri)}" target="_blank" rel="noopener">View in ESCO</a></p>`}
      <div class="row"><button class="btn" type="button" data-explain="${x.role}" ${st.busy["ex_" + x.role] ? "disabled" : ""}>${st.busy["ex_" + x.role] ? '<span class="spin"></span> Writing…' : "Explain it to me"}</button>
        <select data-lang aria-label="Language"><option value="en" ${A().prefs.lang === "en" ? "selected" : ""}>English</option><option value="ms" ${A().prefs.lang === "ms" ? "selected" : ""}>Bahasa Malaysia</option><option value="zh" ${A().prefs.lang === "zh" ? "selected" : ""}>中文</option></select></div>
      ${ex ? `<div class="explain">${esc(ex.text)}</div><p class="tiny muted">${ex.method === "llm" ? `Written by ${esc(ex.model)} from the facts above; numbers checked.` : "Standard explanation."}</p>` : ""}
      <details><summary class="small muted">How this career helps the UN goals ${info("sdg")}</summary><div class="stack" style="margin-top:8px">${r.sdg.map((l) => `<p class="small">${sdgTag(l.target)} ${esc(l.why)}</p>`).join("")}</div></details>
    </div>` : ""}
  </article>`;
}
function vRadarCard() {
  const list = rows(); if (!list.length) return "";
  const sig = st.analysis.signals;
  const ids = Object.keys(sig).filter((k) => sig[k].demand_change != null).sort((a, b) => sig[b].demand_change - sig[a].demand_change);
  if (simple()) {
    return `<div class="card stack"><div class="row" style="gap:6px"><h3>Skills on the rise</h3>${info("demand")}</div>
      <ul class="small plain">${ids.slice(0, 4).map((k) => `<li class="up">▲ ${esc(cl(k).label)}</li>`).join("")}</ul>
      <h3 style="margin-top:6px">Skills cooling down</h3><ul class="small plain">${ids.slice(-3).map((k) => `<li class="down">▼ ${esc(cl(k).label)}</li>`).join("")}</ul></div>`;
  }
  const W = 320, H = 220, L = 30, R = 8, T = 10, B = 30;
  const pts = list.map((x) => ({ x: roleOf(x.role).exposure.mean, y: x.components.outlook, r: x }));
  const ymin = Math.min(...pts.map((p) => p.y)) - 0.03, ymax = Math.max(...pts.map((p) => p.y)) + 0.03;
  const xs = (v) => L + (v - 0.1) / 0.6 * (W - L - R), ys = (v) => T + (1 - (v - ymin) / (ymax - ymin)) * (H - T - B);
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Careers by AI exposure and demand"><rect x="${L}" y="${T}" width="${W - L - R}" height="${H - T - B}" rx="6" fill="var(--chip)"/>`;
  [0.1, 0.4, 0.7].forEach((v) => { s += `<text x="${xs(v)}" y="${H - B + 14}" font-size="9" text-anchor="middle" fill="var(--muted)" font-family="IBM Plex Mono, monospace">${v.toFixed(1)}</text>`; });
  s += `<text x="${(L + W) / 2}" y="${H - 3}" font-size="9" text-anchor="middle" fill="var(--muted)">AI exposure →</text><text x="10" y="${(T + H - B) / 2}" font-size="9" text-anchor="middle" fill="var(--muted)" transform="rotate(-90 10 ${(T + H - B) / 2})">Demand →</text>`;
  pts.slice().reverse().forEach((p) => { const top = p.r.rank <= 6; s += `<g><title>${esc(roleOf(p.r.role).title)}</title><circle cx="${xs(p.x)}" cy="${ys(p.y)}" r="${top ? 8 : 4}" fill="${top ? "var(--accent)" : "var(--surface)"}" stroke="var(--accent)" stroke-width="1.5"/>${top ? `<text x="${xs(p.x)}" y="${ys(p.y) + 3}" font-size="9" font-weight="600" text-anchor="middle" fill="var(--accent-ink)">${p.r.rank}</text>` : ""}</g>`; });
  s += "</svg>";
  return `<div class="card stack radar"><div class="row" style="gap:6px"><h3>Future skills radar</h3>${info("exposure")}</div><p class="tiny muted">Numbers match the ranking. Top-left is the safest place to be.</p>${s}
    <div class="list">${ids.slice(0, 4).map((k) => `<div><span>${esc(cl(k).label)}</span><span class="mono up">${demandText(sig[k].demand_change)}</span></div>`).join("")}${ids.slice(-2).map((k) => `<div><span>${esc(cl(k).label)}</span><span class="mono down">${demandText(sig[k].demand_change)}</span></div>`).join("")}</div>
    <p class="tiny muted">${esc(st.advice ? st.advice.trend_note : "")}</p></div>`;
}

// ---------- path ----------------------------------------------------------------------------
function nodeLabel(n) { return n.type === "skill" ? cl(n.cluster).label : n.type === "cert" ? n.item.title : n.type === "gate" ? (simple() ? "Real work" : "Experience") : "Ready to apply"; }
function nodeIcon(n, isDone) { return isDone ? I.check : { skill: I.book, cert: I.award, gate: I.flag, checkpoint: I.case }[n.type]; }
function vPath() {
  if (!A().role) return `<div class="page">${intro("Path", "Choose a career first", "")}<button class="btn primary" type="button" data-page="careers">Go to careers</button></div>`;
  if (!st.path || st.path.role !== A().role) { if (!st.busy.path) loadPath().then(render); return '<p class="muted"><span class="spin"></span> Building your path…</p>'; }
  const pw = st.path, nodes = flatNodes(), cur = currentNode();
  if (!st.sel || !nodes.find((n) => n.key === st.sel)) st.sel = cur ? cur.key : nodes[0].key;
  const peak = pw.stages[pw.stages.length - 1].title, up = st.updates;
  const newTech = [...new Set(nodes.flatMap((n) => (n.new_tech || []).map((w) => w.term)))];
  let y = 40; const items = []; let k = 0;
  pw.stages.forEach((s, si) => {
    items.push({ band: true, y, text: `${s.stage} · ${s.title}` }); y += 70;
    s.nodes.forEach((n) => { const key = nodeKey(si, n); items.push({ n: nodes.find((x) => x.key === key), y, x: 50 + 26 * Math.sin(k * 1.05) }); y += 128; k++; });
  });
  const pts = items.filter((i) => !i.band);
  const curve = (arr) => arr.map((p, i) => { if (!i) return `M ${p.x} ${p.y}`; const q = arr[i - 1], my = (q.y + p.y) / 2; return `C ${q.x} ${my} ${p.x} ${my} ${p.x} ${p.y}`; }).join(" ");
  const firstOpen = pts.findIndex((p) => !done(p.n.key));
  const map = `<div class="map" style="height:${y}px">
    <svg class="road" viewBox="0 0 100 ${y}" preserveAspectRatio="none" aria-hidden="true"><path d="${curve(pts)}" fill="none" stroke="var(--line)" stroke-width="10" stroke-linecap="round" vector-effect="non-scaling-stroke"/><path d="${curve(pts.slice(0, (firstOpen === -1 ? pts.length : firstOpen) + 1))}" fill="none" stroke="var(--accent)" stroke-width="10" stroke-linecap="round" vector-effect="non-scaling-stroke" opacity=".35"/></svg>
    ${items.map((it) => it.band ? `<div class="stage-band" style="top:${it.y}px"><span>${esc(it.text)}</span></div>` :
      (() => { const n = it.n, isDone = done(n.key), cls = [isDone ? "done" : "", cur && n.key === cur.key ? "current" : "", n.type === "cert" && n.optional ? "optional" : "", n.key === st.sel ? "selected" : ""].join(" ");
        const flag = n.moved > 0 ? (simple() ? "do sooner" : "priority ↑") : (n.new_tech && n.new_tech.length ? "new tool" : "");
        return `<button type="button" class="node ${cls}" data-node="${esc(n.key)}" style="left:${it.x}%;top:${it.y}px" aria-label="${esc(nodeLabel(n))}${isDone ? ", done" : ""}"><span class="disc">${nodeIcon(n, isDone)}${flag && !isDone ? `<span class="flag">${flag}</span>` : ""}</span><span class="cap">${esc(nodeLabel(n))}</span></button>`; })()).join("")}
  </div>`;
  return `<div class="page">
  ${intro("Path", `Your path to ${peak}`, simple() ? `Follow the road from the top. Tap a circle to see what to do. Dashed circles are optional.` : `Start as ${esc(pw.stages[0].title)}. Steps are ordered by prerequisites and current demand. Paid certificates outside your budget are dashed and optional.`)}
  <div class="note accent small"><div class="row" style="gap:6px"><b>${simple() ? "We checked today." : `Checked ${esc(up ? up.checked_on : "today")}. Trend data ${esc(pw.snapshot.as_of)}.`}</b>${info("update")}</div>
    ${simple() ? (pw.priorities_changed ? `${pw.priorities_changed} step(s) moved up because more jobs need them now.` : "Your plan is still in the best order.") : (pw.priorities_changed ? `${pw.priorities_changed} step(s) moved because demand changed.` : "Step order unchanged.")}
    ${newTech.length ? ` ${simple() ? "New tools to know" : "Rising tools in your path"}: ${esc(newTech.join(", "))}.` : ""}</div>
  <div class="row between">
    <div class="row">${pw.stages.map((s) => `<span class="badge">${esc(s.stage)}: ${simple() ? `~${s.weeks[1]} weeks` : `${s.hours} h · ${s.weeks[0]}–${s.weeks[1]} wk`}${s.local_demand ? " · in demand" : ""}</span>`).join("")}${info("stage")}</div>
    <label class="small row" style="gap:6px">Budget ${info("budget")}<select id="budgetPath">${country().budgets.map(([kk, v]) => `<option value="${kk}" ${P().budget === kk ? "selected" : ""}>${esc(v)}</option>`).join("")}</select></label>
  </div>
  <div class="map-wrap">${map}<div class="sheet">${vNodeSheet(nodes.find((n) => n.key === st.sel))}</div></div>
  </div>`;
}
function course(c, label) {
  return `<div class="course"><span class="tiny muted">${esc(label)}</span><b class="small">${esc(c.title)}</b><span class="tiny muted">${esc(c.provider)} · ${c.hours} h · ${esc(c.cost)}${c.hrdc && !simple() ? " · HRD Corp: " + esc(c.hrdc) : ""}</span>${c.url ? `<a class="small" href="${esc(c.url)}" target="_blank" rel="noopener">Open course ↗</a>` : ""}</div>`;
}
function vNodeSheet(n) {
  if (!n) return "";
  const isDone = done(n.key), s = st.path.stages[n.si];
  let body = "";
  if (n.type === "skill") {
    const why = simple()
      ? (n.moved > 0 ? "More jobs need this now, so we moved it earlier." : `Jobs: ${demandText(n.demand_change)}.`)
      : `Job-post demand ${demandText(n.demand_change)}${n.demand_change_before != null ? ` (was ${demandText(n.demand_change_before)})` : ""}.${n.moved > 0 ? " Moved earlier because demand rose." : n.moved < 0 ? " Moved later because other skills became more urgent." : ""}`;
    body = `<p class="small muted">${simple() ? `Go from ${LV[n.from]} to ${LV[n.to]}` : `${LV[n.from]} → ${LV[n.to]}`}${n.basis === "future" ? ` · new AI-era skill ${info("future")}` : ""}</p>
      <p class="small">${why} ${info(n.moved ? "priority" : "demand")}</p>
      ${n.new_tech && n.new_tech.length ? `<p class="note small"><b>${simple() ? "New tool to know:" : "Rising tools:"}</b> ${n.new_tech.map((w) => simple() ? esc(w.term) : `${esc(w.term)} (${w.prev} → ${w.cur} posts)`).join(", ")} ${info("newtech")}</p>` : ""}
      ${n.items.map((c) => course(c, simple() ? "Do this course" : "Recommended")).join("")}
      ${n.covered_earlier ? '<p class="small muted">You already covered this in an earlier course.</p>' : ""}
      ${n.budget_blocked ? '<p class="note warn small">No course fits your budget yet. See the option below or ask about funding.</p>' : ""}
      ${n.partial ? '<p class="note warn small">Courses only get you part of the way. Practise it at work or in a project.</p>' : ""}
      ${n.no_resource ? '<p class="note warn small">No checked course yet. Practise it at work or ask a counsellor.</p>' : ""}
      ${(n.upgrade || []).map((c) => course(c, simple() ? "Optional paid course" : "Stronger option, outside your budget")).join("")}
      ${simple() ? "" : `<p class="tiny muted">Supports ${n.sdg.map(sdgTag).join(" ")} ${info("sdg")}</p>`}`;
  } else if (n.type === "cert") {
    body = `${course(n.item, n.optional ? "Optional: outside your budget" : "Certificate")}<p class="small muted">${simple() ? "A certificate shows employers your level." : "Certificates help employers trust your level. Check the provider's current fee and exam rules."}</p>`;
  } else if (n.type === "gate") {
    body = `<p class="small">${esc(n.text)}</p><p class="small muted">${simple() ? "No course for this one. Mark it done when you have done it." : "This step needs real work, not a course."}</p>`;
  } else {
    const q = encodeURIComponent(s.title), qd = s.title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    body = `<p class="small">${esc(n.text)}</p>
      ${s.local_demand ? `<p class="note accent small">${simple() ? `Employers in ${esc(country().name)} are short of these people.` : `${esc(s.local_demand)} are listed as critical occupations in ${esc(country().name)}. ${esc(st.path.local_demand_source)}`}</p>` : ""}
      <div class="stack"><span class="label">Look for jobs in ${esc(country().name)}</span>${(st.advice ? st.advice.job_search : []).map((j) => `<a class="btn" href="${esc(j.url.replace("{q}", q).replace("{q_dash}", qd))}" target="_blank" rel="noopener">${esc(j.name)} ↗</a>`).join("")}</div>
      ${unlockedStage() >= n.si ? '<button class="btn primary" type="button" data-page="resume">Build my resume →</button>' : '<p class="small muted">Finish the steps above to unlock your resume.</p>'}`;
  }
  return `<div class="card stack"><span class="eyebrow">${esc(s.stage)} · ${esc(s.title)}</span><h3>${esc(nodeLabel(n))}</h3>${body}
    ${n.type !== "checkpoint" ? `<button class="btn ${isDone ? "" : "primary"}" type="button" data-toggle="${esc(n.key)}">${isDone ? "Mark as not done" : "Mark as done"}</button>` : ""}</div>`;
}

// ---------- resume --------------------------------------------------------------------------
function resumeData() {
  const cv = P().cv, u = unlockedStage(), stage = st.path.stages[u];
  const skills = Object.entries(skillsNow()).filter(([, v]) => v >= 2).sort((a, b) => b[1] - a[1]).map(([k]) => cl(k).label);
  const courses = flatNodes().filter((n) => done(n.key) && (n.type === "cert" || n.type === "skill")).flatMap((n) => n.type === "cert" ? [n.item] : n.items).map((c) => `${c.title}, ${c.provider}`);
  const job = /^[A-Z]{2}/.test(stage.title) ? stage.title : stage.title[0].toLowerCase() + stage.title.slice(1);
  const summary = cv.summary || `${stage.title} candidate with skills in ${skills.slice(0, 4).join(", ").toLowerCase()}. Completed a structured learning path towards ${job} roles.`;
  return { stage, skills, courses, summary };
}
function vResume() {
  if (!A().role) return `<div class="page">${intro("Resume", "Choose a career first", "")}<button class="btn primary" type="button" data-page="careers">Go to careers</button></div>`;
  if (!st.path || st.path.role !== A().role) { if (!st.busy.path) loadPath().then(render); return '<p class="muted"><span class="spin"></span> Loading…</p>'; }
  const u = unlockedStage();
  if (u < 0) {
    const first = flatNodes().filter((n) => n.si === 0 && required(n)), dn = first.filter((n) => done(n.key)).length;
    return `<div class="page">${intro("Resume", "Your resume unlocks when you are ready", "")}
      <div class="card lock"><span class="icon" style="width:56px;height:56px">${I.lock}</span><div class="ring" style="--p:${stagePct(0)}"><span>${stagePct(0)}%</span></div>
        <p>Finish the steps for <b>${esc(st.path.stages[0].title)}</b> (${dn} of ${first.length} done) to unlock a resume for that job.</p>
        <p class="small muted">${esc(GLOSSARY.resume[0])}</p><button class="btn primary" type="button" data-page="path">Continue my path</button></div></div>`;
  }
  const cv = P().cv, R = resumeData();
  const expHtml = cv.experience.map((e) => `<p><b>${esc(e.title)}</b>${e.organisation ? ", " + esc(e.organisation) : ""} <span class="meta">${esc([e.start, e.end].filter(Boolean).join(" – "))}</span></p>${(e.highlights || []).length ? `<ul>${(e._polished || e.highlights).map((h) => `<li>${esc(h)}</li>`).join("")}</ul>` : ""}`).join("");
  return `<div class="page">
  ${intro("Resume", `Resume for ${R.stage.title}`, "Built from your profile and the steps you finished. Check it, then save it as a PDF.")}
  <div class="resume-wrap">
    <div class="stack lg no-print">
      <div class="card stack"><h3>Your details</h3>
        <div class="grid cols-2">${["name", "email", "phone", "location"].map((k) => `<div class="field"><label>${k[0].toUpperCase() + k.slice(1)}</label><input type="text" data-res="contact.${k}" value="${esc(cv.contact[k] || "")}"></div>`).join("")}</div>
        <div class="field"><label>Summary</label><textarea data-res="summary">${esc(R.summary)}</textarea></div>
        <p class="small muted">Jobs and education come from your CV. <button class="btn ghost" type="button" data-page="wizard">Edit about you</button></p></div>
      <div class="card stack"><h3>Finish</h3>
        ${st.meta.llm.available ? `<button class="btn" type="button" id="polishBtn" ${st.busy.polish ? "disabled" : ""}>${st.busy.polish ? '<span class="spin"></span> Improving…' : "Improve wording with AI"}</button>` : ""}
        ${st.polished ? `<p class="tiny muted">${esc(st.polished.note)}</p>` : ""}
        <div class="row"><button class="btn primary" type="button" id="printBtn">Save as PDF</button><button class="btn" type="button" id="txtBtn">Download text</button></div>
        <p class="tiny muted">Only list what you can show an employer.</p></div>
    </div>
    <div class="paper" id="paper">
      <h1>${esc(cv.contact.name || A().name)}</h1>
      <p class="meta">${esc([cv.contact.email, cv.contact.phone, cv.contact.location].filter(Boolean).join(" · ") || "email · phone · city")}</p>
      <p style="margin-top:6px"><b>${esc(R.stage.title)}</b></p>
      <h4>Summary</h4><p>${esc(R.summary)}</p>
      ${R.skills.length ? `<h4>Skills</h4><p>${esc(R.skills.join(" · "))}</p>` : ""}
      ${expHtml ? `<h4>Experience</h4>${expHtml}` : ""}
      ${R.courses.length || cv.certifications.length ? `<h4>Courses and certificates</h4><ul>${[...R.courses, ...cv.certifications].map((c) => `<li>${esc(c)}</li>`).join("")}</ul>` : ""}
      ${cv.education.length ? `<h4>Education</h4>${cv.education.map((e) => `<p>${esc(e.qualification)}${e.institution ? ", " + esc(e.institution) : ""} <span class="meta">${esc(e.year)}</span></p>`).join("")}` : ""}
      ${cv.languages.length ? `<h4>Languages</h4><p>${esc(cv.languages.join(", "))}</p>` : ""}
    </div>
  </div></div>`;
}
function resumeText() {
  const cv = P().cv, R = resumeData();
  const lines = [cv.contact.name || A().name, [cv.contact.email, cv.contact.phone, cv.contact.location].filter(Boolean).join(" | "), R.stage.title, "", "SUMMARY", R.summary, ""];
  if (R.skills.length) lines.push("SKILLS", R.skills.join(", "), "");
  if (cv.experience.length) { lines.push("EXPERIENCE"); cv.experience.forEach((e) => { lines.push(`${e.title}${e.organisation ? ", " + e.organisation : ""} (${[e.start, e.end].filter(Boolean).join(" - ")})`); (e._polished || e.highlights || []).forEach((h) => lines.push("- " + h)); }); lines.push(""); }
  const cs = [...R.courses, ...cv.certifications]; if (cs.length) lines.push("COURSES AND CERTIFICATES", ...cs.map((c) => "- " + c), "");
  if (cv.education.length) lines.push("EDUCATION", ...cv.education.map((e) => `${e.qualification}, ${e.institution} ${e.year}`), "");
  if (cv.languages.length) lines.push("LANGUAGES", cv.languages.join(", "));
  return lines.join("\n");
}

// ---------- teams and sources ---------------------------------------------------------------
function teamData() { return st.team === "upload" && st.teamUpload ? st.teamUpload : st.meta.samples.teams.find((t) => t.id === st.team); }
function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/).map((l) => l.split(",").map((c) => c.trim()));
  const head = lines.shift(); const cols = head.slice(1).filter((c) => st.meta.clusters.some((x) => x.id === c));
  if (!cols.length) throw new Error("The header must be: name, then skill codes such as excel, genai, customer");
  const people = lines.filter((l) => l[0]).map((l) => [l[0], Object.fromEntries(cols.map((c) => [c, Math.max(0, Math.min(3, parseInt(l[head.indexOf(c)], 10) || 0))]))]);
  return { id: "upload", who: "Your upload", label: "Your team", desc: `${people.length} people from your file. Read on this device only.`, target_role: st.meta.roles[0].id, columns: cols, people };
}
function vTeam() {
  const T = teamData(), target = st.teamTarget || T.target_role, r = roleOf(target);
  const need = Object.fromEntries(r.req.map((x) => [x.cluster, x.level]));
  const cols = [...new Set([...T.columns, ...Object.keys(need)])];
  const cell = (v, nd) => { const c = nd ? (v >= nd ? 3 : v === nd - 1 ? 2 : v > 0 ? 1 : 0) : Math.min(v, 3); return `<span class="cell c${c}">${LV[v]}</span>`; };
  const gaps = Object.keys(need).map((k) => ({ k, n: T.people.filter(([, s]) => (s[k] || 0) < need[k]).length })).sort((a, b) => b.n - a.n);
  return `<div class="page">${intro("For HR and career centres", T.label, esc(T.desc))}
   <div class="row between"><div class="seg">${st.meta.samples.teams.map((t) => `<button type="button" data-team="${t.id}" aria-pressed="${st.team === t.id}">${esc(t.who)}</button>`).join("")}${st.teamUpload ? `<button type="button" data-team="upload" aria-pressed="${st.team === "upload"}">Your upload</button>` : ""}</div>
     <div class="row"><label class="small">Target <select id="teamTarget">${st.meta.roles.map((x) => `<option value="${x.id}" ${x.id === target ? "selected" : ""}>${esc(x.title)}</option>`).join("")}</select></label><label class="btn">Upload CSV<input type="file" id="teamCsv" accept=".csv" hidden></label></div></div>
   <div class="card"><div class="tablewrap"><table><thead><tr><th>Person</th>${cols.map((k) => `<th>${esc(cl(k).label)}${need[k] ? `<br><span class="mono">needs ${LV[need[k]]}</span>` : ""}</th>`).join("")}</tr></thead>
     <tbody>${T.people.map(([nm, s]) => `<tr><td>${esc(nm)}</td>${cols.map((k) => `<td>${cell(s[k] || 0, need[k])}</td>`).join("")}</tr>`).join("")}</tbody></table></div>
     <p class="tiny muted" style="margin-top:8px">CSV format: name, then skill codes (excel, genai, customer…) with levels 0–3. For training plans only, never for selection.</p></div>
   <div class="card stack"><h3>Biggest shared gaps</h3><div class="list">${gaps.map((g) => `<div><span>${esc(cl(g.k).label)}</span><span class="mono">${g.n} of ${T.people.length} people</span></div>`).join("")}</div></div></div>`;
}
function vSources() {
  const m = st.meta, s = st.analysis ? st.analysis.snapshot : null, l = m.llm;
  const rows2 = [["AI exposure by occupation", m.sources.ilo.source, m.sources.ilo.retrieved], ["Occupations and skills", m.sources.esco.source, m.sources.esco.retrieved], ["SDG targets", m.sources.sdg.source, m.sources.sdg.retrieved],
    ...(s ? Object.values(s.sources).map((x) => [x.name, x.url || "", s.as_of]) : []), ["Courses", "Hand-curated catalogue; every link checked by script", "see each course"]];
  const sc = Object.entries(m.scenarios).map(([k, v]) => `<tr><td>${esc(v.label)}</td>${["skill", "outlook", "transfer", "interest", "green", "exposure"].map((x) => `<td class="mono">${(x === "exposure" ? "−" : "") + v.weights[x].toFixed(2)}</td>`).join("")}</tr>`).join("");
  return `<div class="page">${intro("How it works", "Sources and method", "Every number comes from one of these sources. Careers come from ESCO, courses from a checked list, trends from dated snapshots.")}
   <div class="card"><div class="tablewrap"><table><thead><tr><th>Layer</th><th>Source</th><th>Date</th></tr></thead><tbody>${rows2.map((r) => `<tr><td><b>${esc(r[0])}</b></td><td class="small">${esc(r[1])}</td><td class="mono small">${esc(r[2])}</td></tr>`).join("")}</tbody></table></div></div>
   <div class="grid cols-2"><div class="card stack"><h3>Score</h3><pre>score = ( skill·match + outlook·demand + transfer·human skills
        + interest·fit + green·low-carbon role − exposure·AI )
        ÷ (sum of positive weights) × 100</pre><p class="small muted">Green only counts in the Green transition scenario. Age, situation and explanation style are never used.</p></div>
   <div class="card stack"><h3>Weights</h3><div class="tablewrap"><table><thead><tr><th></th><th>skill</th><th>outlook</th><th>transfer</th><th>interest</th><th>green</th><th>exposure</th></tr></thead><tbody>${sc}</tbody></table></div></div></div>
   <div class="card stack"><h3>Words we use</h3><div class="list">${Object.entries(GLOSSARY).map(([k, v]) => `<div><span><b>${esc(k)}</b></span><span class="small" style="text-align:right">${esc(v[simple() ? 0 : 1])}</span></div>`).join("")}</div></div>
   <div class="card stack"><h3>AI model</h3><p class="small">${l.available ? `${esc(l.model)} via ${esc(l.via)}. It may only pick skills it can quote from your text, reword explanations and resume lines without adding facts, and read a CV after contact details are removed. It never picks careers, courses or scores.` : "Not connected."}</p></div></div>`;
}

const VIEWS = { signin: vSignin, wizard: vWizard, dashboard: vDashboard, careers: vCareers, path: vPath, resume: vResume, team: vTeam, sources: vSources };
function render() {
  if (!A() && st.page !== "signin") st.page = "signin";
  renderChrome();
  $("#app").innerHTML = VIEWS[st.page]();
  bindDrop();
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
  catch (e) { toast("Could not read the CV: " + e.message); }
  st.busy.cv = false; render();
  const el = $("#cvReview"); if (el) el.scrollIntoView({ behavior: "smooth" });
}
function setPath(obj, path, val) { const ks = path.split("."); let o = obj; ks.slice(0, -1).forEach((k) => { o = o[k]; }); o[ks[ks.length - 1]] = val; }
let tOcc = null;
async function searchOcc(q) {
  st.occ.q = q; if (q.trim().length < 2) { st.occ.results = []; render(); return; }
  st.busy.occ = true; render(); refocus();
  try { const r = await api("/api/occupations/search?q=" + encodeURIComponent(q)); st.occ.results = r.results; }
  catch (e) { toast("Job search failed: " + e.message); }
  st.busy.occ = false; render(); refocus();
}
function refocus() { const el = $("#occQ"); if (el && st.focusOcc) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); } }
function go(page) { st.page = page; if (page === "wizard") { st.wiz = 0; st.expMode = null; st.extractNote = ""; } render(); window.scrollTo({ top: 0 }); const m = document.querySelector("details.menu"); if (m) m.open = false; }

document.addEventListener("click", async (ev) => {
  const t = ev.target.closest("button,a[data-page]"); if (!t) return;
  const d = t.dataset;
  if (d.page) { if (!t.disabled) go(d.page); return; }
  if (d.mode) { A().prefs.mode = d.mode; save(); render(); return; }
  if (d.opt) {
    const v = d.val;
    if (d.opt === "mode") A().prefs.mode = v;
    else { P()[d.opt] = v; if (d.opt === "country") P().budget = "free"; }
    save(); render(); return;
  }
  if (d.exp) { st.expMode = d.exp; if (d.exp === "skip") { st.wiz++; } render(); return; }
  if (d.cycle) { const s = P().skills, k = d.cycle; const cur = Math.max(s[k] || 0, P().pathSkills[k] || 0); const nx = (cur + 1) % 4; if (nx) s[k] = nx; else { delete s[k]; delete P().pathSkills[k]; delete P().evidence[k]; } changed({ path: false }); render(); return; }
  if (d.interest) { const a = P().interests, i = a.indexOf(d.interest); if (i >= 0) a.splice(i, 1); else a.push(d.interest); save(); render(); return; }
  if (d.occ) { const h = st.occ.results[+d.occ]; P().current = { title: h.title, isco: h.isco, exposure: h.exposure, suggested: h.suggested_skills }; st.occ.results = []; save(); render(); return; }
  if (d.scen) { st.scen = d.scen; st.explain = {}; st.path = null; render(); if (A().role) await loadPath(); render(); return; }
  if (d.open) { st.open = st.open === d.open ? null : d.open; render(); return; }
  if (d.choose) { A().role = d.choose; st.path = null; st.sel = null; st.polished = null; save(); go("path"); await loadPath(); await loadAdvice(); render(); return; }
  if (d.node) { st.sel = d.node; render(); if (window.innerWidth < 860) { const sh = $(".sheet"); if (sh) sh.scrollIntoView({ behavior: "smooth" }); } return; }
  if (d.goto) { st.sel = d.goto; go("path"); return; }
  if (d.toggle) { const n = flatNodes().find((x) => x.key === d.toggle); if (n) setDone(n, !done(n.key)); return; }
  if (d.team) { st.team = d.team; st.teamTarget = null; render(); return; }
  if (d.cvadd) { st.cvDraft[d.cvadd].push(d.cvadd === "experience" ? { title: "", organisation: "", start: "", end: "", highlights: [] } : { qualification: "", institution: "", year: "" }); render(); return; }
  if (d.cvdel) { const [k, i] = d.cvdel.split("."); st.cvDraft[k].splice(+i, 1); render(); return; }
  if (d.explain) {
    const role = d.explain; st.busy["ex_" + role] = true; render();
    try { st.explain[role] = await api("/api/explain", { ...profileBody(), role, scenario: st.scen, lang: A().prefs.lang, use_model: !!st.meta.llm.available }); }
    catch (e) { toast("Could not explain: " + e.message); }
    st.busy["ex_" + role] = false; render(); return;
  }
  switch (t.id) {
    case "signIn": st.signin = { error: "" }; signIn($("#acctSel").value); return;
    case "signOut": { clearTimeout(tSave); const data = Object.fromEntries(DATA_KEYS.map((k) => [k, A()[k]])); try { await api("/api/me", data, false, "PUT"); await api("/api/signout", {}); } catch (e) { /* already signed out */ } signedOut(); return; }
    case "wizNext": st.wiz = Math.min(WIZ.length - 1, st.wiz + 1); st.extractNote = ""; render(); window.scrollTo({ top: 0 }); return;
    case "wizBack": st.wiz = Math.max(0, st.wiz - 1); render(); window.scrollTo({ top: 0 }); return;
    case "wizFinish": finishWizard(); return;
    case "extractBtn": {
      const text = ($("#about") || {}).value || ""; P().about = text;
      if (text.trim().length < 15) { toast("Write a few sentences about your work first."); return; }
      st.busy.extract = true; render();
      try {
        const r = await api("/api/extract", { text, use_model: !!P().useModel });
        Object.entries(r.skills).forEach(([k, v]) => { P().skills[k] = Math.max(P().skills[k] || 0, v.level); P().evidence[k] = v; });
        st.extractNote = `Found ${Object.keys(r.skills).length} skills${r.model ? " with " + r.model : ""}. Press Next to check them.`; save();
      } catch (e) { toast("Could not read the text: " + e.message); }
      st.busy.extract = false; render(); return;
    }
    case "cvSave": {
      const dft = st.cvDraft;
      Object.entries(dft.skills).forEach(([k, v]) => { if (v.keep !== false) { P().skills[k] = Math.max(P().skills[k] || 0, v.level); P().evidence[k] = v; } });
      P().cv = { contact: dft.contact, headline: dft.headline, summary: dft.summary, experience: dft.experience, education: dft.education, certifications: dft.certifications, languages: dft.languages };
      if (dft.experience[0] && !st.occ.q) st.occ.q = dft.experience[0].title;
      st.cvDraft = null; save(); st.wiz++; render(); window.scrollTo({ top: 0 }); toast("Saved. Now check your skills."); return;
    }
    case "cvDiscard": st.cvDraft = null; render(); return;
    case "addSuggested": { let n = 0; Object.entries(P().current.suggested || {}).forEach(([k, v]) => { if (!skillsNow()[k]) { P().skills[k] = v.level; P().evidence[k] = { evidence: "ESCO: " + v.esco_skills.join(", "), method: "esco" }; n++; } }); toast(n ? `Added ${n} skills.` : "Already in your profile."); save(); render(); return; }
    case "printBtn": window.print(); return;
    case "txtBtn": { const blob = new Blob([resumeText()], { type: "text/plain" }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "resume.txt"; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); return; }
    case "polishBtn": {
      const cv = P().cv, R = resumeData(), bullets = cv.experience.flatMap((e) => e.highlights || []);
      st.busy.polish = true; render();
      try {
        const r = await api("/api/resume/polish", { role: A().role, summary: R.summary, bullets });
        st.polished = r; let i = 0; cv.experience.forEach((e) => { e._polished = (e.highlights || []).map(() => r.bullets[i++]); });
        if (r.summary) cv.summary = r.summary; save();
      } catch (e) { toast("Could not improve wording: " + e.message); }
      st.busy.polish = false; render(); return;
    }
  }
});
document.addEventListener("change", (ev) => {
  const t = ev.target, d = t.dataset;
  if (t.id === "cvFile" && t.files[0]) { importCv(t.files[0]); return; }
  if (t.id === "useModel") { P().useModel = t.checked; save(); return; }
  if (t.id === "langSel" || (d.lang !== undefined && t.tagName === "SELECT")) { A().prefs.lang = t.value; st.explain = {}; save(); render(); return; }
  if (t.id === "addSkill" && t.value) { P().skills[t.value] = 1; changed({ path: false }); render(); return; }
  if (t.id === "budgetPath") { P().budget = t.value; st.path = null; changed(); render(); return; }
  if (t.id === "compareChk") { st.compare = t.checked; changed({ path: false }); return; }
  if (d.cvskill) { st.cvDraft.skills[d.cvskill].keep = t.checked; return; }
  if (d.cvlevel) { st.cvDraft.skills[d.cvlevel].level = +t.value; return; }
  if (t.id === "teamTarget") { st.teamTarget = t.value; render(); return; }
  if (t.id === "teamCsv" && t.files[0]) { const f = new FileReader(); f.onload = () => { try { st.teamUpload = parseCsv(String(f.result)); st.team = "upload"; render(); } catch (e) { toast(e.message); } }; f.readAsText(t.files[0]); }
});
document.addEventListener("input", (ev) => {
  const t = ev.target, d = t.dataset;
  if (t.id === "hours") { P().hours = +t.value; const o = $("#hoursOut"); if (o) o.textContent = t.value; st.path = null; save(); return; }
  if (t.id === "about") { P().about = t.value; save(); return; }
  if (t.id === "occQ") { st.focusOcc = true; clearTimeout(tOcc); const q = t.value; tOcc = setTimeout(() => searchOcc(q), 350); return; }
  if (d.cv) {
    let v = t.value;
    if (d.cv.endsWith(".highlights") || d.cv === "certifications") v = v.split("\n").map((x) => x.trim()).filter(Boolean);
    if (d.cv === "languages") v = v.split(",").map((x) => x.trim()).filter(Boolean);
    setPath(st.cvDraft, d.cv, v); return;
  }
  if (d.res) {
    setPath(P().cv, d.res, t.value); save();
    $("#app").innerHTML = VIEWS[st.page]();
    const again = document.querySelector(`[data-res="${d.res}"]`); if (again) { again.focus(); again.setSelectionRange(again.value.length, again.value.length); }
  }
});

// ---------- start ------------------------------------------------------------------------------
(async function start() {
  try { st.meta = await api("/api/meta"); }
  catch (e) { $("#app").innerHTML = `<p class="note warn">The server is not ready: ${esc(e.message)}</p>`; return; }
  try { st.updates = await api("/api/updates"); } catch (e) { st.updates = null; }
  try { st.token = localStorage.getItem(TOKEN); } catch (e) { st.token = null; }
  if (st.token) { try { useAccount(await api("/api/me")); } catch (e) { st.token = null; try { localStorage.removeItem(TOKEN); } catch (e2) { /* ignore */ } } }
  if (A()) {
    if (!A().onboarded) { st.page = "wizard"; render(); return; }
    st.page = "dashboard"; render(); await refresh({});
    if (st.updates && A().seen !== st.updates.snapshot.id) { if (A().seen) toast("New job data since your last visit. We rechecked your path."); A().seen = st.updates.snapshot.id; save(); }
  } else { st.page = "signin"; await loadAccounts(); }
})();
})();

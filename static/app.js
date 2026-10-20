/* Workforce Futures Engine: web client.
   Talks to the FastAPI backend; keeps the user's profile only in this browser. */
(function () {
"use strict";

// ---------- state ----------------------------------------------------------
const STORE = "wfe.profile.v1";
const st = {
  meta: null, tab: "profile", scen: "moderate", snapId: null, compare: false,
  analysis: null, role: null, pathway: null, explain: {}, lang: "en",
  team: "hr", teamUpload: null, busy: {}, occ: { q: "", results: [], source: "" },
  profile: { skills: {}, evidence: {}, interests: [], hours: 5, current: null, about: "", useModel: false, sample: null },
  done: {}, notes: {}
};
function save() {
  try { localStorage.setItem(STORE, JSON.stringify({ profile: st.profile, done: st.done, notes: st.notes, lang: st.lang })); } catch (e) { /* storage unavailable */ }
}
function restore() {
  try {
    const d = JSON.parse(localStorage.getItem(STORE) || "null");
    if (d) { Object.assign(st.profile, d.profile || {}); st.done = d.done || {}; st.notes = d.notes || {}; st.lang = d.lang || "en"; return true; }
  } catch (e) { /* ignore */ }
  return false;
}

// ---------- helpers ----------------------------------------------------------
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const pct = (x) => x == null ? "no signal" : (x >= 0 ? "+" : "") + Math.round(x * 100) + "%";
const LV = ["none", "basic", "working", "strong"];
const cl = (id) => st.meta.clusters.find((c) => c.id === id);
const roleOf = (id) => st.meta.roles.find((r) => r.id === id);
function toast(msg) { const t = $("#toast"); t.textContent = msg; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => { t.hidden = true; }, 2600); }
async function api(path, body) {
  const r = await fetch(path, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {});
  if (!r.ok) { let m = r.statusText; try { m = (await r.json()).detail || m; } catch (e) { /* not json */ } throw new Error(m); }
  return r.json();
}
function lvlDots(n) { let s = '<span class="lvl" aria-hidden="true">'; for (let i = 1; i <= 3; i++) s += `<i class="${i <= n ? "on" : ""}"></i>`; return s + "</span>"; }
function gradClass(g) { g = g || ""; return g.includes("4") ? "g4" : g.includes("3") ? "g3" : g.includes("2") ? "g2" : g.includes("1") ? "g1" : g.startsWith("Minimal") ? "gmin" : "gnot"; }
function gradBadge(e) { return e ? `<span class="grad ${gradClass(e.category)}" title="ILO 2025 GenAI exposure">ILO: ${esc(e.category.replace("Exposed: ", ""))}</span>` : '<span class="tag">No ILO score</span>'; }
const SDG_COL = { 1: "#E5243B", 2: "#DDA63A", 3: "#4C9F38", 4: "#C5192D", 5: "#FF3A21", 6: "#26BDE2", 7: "#FCC30B", 8: "#A21942", 9: "#FD6925", 10: "#DD1367", 11: "#FD9D24", 12: "#BF8B2E", 13: "#3F7E44", 14: "#0A97D9", 15: "#56C02B", 16: "#00689D", 17: "#19486A" };
function sdgPill(t) { const g = parseInt(t, 10); return `<span class="sdg ${g === 7 ? "s7" : ""}" style="background:${SDG_COL[g]}" title="SDG target ${esc(t)}">SDG ${esc(t)}</span>`; }
function basis(b) { return b === "esco" ? '<span class="basis esco" title="Listed as an essential skill for this occupation in ESCO">ESCO</span>' : '<span class="basis future" title="Not yet in ESCO; added because of AI-era demand">future skill</span>'; }
function snapLabel(s) { return s ? `Trend data ${s.as_of}` : ""; }
function scenRows() { return st.analysis ? st.analysis.scenarios[st.scen] : []; }
function resultFor(roleId) { return scenRows().find((x) => x.role === roleId); }

// ---------- data flow --------------------------------------------------------
let tAnalyze = null;
function profileChanged() { save(); clearTimeout(tAnalyze); tAnalyze = setTimeout(analyze, 250); }
async function analyze() {
  const snaps = st.meta.snapshots;
  const idx = snaps.findIndex((s) => s.id === st.snapId);
  const prev = st.compare && idx >= 0 && snaps[idx + 1] ? snaps[idx + 1].id : null;
  try {
    st.analysis = await api("/api/analyze", { skills: st.profile.skills, interests: st.profile.interests, hours: st.profile.hours, snapshot_id: st.snapId, compare_id: prev });
    if (!st.role || !resultFor(st.role)) st.role = scenRows()[0].role;
    st.pathway = null; st.explain = {};
    render();
  } catch (e) { toast("Could not analyse: " + e.message); }
}
async function loadPathway() {
  if (!st.role) return;
  st.busy.pathway = true; render();
  try { st.pathway = await api("/api/pathway", { skills: st.profile.skills, interests: st.profile.interests, hours: st.profile.hours, role: st.role, scenario: st.scen, snapshot_id: st.snapId }); }
  catch (e) { toast("Could not build pathway: " + e.message); }
  st.busy.pathway = false; render();
}

// ---------- chrome --------------------------------------------------------------
const TABS = [["profile", "1", "Your profile"], ["radar", "2", "Future skills radar"], ["matches", "3", "Matches"], ["pathway", "4", "Pathway"], ["sdg", "5", "SDG impact"], ["|"], ["team", "", "Team & cohort view"], ["sources", "", "Sources & method"]];
function renderChrome() {
  $("#tabs").innerHTML = TABS.map((t) => t[0] === "|" ? '<span class="sep" aria-hidden="true"></span>' :
    `<button role="tab" type="button" id="tab-${t[0]}" aria-selected="${st.tab === t[0]}" data-tab="${t[0]}">${t[1] ? `<span class="n">${t[1]}</span>` : ""}${esc(t[2])}</button>`).join("");
  $("#scenarioSeg").innerHTML = Object.entries(st.meta.scenarios).map(([k, v]) => `<button type="button" id="scen-${k}" data-scen="${k}" aria-pressed="${st.scen === k}" title="${esc(v.note)}">${esc(v.label)}</button>`).join("");
  $("#snapSel").innerHTML = st.meta.snapshots.map((s) => `<option value="${s.id}" ${s.id === st.snapId ? "selected" : ""}>${esc(s.as_of)}</option>`).join("");
  $("#compareChk").checked = st.compare;
  const l = st.meta.llm;
  $("#llmFoot").textContent = l.available ? `Language model: ${l.model} via ${l.via}, used only when you switch it on.` : "No language model connected; all text is generated from the data.";
}
function diffBlock() {
  const a = st.analysis; if (!a || !a.diff) return "";
  const d = a.diff[st.scen];
  return `<div class="diff" role="status"><h3>What changed since ${esc(a.compare.as_of)}</h3>
    <p class="small">Rankings with trend data from ${esc(a.snapshot.as_of)} compared with ${esc(a.compare.as_of)}, ${esc(st.meta.scenarios[st.scen].label)} scenario.</p>
    <ul class="small">${d.length ? d.map((x) => `<li><b>${esc(roleOf(x.role).title)}</b> moved ${x.from} → ${x.to} (score ${x.score_from} → ${x.score_to}). Main driver: ${esc(cl(x.driver).label)}, job-post demand ${pct(x.driver_before)} → ${pct(x.driver_after)}.</li>`).join("") : "<li>No rank changes in your top 6. Scores updated.</li>"}</ul></div>`;
}

// ---------- 1. profile -------------------------------------------------------------
function vProfile() {
  const p = st.profile, m = st.meta, l = m.llm;
  const interests = [...new Set(m.roles.flatMap((r) => r.tags))].sort();
  const opts = m.clusters.filter((c) => !(p.skills[c.id] > 0)).map((c) => `<option value="${c.id}">${esc(c.label)}</option>`).join("");
  const cur = p.current;
  return `<div class="view">
  <div><h2>Tell us about yourself</h2><p class="lead">Describe your experience, pick your current job, or start from a sample person. You can adjust every skill. Your profile stays in this browser.</p></div>
  <div class="personas">${m.samples.personas.map((x) => `<button type="button" class="persona" data-sample="${x.id}" aria-pressed="${p.sample === x.id}">
      <span class="group">${esc(x.group)}</span><h3>${esc(x.name)}</h3><span class="small muted">${esc(x.headline)}</span></button>`).join("")}
    <button type="button" class="persona" data-tab="team"><span class="group">HR manager / career centre</span><h3>Team & cohort view</h3><span class="small muted">See skill gaps across a team or class.</span></button>
  </div>
  <div class="grid2">
    <div class="panel form">
      <h3>Describe your experience</h3>
      <textarea id="about" maxlength="6000" placeholder="For example: I have worked 10 years as an admin clerk. I prepare invoices in Excel, handle customer calls in Malay and English, and organise meetings.">${esc(p.about)}</textarea>
      ${l.available ? `<label class="check"><input type="checkbox" id="useModel" ${p.useModel ? "checked" : ""}> <span>Also let the AI model (${esc(l.model)} via WorkBuddy) read this text to find skills. Do not include your name, IC number or contact details. The text is not stored.</span></label>` : `<p class="small muted">Skills are found by keyword matching. No AI model is connected.</p>`}
      <div class="row"><button class="btn primary" type="button" id="extractBtn" ${st.busy.extract ? "disabled" : ""}>${st.busy.extract ? '<span class="spin"></span> Reading…' : "Find my skills"}</button>
        <button class="btn" type="button" disabled title="Prototype: paste text instead. Real CVs are not used in this hackathon.">Upload CV</button></div>
      ${st.extractNote ? `<p class="notice small">${esc(st.extractNote)}</p>` : ""}
      <h3 style="margin-top:6px">Current job</h3>
      <input type="search" id="occQ" placeholder="Search a job title, e.g. accounts clerk" value="${esc(st.occ.q)}" autocomplete="off">
      ${st.busy.occ ? '<p class="small muted"><span class="spin"></span> Searching ESCO…</p>' : ""}
      ${st.occ.results.length ? `<div class="results">${st.occ.results.map((r, i) => `<button type="button" class="result" data-occ="${i}"><b>${esc(r.title)}</b><span class="small muted">ISCO ${esc(r.isco)} · ${r.exposure ? "ILO exposure " + r.exposure.mean.toFixed(2) : "no ILO score"}</span></button>`).join("")}</div><p class="small muted">${esc(st.occ.source)}</p>` : ""}
      ${cur ? `<div class="notice"><p><b>${esc(cur.title)}</b> <span class="tag">ISCO ${esc(cur.isco)}</span> ${gradBadge(cur.exposure)}</p>
        ${cur.exposure ? `<p class="small" style="margin-top:6px">Generative AI could do part of this job's tasks today: mean task score <b class="mono">${cur.exposure.mean.toFixed(2)}</b> of 1. Most exposed: “${esc(cur.exposure.most_exposed_task.task)}” (${cur.exposure.most_exposed_task.score.toFixed(2)}). Least exposed: “${esc(cur.exposure.least_exposed_task.task)}” (${cur.exposure.least_exposed_task.score.toFixed(2)}).</p><p class="small muted">Source: ILO Working Paper 140 (2025).</p>` : ""}
        ${cur.suggested && Object.keys(cur.suggested).length ? `<button class="btn" type="button" id="addSuggested" style="margin-top:8px">Add skills typical of this job (from ESCO)</button>` : ""}</div>` : ""}
    </div>
    <div class="panel form">
      <h3>Your skills</h3>
      <p class="small muted">Click a skill to change its level (basic → working → strong → remove).</p>
      <div class="chips">${Object.entries(p.skills).filter(([, v]) => v > 0).map(([k, v]) => { const ev = p.evidence[k]; return `<button type="button" class="chip" data-cycle="${k}" title="${esc(LV[v] + (ev ? " · from: " + ev.evidence : ""))}">${esc(cl(k).label)} ${lvlDots(v)}${ev && ev.method === "llm" ? ' <span class="basis esco">AI</span>' : ""}</button>`; }).join("") || '<span class="small muted">No skills yet.</span>'}</div>
      <select id="addSkill" aria-label="Add a skill"><option value="">Add a skill…</option>${opts}</select>
      <div><p class="small muted">What do you enjoy?</p><div class="chips">${interests.map((i) => `<button type="button" class="chip interest" data-interest="${esc(i)}" aria-pressed="${p.interests.includes(i)}">${esc(i)}</button>`).join("")}</div></div>
      <div class="field"><label for="hours">Time for learning: <b id="hoursOut">${p.hours}</b> hours a week</label><input type="range" id="hours" min="1" max="20" value="${p.hours}"></div>
      <div class="row"><button class="btn primary" type="button" data-tab="radar">See the future skills radar →</button><button class="btn" type="button" id="resetBtn">Clear profile</button></div>
    </div>
  </div></div>`;
}

// ---------- 2. radar ---------------------------------------------------------------
function vRadar() {
  const rows = scenRows(); if (!rows.length) return "<p>Add some skills first.</p>";
  const top = rows.slice(0, 5).map((x) => x.role);
  const pts = rows.map((x) => ({ x: roleOf(x.role).exposure.mean, y: x.components.outlook, r: x })).reverse();
  const W = 640, H = 380, L = 52, R = 16, T = 18, B = 48;
  const xs = (v) => L + (v - 0.1) / (0.7 - 0.1) * (W - L - R);
  const ymin = Math.min(...pts.map((p) => p.y)) - 0.03, ymax = Math.max(...pts.map((p) => p.y)) + 0.03;
  const ys = (v) => T + (1 - (v - ymin) / (ymax - ymin)) * (H - T - B);
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Roles by AI exposure and demand outlook"><rect x="${L}" y="${T}" width="${W - L - R}" height="${H - T - B}" fill="var(--chip)" rx="6"/>`;
  s += `<line x1="${xs(0.4)}" x2="${xs(0.4)}" y1="${T}" y2="${H - B}" stroke="var(--line)" stroke-dasharray="4 4"/><line x1="${L}" x2="${W - R}" y1="${ys(0.5)}" y2="${ys(0.5)}" stroke="var(--line)" stroke-dasharray="4 4"/>`;
  [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7].forEach((v) => { s += `<text x="${xs(v)}" y="${H - B + 18}" font-size="11" text-anchor="middle" fill="var(--muted)" font-family="IBM Plex Mono, monospace">${v.toFixed(1)}</text>`; });
  s += `<text x="${(L + W - R) / 2}" y="${H - 8}" font-size="12" text-anchor="middle" fill="var(--muted)">Generative-AI exposure of the occupation (ILO 2025 task mean) →</text>`;
  s += `<text x="14" y="${(T + H - B) / 2}" font-size="12" text-anchor="middle" fill="var(--muted)" transform="rotate(-90 14 ${(T + H - B) / 2})">Demand outlook of its skills →</text>`;
  s += `<text x="${L + 8}" y="${T + 16}" font-size="11" fill="var(--muted)">Growing, lower exposure</text><text x="${W - R - 8}" y="${T + 16}" font-size="11" fill="var(--muted)" text-anchor="end">Growing, will change with AI</text>`;
  s += `<text x="${L + 8}" y="${H - B - 8}" font-size="11" fill="var(--muted)">Flat, lower exposure</text><text x="${W - R - 8}" y="${H - B - 8}" font-size="11" fill="var(--muted)" text-anchor="end">Most pressure to change</text>`;
  const cur = st.profile.current;
  if (cur && cur.exposure) { const cx = xs(Math.max(0.1, Math.min(0.7, cur.exposure.mean))); s += `<line x1="${cx}" x2="${cx}" y1="${T}" y2="${H - B}" stroke="var(--fall)" stroke-width="1.5"/><text x="${cx - 6}" y="${H - B - 24}" font-size="11" fill="var(--fall)" text-anchor="end">Your current job (${cur.exposure.mean.toFixed(2)})</text>`; }
  pts.forEach(({ x, y, r }) => { const t = top.includes(r.role);
    s += `<g><title>${esc(roleOf(r.role).title)}: exposure ${x.toFixed(2)}, outlook ${y.toFixed(2)}</title><circle cx="${xs(x)}" cy="${ys(y)}" r="${t ? 10 : 5}" fill="${t ? "var(--accent)" : "var(--surface)"}" stroke="var(--accent)" stroke-width="2"/>`;
    if (t) s += `<text x="${xs(x)}" y="${ys(y) + 4}" font-size="11" font-weight="600" text-anchor="middle" fill="var(--surface)" font-family="IBM Plex Mono, monospace">${r.rank}</text>`;
    s += "</g>"; });
  s += "</svg>";
  const sig = st.analysis.signals;
  const ids = Object.keys(sig).filter((k) => sig[k].demand_change != null || sig[k].research_change != null);
  ids.sort((a, b) => sig[b].momentum[st.scen] - sig[a].momentum[st.scen]);
  const mine = (k) => (st.profile.skills[k] || 0) > 0;
  const row = (k) => { const g = sig[k]; return `<div class="skillrow"><span>${esc(cl(k).label)}${mine(k) ? ' <span class="tag">you</span>' : ""}<br><span class="small muted">job posts n=${g.n}${g.research_change != null ? ` · arXiv papers ${pct(g.research_change)}` : ""}</span></span><span class="mono ${(g.demand_change || 0) >= 0 ? "up" : "down"}">${(g.demand_change || 0) >= 0 ? "▲" : "▼"} ${pct(g.demand_change)}</span><span class="mono small" title="Outlook 0–1">${g.momentum[st.scen].toFixed(2)}</span></div>`; };
  const src = st.analysis.snapshot.sources;
  return `<div class="view">${diffBlock()}
   <div><h2>Future skills radar</h2><p class="lead">Each dot is a role. Left to right: how much of its work generative AI could do today (ILO data). Bottom to top: how demand is moving for the skills it needs, ${esc(st.meta.scenarios[st.scen].label)} scenario. Numbered dots are your top 5 matches.</p></div>
   <div class="panel radar">${s}<ol class="toplist" style="margin:10px 0 0;padding-left:20px;display:grid;gap:2px;font-size:.86rem">${rows.slice(0, 5).map((x) => `<li>${esc(roleOf(x.role).title)} <span class="muted mono small">exposure ${roleOf(x.role).exposure.mean.toFixed(2)} · outlook ${x.components.outlook.toFixed(2)}</span></li>`).join("")}</ol></div>
   <div class="grid2">
     <div class="panel"><h3>Rising skills</h3><div class="skilllist">${ids.slice(0, 8).map(row).join("")}</div></div>
     <div class="panel"><h3>Falling or flat skills</h3><div class="skilllist">${ids.slice(-6).reverse().map(row).join("")}</div></div>
   </div>
   <div class="notice small"><b>Where these numbers come from.</b> ${src.hn ? `Job-post demand: share of posts mentioning each skill in ${esc(src.hn.current_window.join(", "))} (${src.hn.posts_current} posts) versus ${esc(src.hn.previous_window.join(", "))} (${src.hn.posts_previous} posts), ${esc(src.hn.name)}. ` : ""}${src.arxiv ? `Research activity: arXiv papers ${esc(src.arxiv.current_window.join(" to "))} versus ${esc(src.arxiv.previous_window.join(" to "))}. ` : ""}${src.adzuna ? esc(src.adzuna.name) + ". " : ""}Small samples are pulled toward zero. These posts are global and tech-heavy, so treat them as one signal among several.</div>
  </div>`;
}

// ---------- 3. matches ------------------------------------------------------------
function bar(label, pts, val, neg) {
  const w = Math.min(100, Math.abs(pts) * 2.5);
  return `<div class="bar"><span class="muted">${esc(label)}</span><span class="track"><span class="fill ${neg ? "neg" : ""}" style="display:block;width:${w}%"></span></span><span class="mono">${neg ? "" : "+"}${pts.toFixed(1)}</span></div>`;
}
function vMatches() {
  const rows = scenRows().slice(0, 6); if (!rows.length) return "<p>Add some skills first.</p>";
  return `<div class="view">${diffBlock()}
   <div><h2>Your best-fit future roles</h2><p class="lead">${esc(st.meta.scenarios[st.scen].label)} scenario: ${esc(st.meta.scenarios[st.scen].note)} The range shows the score across all three scenarios.</p></div>
   ${rows.map((x) => { const r = roleOf(x.role), rg = st.analysis.ranges[x.role], ex = st.explain[x.role]; return `<article class="match ${st.role === x.role ? "sel" : ""}">
     <div class="rank">${x.rank}</div>
     <div style="min-width:0">
       <h3>${esc(r.title)}</h3>
       <div class="row small" style="margin-top:4px;gap:6px">${gradBadge(r.exposure)}<span class="tag">ESCO: ${esc(r.esco.title)}</span><span class="tag">ISCO ${esc(r.isco)}</span>${r.sdg.filter((l) => l.basis === "role").map((l) => sdgPill(l.target)).join("")}</div>
       <p class="small" style="margin-top:8px"><b>You have:</b> ${x.matched.map((m) => esc(cl(m.cluster).label)).join(", ") || "none of the core skills yet"}.</p>
       <p class="small"><b>To build:</b> ${x.gaps.map((g) => `${esc(cl(g.cluster).label)} (${LV[g.have]} → ${LV[g.need]})${basis(g.basis)}`).join(", ") || "nothing, you are ready"}.</p>
       <details><summary>Why this score</summary><div class="bars">
         ${bar("Skill match", x.points.skill)}${bar("Demand outlook", x.points.outlook)}${bar("Transferable skills", x.points.transfer)}${bar("Interest fit", x.points.interest)}${bar("SDG relevance", x.points.sdg)}${bar("AI exposure", x.points.exposure, 0, true)}
         <p class="small muted">Points out of 100. AI exposure: ILO occupation “${esc(r.exposure.ilo_title)}”, mean task score ${r.exposure.mean.toFixed(2)}. Most exposed task: “${esc(r.exposure.most_exposed_task.task)}”.</p>
         <p class="small muted">ESCO lists ${r.esco_essential.length} essential skills for ${esc(r.esco.title)}. <a href="${esc(r.esco.uri)}" target="_blank" rel="noopener">View in ESCO</a></p>
       </div></details>
       <div class="row" style="margin-top:8px"><button class="btn" type="button" data-explain="${x.role}" ${st.busy["ex_" + x.role] ? "disabled" : ""}>${st.busy["ex_" + x.role] ? '<span class="spin"></span> Writing…' : "Explain in plain language"}</button>
         <select id="langSel-${x.role}" data-lang aria-label="Language"><option value="en" ${st.lang === "en" ? "selected" : ""}>English</option><option value="ms" ${st.lang === "ms" ? "selected" : ""}>Bahasa Malaysia</option><option value="zh" ${st.lang === "zh" ? "selected" : ""}>中文</option></select></div>
       ${ex ? `<div class="explain">${esc(ex.text)}</div><p class="small muted">${ex.method === "llm" ? `Written by ${esc(ex.model)} via WorkBuddy from the facts above; numbers checked against the data.` : "Standard explanation generated from the data."} ${esc(ex.note || "")}</p>` : ""}
     </div>
     <div class="score"><span class="big mono">${x.score.toFixed(0)}</span><span class="small muted mono">range ${rg.min.toFixed(0)}–${rg.max.toFixed(0)}</span><span class="small muted">top 3 in ${rg.top3} of 3 scenarios</span>
       <button class="btn ${st.role === x.role ? "primary" : ""}" type="button" data-plan="${x.role}" style="margin-top:8px">Plan this path</button></div>
   </article>`; }).join("")}
   <p class="small muted">The final choice is yours. Talk it through with a career counsellor before deciding.</p></div>`;
}

// ---------- 4. pathway ---------------------------------------------------------
function vPathway() {
  if (!st.role) return "<p>Pick a role on the Matches tab first.</p>";
  if (!st.pathway || st.pathway.role !== st.role) { if (!st.busy.pathway) loadPathway(); return '<p class="muted"><span class="spin"></span> Building your pathway…</p>'; }
  const pw = st.pathway, r = roleOf(st.role), key = st.role, done = st.done[key] || {};
  const n = pw.steps.filter((s) => done[s.cluster]).length;
  return `<div class="view">${diffBlock()}
   <div class="row" style="justify-content:space-between"><div><h2>Pathway to ${esc(r.title)}</h2><p class="lead">Foundations first. Only courses from the checked catalogue appear; when none fits, the plan says so.</p></div>
     <label class="small">Target role <select id="roleSel">${scenRows().slice(0, 6).map((x) => `<option value="${x.role}" ${x.role === st.role ? "selected" : ""}>${esc(roleOf(x.role).title)}</option>`).join("")}</select></label></div>
   <div class="kpis">
     <div class="kpi"><span class="small muted">Learning time</span><b class="mono">${pw.hours} h</b></div>
     <div class="kpi"><span class="small muted">At ${pw.hours_per_week} h / week</span><b class="mono">${pw.weeks[0] === pw.weeks[1] ? pw.weeks[0] : pw.weeks[0] + "–" + pw.weeks[1]} weeks</b></div>
     <div class="kpi"><span class="small muted">Steps done</span><b class="mono">${n} / ${pw.steps.length}</b><div class="progress" style="margin-top:6px"><div style="width:${pw.steps.length ? n / pw.steps.length * 100 : 0}%"></div></div></div>
     <div class="kpi"><span class="small muted">Match score now</span><b class="mono">${pw.score_now.toFixed(0)}</b></div>
   </div>
   ${pw.steps.length ? `<div class="steps">${pw.steps.map((s, i) => `<div class="step ${done[s.cluster] ? "done" : ""}">
     <span class="num">${i + 1}</span>
     <div style="min-width:0"><h3>${esc(cl(s.cluster).label)}${basis(s.basis)}</h3>
       <p class="small muted">${LV[s.from]} → ${LV[s.to]} · job-post demand ${pct(s.demand_change)} · ${sdgPill("4.4")}</p>
       ${s.items.map((c) => `<div class="res"><span><b>${esc(c.title)}</b> · ${esc(c.provider)}</span><span class="small muted mono">${c.hours} h · ${esc(c.cost)} · HRD Corp: ${esc(c.hrdc || (c.cost === "free" ? "not needed" : "unverified"))}${c.link_checked_on ? " · link checked " + esc(c.link_checked_on) : ""}</span>${c.url ? `<a class="small" href="${esc(c.url)}" target="_blank" rel="noopener">Open provider site</a>` : ""}</div>`).join("")}
       ${s.no_resource ? '<div class="nores">No verified course indexed for this skill yet. Ask a counsellor or HR for a local option, or practise it at work.</div>' : ""}
       ${s.partial ? '<div class="nores">Courses here only reach part of this level. Plan a work project to practise it.</div>' : ""}
       ${s.covered_earlier ? '<p class="small muted" style="margin-top:6px">Covered by a course in an earlier step.</p>' : ""}
     </div>
     <label class="small row" style="gap:6px"><input type="checkbox" data-done="${s.cluster}" ${done[s.cluster] ? "checked" : ""}> Done</label></div>`).join("")}</div>` : '<div class="panel"><p>You already meet every skill this role needs. Next step: talk to employers or a counsellor about the move.</p></div>'}
   <div class="panel"><h3>Notes for your counsellor</h3><p class="small muted" style="margin-bottom:8px">Plans are suggestions. A counsellor can change the order, swap courses or add local options.</p>
     <textarea id="note" placeholder="For example: I can only study on weekends. I prefer courses in Bahasa Malaysia.">${esc(st.notes[key] || "")}</textarea>
     <div class="row" style="margin-top:8px"><button class="btn" type="button" id="copyPlan">Copy plan as text</button></div></div>
  </div>`;
}
function planText() {
  const pw = st.pathway, r = roleOf(st.role);
  let t = `Pathway to ${r.title} (${pw.hours} h, about ${pw.weeks[0]}-${pw.weeks[1]} weeks at ${pw.hours_per_week} h/week)\n`;
  pw.steps.forEach((s, i) => { t += `\n${i + 1}. ${cl(s.cluster).label}: ${LV[s.from]} -> ${LV[s.to]}\n`; s.items.forEach((c) => { t += `   - ${c.title} (${c.provider}), ${c.hours} h, ${c.cost}${c.url ? ", " + c.url : ""}\n`; }); if (s.no_resource) t += "   - No verified course indexed yet\n"; });
  if (st.notes[st.role]) t += `\nNotes: ${st.notes[st.role]}\n`;
  return t + `\nGenerated by Workforce Futures Engine with trend data ${st.analysis.snapshot.as_of}. Estimates, not predictions.`;
}

// ---------- 5. SDG -------------------------------------------------------------
function vSdg() {
  if (!st.role) return "<p>Pick a role on the Matches tab first.</p>";
  const r = roleOf(st.role);
  const others = scenRows().slice(0, 6).filter((x) => x.role !== st.role);
  return `<div class="view">
   <div><h2>How your path connects to the SDGs</h2><p class="lead">For <b>${esc(r.title)}</b>. Each link quotes the official UN target and says why it applies, so you can challenge it. These show alignment, not guaranteed impact.</p></div>
   <div class="sdgcards">${r.sdg.map((l) => `<div class="sdgcard"><div class="hd ${l.goal === "7" ? "s7" : ""}" style="background:${SDG_COL[l.goal]}"><b>SDG ${esc(l.goal)}</b><span class="mono small">Target ${esc(l.target)}</span></div>
     <div class="bd"><p><b>${esc(l.goal_title)}</b></p><p class="small muted">“${esc(l.text)}”</p><p>${esc(l.why)}</p><p class="small muted">${l.basis === "role" ? "Linked to this role" : "Linked to reskilling itself"}</p></div></div>`).join("")}</div>
   <div class="panel"><h3>Compare with your other matches</h3><div class="skilllist">${others.map((x) => `<div class="skillrow"><span>${esc(roleOf(x.role).title)}</span><span>${roleOf(x.role).sdg.filter((l) => l.basis === "role").map((l) => sdgPill(l.target)).join(" ")}</span><button class="btn" type="button" data-choose="${x.role}">Choose</button></div>`).join("")}</div>
   <p class="small muted" style="margin-top:10px">In the Green transition scenario, low-carbon roles get more weight. Switch scenarios at the top to see the effect.</p></div>
  </div>`;
}

// ---------- team / cohort ---------------------------------------------------------
function teamData() {
  if (st.team === "upload" && st.teamUpload) return st.teamUpload;
  return st.meta.samples.teams.find((t) => t.id === st.team);
}
function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/).map((l) => l.split(",").map((c) => c.trim()));
  const head = lines.shift(); const cols = head.slice(1).filter((c) => cl(c));
  if (!cols.length) throw new Error("Header must be: name, then skill ids such as excel, genai, customer");
  const people = lines.filter((l) => l[0]).map((l) => [l[0], Object.fromEntries(cols.map((c) => [c, Math.max(0, Math.min(3, parseInt(l[head.indexOf(c)], 10) || 0))]))]);
  return { id: "upload", who: "Your upload", label: "Uploaded team", desc: `${people.length} people from your CSV. Processed in this browser only.`, target_role: st.meta.roles[0].id, columns: cols, people };
}
function vTeam() {
  const T = teamData(), target = st.teamTarget || T.target_role, r = roleOf(target);
  const need = Object.fromEntries(r.req.map((x) => [x.cluster, x.level]));
  const cols = [...new Set([...T.columns, ...Object.keys(need)])];
  const cell = (v, nd) => { const c = nd ? (v >= nd ? 3 : v === nd - 1 ? 2 : v > 0 ? 1 : 0) : Math.min(v, 3); return `<span class="cell c${c}">${LV[v]}</span>`; };
  const gaps = Object.keys(need).map((k) => ({ k, n: T.people.filter(([, s]) => (s[k] || 0) < need[k]).length })).sort((a, b) => b.n - a.n);
  const cat = st.meta.catalogue.items;
  const plan = gaps.filter((g) => g.n > 0).slice(0, 5).map((g) => ({ g, c: cat.filter((c) => c.covers[g.k]).sort((a, b) => a.hours - b.hours)[0] }));
  const sig = st.analysis ? st.analysis.signals : {};
  return `<div class="view">
   <div class="row" style="justify-content:space-between"><div><h2>${esc(T.label)}</h2><p class="lead">${esc(T.desc)}</p></div>
    <div class="seg" role="group" aria-label="View">${st.meta.samples.teams.map((t) => `<button type="button" data-team="${t.id}" aria-pressed="${st.team === t.id}">${esc(t.who)}</button>`).join("")}${st.teamUpload ? `<button type="button" data-team="upload" aria-pressed="${st.team === "upload"}">Your upload</button>` : ""}</div></div>
   <div class="row"><label class="small">Target role <select id="teamTarget">${st.meta.roles.map((x) => `<option value="${x.id}" ${x.id === target ? "selected" : ""}>${esc(x.title)}</option>`).join("")}</select></label>
     <label class="small">Upload a team CSV <input type="file" id="teamCsv" accept=".csv,text/csv"></label>
     <span class="small muted">Format: name,excel,genai,customer… with levels 0–3. Use codes, not names.</span></div>
   <div class="panel"><h3>Skill-gap heatmap vs ${esc(r.title)}</h3><div class="tablewrap"><table>
     <thead><tr><th>Person</th>${cols.map((k) => `<th>${esc(cl(k).label)}${need[k] ? `<br><span class="mono">needs ${LV[need[k]]}</span>` : ""}</th>`).join("")}</tr></thead>
     <tbody>${T.people.map(([nm, s]) => `<tr><td>${esc(nm)}</td>${cols.map((k) => `<td>${cell(s[k] || 0, need[k])}</td>`).join("")}</tr>`).join("")}</tbody></table></div>
     <p class="small muted" style="margin-top:8px">Age, gender and background are not collected or used. This view supports training plans, not selection decisions.</p></div>
   <div class="grid2">
     <div class="panel"><h3>Biggest shared gaps</h3><div class="skilllist">${gaps.map((g) => `<div class="skillrow"><span>${esc(cl(g.k).label)}</span><span class="mono">${g.n} / ${T.people.length}</span><span class="mono small ${((sig[g.k] || {}).demand_change || 0) >= 0 ? "up" : "down"}">${pct((sig[g.k] || {}).demand_change)}</span></div>`).join("")}</div></div>
     <div class="panel"><h3>Suggested group plan</h3><div class="skilllist">${plan.map(({ g, c }) => `<div class="skillrow"><span><b>${esc(cl(g.k).label)}</b><br><span class="small muted">${c ? esc(c.title + " · " + c.provider) : "No verified course indexed yet"}</span></span><span class="mono small">${c ? c.hours + " h" : "–"}</span><span class="mono small">${g.n} people</span></div>`).join("") || '<p class="small">No shared gaps.</p>'}</div>
       <p class="small muted" style="margin-top:10px">${r.sdg.map((l) => sdgPill(l.target)).join(" ")} SDG targets this team plan supports.</p></div>
   </div></div>`;
}

// ---------- sources ---------------------------------------------------------------
function vSources() {
  const m = st.meta, s = st.analysis ? st.analysis.snapshot : null, l = m.llm;
  const rows = [
    ["AI exposure by occupation", m.sources.ilo.source, "CC BY 4.0", m.sources.ilo.retrieved],
    ["Occupations and skills", m.sources.esco.source, "EU reuse policy, attribution", m.sources.esco.retrieved],
    ["SDG goals and targets", m.sources.sdg.source, "UN terms of use", m.sources.sdg.retrieved],
    ...(s ? Object.values(s.sources).map((x) => [x.name.split(" (")[0], x.name + " " + (x.url || ""), "Public API", s.as_of]) : []),
    ["Learning catalogue", "Hand-curated by the team. " + (m.catalogue._about || ""), "Provider terms", "see each item"],
  ];
  const sc = Object.entries(m.scenarios).map(([k, v]) => `<tr><td>${esc(v.label)}</td>${["skill", "outlook", "transfer", "interest", "sdg", "exposure"].map((x) => `<td class="mono">${(x === "exposure" ? "−" : "") + v.weights[x].toFixed(2)}</td>`).join("")}<td class="mono">${v.amp}×</td></tr>`).join("");
  return `<div class="view">
   <div><h2>Sources & method</h2><p class="lead">Every number in the app comes from one of these sources. Roles come only from ESCO, courses only from the catalogue, trend numbers only from dated snapshots.</p></div>
   <div class="panel"><div class="tablewrap"><table class="srcs"><thead><tr><th>Layer</th><th>Source</th><th>Licence</th><th>Retrieved</th></tr></thead>
    <tbody>${rows.map((r) => `<tr><td><b>${esc(r[0])}</b></td><td class="small">${esc(r[1])}</td><td class="small">${esc(r[2])}</td><td class="mono small">${esc(r[3])}</td></tr>`).join("")}</tbody></table></div></div>
   <div class="panel"><h3>Language model</h3><p class="small">${l.available ? `${esc(l.model)} via ${esc(l.via)}. Used only when you switch it on, for two jobs: reading your description to suggest skills (each suggestion must quote your own words, or it is rejected) and rewording an explanation (any number not in the data causes the text to be rejected). It never chooses roles, courses or scores.` : "Not connected. All text is generated from templates."}</p></div>
   <div class="grid2">
    <div class="panel"><h3>Match score</h3><pre>score = ( w.skill·skill_match + w.outlook·outlook
        + w.transfer·transferable + w.interest·interest
        + w.sdg·sdg_relevance − w.exposure·ai_exposure )
        ÷ (sum of positive weights) × 100

skill_match = Σ min(have, need) ÷ Σ need
outlook     = mean skill momentum, weighted by need
momentum    = 0.5 + 1.2·demand_change + 0.5·research_change
              (×1.5 for AI-related or falling skills in
               Fast disruption), kept within 0.05–0.95</pre></div>
    <div class="panel"><h3>Scenario weights</h3><div class="tablewrap"><table><thead><tr><th>Scenario</th><th>skill</th><th>outlook</th><th>transfer</th><th>interest</th><th>SDG</th><th>exposure</th><th>amp</th></tr></thead><tbody>${sc}</tbody></table></div></div>
   </div>
   <div class="panel"><h3>Limits we know about</h3><ul class="small" style="margin:0;padding-left:18px;display:grid;gap:4px">
     <li>Job-post signals come from global tech hiring threads; Malaysian job-ad data has no open API. Adzuna (Singapore) is added when an API key is set.</li>
     <li>ESCO is a European taxonomy; Malaysia's MASCO uses the same ISCO-08 codes, so exposure scores line up, but some local job titles may be missing.</li>
     <li>"Future skill" requirements (such as working with AI tools) are added by the team because ESCO does not list them yet.</li>
     <li>Course details and HRD Corp status must be confirmed with the provider.</li></ul></div>
  </div>`;
}

const VIEWS = { profile: vProfile, radar: vRadar, matches: vMatches, pathway: vPathway, sdg: vSdg, team: vTeam, sources: vSources };
function render() { renderChrome(); $("#app").innerHTML = VIEWS[st.tab](); }

// ---------- events ---------------------------------------------------------------
function loadSample(id) {
  const p = st.meta.samples.personas.find((x) => x.id === id);
  Object.assign(st.profile, { skills: { ...p.skills }, evidence: {}, interests: [...p.interests], hours: p.hours, about: p.about, sample: id, current: null });
  st.role = null; st.pathway = null;
  st.extractNote = ""; st.occ = { q: p.current_esco_title || "", results: [], source: "" };
  if (p.current_esco_title) searchOcc(p.current_esco_title, true);
  profileChanged();
}
let tOcc = null;
async function searchOcc(q, pickFirst) {
  st.occ.q = q; if (q.trim().length < 2) { st.occ.results = []; render(); return; }
  st.busy.occ = true; render(); restoreFocus("occQ");
  try {
    const r = await api("/api/occupations/search?q=" + encodeURIComponent(q));
    st.occ.results = r.results; st.occ.source = r.source || "";
    if (pickFirst) { const hit = r.results.find((x) => x.title.toLowerCase() === q.toLowerCase()) || r.results[0]; if (hit) pickOcc(hit); st.occ.results = []; }
  } catch (e) { toast("Job search failed: " + e.message); }
  st.busy.occ = false; render(); restoreFocus("occQ");
}
function pickOcc(hit) {
  st.profile.current = { title: hit.title, isco: hit.isco, exposure: hit.exposure, suggested: hit.suggested_skills, uri: hit.uri };
  st.occ.results = []; save(); render();
}
function restoreFocus(id) { const el = document.getElementById(id); if (el && document.activeElement !== el && st.focus === id) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); } }

document.addEventListener("click", async (ev) => {
  const t = ev.target.closest("button,[data-tab]"); if (!t) return;
  const d = t.dataset;
  if (d.tab) { st.tab = d.tab; render(); window.scrollTo({ top: 0 }); return; }
  if (d.scen) { st.scen = d.scen; st.pathway = null; st.explain = {}; render(); return; }
  if (d.sample) { loadSample(d.sample); return; }
  if (d.cycle) { const s = st.profile.skills; s[d.cycle] = ((s[d.cycle] || 0) + 1) % 4; if (!s[d.cycle]) { delete s[d.cycle]; delete st.profile.evidence[d.cycle]; } st.profile.sample = null; profileChanged(); render(); return; }
  if (d.interest) { const i = st.profile.interests; const k = i.indexOf(d.interest); if (k >= 0) i.splice(k, 1); else i.push(d.interest); profileChanged(); render(); return; }
  if (d.occ) { pickOcc(st.occ.results[+d.occ]); return; }
  if (d.plan || d.choose) { st.role = d.plan || d.choose; st.pathway = null; st.tab = d.plan ? "pathway" : st.tab; render(); window.scrollTo({ top: 0 }); return; }
  if (d.team) { st.team = d.team; st.teamTarget = null; render(); return; }
  if (d.explain) {
    const role = d.explain; st.busy["ex_" + role] = true; render();
    try { st.explain[role] = await api("/api/explain", { skills: st.profile.skills, interests: st.profile.interests, hours: st.profile.hours, role, scenario: st.scen, lang: st.lang, snapshot_id: st.snapId, use_model: !!st.meta.llm.available }); }
    catch (e) { toast("Could not explain: " + e.message); }
    st.busy["ex_" + role] = false; render(); return;
  }
  if (t.id === "extractBtn") {
    const text = ($("#about") || {}).value || ""; st.profile.about = text;
    if (text.trim().length < 15) { toast("Write a few sentences about your work first."); return; }
    st.busy.extract = true; render();
    try {
      const r = await api("/api/extract", { text, use_model: !!st.profile.useModel });
      let added = 0;
      Object.entries(r.skills).forEach(([k, v]) => { if (!st.profile.skills[k]) added++; st.profile.skills[k] = Math.max(st.profile.skills[k] || 0, v.level); st.profile.evidence[k] = v; });
      st.extractNote = `Found ${Object.keys(r.skills).length} skills (${added} new) using ${r.method === "keywords" ? "keyword matching" : r.model + " plus keyword matching"}. ${r.note || ""} Check the levels below.`;
      st.profile.sample = null; profileChanged();
    } catch (e) { toast("Could not read the text: " + e.message); }
    st.busy.extract = false; render(); return;
  }
  if (t.id === "addSuggested") {
    const sug = st.profile.current.suggested || {}; let n = 0;
    Object.entries(sug).forEach(([k, v]) => { if (!st.profile.skills[k]) { st.profile.skills[k] = v.level; st.profile.evidence[k] = { evidence: "ESCO: " + v.esco_skills.join(", "), method: "esco" }; n++; } });
    toast(n ? `Added ${n} skills from ESCO. Adjust the levels to match you.` : "These skills are already in your profile.");
    profileChanged(); render(); return;
  }
  if (t.id === "resetBtn") { st.role = null; Object.assign(st.profile, { skills: {}, evidence: {}, interests: [], hours: 5, current: null, about: "", sample: null }); st.extractNote = ""; profileChanged(); render(); return; }
  if (t.id === "copyPlan") { const txt = planText(); try { await navigator.clipboard.writeText(txt); toast("Plan copied."); } catch (e) { toast("Copy blocked by the browser; select the text manually."); } return; }
});
document.addEventListener("change", (ev) => {
  const t = ev.target;
  if (t.id === "addSkill" && t.value) { st.profile.skills[t.value] = 1; st.profile.sample = null; profileChanged(); render(); }
  else if (t.id === "roleSel") { st.role = t.value; st.pathway = null; render(); }
  else if (t.id === "snapSel") { st.snapId = +t.value; analyze(); }
  else if (t.id === "compareChk") { st.compare = t.checked; analyze(); }
  else if (t.id === "useModel") { st.profile.useModel = t.checked; save(); }
  else if (t.dataset && t.dataset.lang !== undefined && t.tagName === "SELECT") { st.lang = t.value; st.explain = {}; save(); render(); }
  else if (t.dataset && t.dataset.done) { st.done[st.role] = st.done[st.role] || {}; st.done[st.role][t.dataset.done] = t.checked; save(); render(); }
  else if (t.id === "teamTarget") { st.teamTarget = t.value; render(); }
  else if (t.id === "teamCsv" && t.files[0]) {
    const f = new FileReader();
    f.onload = () => { try { st.teamUpload = parseCsv(String(f.result)); st.team = "upload"; st.teamTarget = null; render(); } catch (e) { toast(e.message); } };
    f.readAsText(t.files[0]);
  }
});
document.addEventListener("input", (ev) => {
  const t = ev.target;
  if (t.id === "hours") { st.profile.hours = +t.value; const o = $("#hoursOut"); if (o) o.textContent = t.value; profileChanged(); }
  else if (t.id === "about") { st.profile.about = t.value; save(); }
  else if (t.id === "note") { st.notes[st.role] = t.value; save(); }
  else if (t.id === "occQ") { st.focus = "occQ"; clearTimeout(tOcc); const q = t.value; tOcc = setTimeout(() => searchOcc(q, false), 350); }
});

// ---------- start ------------------------------------------------------------------
(async function start() {
  try { st.meta = await api("/api/meta"); }
  catch (e) { $("#app").innerHTML = `<div class="notice warn">The server is not ready: ${esc(e.message)}</div>`; return; }
  if (!st.meta.snapshots.length) { $("#app").innerHTML = '<div class="notice warn">No trend data yet. Run <code>python -m ingest.refresh</code> on the server.</div>'; return; }
  st.snapId = st.meta.snapshots[0].id;
  if (!restore() || !Object.keys(st.profile.skills).length) loadSample(st.meta.samples.personas[0].id);
  else analyze();
  render();
})();
})();

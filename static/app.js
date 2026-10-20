/* Workforce Futures Engine: web client.
   Four steps (About you → Careers → Path → Resume). The profile, CV details and
   progress stay in this browser; the server only computes. */
(function () {
"use strict";

// ---------- state ----------------------------------------------------------------
const STORE = "wfe.v2";
const blankCv = () => ({ contact: { name: "", email: "", phone: "", location: "" }, headline: "", summary: "", experience: [], education: [], certifications: [], languages: [] });
const st = {
  meta: null, page: "profile", scen: "moderate", compare: false, lang: "en",
  analysis: null, advice: null, path: null, updates: null, role: null, sel: null, open: null,
  explain: {}, busy: {}, cvDraft: null, extractNote: "", occ: { q: "", results: [], source: "" },
  team: "hr", teamUpload: null, teamTarget: null, polished: null,
  profile: { skills: {}, pathSkills: {}, evidence: {}, interests: [], hours: 5, country: "MY", budget: "free",
             age_band: "", situation: "", current: null, about: "", useModel: false, sample: null, cv: blankCv() },
  progress: {}, seen: null
};
function save() {
  try { localStorage.setItem(STORE, JSON.stringify({ profile: st.profile, progress: st.progress, role: st.role, lang: st.lang, seen: st.seen })); } catch (e) { /* storage blocked */ }
}
function restore() {
  try {
    const d = JSON.parse(localStorage.getItem(STORE) || "null");
    if (!d) return false;
    Object.assign(st.profile, d.profile || {});
    st.profile.cv = Object.assign(blankCv(), st.profile.cv || {});
    st.progress = d.progress || {}; st.role = d.role || null; st.lang = d.lang || "en"; st.seen = d.seen || null;
    return true;
  } catch (e) { return false; }
}

// ---------- helpers ----------------------------------------------------------------
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const pct = (x) => x == null ? "no data" : (x >= 0 ? "+" : "") + Math.round(x * 100) + "%";
const LV = ["none", "basic", "working", "strong"];
const cl = (id) => st.meta.clusters.find((c) => c.id === id) || { label: id, sdg: [] };
const roleOf = (id) => st.meta.roles.find((r) => r.id === id);
const country = () => st.meta.countries[st.profile.country] || st.meta.countries.OTHER;
const skillsNow = () => { const s = { ...st.profile.skills }; Object.entries(st.profile.pathSkills).forEach(([k, v]) => { s[k] = Math.max(s[k] || 0, v); }); return s; };
function toast(m) { const t = $("#toast"); t.textContent = m; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => { t.hidden = true; }, 2800); }
async function api(path, body, isForm) {
  const opt = body ? { method: "POST", body: isForm ? body : JSON.stringify(body), headers: isForm ? {} : { "Content-Type": "application/json" } } : {};
  const r = await fetch(path, opt);
  if (!r.ok) { let m = r.statusText; try { m = (await r.json()).detail || m; } catch (e) { /* not json */ } throw new Error(m); }
  return r.json();
}
const lvlDots = (n) => `<span class="lvl" aria-hidden="true">${[1, 2, 3].map((i) => `<i class="${i <= n ? "on" : ""}"></i>`).join("")}</span>`;
const SDG_COL = { 1: "#E5243B", 2: "#DDA63A", 3: "#4C9F38", 4: "#C5192D", 5: "#FF3A21", 6: "#26BDE2", 7: "#FCC30B", 8: "#A21942", 9: "#FD6925", 10: "#DD1367", 11: "#FD9D24", 12: "#BF8B2E", 13: "#3F7E44", 14: "#0A97D9", 15: "#56C02B", 16: "#00689D", 17: "#19486A" };
const sdgTag = (t) => { const g = parseInt(t, 10); const d = st.meta.sdg_targets[t]; return `<span class="sdg ${g === 7 ? "y" : ""}" style="background:${SDG_COL[g]}" title="${esc(d ? "SDG " + t + ": " + d.text : "SDG " + t)}">SDG ${esc(t)}</span>`; };
function expBadge(e) {
  if (!e) return '<span class="badge">No AI exposure score</span>';
  const c = e.category.replace("Exposed: ", "");
  const warn = /Gradient [34]/.test(e.category);
  return `<span class="badge ${warn ? "warn" : ""}" title="ILO 2025: generative AI could do part of this job's tasks; mean task score ${e.mean.toFixed(2)} of 1">AI exposure: ${esc(c)}</span>`;
}
const I = {
  upload: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 16V4M6 10l6-6 6 6M4 20h16"/></svg>',
  pen: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>',
  user: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/></svg>',
  book: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M4 5c3-1 6-1 8 1 2-2 5-2 8-1v14c-3-1-6-1-8 1-2-2-5-2-8-1z"/><path d="M12 6v14"/></svg>',
  award: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><circle cx="12" cy="9" r="6"/><path d="M8.5 14 7 22l5-3 5 3-1.5-8"/></svg>',
  flag: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M5 21V4M5 4h11l-2 4 2 4H5"/></svg>',
  case: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5h6v2M3 13h18"/></svg>',
  check: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5 9-10"/></svg>',
  lock: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>'
};

// ---------- data flow --------------------------------------------------------------
const profileBody = () => ({ skills: skillsNow(), interests: st.profile.interests, hours: st.profile.hours, country: st.profile.country,
  budget: st.profile.budget, age_band: st.profile.age_band || null, situation: st.profile.situation || null });
let tA = null;
function changed(opts) { save(); clearTimeout(tA); tA = setTimeout(() => refresh(opts || {}), 250); }
async function refresh(opts) {
  try {
    st.analysis = await api("/api/analyze", { ...profileBody(), compare: st.compare });
    if (!st.role || !roleOf(st.role)) st.role = null;
    if (opts.path !== false && st.role) await loadPath();
    await loadAdvice();
  } catch (e) { toast("Could not update: " + e.message); }
  render();
}
async function loadPath() {
  if (!st.role) return;
  st.busy.path = true;
  try { st.path = await api("/api/pathway", { ...profileBody(), skills: st.profile.skills, role: st.role, scenario: st.scen }); }
  catch (e) { toast("Could not build the path: " + e.message); }
  st.busy.path = false;
}
async function loadAdvice() {
  const role = st.role || (st.analysis && st.analysis.scenarios[st.scen][0].role);
  try { st.advice = await api("/api/advice", { ...profileBody(), role, path_hours: st.path && st.path.role === role ? st.path.hours : null }); }
  catch (e) { st.advice = null; }
}
const rows = () => st.analysis ? st.analysis.scenarios[st.scen] : [];

// ---------- path model ---------------------------------------------------------------
function nodeKey(si, n) { return `${si}:${n.type}:${n.cluster || (n.item && n.item.id) || n.text}`; }
function flatNodes() {
  if (!st.path) return [];
  const out = [];
  st.path.stages.forEach((s, si) => s.nodes.forEach((n) => out.push({ ...n, si, key: nodeKey(si, n), stage: s })));
  return out;
}
const done = (key) => !!(st.progress[st.role] || {})[key];
function currentKey() { const n = flatNodes().find((x) => !done(x.key) && !(x.type === "cert" && x.optional)); return n ? n.key : null; }
function stageDone(si) { return flatNodes().filter((n) => n.si === si && !(n.type === "cert" && n.optional) && n.type !== "checkpoint").every((n) => done(n.key)); }
function unlockedStage() { if (!st.path) return -1; let u = -1; st.path.stages.forEach((s, i) => { if (u === i - 1 && stageDone(i)) u = i; }); return u; }
function setDone(n, val) {
  const p = (st.progress[st.role] = st.progress[st.role] || {});
  if (val) p[n.key] = true; else delete p[n.key];
  if (n.type === "skill") {
    if (val) { st.profile.pathSkills[n.cluster] = Math.max(st.profile.pathSkills[n.cluster] || 0, n.to); }
    else {
      const still = flatNodes().filter((x) => x.type === "skill" && x.cluster === n.cluster && x.key !== n.key && done(x.key));
      if (still.length) st.profile.pathSkills[n.cluster] = Math.max(...still.map((x) => x.to)); else delete st.profile.pathSkills[n.cluster];
    }
  }
  const nk = currentKey(); if (val && nk) st.sel = nk;
  changed({ path: false });
  render();
}

// ---------- chrome -------------------------------------------------------------------
const STEPS = [["profile", "About you"], ["careers", "Careers"], ["path", "Path"], ["resume", "Resume"]];
function renderChrome() {
  const idx = STEPS.findIndex((s) => s[0] === st.page);
  const doneFlags = { profile: Object.keys(skillsNow()).length >= 2, careers: !!st.role, path: Object.keys(st.progress[st.role] || {}).length > 0, resume: unlockedStage() >= 0 };
  $("#steps").innerHTML = STEPS.map((s, i) => `${i ? '<span class="step-sep"></span>' : ""}<button type="button" class="step-btn ${doneFlags[s[0]] && i !== idx ? "done" : ""}" data-page="${s[0]}" ${i === idx ? 'aria-current="step"' : ""}><span class="dot">${doneFlags[s[0]] && i !== idx ? "✓" : i + 1}</span><span class="label">${esc(s[1])}</span></button>`).join("");
  $("#topLinks").innerHTML = [["team", "Teams"], ["sources", "Sources"]].map(([k, l]) => `<button type="button" data-page="${k}" ${st.page === k ? 'aria-current="page"' : ""}>${l}</button>`).join("");
  const l = st.meta.llm;
  $("#llmFoot").textContent = l.available ? `AI model: ${l.model} via ${l.via}, only when you switch it on.` : "No AI model connected.";
}
const intro = (step, title, text) => `<div class="intro">${step ? `<span class="eyebrow">${esc(step)}</span>` : ""}<h2>${esc(title)}</h2>${text ? `<p class="muted">${text}</p>` : ""}</div>`;

// ---------- 1. About you --------------------------------------------------------------
function vProfile() {
  const p = st.profile, m = st.meta, l = m.llm, c = country();
  const sk = skillsNow();
  const interests = [...new Set(m.roles.flatMap((r) => r.tags))].sort();
  const ready = Object.keys(sk).length >= 2;
  return `<div class="page">
  ${intro("Step 1 of 4", "Tell us about you", "Start with your CV, a few sentences, or a sample person. You can change everything before we use it.")}
  <div class="grid cols-3">
    <div class="card start">
      <div class="row"><span class="icon">${I.upload}</span><h3>Import your CV</h3></div>
      <label class="drop" id="drop"><span class="small">Drop a PDF, Word or text file, or <u>choose a file</u></span><input type="file" id="cvFile" accept=".pdf,.docx,.txt" hidden></label>
      ${l.available ? `<label class="check"><input type="checkbox" id="useModel" ${p.useModel ? "checked" : ""}> <span class="small">Let AI read it. Your name, phone, email and IC number are removed first.</span></label>` : ""}
      ${st.busy.cv ? '<p class="small muted"><span class="spin"></span> Reading your CV…</p>' : ""}
      <p class="tiny muted">Try a sample: <a href="/static/samples/sample-cv-meiling.pdf" download>PDF</a> · <a href="/static/samples/sample-cv-aisha.docx" download>Word</a> · <a href="/static/samples/sample-cv-hafiz.txt" download>text</a></p>
    </div>
    <div class="card start">
      <div class="row"><span class="icon">${I.pen}</span><h3>Describe your work</h3></div>
      <textarea id="about" maxlength="6000" placeholder="I have worked 10 years as an admin clerk. I prepare invoices in Excel and handle customer calls in Malay and English.">${esc(p.about)}</textarea>
      <button class="btn" type="button" id="extractBtn" ${st.busy.extract ? "disabled" : ""}>${st.busy.extract ? '<span class="spin"></span> Reading…' : "Find my skills"}</button>
    </div>
    <div class="card start">
      <div class="row"><span class="icon">${I.user}</span><h3>Try a sample person</h3></div>
      <p class="small muted">Synthetic people for exploring. Not real.</p>
      <div class="stack">${m.samples.personas.map((x) => `<button type="button" class="btn" data-sample="${x.id}" style="display:grid;gap:0;text-align:left;justify-items:start${p.sample === x.id ? ";border-color:var(--accent)" : ""}"><span>${esc(x.name)}</span><span class="tiny muted">${esc(x.group)}</span></button>`).join("")}</div>
    </div>
  </div>
  ${st.extractNote ? `<p class="note">${esc(st.extractNote)}</p>` : ""}
  ${st.cvDraft ? vCvReview() : ""}
  <div class="split">
    <div class="card stack lg">
      <div><h3>Your skills</h3><p class="small muted">Tap a skill to change its level: basic, working, strong, then remove.</p></div>
      <div class="chips">${Object.entries(sk).length ? Object.entries(sk).map(([k, v]) => { const ev = p.evidence[k]; const fromPath = (p.pathSkills[k] || 0) > (p.skills[k] || 0); return `<button type="button" class="chip" data-cycle="${k}" title="${esc(LV[v] + (ev ? " · " + ev.evidence : "") + (fromPath ? " · from your completed path" : ""))}">${esc(cl(k).label)} ${lvlDots(v)}</button>`; }).join("") : '<span class="small muted">No skills yet. Import a CV or describe your work above.</span>'}</div>
      <select id="addSkill" aria-label="Add a skill"><option value="">+ Add a skill</option>${m.clusters.filter((c) => !sk[c.id]).map((c) => `<option value="${c.id}">${esc(c.label)}</option>`).join("")}</select>
      <hr>
      <div class="field"><label for="occQ">Current or last job (optional)</label><input type="search" id="occQ" placeholder="e.g. accounts clerk" value="${esc(st.occ.q)}" autocomplete="off"></div>
      ${st.busy.occ ? '<p class="small muted"><span class="spin"></span> Searching…</p>' : ""}
      ${st.occ.results.length ? `<div class="stack">${st.occ.results.map((r, i) => `<button type="button" class="btn" data-occ="${i}" style="justify-content:space-between"><span>${esc(r.title)}</span><span class="tiny muted">${r.exposure ? "AI exposure " + r.exposure.mean.toFixed(2) : ""}</span></button>`).join("")}</div>` : ""}
      ${p.current ? `<div class="note"><b>${esc(p.current.title)}</b> ${expBadge(p.current.exposure)}${p.current.exposure ? `<p class="small" style="margin-top:6px">Generative AI could do part of this job's tasks today (ILO score ${p.current.exposure.mean.toFixed(2)} of 1). Most exposed: “${esc(p.current.exposure.most_exposed_task.task)}”.</p>` : ""}
        ${p.current.suggested && Object.keys(p.current.suggested).length ? '<button class="btn ghost" type="button" id="addSuggested">+ Add skills typical of this job</button>' : ""}</div>` : ""}
    </div>
    <div class="card stack lg">
      <div><h3>Your situation</h3><p class="small muted">Used to plan cost and time. Age and situation never change which careers match you.</p></div>
      <div class="grid cols-2">
        <div class="field"><label for="country">Country</label><select id="country">${Object.entries(m.countries).map(([k, v]) => `<option value="${k}" ${p.country === k ? "selected" : ""}>${esc(v.name)}</option>`).join("")}</select></div>
        <div class="field"><label for="age">Age</label><select id="age"><option value="">Prefer not to say</option>${m.age_bands.map((a) => `<option ${p.age_band === a ? "selected" : ""}>${a}</option>`).join("")}</select></div>
        <div class="field"><label for="situation">Situation</label><select id="situation"><option value="">Prefer not to say</option>${Object.entries(m.situations).map(([k, v]) => `<option value="${k}" ${p.situation === k ? "selected" : ""}>${esc(v)}</option>`).join("")}</select></div>
        <div class="field"><label for="budget">Learning budget</label><select id="budget">${c.budgets.map(([k, v]) => `<option value="${k}" ${p.budget === k ? "selected" : ""}>${esc(v)}</option>`).join("")}</select></div>
      </div>
      <div class="field"><label for="hours">Time to learn: <b id="hoursOut">${p.hours}</b> hours a week</label><input type="range" id="hours" min="1" max="20" value="${p.hours}"></div>
      <div class="field"><span class="label">What do you enjoy?</span><div class="chips">${interests.map((i) => `<button type="button" class="chip" data-interest="${esc(i)}" aria-pressed="${p.interests.includes(i)}">${esc(i)}</button>`).join("")}</div></div>
    </div>
  </div>
  <div class="row between"><button class="btn ghost" type="button" id="resetBtn">Start over</button>
    <button class="btn primary big" type="button" data-page="careers" ${ready ? "" : "disabled"} title="${ready ? "" : "Add at least two skills first"}">See careers that fit you →</button></div>
  </div>`;
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
  return `<div class="card stack lg" id="cvReview">
    <div class="row between"><div><span class="eyebrow">Check before saving</span><h3>Here is what we found in your CV</h3>
      <p class="small muted">${esc(d.note)} Edit anything that is wrong. Your details stay in this browser.</p></div></div>
    ${d.warnings && d.warnings.length ? `<p class="note warn">${esc(d.warnings.join(" "))}</p>` : ""}
    <div class="grid cols-2">
      ${["name", "email", "phone", "location"].map((k) => `<div class="field"><label>${k[0].toUpperCase() + k.slice(1)}</label><input type="${k === "email" ? "email" : "text"}" data-cv="contact.${k}" value="${esc(d.contact[k] || "")}"></div>`).join("")}
    </div>
    <div class="field"><label>Headline</label><input type="text" data-cv="headline" value="${esc(d.headline)}"></div>
    <div class="field"><label>Summary</label><textarea data-cv="summary">${esc(d.summary)}</textarea></div>
    <div class="stack"><span class="label">Work experience</span>${exp || '<p class="small muted">No jobs found.</p>'}<button type="button" class="btn" data-cvadd="experience">+ Add a job</button></div>
    <div class="stack"><span class="label">Education</span>${edu || '<p class="small muted">No education found.</p>'}<button type="button" class="btn" data-cvadd="education">+ Add education</button></div>
    <div class="grid cols-2">
      <div class="field"><label>Certificates (one per line)</label><textarea data-cv="certifications">${esc(d.certifications.join("\n"))}</textarea></div>
      <div class="field"><label>Languages (comma separated)</label><input type="text" data-cv="languages" value="${esc(d.languages.join(", "))}"></div>
    </div>
    <div class="stack"><span class="label">Skills we found</span>
      ${Object.entries(d.skills).map(([k, v]) => `<label class="check"><input type="checkbox" data-cvskill="${k}" ${v.keep !== false ? "checked" : ""}>
        <span><b>${esc(cl(k).label)}</b> <select data-cvlevel="${k}" aria-label="Level">${[1, 2, 3].map((n) => `<option value="${n}" ${v.level === n ? "selected" : ""}>${LV[n]}</option>`).join("")}</select><br><span class="tiny muted">“${esc(v.evidence)}”</span></span></label>`).join("") || '<p class="small muted">No skills found. Add them below.</p>'}</div>
    <div class="row between"><button type="button" class="btn ghost" id="cvDiscard">Discard</button><button type="button" class="btn primary" id="cvSave">Save to my profile</button></div>
  </div>`;
}

// ---------- 2. Careers ----------------------------------------------------------------
function bar(label, pts, neg) { const w = Math.min(100, Math.abs(pts) * 2.4); return `<div class="bar"><span class="muted">${esc(label)}</span><span class="track"><span class="fill ${neg ? "neg" : ""}" style="display:block;width:${w}%"></span></span><span class="mono">${neg ? "" : "+"}${pts.toFixed(1)}</span></div>`; }
function vCareers() {
  const a = st.analysis; if (!a) return '<p class="muted"><span class="spin"></span> Loading…</p>';
  const list = rows().slice(0, 6), adv = st.advice;
  const diff = a.diff ? a.diff[st.scen] : null;
  return `<div class="page">
  ${intro("Step 2 of 4", "Careers that fit you", "Ranked by your skills, where demand is heading, and how much of the work AI can already do. Open a career to see why, then choose one.")}
  <div class="row between">
    <div class="seg" role="group" aria-label="Future scenario">${Object.entries(st.meta.scenarios).map(([k, v]) => `<button type="button" data-scen="${k}" aria-pressed="${st.scen === k}" title="${esc(v.note)}">${esc(v.label)}</button>`).join("")}</div>
    <label class="check small" style="align-items:center"><input type="checkbox" id="compareChk" ${st.compare ? "checked" : ""}> Show what changed since ${esc(a.compare ? a.compare.as_of : "the last update")}</label>
  </div>
  <p class="small muted">${esc(st.meta.scenarios[st.scen].note)} Trend data from ${esc(a.snapshot.as_of)}. Scores are estimates.</p>
  ${diff ? `<div class="note accent"><b>What changed with the latest data.</b> ${diff.length ? diff.map((x) => `${esc(roleOf(x.role).title)} moved ${x.from} → ${x.to} (${esc(cl(x.driver).label)}: ${pct(x.driver_before)} → ${pct(x.driver_after)})`).join("; ") : "No rank changes in your top 6."}</div>` : ""}
  <div class="split">
    <div class="card pad0">${list.map((x) => vCareerRow(x)).join("")}</div>
    <div class="stack lg">
      ${adv ? `<div class="card stack"><h3>Advice for your situation</h3>
        <div class="stack">${adv.tips.map((t, i) => `<div class="guide"><span class="num">${i + 1}</span><p class="small">${esc(t)}</p></div>`).join("")}</div>
        ${adv.side_income.length ? `<hr><div class="stack"><span class="label">Earn while you learn</span>${adv.side_income.map((s) => `<p class="small">• ${esc(s.idea)} <span class="tiny muted">(uses ${esc(s.skill.toLowerCase())})</span>${s.caution ? `<br><span class="tiny" style="color:var(--warn)">${esc(s.caution)}</span>` : ""}</p>`).join("")}</div>` : ""}
        ${adv.funding.length ? `<hr><div class="stack"><span class="label">Help with costs in ${esc(country().name)}</span>${adv.funding.map((f) => `<p class="small"><a href="${esc(f.url)}" target="_blank" rel="noopener">${esc(f.name)}</a>: ${esc(f.text)}</p>`).join("")}</div>` : ""}
        <p class="tiny muted">${esc(adv.fairness_note)}</p></div>` : ""}
      ${vRadarCard()}
    </div>
  </div></div>`;
}
function vCareerRow(x) {
  const r = roleOf(x.role), rg = st.analysis.ranges[x.role], open = st.open === x.role, ex = st.explain[x.role];
  const local = st.analysis.local_demand[`${x.role}@0`];
  return `<article class="career">
    <div class="ring" style="--p:${Math.round(x.score)}"><span>${Math.round(x.score)}</span></div>
    <div class="stack" style="gap:6px;min-width:0">
      <h3>${esc(r.title)}</h3>
      <div class="ladder">${r.ladder.map((s, i) => `${i ? '<span class="arrow">→</span>' : ""}<span>${esc(s.title)}</span>`).join("")}</div>
      <div class="row" style="gap:6px">${expBadge(r.exposure)}${local ? `<span class="badge accent" title="${esc(st.analysis.local_demand_source)}">In demand in ${esc(country().name)}</span>` : ""}<span class="badge">score ${rg.min.toFixed(0)}–${rg.max.toFixed(0)} across scenarios</span></div>
    </div>
    <div class="row act"><button class="btn" type="button" data-open="${x.role}">${open ? "Hide" : "Why?"}</button><button class="btn ${st.role === x.role ? "primary" : ""}" type="button" data-choose="${x.role}">${st.role === x.role ? "Chosen ✓" : "Choose"}</button></div>
    ${open ? `<div class="details">
      <p class="small"><b>You have:</b> ${x.matched.map((mm) => esc(cl(mm.cluster).label)).join(", ") || "none of the core skills yet"}.</p>
      <p class="small"><b>To build:</b> ${x.gaps.map((g) => `${esc(cl(g.cluster).label)} (${LV[g.have]} → ${LV[g.need]}${g.basis === "future" ? ", new AI-era skill" : ""})`).join("; ") || "nothing, you are ready"}.</p>
      <div class="bars">${bar("Skill match", x.points.skill)}${bar("Demand outlook", x.points.outlook)}${bar("Transferable skills", x.points.transfer)}${bar("Interest fit", x.points.interest)}${x.points.green ? bar("Green economy", x.points.green) : ""}${bar("AI exposure", x.points.exposure, true)}</div>
      <p class="tiny muted">ILO: “${esc(r.exposure.most_exposed_task.task)}” is the task AI could most easily do. ESCO lists ${r.esco_essential.length} essential skills for ${esc(r.esco.title)}. <a href="${esc(r.esco.uri)}" target="_blank" rel="noopener">View in ESCO</a></p>
      <div class="row"><button class="btn" type="button" data-explain="${x.role}" ${st.busy["ex_" + x.role] ? "disabled" : ""}>${st.busy["ex_" + x.role] ? '<span class="spin"></span> Writing…' : "Explain in plain words"}</button>
        <select data-lang aria-label="Language"><option value="en" ${st.lang === "en" ? "selected" : ""}>English</option><option value="ms" ${st.lang === "ms" ? "selected" : ""}>Bahasa Malaysia</option><option value="zh" ${st.lang === "zh" ? "selected" : ""}>中文</option></select></div>
      ${ex ? `<div class="explain">${esc(ex.text)}</div><p class="tiny muted">${ex.method === "llm" ? `Written by ${esc(ex.model)} from the facts above; numbers checked.` : "Standard explanation."} ${esc(ex.note || "")}</p>` : ""}
      <details><summary class="small muted">Linked UN SDG targets</summary><div class="stack" style="margin-top:8px">${r.sdg.map((l) => `<p class="small">${sdgTag(l.target)} ${esc(l.why)}</p>`).join("")}</div></details>
    </div>` : ""}
  </article>`;
}
function vRadarCard() {
  const list = rows(); if (!list.length) return "";
  const W = 320, H = 220, L = 30, R = 8, T = 10, B = 30;
  const pts = list.map((x) => ({ x: roleOf(x.role).exposure.mean, y: x.components.outlook, r: x }));
  const ymin = Math.min(...pts.map((p) => p.y)) - 0.03, ymax = Math.max(...pts.map((p) => p.y)) + 0.03;
  const xs = (v) => L + (v - 0.1) / 0.6 * (W - L - R), ys = (v) => T + (1 - (v - ymin) / (ymax - ymin)) * (H - T - B);
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Careers by AI exposure and demand"><rect x="${L}" y="${T}" width="${W - L - R}" height="${H - T - B}" rx="6" fill="var(--chip)"/>`;
  [0.1, 0.4, 0.7].forEach((v) => { s += `<text x="${xs(v)}" y="${H - B + 14}" font-size="9" text-anchor="middle" fill="var(--muted)" font-family="IBM Plex Mono, monospace">${v.toFixed(1)}</text>`; });
  s += `<text x="${(L + W) / 2}" y="${H - 3}" font-size="9" text-anchor="middle" fill="var(--muted)">AI exposure →</text><text x="10" y="${(T + H - B) / 2}" font-size="9" text-anchor="middle" fill="var(--muted)" transform="rotate(-90 10 ${(T + H - B) / 2})">Demand →</text>`;
  pts.slice().reverse().forEach((p) => { const top = p.r.rank <= 6; s += `<g><title>${esc(roleOf(p.r.role).title)}</title><circle cx="${xs(p.x)}" cy="${ys(p.y)}" r="${top ? 8 : 4}" fill="${top ? "var(--accent)" : "var(--surface)"}" stroke="var(--accent)" stroke-width="1.5"/>${top ? `<text x="${xs(p.x)}" y="${ys(p.y) + 3}" font-size="9" font-weight="600" text-anchor="middle" fill="var(--accent-ink)">${p.r.rank}</text>` : ""}</g>`; });
  s += "</svg>";
  const sig = st.analysis.signals;
  const ids = Object.keys(sig).filter((k) => sig[k].demand_change != null).sort((a, b) => sig[b].demand_change - sig[a].demand_change);
  return `<div class="card stack radar"><h3>Future skills radar</h3><p class="tiny muted">Numbers match the ranking. Top-left is the safest place to be.</p>${s}
    <div class="list">${ids.slice(0, 4).map((k) => `<div><span>${esc(cl(k).label)}</span><span class="mono up">${pct(sig[k].demand_change)}</span></div>`).join("")}${ids.slice(-2).map((k) => `<div><span>${esc(cl(k).label)}</span><span class="mono down">${pct(sig[k].demand_change)}</span></div>`).join("")}</div>
    <p class="tiny muted">Share of job posts mentioning each skill, last 3 months vs the 3 before. ${esc(st.advice ? st.advice.trend_note : "")}</p></div>`;
}

// ---------- 3. Path ----------------------------------------------------------------------
function nodeLabel(n) { return n.type === "skill" ? cl(n.cluster).label : n.type === "cert" ? n.item.title : n.type === "gate" ? "Experience" : "Ready to apply"; }
function nodeIcon(n, isDone) { return isDone ? I.check : { skill: I.book, cert: I.award, gate: I.flag, checkpoint: I.case }[n.type]; }
function vPath() {
  if (!st.role) return `<div class="page">${intro("Step 3 of 4", "Choose a career first", "")}<button class="btn primary" type="button" data-page="careers">Go to careers</button></div>`;
  if (!st.path || st.path.role !== st.role) { if (!st.busy.path) { loadPath().then(render); } return '<p class="muted"><span class="spin"></span> Building your path…</p>'; }
  const pw = st.path, r = roleOf(st.role), nodes = flatNodes(), cur = currentKey();
  if (!st.sel || !nodes.find((n) => n.key === st.sel)) st.sel = cur || (nodes[0] && nodes[0].key);
  const peak = pw.stages[pw.stages.length - 1].title;
  const up = st.updates;
  const newTech = [...new Set(nodes.flatMap((n) => (n.new_tech || []).map((w) => w.term)))];
  // layout
  let y = 40; const items = []; let k = 0;
  pw.stages.forEach((s, si) => {
    items.push({ band: true, y, text: `${s.stage} · ${s.title}` }); y += 70;
    s.nodes.forEach((n) => { const key = nodeKey(si, n); items.push({ n: nodes.find((x) => x.key === key), y, x: 50 + 26 * Math.sin(k * 1.05) }); y += 128; k++; });
  });
  const H = y;
  const pts = items.filter((i) => !i.band);
  let d = ""; pts.forEach((p, i) => { if (!i) d = `M ${p.x} ${p.y}`; else { const q = pts[i - 1]; const my = (q.y + p.y) / 2; d += ` C ${q.x} ${my} ${p.x} ${my} ${p.x} ${p.y}`; } });
  const doneUntil = pts.findIndex((p) => !done(p.n.key));
  let dDone = ""; const lastDone = doneUntil === -1 ? pts.length - 1 : doneUntil;
  pts.slice(0, lastDone + 1).forEach((p, i, arr) => { if (!i) dDone = `M ${p.x} ${p.y}`; else { const q = arr[i - 1]; const my = (q.y + p.y) / 2; dDone += ` C ${q.x} ${my} ${p.x} ${my} ${p.x} ${p.y}`; } });
  const map = `<div class="map" style="height:${H}px">
    <svg class="road" viewBox="0 0 100 ${H}" preserveAspectRatio="none" aria-hidden="true"><path d="${d}" fill="none" stroke="var(--line)" stroke-width="10" stroke-linecap="round" vector-effect="non-scaling-stroke"/>${dDone ? `<path d="${dDone}" fill="none" stroke="var(--accent)" stroke-width="10" stroke-linecap="round" vector-effect="non-scaling-stroke" opacity=".35"/>` : ""}</svg>
    ${items.map((it) => it.band ? `<div class="stage-band" style="top:${it.y}px"><span>${esc(it.text)}</span></div>` :
      (() => { const n = it.n, isDone = done(n.key), cls = [isDone ? "done" : "", n.key === cur ? "current" : "", n.type === "cert" && n.optional ? "optional" : "", n.key === st.sel ? "selected" : ""].join(" ");
        const flag = n.moved > 0 ? "priority ↑" : (n.new_tech && n.new_tech.length ? "new tech" : "");
        return `<button type="button" class="node ${cls}" data-node="${esc(n.key)}" style="left:${it.x}%;top:${it.y}px" aria-label="${esc(nodeLabel(n))}${isDone ? ", done" : ""}"><span class="disc">${nodeIcon(n, isDone)}${flag && !isDone ? `<span class="flag">${flag}</span>` : ""}</span><span class="cap">${esc(nodeLabel(n))}</span></button>`; })()).join("")}
  </div>`;
  return `<div class="page">
  ${intro("Step 3 of 4", `Your path to ${peak}`, `Start as ${esc(pw.stages[0].title)}. Tap any step to see what to do. Paid certificates outside your budget show as dashed, optional steps.`)}
  <div class="note accent small">
    <b>Checked ${esc(up ? up.checked_on : "today")}.</b> Trend data ${esc(pw.snapshot.as_of)}.
    ${pw.priorities_changed ? `${pw.priorities_changed} step(s) moved because demand changed.` : "Your step order is unchanged."}
    ${newTech.length ? ` New tools rising in your path: ${esc(newTech.join(", "))}.` : ""}
  </div>
  <div class="row between">
    <div class="row">${pw.stages.map((s) => `<span class="badge">${esc(s.stage)}: ${s.hours} h · ${s.weeks[0] === s.weeks[1] ? s.weeks[0] : s.weeks[0] + "–" + s.weeks[1]} wk${s.local_demand ? " · in demand locally" : ""}</span>`).join("")}</div>
    <label class="small row" style="gap:6px">Budget <select id="budgetPath">${country().budgets.map(([k, v]) => `<option value="${k}" ${st.profile.budget === k ? "selected" : ""}>${esc(v)}</option>`).join("")}</select></label>
  </div>
  <div class="map-wrap">${map}<div class="sheet">${vNodeSheet(nodes.find((n) => n.key === st.sel))}</div></div>
  </div>`;
}
function course(c, label) {
  return `<div class="course"><span class="tiny muted">${esc(label)}</span><b class="small">${esc(c.title)}</b><span class="tiny muted">${esc(c.provider)} · ${c.hours} h · ${esc(c.cost)}${c.hrdc ? " · HRD Corp: " + esc(c.hrdc) : ""}</span>${c.url ? `<a class="small" href="${esc(c.url)}" target="_blank" rel="noopener">Open course ↗</a>` : ""}</div>`;
}
function vNodeSheet(n) {
  if (!n) return "";
  const isDone = done(n.key), s = st.path.stages[n.si];
  let body = "";
  if (n.type === "skill") {
    body = `<p class="small muted">${LV[n.from]} → ${LV[n.to]}${n.basis === "future" ? " · new AI-era skill" : ""}</p>
      <p class="small">Job-post demand ${pct(n.demand_change)}${n.demand_change_before != null ? ` (was ${pct(n.demand_change_before)})` : ""}.${n.moved > 0 ? " Moved earlier in your path because demand rose." : n.moved < 0 ? " Moved later because other skills became more urgent." : ""}</p>
      ${n.new_tech && n.new_tech.length ? `<p class="note small"><b>New tools to watch:</b> ${n.new_tech.map((w) => `${esc(w.term)} (${w.prev} → ${w.cur} job posts)`).join(", ")}</p>` : ""}
      ${n.items.map((c) => course(c, "Recommended")).join("")}
      ${n.covered_earlier ? '<p class="small muted">Covered by a course earlier on your path.</p>' : ""}
      ${n.budget_blocked ? '<p class="note warn small">No course for this skill fits your budget yet. See the option below or ask about funding.</p>' : ""}
      ${n.partial ? '<p class="note warn small">Courses only reach part of this level. Practise it at work or in a project.</p>' : ""}
      ${n.no_resource ? '<p class="note warn small">No verified course yet. Practise it at work or ask a counsellor.</p>' : ""}
      ${n.upgrade && n.upgrade.length ? n.upgrade.map((c) => course(c, "Stronger option, outside your budget")).join("") : ""}
      <p class="tiny muted">Supports ${n.sdg.map(sdgTag).join(" ")}</p>`;
  } else if (n.type === "cert") {
    body = `${course(n.item, n.optional ? "Optional: outside your budget" : "Certificate")}<p class="small muted">Certificates help employers trust your level. Check the provider's current fee and exam rules.</p>`;
  } else if (n.type === "gate") {
    body = `<p class="small">${esc(n.text)}</p><p class="small muted">This step needs real work, not a course. Mark it done when you have done it.</p>`;
  } else {
    const q = encodeURIComponent(s.title), qd = s.title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const unlocked = unlockedStage() >= n.si;
    body = `<p class="small">${esc(n.text)}</p>
      ${s.local_demand ? `<p class="note accent small">${esc(s.local_demand)} are listed as critical occupations in ${esc(country().name)}. ${esc(st.path.local_demand_source)}</p>` : ""}
      <div class="stack"><span class="label">Search jobs in ${esc(country().name)}</span>${(st.advice ? st.advice.job_search : []).map((j) => `<a class="btn" href="${esc(j.url.replace("{q}", q).replace("{q_dash}", qd))}" target="_blank" rel="noopener">${esc(j.name)} ↗</a>`).join("")}</div>
      ${unlocked ? '<button class="btn primary" type="button" data-page="resume">Build my resume →</button>' : '<p class="small muted">Finish the steps above to unlock your resume for this stage.</p>'}`;
  }
  return `<div class="card stack">
    <span class="eyebrow">${esc(s.stage)} · ${esc(s.title)}</span>
    <h3>${esc(nodeLabel(n))}</h3>
    ${body}
    ${n.type !== "checkpoint" ? `<button class="btn ${isDone ? "" : "primary"}" type="button" data-toggle="${esc(n.key)}">${isDone ? "Mark as not done" : "Mark as done"}</button>` : ""}
  </div>`;
}

// ---------- 4. Resume ---------------------------------------------------------------------
function resumeData() {
  const p = st.profile, cv = p.cv, u = unlockedStage(), stage = st.path.stages[u];
  const sk = skillsNow();
  const skills = Object.entries(sk).filter(([, v]) => v >= 2).sort((a, b) => b[1] - a[1]).map(([k]) => cl(k).label);
  const courses = flatNodes().filter((n) => done(n.key) && (n.type === "cert" || n.type === "skill")).flatMap((n) => n.type === "cert" ? [n.item] : n.items).map((c) => `${c.title}, ${c.provider}`);
  const job = /^[A-Z]{2}/.test(stage.title) ? stage.title : stage.title[0].toLowerCase() + stage.title.slice(1);
  const summary = (st.polished && st.polished.summary) || cv.summary || `${stage.title} candidate with skills in ${skills.slice(0, 4).join(", ").toLowerCase()}. Completed a structured learning path towards ${job} roles.`;
  return { stage, skills, courses, summary };
}
function vResume() {
  if (!st.role) return `<div class="page">${intro("Step 4 of 4", "Choose a career first", "")}<button class="btn primary" type="button" data-page="careers">Go to careers</button></div>`;
  if (!st.path || st.path.role !== st.role) { if (!st.busy.path) loadPath().then(render); return '<p class="muted"><span class="spin"></span> Loading…</p>'; }
  const u = unlockedStage();
  if (u < 0) {
    const first = flatNodes().filter((n) => n.si === 0 && n.type !== "checkpoint" && !(n.type === "cert" && n.optional));
    const dn = first.filter((n) => done(n.key)).length, pc = first.length ? Math.round(dn / first.length * 100) : 0;
    return `<div class="page">${intro("Step 4 of 4", "Your resume unlocks when you are ready", "")}
      <div class="card lock"><span class="icon" style="width:56px;height:56px">${I.lock}</span>
        <div class="ring" style="--p:${pc}"><span>${pc}%</span></div>
        <p>Finish the ${esc(st.path.stages[0].stage.toLowerCase())} steps for <b>${esc(st.path.stages[0].title)}</b> (${dn} of ${first.length} done) to unlock a resume for that job.</p>
        <p class="small muted">This keeps your resume honest: it lists only the skills and courses you have finished.</p>
        <button class="btn primary" type="button" data-page="path">Continue my path</button></div></div>`;
  }
  const cv = st.profile.cv, R = resumeData();
  const expHtml = cv.experience.map((e) => `<p><b>${esc(e.title)}</b>${e.organisation ? ", " + esc(e.organisation) : ""} <span class="meta">${esc([e.start, e.end].filter(Boolean).join(" – "))}</span></p>${e.highlights && e.highlights.length ? `<ul>${(e._polished || e.highlights).map((h) => `<li>${esc(h)}</li>`).join("")}</ul>` : ""}`).join("");
  return `<div class="page">
  ${intro("Step 4 of 4", `Resume for ${R.stage.title}`, "Built from your profile and the steps you finished. Edit the details, then save it as a PDF.")}
  <div class="resume-wrap">
    <div class="stack lg no-print">
      <div class="card stack">
        <h3>Your details</h3>
        <div class="grid cols-2">${["name", "email", "phone", "location"].map((k) => `<div class="field"><label>${k[0].toUpperCase() + k.slice(1)}</label><input type="text" data-res="contact.${k}" value="${esc(cv.contact[k] || "")}"></div>`).join("")}</div>
        <div class="field"><label>Summary</label><textarea data-res="summary">${esc(R.summary)}</textarea></div>
        <p class="small muted">Work history and education come from your CV. <button class="btn ghost" type="button" data-page="profile">Edit on About you</button></p>
      </div>
      <div class="card stack">
        <h3>Finish</h3>
        ${st.meta.llm.available ? `<button class="btn" type="button" id="polishBtn" ${st.busy.polish ? "disabled" : ""}>${st.busy.polish ? '<span class="spin"></span> Improving…' : "Improve wording with AI"}</button>` : ""}
        ${st.polished ? `<p class="tiny muted">${esc(st.polished.note)}</p>` : ""}
        <div class="row"><button class="btn primary" type="button" id="printBtn">Save as PDF</button><button class="btn" type="button" id="txtBtn">Download text</button></div>
        <p class="tiny muted">Only list what you can show an employer. Courses appear here after you mark them done on your path.</p>
      </div>
    </div>
    <div class="paper" id="paper">
      <h1>${esc(cv.contact.name || "Your name")}</h1>
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
  const cv = st.profile.cv, R = resumeData();
  const lines = [cv.contact.name || "Your name", [cv.contact.email, cv.contact.phone, cv.contact.location].filter(Boolean).join(" | "), R.stage.title, "", "SUMMARY", R.summary, ""];
  if (R.skills.length) lines.push("SKILLS", R.skills.join(", "), "");
  if (cv.experience.length) { lines.push("EXPERIENCE"); cv.experience.forEach((e) => { lines.push(`${e.title}${e.organisation ? ", " + e.organisation : ""} (${[e.start, e.end].filter(Boolean).join(" - ")})`); (e._polished || e.highlights || []).forEach((h) => lines.push("- " + h)); }); lines.push(""); }
  const cs = [...R.courses, ...cv.certifications]; if (cs.length) lines.push("COURSES AND CERTIFICATES", ...cs.map((c) => "- " + c), "");
  if (cv.education.length) lines.push("EDUCATION", ...cv.education.map((e) => `${e.qualification}, ${e.institution} ${e.year}`), "");
  if (cv.languages.length) lines.push("LANGUAGES", cv.languages.join(", "));
  return lines.join("\n");
}

// ---------- teams and sources ---------------------------------------------------------
function teamData() { return st.team === "upload" && st.teamUpload ? st.teamUpload : st.meta.samples.teams.find((t) => t.id === st.team); }
function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/).map((l) => l.split(",").map((c) => c.trim()));
  const head = lines.shift(); const cols = head.slice(1).filter((c) => st.meta.clusters.some((x) => x.id === c));
  if (!cols.length) throw new Error("The header must be: name, then skill codes such as excel, genai, customer");
  const people = lines.filter((l) => l[0]).map((l) => [l[0], Object.fromEntries(cols.map((c) => [c, Math.max(0, Math.min(3, parseInt(l[head.indexOf(c)], 10) || 0))]))]);
  return { id: "upload", who: "Your upload", label: "Your team", desc: `${people.length} people from your file. Read in this browser only.`, target_role: st.meta.roles[0].id, columns: cols, people };
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
  const sc = Object.entries(m.scenarios).map(([, v]) => `<tr><td>${esc(v.label)}</td>${["skill", "outlook", "transfer", "interest", "green", "exposure"].map((x) => `<td class="mono">${(x === "exposure" ? "−" : "") + v.weights[x].toFixed(2)}</td>`).join("")}</tr>`).join("");
  return `<div class="page">${intro("How it works", "Sources and method", "Every number comes from one of these sources. Careers come from ESCO, courses from a checked list, trends from dated snapshots.")}
   <div class="card"><div class="tablewrap"><table><thead><tr><th>Layer</th><th>Source</th><th>Date</th></tr></thead><tbody>${rows2.map((r) => `<tr><td><b>${esc(r[0])}</b></td><td class="small">${esc(r[1])}</td><td class="mono small">${esc(r[2])}</td></tr>`).join("")}</tbody></table></div></div>
   <div class="grid cols-2"><div class="card stack"><h3>Score</h3><pre>score = ( skill·match + outlook·demand + transfer·human skills
        + interest·fit + green·low-carbon role − exposure·AI )
        ÷ (sum of positive weights) × 100</pre><p class="small muted">Green only counts in the Green transition scenario. Age and situation are never used.</p></div>
   <div class="card stack"><h3>Weights</h3><div class="tablewrap"><table><thead><tr><th></th><th>skill</th><th>outlook</th><th>transfer</th><th>interest</th><th>green</th><th>exposure</th></tr></thead><tbody>${sc}</tbody></table></div></div></div>
   <div class="card stack"><h3>AI model</h3><p class="small">${l.available ? `${esc(l.model)} via ${esc(l.via)}. It may only pick skills it can quote from your text, reword explanations and resume lines without adding facts, and read a CV after contact details are removed. It never picks careers, courses or scores.` : "Not connected."}</p></div>
   <div class="card stack"><h3>Known limits</h3><ul class="small" style="margin:0;padding-left:18px"><li>Job-post trends are global and tech-heavy; Malaysia has no open job-ad API.</li><li>Career stages are real ESCO occupations; time in each stage depends on the person and employer, so no years are shown.</li><li>Course prices and HRD Corp status must be confirmed with each provider.</li></ul></div></div>`;
}

const VIEWS = { profile: vProfile, careers: vCareers, path: vPath, resume: vResume, team: vTeam, sources: vSources };
function render() { renderChrome(); $("#app").innerHTML = VIEWS[st.page](); bindDrop(); }

// ---------- events -------------------------------------------------------------------
function bindDrop() {
  const d = $("#drop"); if (!d) return;
  ["dragenter", "dragover"].forEach((e) => d.addEventListener(e, (ev) => { ev.preventDefault(); d.classList.add("over"); }));
  ["dragleave", "drop"].forEach((e) => d.addEventListener(e, (ev) => { ev.preventDefault(); d.classList.remove("over"); }));
  d.addEventListener("drop", (ev) => { const f = ev.dataTransfer.files[0]; if (f) importCv(f); });
}
async function importCv(file) {
  st.busy.cv = true; render();
  const fd = new FormData(); fd.append("file", file); fd.append("use_model", st.profile.useModel ? "true" : "false");
  try {
    const r = await api("/api/cv", fd, true);
    st.cvDraft = { ...r, contact: { location: "", ...r.contact } };
    setTimeout(() => { const el = $("#cvReview"); if (el) el.scrollIntoView({ behavior: "smooth" }); }, 50);
  } catch (e) { toast("Could not read the CV: " + e.message); }
  st.busy.cv = false; render();
}
function setPath(obj, path, val) { const ks = path.split("."); let o = obj; ks.slice(0, -1).forEach((k) => { o = o[k]; }); o[ks[ks.length - 1]] = val; }
function loadSample(id) {
  const p = st.meta.samples.personas.find((x) => x.id === id);
  Object.assign(st.profile, { skills: { ...p.skills }, pathSkills: {}, evidence: {}, interests: [...p.interests], hours: p.hours, about: p.about, sample: id, current: null, budget: p.budget === "low-cost" ? "low" : "free", cv: blankCv() });
  st.role = null; st.path = null; st.cvDraft = null; st.extractNote = "";
  changed();
}
let tOcc = null;
async function searchOcc(q) {
  st.occ.q = q; if (q.trim().length < 2) { st.occ.results = []; render(); return; }
  st.busy.occ = true; render(); refocus();
  try { const r = await api("/api/occupations/search?q=" + encodeURIComponent(q)); st.occ.results = r.results; st.occ.source = r.source; }
  catch (e) { toast("Job search failed: " + e.message); }
  st.busy.occ = false; render(); refocus();
}
function refocus() { const el = $("#occQ"); if (el && st.focusOcc) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); } }

document.addEventListener("click", async (ev) => {
  const t = ev.target.closest("button,a[data-page]"); if (!t) return;
  const d = t.dataset;
  if (d.page) { if (t.disabled) return; st.page = d.page; render(); window.scrollTo({ top: 0 }); return; }
  if (d.sample) { loadSample(d.sample); toast("Sample loaded. Check the skills, then see careers."); return; }
  if (d.cycle) { const s = st.profile.skills, k = d.cycle; const cur = Math.max(s[k] || 0, st.profile.pathSkills[k] || 0); const nx = (cur + 1) % 4; if (nx) s[k] = nx; else { delete s[k]; delete st.profile.pathSkills[k]; delete st.profile.evidence[k]; } st.profile.sample = null; changed(); render(); return; }
  if (d.interest) { const a = st.profile.interests, i = a.indexOf(d.interest); if (i >= 0) a.splice(i, 1); else a.push(d.interest); changed({ path: false }); render(); return; }
  if (d.occ) { const h = st.occ.results[+d.occ]; st.profile.current = { title: h.title, isco: h.isco, exposure: h.exposure, suggested: h.suggested_skills }; st.occ.results = []; save(); render(); return; }
  if (d.scen) { st.scen = d.scen; st.explain = {}; st.path = null; render(); if (st.role) { await loadPath(); } render(); return; }
  if (d.open) { st.open = st.open === d.open ? null : d.open; render(); return; }
  if (d.choose) { st.role = d.choose; st.path = null; st.sel = null; st.polished = null; save(); st.page = "path"; render(); window.scrollTo({ top: 0 }); await loadPath(); await loadAdvice(); render(); return; }
  if (d.node) { st.sel = d.node; render(); if (window.innerWidth < 860) { const sh = $(".sheet"); if (sh) sh.scrollIntoView({ behavior: "smooth" }); } return; }
  if (d.toggle) { const n = flatNodes().find((x) => x.key === d.toggle); if (n) setDone(n, !done(n.key)); return; }
  if (d.team) { st.team = d.team; st.teamTarget = null; render(); return; }
  if (d.cvadd) { st.cvDraft[d.cvadd].push(d.cvadd === "experience" ? { title: "", organisation: "", start: "", end: "", highlights: [] } : { qualification: "", institution: "", year: "" }); render(); return; }
  if (d.cvdel) { const [k, i] = d.cvdel.split("."); st.cvDraft[k].splice(+i, 1); render(); return; }
  if (d.explain) {
    const role = d.explain; st.busy["ex_" + role] = true; render();
    try { st.explain[role] = await api("/api/explain", { ...profileBody(), role, scenario: st.scen, lang: st.lang, use_model: !!st.meta.llm.available }); }
    catch (e) { toast("Could not explain: " + e.message); }
    st.busy["ex_" + role] = false; render(); return;
  }
  switch (t.id) {
    case "extractBtn": {
      const text = ($("#about") || {}).value || ""; st.profile.about = text;
      if (text.trim().length < 15) { toast("Write a few sentences about your work first."); return; }
      st.busy.extract = true; render();
      try {
        const r = await api("/api/extract", { text, use_model: !!st.profile.useModel });
        Object.entries(r.skills).forEach(([k, v]) => { st.profile.skills[k] = Math.max(st.profile.skills[k] || 0, v.level); st.profile.evidence[k] = v; });
        st.extractNote = `Found ${Object.keys(r.skills).length} skills${r.model ? " with " + r.model : ""}. ${r.note || ""} Check the levels below.`;
        st.profile.sample = null; changed();
      } catch (e) { toast("Could not read the text: " + e.message); }
      st.busy.extract = false; render(); return;
    }
    case "cvSave": {
      const dft = st.cvDraft;
      if (st.profile.sample) { st.profile.skills = {}; st.profile.pathSkills = {}; st.profile.evidence = {}; st.profile.interests = []; st.progress = {}; st.role = null; st.path = null; }
      Object.entries(dft.skills).forEach(([k, v]) => { if (v.keep !== false) { st.profile.skills[k] = Math.max(st.profile.skills[k] || 0, v.level); st.profile.evidence[k] = v; } });
      st.profile.cv = { contact: dft.contact, headline: dft.headline, summary: dft.summary, experience: dft.experience, education: dft.education, certifications: dft.certifications, languages: dft.languages };
      if (dft.experience[0] && !st.occ.q) st.occ.q = dft.experience[0].title;
      st.cvDraft = null; st.profile.sample = null; changed(); toast("Saved to your profile in this browser."); render(); return;
    }
    case "cvDiscard": st.cvDraft = null; render(); return;
    case "addSuggested": { let n = 0; Object.entries(st.profile.current.suggested || {}).forEach(([k, v]) => { if (!skillsNow()[k]) { st.profile.skills[k] = v.level; st.profile.evidence[k] = { evidence: "ESCO: " + v.esco_skills.join(", "), method: "esco" }; n++; } }); toast(n ? `Added ${n} skills. Adjust the levels.` : "Already in your profile."); changed(); render(); return; }
    case "resetBtn": localStorage.removeItem(STORE); location.reload(); return;
    case "printBtn": window.print(); return;
    case "txtBtn": { const blob = new Blob([resumeText()], { type: "text/plain" }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "resume.txt"; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); return; }
    case "polishBtn": {
      const cv = st.profile.cv, R = resumeData(); const bullets = cv.experience.flatMap((e) => e.highlights || []);
      st.busy.polish = true; render();
      try {
        const r = await api("/api/resume/polish", { role: st.role, summary: R.summary, bullets });
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
  if (t.id === "useModel") { st.profile.useModel = t.checked; save(); return; }
  if (t.id === "addSkill" && t.value) { st.profile.skills[t.value] = 1; changed(); render(); return; }
  if (["country", "age", "situation", "budget", "budgetPath"].includes(t.id)) {
    const key = { country: "country", age: "age_band", situation: "situation", budget: "budget", budgetPath: "budget" }[t.id];
    st.profile[key] = t.value;
    if (t.id === "country") st.profile.budget = "free";
    if (t.id === "budgetPath" || t.id === "budget") st.path = null;
    changed(); render(); return;
  }
  if (t.id === "compareChk") { st.compare = t.checked; changed({ path: false }); return; }
  if (d.lang !== undefined && t.tagName === "SELECT") { st.lang = t.value; st.explain = {}; save(); render(); return; }
  if (d.cvskill) { st.cvDraft.skills[d.cvskill].keep = t.checked; return; }
  if (d.cvlevel) { st.cvDraft.skills[d.cvlevel].level = +t.value; return; }
  if (t.id === "teamTarget") { st.teamTarget = t.value; render(); return; }
  if (t.id === "teamCsv" && t.files[0]) { const f = new FileReader(); f.onload = () => { try { st.teamUpload = parseCsv(String(f.result)); st.team = "upload"; render(); } catch (e) { toast(e.message); } }; f.readAsText(t.files[0]); }
});
document.addEventListener("input", (ev) => {
  const t = ev.target, d = t.dataset;
  if (t.id === "hours") { st.profile.hours = +t.value; const o = $("#hoursOut"); if (o) o.textContent = t.value; st.path = null; changed(); return; }
  if (t.id === "about") { st.profile.about = t.value; save(); return; }
  if (t.id === "occQ") { st.focusOcc = true; clearTimeout(tOcc); const q = t.value; tOcc = setTimeout(() => searchOcc(q), 350); return; }
  if (d.cv) {
    let v = t.value;
    if (d.cv.endsWith(".highlights") || d.cv === "certifications") v = v.split("\n").map((x) => x.trim()).filter(Boolean);
    if (d.cv === "languages") v = v.split(",").map((x) => x.trim()).filter(Boolean);
    setPath(st.cvDraft, d.cv, v); return;
  }
  if (d.res) { setPath(st.profile.cv, d.res, t.value); if (d.res === "summary") st.polished = null; save(); const paper = $("#paper"); if (paper) { const keep = document.activeElement; $("#app").innerHTML = VIEWS[st.page](); const again = document.querySelector(`[data-res="${d.res}"]`); if (again) { again.focus(); again.setSelectionRange(again.value.length, again.value.length); } } }
});

// ---------- start ----------------------------------------------------------------------
(async function start() {
  try { st.meta = await api("/api/meta"); }
  catch (e) { $("#app").innerHTML = `<p class="note warn">The server is not ready: ${esc(e.message)}</p>`; return; }
  const had = restore();
  try { st.updates = await api("/api/updates"); } catch (e) { st.updates = null; }
  if (st.updates && st.seen !== st.updates.snapshot.id) { if (st.seen) toast("New trend data since your last visit. Your path priorities were rechecked."); st.seen = st.updates.snapshot.id; save(); }
  if (!had || !Object.keys(st.profile.skills).length) loadSample(st.meta.samples.personas[0].id);
  else { await refresh({}); if (st.role) st.page = "path"; }
  render();
})();
})();

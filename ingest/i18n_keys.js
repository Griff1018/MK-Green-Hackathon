// Lists every English string the interface translates, so the BM and Chinese files can be
// checked for gaps: node ingest/i18n_keys.js > keys.json
// Strings come from T("...") calls in static/app.js, the label tables in that file,
// data-i18n attributes in index.html, and the server texts in ingest/i18n_server.json.
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const src = fs.readFileSync(path.join(root, "static/app.js"), "utf8").replace(/\r\n/g, "\n");
const keys = new Set();

// 1. string literals inside T( ... ) calls, including both sides of a ternary
const lit = /"((?:[^"\\]|\\.)*)"/g;
for (let i = 0; (i = src.indexOf("T(", i)) !== -1; i += 2) {
  if (/[\w$.]/.test(src[i - 1] || "")) continue;
  let depth = 0, j = i + 1, inStr = null;
  for (; j < src.length; j++) {
    const c = src[j];
    if (inStr) { if (c === "\\") j++; else if (c === inStr) inStr = null; continue; }
    if (c === '"' || c === "'" || c === "`") { inStr = c; continue; }
    if (c === "(") depth++;
    else if (c === ")") { depth--; if (!depth) break; }
  }
  let call = src.slice(i + 2, j);
  // values in the {placeholders} object are data, not text to translate: cut at the
  // first ", {" that sits outside a string
  for (let k = 0, q = null; k < call.length; k++) {
    const c = call[k];
    if (q) { if (c === "\\") k++; else if (c === q) q = null; continue; }
    if (c === '"' || c === "'" || c === "`") { q = c; continue; }
    if (c === "," && /^,\s*\{/.test(call.slice(k))) { call = call.slice(0, k); break; }
  }
  for (const m of call.matchAll(lit)) if (/[A-Za-z]/.test(m[1]) && !/^[a-z]+$/.test(m[1]) || ["done", "optional", "now", "basic", "working", "strong", "none", "low", "medium", "high", "nothing", "today", "or", "new", "text"].includes(m[1])) keys.add(JSON.parse(`"${m[1]}"`));
}

// 2. label tables that are translated where they are shown
const block = (name) => {
  const m = src.match(new RegExp(`const ${name} = ([\\s\\S]*?);\\n`));
  return m ? Function(`return (${m[1]})`)() : null;
};
const add = (v) => { if (typeof v === "string" && /[A-Za-z]/.test(v)) keys.add(v); else if (Array.isArray(v)) v.forEach(add); else if (v && typeof v === "object") Object.values(v).forEach(add); };
const NAV = block("NAV").map((x) => x[1]), NAV2 = block("NAV2").map((x) => x[1]);
add(NAV); add(NAV2); add(block("GLOSSARY")); add(block("GLOSS_LABEL")); add(block("CONTACT")); add(block("LV"));
add(block("EXP_BANDS").map((x) => x[1])); add(block("SCEN_SIMPLE")); add(block("CTABS").map((x) => x[1])); add(block("LOAD_LINES"));
add(block("WIZ").flatMap((w) => [w.title, w.help])); add(block("SUGGEST")); add(block("TEAM_SUGGEST")); add(block("RATE_SCALE")); add(block("AREAS").map((a) => a[1])); add(["Other skills"]); add(block("ZONES").flatMap((z) => [z[1], z[2]])); add(block("TEAM_TOUR").flatMap((s) => [s.t, s.x])); add(block("ME_TOUR").flatMap((s) => [s.t, s.x])); add(["Tell us about yourself", "Future Skills Radar", "Get matched", "Follow a pathway"]); add(block("CHEER").flatMap((c) => c[1])); add(block("NEWS_KINDS").map((x) => x[1])); add(block("NEWS_SORTS").map((x) => x[1])); add(block("CALC_PARTS").flatMap((x) => [x[1], x[2]])); add(Object.values({ outlook: "demand for its skills", transfer: "the people skills you already have", interest: "what you enjoy", green: "the green-economy bonus", exposure: "AI exposure" })); add(block("SAMPLE_ADS").map((x) => x[0])); add(block("SECTION_KINDS").flatMap((x) => [x[1], x[2]])); add(block("BUILTIN").map((x) => x[1])); add(Object.values({ start: "Starting…", jobs: "Reading job posts…", research: "Counting research papers…", news: "Collecting work headlines…", saving: "Saving and re-scoring…" })); add(["Job check", "AI can do much of this", "AI can help with this", "Mostly human work", "Missing", "Part way", "You have"]); add(["News"]); /* NEWS_TOPICS from ingest/news.py */ add(["Jobs and hiring", "AI and work", "Skills and learning", "Remote and flexible work", "Data and analytics", "Software and IT", "Cybersecurity", "Marketing and content", "Design", "Office and admin work", "Accounting and finance", "Customer service", "Health care", "Biotech and labs", "Farming and food", "Manufacturing and robots", "Energy and climate", "Managers and leadership"]);
add(["Your skills", "Careers that fit", "Your path", "Your resume", "Import my CV", "PDF, Word or text", "Write a few lines", "Describe your work in your own words", "Skip", "Add skills yourself next",
  "About you", "Career", "Path", "Resume", "Public API; counts only", "Metadata CC0", "Adzuna terms", "Provider terms",
  "skill", "outlook", "transfer", "interest", "green", "exposure", "Skills table", "team", "cohort", "Skill match", "Demand outlook", "Transferable skills", "Interest fit", "Green economy", "AI exposure"]);
keys.delete("");
[...keys].forEach((k) => { if (/^[a-z]+$/.test(k) && !["done", "optional", "now", "basic", "working", "strong", "none", "low", "medium", "high", "nothing", "today", "or", "new", "text", "skill", "outlook", "transfer", "interest", "green", "exposure", "team", "cohort"].includes(k)) keys.delete(k); });

// words shown through a variable: AI impact levels and the interest tags on careers
["low", "medium", "high", "creative", "data", "energy", "environment", "farming", "hands-on", "health", "making", "organising", "people", "science", "tech"].forEach((k) => keys.add(k));

// 3. static text in index.html
const html = fs.readFileSync(path.join(root, "static/index.html"), "utf8");
for (const m of html.matchAll(/data-i18n(?:-label)?="([^"]+)"/g)) keys.add(m[1]);

// 4. text the server sends (advice, countries, scenarios, path steps, seed data)
const server = JSON.parse(fs.readFileSync(path.join(root, "ingest/i18n_server.json"), "utf8"));
server.forEach((k) => keys.add(k));

process.stdout.write(JSON.stringify([...keys], null, 1));

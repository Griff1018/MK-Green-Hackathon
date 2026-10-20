"""Scoring, scenarios, pathways and SDG links.

Everything here is deterministic: the same profile and snapshot always give the
same result, and every number can be traced to a seed file or a snapshot.
"""
from __future__ import annotations

import math

from .data import CATALOGUE, CLUSTER, CLUSTERS, ROLE, ROLES, SDG_GOALS, SDG_TARGETS

LEVELS = ["none", "basic", "working", "strong"]

# Scenario weights. Positive weights are normalised to sum to 1; exposure is a penalty.
SCENARIOS = {
    "moderate": {"label": "Moderate AI", "note": "AI mostly augments work; adoption follows current trends.",
                 "w": {"skill": .40, "outlook": .20, "transfer": .15, "interest": .10, "sdg": .05, "exposure": .10}, "amp": 1.0},
    "fast": {"label": "Fast disruption", "note": "AI adoption accelerates; exposed tasks are automated sooner.",
             "w": {"skill": .35, "outlook": .25, "transfer": .15, "interest": .05, "sdg": .05, "exposure": .30}, "amp": 1.5},
    "green": {"label": "Green transition", "note": "Policy and investment push low-carbon jobs.",
              "w": {"skill": .35, "outlook": .15, "transfer": .15, "interest": .10, "sdg": .20, "exposure": .10}, "amp": 1.0},
}

# Learning order: foundations and human skills first, specialist skills later.
ORDER = ["genai", "excel", "problem", "customer", "languages", "stakeholder", "correspondence", "scheduling",
         "coaching", "dataentry", "bookkeeping", "processmap", "sql", "python", "dataquality", "dataviz", "mlds",
         "networking", "helpdesk", "cyber", "digimarketing", "content", "design", "esg", "ghg", "fieldwork",
         "electrical", "solar", "energyaudit"]
assert set(ORDER) == set(CLUSTER), "ORDER must list every cluster"


def clamp(x: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, x))


# ---------- signals ---------------------------------------------------------
def momentum(cid: str, snapshot: dict, scenario: str) -> float:
    """0..1 outlook for one skill cluster. 0.5 means flat or no signal."""
    sig = snapshot["clusters"].get(cid, {})
    d = sig.get("demand_change") or 0.0
    r = sig.get("research_change") or 0.0
    amp = SCENARIOS[scenario]["amp"]
    f = amp if (CLUSTER[cid]["ai"] or d < 0) else 1.0
    return clamp(0.5 + 1.2 * d * f + 0.5 * r * f, 0.05, 0.95)


def signal_table(snapshot: dict) -> dict:
    out = {}
    for c in CLUSTERS:
        sig = snapshot["clusters"].get(c["id"], {})
        out[c["id"]] = {
            "demand_change": sig.get("demand_change"),
            "research_change": sig.get("research_change"),
            "n": sig.get("n", 0),
            "momentum": {s: round(momentum(c["id"], snapshot, s), 3) for s in SCENARIOS},
        }
    return out


# ---------- matching ---------------------------------------------------------
def clean_skills(skills: dict) -> dict[str, int]:
    return {k: int(clamp(int(v), 0, 3)) for k, v in (skills or {}).items() if k in CLUSTER and int(v) > 0}


def evaluate(role: dict, skills: dict[str, int], interests: list[str], scenario: str, snapshot: dict) -> dict:
    w = SCENARIOS[scenario]["w"]
    need = have = h_need = h_have = outlook = 0.0
    matched, gaps = [], []
    for item in role["req_list"]:
        cid, lv = item["cluster"], item["level"]
        own = skills.get(cid, 0)
        need += lv
        have += min(own, lv)
        if CLUSTER[cid]["kind"] == "human":
            h_need += lv
            h_have += min(own, lv)
        outlook += momentum(cid, snapshot, scenario) * lv
        (matched if own >= lv else gaps).append({"cluster": cid, "have": own, "need": lv, "basis": item["basis"]})
    tags = role["tags"]
    comp = {
        "skill": have / need,
        "outlook": outlook / need,
        "transfer": h_have / h_need if h_need else 0.5,
        "interest": clamp(len(set(tags) & set(interests)) / max(1, min(2, len(tags))), 0, 1),
        "sdg": 1.0 if role["green"] else 0.5,
        "exposure": role["exposure"]["mean"],
    }
    pos = sum(v for k, v in w.items() if k != "exposure")
    raw = sum(w[k] * comp[k] for k in comp if k != "exposure") - w["exposure"] * comp["exposure"]
    score = clamp(raw / pos, 0, 1) * 100
    return {"role": role["id"], "score": round(score, 1),
            "components": {k: round(v, 3) for k, v in comp.items()},
            "points": {k: round(w[k] * comp[k] / pos * 100, 1) * (-1 if k == "exposure" else 1) for k in comp},
            "matched": matched, "gaps": gaps}


def rank(skills: dict, interests: list[str], scenario: str, snapshot: dict) -> list[dict]:
    res = [evaluate(r, skills, interests, scenario, snapshot) for r in ROLES]
    res.sort(key=lambda x: (-x["score"], x["role"]))
    for i, r in enumerate(res, 1):
        r["rank"] = i
    return res


def analyze(skills: dict, interests: list[str], snapshot: dict, compare: dict | None = None) -> dict:
    skills = clean_skills(skills)
    by_scen = {s: rank(skills, interests, s, snapshot) for s in SCENARIOS}
    ranges = {}
    for r in ROLES:
        scores = [next(x for x in by_scen[s] if x["role"] == r["id"]) for s in SCENARIOS]
        ranges[r["id"]] = {"min": min(x["score"] for x in scores), "max": max(x["score"] for x in scores),
                           "top3": sum(1 for x in scores if x["rank"] <= 3)}
    out = {"scenarios": by_scen, "ranges": ranges}
    if compare:
        out["diff"] = {s: diff(skills, interests, compare, snapshot, s) for s in SCENARIOS}
    return out


def diff(skills: dict, interests: list[str], old: dict, new: dict, scenario: str, top: int = 6) -> list[dict]:
    """Explain how rankings moved between two snapshots."""
    before = {x["role"]: x for x in rank(skills, interests, scenario, old)}
    after = rank(skills, interests, scenario, new)
    changes = []
    for a in after[:top]:
        b = before[a["role"]]
        if a["rank"] == b["rank"]:
            continue
        up = a["rank"] < b["rank"]
        best, best_val = None, -math.inf
        for item in ROLE[a["role"]]["req_list"]:
            cid = item["cluster"]
            delta = (momentum(cid, new, scenario) - momentum(cid, old, scenario)) * item["level"]
            val = delta if up else -delta
            if val > best_val:
                best, best_val = cid, val
        changes.append({"role": a["role"], "from": b["rank"], "to": a["rank"],
                        "score_from": b["score"], "score_to": a["score"], "driver": best,
                        "driver_before": old["clusters"].get(best, {}).get("demand_change"),
                        "driver_after": new["clusters"].get(best, {}).get("demand_change")})
    return changes


# ---------- pathway -------------------------------------------------------------
def pathway(skills: dict, role_id: str, hours_per_week: int, snapshot: dict, scenario: str = "moderate",
            interests: list[str] | None = None) -> dict:
    skills = clean_skills(skills)
    role = ROLE[role_id]
    ev = evaluate(role, skills, interests or [], scenario, snapshot)
    gaps = sorted(ev["gaps"], key=lambda g: ORDER.index(g["cluster"]))
    used: set[str] = set()
    steps = []
    for g in gaps:
        cid, own, lv = g["cluster"], g["have"], g["need"]
        cands = [c for c in CATALOGUE if c["covers"].get(cid)]
        reach = max((c["covers"][cid] for c in cands), default=0)
        enough = sorted([c for c in cands if c["covers"][cid] >= lv], key=lambda c: c["hours"])
        items = enough[:1] if enough else sorted(cands, key=lambda c: -c["covers"][cid])[:1]
        if enough and own == 0 and enough[0]["hours"] > 20:
            base = sorted([c for c in cands if c["covers"][cid] == 1 and c["hours"] <= 10], key=lambda c: c["hours"])
            if base and base[0] is not enough[0]:
                items = [base[0], enough[0]]
        fresh = [c for c in items if c["id"] not in used]
        used.update(c["id"] for c in fresh)
        steps.append({
            "cluster": cid, "from": own, "to": lv, "basis": g["basis"],
            "items": [{k: c.get(k) for k in ("id", "title", "provider", "url", "hours", "cost", "language", "hrdc",
                                              "link_checked_on", "link_status")} for c in fresh],
            "covered_earlier": bool(items) and not fresh,
            "no_resource": not cands,
            "partial": bool(cands) and reach < lv,
            "demand_change": snapshot["clusters"].get(cid, {}).get("demand_change"),
        })
    hours = sum(i["hours"] for s in steps for i in s["items"])
    weeks = hours / max(1, hours_per_week)
    return {"role": role_id, "steps": steps, "hours": hours,
            "weeks": [math.ceil(weeks), math.ceil(weeks * 1.4)], "hours_per_week": hours_per_week,
            "score_now": ev["score"]}


# ---------- SDG -------------------------------------------------------------------
def sdg_target(code: str) -> dict:
    t = SDG_TARGETS[code]
    return {"target": code, "goal": t["goal"], "goal_title": SDG_GOALS.get(t["goal"], ""), "text": t["title"]}


def sdg_links(role_id: str) -> list[dict]:
    role = ROLE[role_id]
    links = [{**sdg_target(code), "why": why, "basis": "role"} for code, why in role["sdg"]]
    for code, why in (("4.4", "Your reskilling pathway itself builds skills for decent work."),
                      ("8.5", "Moving into a role with a stronger outlook supports productive, decent employment.")):
        if code not in {l["target"] for l in links}:
            links.append({**sdg_target(code), "why": why, "basis": "pathway"})
    return links

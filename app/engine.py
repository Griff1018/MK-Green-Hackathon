"""Scoring, scenarios, career paths and SDG links.

Everything here is deterministic: the same profile and snapshot always give the
same result, and every number can be traced to a seed file or a snapshot.
"""
from __future__ import annotations

import math

from .data import CATALOGUE, CLUSTER, CLUSTERS, COUNTRIES, ROLE, ROLES, SDG_GOALS, SDG_TARGETS

LEVELS = ["none", "basic", "working", "strong"]

# Scenario weights. Positive weights are normalised to sum to 1; exposure is a penalty.
# "green" rewards low-carbon roles only in the Green transition scenario, where policy and
# investment are assumed to raise demand for them. SDG links never change rankings otherwise.
SCENARIOS = {
    "moderate": {"label": "Moderate AI", "note": "AI mostly helps people work; adoption follows current trends.",
                 "w": {"skill": .45, "outlook": .20, "transfer": .15, "interest": .10, "green": 0.0, "exposure": .10}, "amp": 1.0},
    "fast": {"label": "Fast disruption", "note": "AI adoption speeds up; exposed tasks are automated sooner.",
             "w": {"skill": .40, "outlook": .25, "transfer": .15, "interest": .05, "green": 0.0, "exposure": .30}, "amp": 1.5},
    "green": {"label": "Green transition", "note": "Policy and investment push low-carbon jobs.",
              "w": {"skill": .35, "outlook": .15, "transfer": .15, "interest": .10, "green": .20, "exposure": .10}, "amp": 1.0},
}

# Learning order: foundations and human skills first, specialist skills later.
ORDER = ["genai", "excel", "problem", "customer", "languages", "stakeholder", "correspondence", "scheduling",
         "coaching", "leadership", "strategy", "dataentry", "bookkeeping", "processmap", "sql", "python", "dataquality", "dataviz", "mlds",
         "networking", "helpdesk", "cyber", "digimarketing", "content", "design", "esg", "ghg", "fieldwork",
         "agronomy", "precisionag", "labwork", "clinical", "healthdata", "bioinfo", "quality", "automation",
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
        "green": 1.0 if role["green"] else 0.0,
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


# ---------- career path -------------------------------------------------------
BUDGET_COSTS = {"free": {"free"}, "low": {"free", "low-cost"}, "mid": {"free", "low-cost"},
                "any": {"free", "low-cost", "paid"}}
FOUNDATION = {"genai", "excel", "problem", "customer", "languages", "stakeholder", "correspondence"}


def _item(c: dict) -> dict:
    return {k: c.get(k) for k in ("id", "title", "provider", "url", "hours", "cost", "language", "hrdc",
                                  "certification", "link_checked_on", "link_status")}


def _pick(cid: str, need: int, allowed: set, used: set) -> dict:
    """Cheapest course the budget allows that reaches the level, plus a stronger option outside the budget."""
    cands = [c for c in CATALOGUE if c["covers"].get(cid)]
    ok = [c for c in cands if c["cost"] in allowed]
    reach = sorted([c for c in ok if c["covers"][cid] >= need], key=lambda c: (c["hours"], c["id"]))
    main = reach[:1] or sorted(ok, key=lambda c: (-c["covers"][cid], c["hours"]))[:1]
    upgrade = sorted([c for c in cands if c["cost"] not in allowed and c["covers"][cid] >= need
                      and c["covers"][cid] == max(c["covers"].values())],  # the course is mainly about this skill
                     key=lambda c: c["hours"])[:1]
    fresh = [c for c in main if c["id"] not in used]
    used.update(c["id"] for c in fresh)
    return {"items": [_item(c) for c in fresh], "covered_earlier": bool(main) and not fresh,
            "no_resource": not cands, "budget_blocked": bool(cands) and not ok,
            "partial": bool(main) and max(c["covers"][cid] for c in main) < need,
            "upgrade": [_item(c) for c in upgrade]}


def _job(title: str) -> str:
    """'AI-enabled executive assistant' stays as written; 'Office manager' becomes 'office manager'."""
    return title if title[:2].isupper() else title[0].lower() + title[1:]


def _a(word: str) -> str:
    return "an" if word[:1].lower() in "aeiou" else "a"


def _priority(cid: str, gap: int, snapshot: dict, scenario: str) -> float:
    return round(gap * momentum(cid, snapshot, scenario), 3)


def new_tech(cid: str, snapshot: dict) -> list:
    """Newer tools in this skill area whose mentions in job posts are rising."""
    return [w for w in snapshot.get("watch", {}).get(cid, []) if w["cur"] >= 5 and w["cur"] > w["prev"] and w["change"] > 0.05]


def career_path(skills: dict, role_id: str, hours_per_week: int, snapshot: dict, previous: dict | None = None,
                scenario: str = "moderate", budget: str = "free", country: str = "MY") -> dict:
    """Ordered steps from where the person is now to the top of the career ladder."""
    skills = clean_skills(skills)
    role = ROLE[role_id]
    allowed = BUDGET_COSTS.get(budget, BUDGET_COSTS["free"])
    local = COUNTRIES.get(country, COUNTRIES["OTHER"])
    have = dict(skills)
    used: set = set()
    stages, total_hours = [], 0
    for idx, st in enumerate(role["stages"]):
        gaps = [(i["cluster"], have.get(i["cluster"], 0), i["level"], i["basis"])
                for i in st["req_list"] if have.get(i["cluster"], 0) < i["level"]]

        def order(snap: dict) -> list:
            return [g[0] for g in sorted(gaps, key=lambda g: (g[0] not in FOUNDATION,
                                                              -_priority(g[0], g[2] - g[1], snap, scenario),
                                                              ORDER.index(g[0])))]
        now = order(snapshot)
        before = order(previous) if previous else now
        nodes = []
        if idx > 0:
            prev_title = role["stages"][idx - 1]["title"]
            nodes.append({"type": "gate", "text": f"Work as {_a(prev_title)} {_job(prev_title)} and use these skills on real tasks."})
        for cid in now:
            g = next(x for x in gaps if x[0] == cid)
            pick = _pick(cid, g[2], allowed, used)
            nodes.append({"type": "skill", "cluster": cid, "from": g[1], "to": g[2], "basis": g[3],
                          "priority": _priority(cid, g[2] - g[1], snapshot, scenario),
                          "moved": before.index(cid) - now.index(cid),
                          "demand_change": snapshot["clusters"].get(cid, {}).get("demand_change"),
                          "demand_change_before": previous["clusters"].get(cid, {}).get("demand_change") if previous else None,
                          "new_tech": new_tech(cid, snapshot), "sdg": CLUSTER[cid].get("sdg", []), **pick})
            have[cid] = g[2]
        for cert in st["certs"]:
            if cert in used:
                continue
            c = next(x for x in CATALOGUE if x["id"] == cert)
            used.add(cert)
            nodes.append({"type": "cert", "item": _item(c), "optional": c["cost"] not in allowed})
        for text in st["gates"]:
            nodes.append({"type": "gate", "text": text})
        nodes.append({"type": "checkpoint", "text": f"Ready to apply for {_job(st['title'])} roles."})
        hours = sum(i["hours"] for n in nodes if n["type"] == "skill" for i in n["items"])
        hours += sum(n["item"]["hours"] for n in nodes if n["type"] == "cert" and not n["optional"])
        total_hours += hours
        weeks = hours / max(1, hours_per_week)
        stages.append({"stage": st["stage"], "title": st["title"], "isco": st["isco"], "esco": st["esco"],
                       "exposure": st["exposure"], "nodes": nodes, "hours": hours,
                       "weeks": [math.ceil(weeks), math.ceil(weeks * 1.4)],
                       "local_demand": local["local_demand"].get(f"{role_id}@{idx}")})
    ev = evaluate(role, skills, [], scenario, snapshot)
    moved = sum(1 for s in stages for n in s["nodes"] if n.get("moved"))
    return {"role": role_id, "stages": stages, "hours": total_hours, "hours_per_week": hours_per_week,
            "budget": budget, "score_now": ev["score"], "priorities_changed": moved,
            "local_demand_source": local["local_demand_source"]}


# ---------- what it takes (counterfactual simulator) --------------------------------------
def upgrade_hours(cid: str, need: int, budget: str = "free") -> int | None:
    """Hours of the checked course the budget allows for this skill and level; None when there is none."""
    pick = _pick(cid, need, BUDGET_COSTS.get(budget, BUDGET_COSTS["free"]), set())
    return sum(i["hours"] for i in pick["items"]) or None


def what_it_takes(skills: dict, interests: list[str], role_id: str, scenario: str, snapshot: dict,
                  budget: str = "free") -> dict:
    """The skills to learn, in the order that raises this career's rank fastest per hour of study.
    Only skills change: interests, demand and AI exposure stay as they are, so the result says
    when even every skill would not make the career the top match."""
    role = ROLE[role_id]
    have = clean_skills(skills)
    place = lambda sk: next(x for x in rank(sk, interests, scenario, snapshot) if x["role"] == role_id)  # noqa: E731
    start = place(have)
    todo = [(i["cluster"], i["level"]) for i in role["req_list"] if have.get(i["cluster"], 0) < i["level"]]
    hours = {cid: upgrade_hours(cid, need, budget) for cid, need in todo}
    steps, cur = [], start
    while todo:
        best = None
        for cid, need in todo:
            res = place({**have, cid: need})
            gain = res["score"] - cur["score"]
            per_hour = gain / hours[cid] if hours[cid] else -1  # no checked course: learn it last
            key = (per_hour, gain)
            if best is None or key > best[0]:
                best = (key, cid, need, res)
        _, cid, need, res = best
        steps.append({"cluster": cid, "from": have.get(cid, 0), "to": need, "hours": hours[cid],
                      "score": res["score"], "rank": res["rank"], "gain": round(res["score"] - cur["score"], 1)})
        have[cid] = need
        cur = res
        todo = [t for t in todo if t[0] != cid]
    top = rank(have, interests, scenario, snapshot)[0]
    held_back = None
    if cur["rank"] > 1:  # which part keeps another career ahead even with every skill learned
        diff = {k: top["points"][k] - cur["points"][k] for k in ("outlook", "transfer", "interest", "green", "exposure")}
        held_back = {"by": top["role"], "part": max(diff, key=diff.get)}
    first_top = next((i for i, s in enumerate(steps) if s["rank"] == 1), None)
    return {"role": role_id, "scenario": scenario, "start": {"rank": start["rank"], "score": start["score"]},
            "steps": steps, "end": {"rank": cur["rank"], "score": cur["score"]},
            "hours": sum(s["hours"] or 0 for s in steps), "unknown_hours": sum(1 for s in steps if not s["hours"]),
            "top_after": first_top, "held_back": held_back}


def next_skills(skills: dict, interests: list[str], role_id: str, scenario: str, snapshot: dict,
                budget: str = "free") -> list[dict]:
    """Each missing skill on its own: how many fit points it adds to this career per hour of study."""
    have = clean_skills(skills)
    base = evaluate(ROLE[role_id], have, interests, scenario, snapshot)["score"]
    out = []
    for i in ROLE[role_id]["req_list"]:
        cid, need = i["cluster"], i["level"]
        if have.get(cid, 0) >= need:
            continue
        gain = evaluate(ROLE[role_id], {**have, cid: need}, interests, scenario, snapshot)["score"] - base
        h = upgrade_hours(cid, need, budget)
        out.append({"cluster": cid, "from": have.get(cid, 0), "to": need, "gain": round(gain, 1), "hours": h,
                    "per_hour": round(gain / h, 2) if h else None})
    return sorted(out, key=lambda x: (x["per_hour"] is None, -(x["per_hour"] or 0), -x["gain"]))


# ---------- teams and cohorts (HR / L&D, TVET and university career centres) -------------
def team_report(people: list, target: str, snapshot: dict, budget: str = "free") -> dict:
    """Matches for a group: careers ranked by the group's average fit, each person's best fit,
    and one learning plan for the target career that closes the most shared gaps first."""
    people = [(name, clean_skills(skills)) for name, skills in people]
    careers, persons = {}, {}
    for s in SCENARIOS:
        rows = []
        for r in ROLES:
            ev = [evaluate(r, sk, [], s, snapshot) for _, sk in people]
            scores = [e["score"] for e in ev]
            rows.append({"role": r["id"], "score": round(sum(scores) / len(scores), 1),
                         "min": min(scores), "max": max(scores),
                         "components": {k: round(sum(e["components"][k] for e in ev) / len(ev), 3) for k in ev[0]["components"]}})
        rows.sort(key=lambda x: (-x["score"], x["role"]))
        for i, x in enumerate(rows, 1):
            x["rank"] = i
        careers[s] = rows
        persons[s] = []
        for name, sk in people:
            top = rank(sk, [], s, snapshot)[:3]
            ev = evaluate(ROLE[target], sk, [], s, snapshot)
            gaps = sorted(ev["gaps"], key=lambda g: (-(g["need"] - g["have"]), ORDER.index(g["cluster"])))
            persons[s].append({"name": name, "top": [{"role": x["role"], "score": x["score"]} for x in top],
                               "target_score": ev["score"], "readiness": ev["components"]["skill"],
                               "gaps": [{"cluster": g["cluster"], "have": g["have"], "need": g["need"]} for g in gaps]})

    allowed = BUDGET_COSTS.get(budget, BUDGET_COSTS["free"])
    need = {i["cluster"]: i["level"] for i in ROLE[target]["stages"][0]["req_list"]}
    gaps = []
    for cid, lv in need.items():
        short = [name for name, sk in people if sk.get(cid, 0) < lv]
        if short:
            gaps.append((cid, lv, short))
    gaps.sort(key=lambda g: (-len(g[2]), g[0] not in FOUNDATION, ORDER.index(g[0])))
    used: set = set()
    steps = []
    for cid, lv, short in gaps:
        steps.append({"cluster": cid, "to": lv, "people": short, "n": len(short),
                      "sdg": CLUSTER[cid].get("sdg", []), **_pick(cid, lv, allowed, used)})
    hours = {name: sum(i["hours"] for st in steps if name in st["people"] for i in st["items"]) for name, _ in people}
    ready = [p["name"] for p in persons["moderate"] if p["readiness"] >= READY]
    return {"size": len(people), "careers": careers, "people": persons,
            "summary": {"target": target, "ready": ready, "ready_at": READY,
                        "readiness_avg": round(sum(p["readiness"] for p in persons["moderate"]) / len(people), 3),
                        "target_exposure": ROLE[target]["exposure"]},
            "plan": {"role": target, "steps": steps, "hours": hours}}


READY = 0.8  # share of the target career's entry skills a person already has to count as nearly ready


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

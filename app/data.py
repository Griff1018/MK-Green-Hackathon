"""Loads the seed files once at start-up. Everything here is read-only."""
from __future__ import annotations

import json

from .config import SEED_DIR


def _load(name: str) -> dict:
    return json.loads((SEED_DIR / name).read_text(encoding="utf-8"))


CLUSTERS: list[dict] = _load("clusters.json")["clusters"]
CLUSTER: dict[str, dict] = {c["id"]: c for c in CLUSTERS}

_roles = _load("roles.json")["roles"]
_occ = _load("occupations.json")
OCCUPATIONS: dict[str, dict] = _occ["occupations"]
ESCO_META = {"source": _occ["_source"], "retrieved": _occ["_retrieved"]}

_ilo = _load("ilo_scores.json")
ILO: dict[str, dict] = _ilo["occupations"]
ILO_META = {"source": _ilo["_source"], "retrieved": _ilo["_retrieved"]}

_sdg = _load("sdg_targets.json")
SDG_GOALS: dict[str, str] = _sdg["goals"]
SDG_TARGETS: dict[str, dict] = _sdg["targets"]
SDG_META = {"source": _sdg["_source"], "retrieved": _sdg["_retrieved"]}

_cat = _load("catalogue.json")
CATALOGUE: list[dict] = _cat["items"]
CATALOGUE_META = {k: v for k, v in _cat.items() if k.startswith("_")}

SAMPLES = _load("samples.json")


def exposure(isco: str | None) -> dict | None:
    """ILO 2025 GenAI exposure for a 4-digit ISCO-08 code, or None if unscored."""
    if not isco or isco not in ILO:
        return None
    o = ILO[isco]
    return {
        "isco": isco,
        "ilo_title": o["title"],
        "mean": o["mean_2025"],
        "sd": o["sd_2025"],
        "mean_2023": o["mean_2023"],
        "category": o["category"],
        "most_exposed_task": o["tasks"][0],
        "least_exposed_task": o["tasks"][-1],
        "n_tasks": len(o["tasks"]),
    }


_countries = _load("countries.json")
COUNTRIES: dict[str, dict] = _countries["countries"]
SIDE_INCOME = _load("side_income.json")
CATALOGUE_BY_ID = {c["id"]: c for c in CATALOGUE}

for _c in CLUSTERS:
    for _t in _c.get("sdg", []):
        if _t not in SDG_TARGETS:
            raise RuntimeError(f"Cluster {_c['id']} links to unknown SDG target {_t}")


def _occupation(title: str, where: str) -> dict:
    occ = OCCUPATIONS.get(title)
    if not occ:
        raise RuntimeError(f"ESCO occupation {title!r} ({where}) missing; run python -m ingest.build_seed")
    return occ


def _req_list(req: dict, occ: dict, where: str) -> list[dict]:
    unknown = set(req) - set(CLUSTER)
    if unknown:
        raise RuntimeError(f"{where} uses unknown clusters {unknown}")
    out = []
    for cid, level in req.items():
        evidence = occ["clusters"].get(cid, [])
        out.append({"cluster": cid, "level": level, "basis": "esco" if evidence else "future", "esco_skills": evidence})
    return out


def _esco_info(occ: dict) -> dict:
    return {"uri": occ["uri"], "title": occ["title"], "code": occ["code"],
            "description": occ["description"], "essential": occ["essential"]}


def _build_roles() -> list[dict]:
    roles = []
    for r in _roles:
        occ = _occupation(r["esco_title"], r["id"])
        for target, _ in r["sdg"]:
            if target not in SDG_TARGETS:
                raise RuntimeError(f"Role {r['id']} links to unknown SDG target {target}")
        stages = [{"stage": "Entry", "title": r["title"], "esco": _esco_info(occ), "isco": occ["isco"],
                   "exposure": exposure(occ["isco"]), "req_list": _req_list(r["req"], occ, r["id"]),
                   "gates": [], "certs": []}]
        cumulative = dict(r["req"])
        for i, st in enumerate(r.get("ladder", []), 1):
            socc = _occupation(st["esco_title"], f"{r['id']} stage {i}")
            for cid, lv in st["add"].items():
                cumulative[cid] = max(cumulative.get(cid, 0), lv)
            for cert in st["certs"]:
                if cert not in CATALOGUE_BY_ID:
                    raise RuntimeError(f"{r['id']} stage {i} names unknown catalogue item {cert}")
            stages.append({"stage": st["stage"], "title": st["esco_title"][0].upper() + st["esco_title"][1:],
                           "esco": _esco_info(socc), "isco": socc["isco"], "exposure": exposure(socc["isco"]),
                           "req_list": _req_list(dict(cumulative), socc, f"{r['id']} stage {i}"),
                           "gates": st["gates"], "certs": st["certs"]})
        roles.append({**r, "req_list": stages[0]["req_list"], "esco": stages[0]["esco"],
                      "isco": occ["isco"], "exposure": stages[0]["exposure"], "stages": stages})
    return roles


ROLES: list[dict] = _build_roles()
TRACKS: dict = _load("tracks.json")
SELFSTUDY: dict = _load("selfstudy.json")
ROLE: dict[str, dict] = {r["id"]: r for r in ROLES}

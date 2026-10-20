"""HTTP API and static web app.

    uvicorn app.main:app --reload            # local
    uvicorn app.main:app --host 0.0.0.0 --port 8000   # Replit
"""
from __future__ import annotations

import json
import threading
from contextlib import asynccontextmanager
from datetime import date

import httpx
from fastapi import FastAPI, Header, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from . import assist, config, db, engine, llm
from .config import ROOT, SEED_DIR
from .data import (CATALOGUE, CATALOGUE_META, CLUSTERS, ESCO_META, ILO_META, OCCUPATIONS, ROLE, ROLES,
                   SAMPLES, SDG_META, exposure)

ESCO_API = "https://ec.europa.eu/esco/api"
BOOTSTRAP = SEED_DIR / "snapshots_bootstrap.json"


# ---------- snapshots ------------------------------------------------------------
def bootstrap_snapshots() -> None:
    """A fresh deployment starts from the snapshots shipped in the repo."""
    if db.list_snapshots(1) or not BOOTSTRAP.exists():
        return
    for snap in json.loads(BOOTSTRAP.read_text(encoding="utf-8")):
        db.save_snapshot(snap["as_of"], snap)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    db.init()
    bootstrap_snapshots()
    yield


app = FastAPI(title="Workforce Futures Engine", version="0.1.0", lifespan=lifespan)


def load_snapshot(snapshot_id: int | None) -> dict:
    if snapshot_id is None:
        snaps = db.list_snapshots(1)
        if not snaps:
            raise HTTPException(503, "No trend data yet. Run: python -m ingest.refresh")
        snapshot_id = snaps[0]["id"]
    snap = db.get_snapshot(snapshot_id)
    if not snap:
        raise HTTPException(404, "Snapshot not found")
    return {**snap["payload"], "id": snap["id"], "created_at": snap["created_at"]}


def snapshot_info(s: dict) -> dict:
    return {"id": s["id"], "as_of": s["as_of"], "created_at": s["created_at"], "sources": s["sources"]}


# ---------- models ------------------------------------------------------------------
class Profile(BaseModel):
    skills: dict[str, int] = Field(default_factory=dict)
    interests: list[str] = Field(default_factory=list)
    hours: int = Field(5, ge=1, le=40)


class AnalyzeIn(Profile):
    snapshot_id: int | None = None
    compare_id: int | None = None


class PathwayIn(Profile):
    role: str
    scenario: str = "moderate"
    snapshot_id: int | None = None


class ExtractIn(BaseModel):
    text: str = Field(..., max_length=6000)
    use_model: bool = False


class ExplainIn(Profile):
    role: str
    scenario: str = "moderate"
    lang: str = "en"
    snapshot_id: int | None = None
    use_model: bool = False


# ---------- read-only data ------------------------------------------------------------
@app.get("/api/health")
def health() -> dict:
    return {"ok": True, "snapshots": len(db.list_snapshots(50)), "llm": llm.status()}


@app.get("/api/meta")
def meta() -> dict:
    roles = []
    for r in ROLES:
        roles.append({
            "id": r["id"], "title": r["title"], "tags": r["tags"], "green": r["green"],
            "esco": {k: r["esco"][k] for k in ("uri", "title", "code", "description")},
            "esco_essential": r["esco"]["essential"],
            "isco": r["isco"], "exposure": r["exposure"], "req": r["req_list"],
            "sdg": engine.sdg_links(r["id"]),
        })
    return {
        "clusters": [{k: c[k] for k in ("id", "label", "kind", "ai")} for c in CLUSTERS],
        "roles": roles,
        "scenarios": {k: {"label": v["label"], "note": v["note"], "weights": v["w"], "amp": v["amp"]}
                      for k, v in engine.SCENARIOS.items()},
        "levels": engine.LEVELS,
        "samples": SAMPLES,
        "snapshots": db.list_snapshots(20),
        "catalogue": {"items": CATALOGUE, **CATALOGUE_META},
        "sources": {"ilo": ILO_META, "esco": ESCO_META, "sdg": SDG_META},
        "llm": llm.status(),
    }


@app.get("/api/snapshots/{snapshot_id}")
def snapshot(snapshot_id: int) -> dict:
    s = load_snapshot(snapshot_id)
    return {**snapshot_info(s), "signals": engine.signal_table(s)}


def _occupation_hit(title: str, code: str, uri: str, essential: list[str]) -> dict:
    isco = (code or "")[:4]
    suggested = {}
    for s in essential:
        low = s.lower()
        for c in CLUSTERS:
            if any(k in low for k in c["esco_keywords"]):
                suggested.setdefault(c["id"], []).append(s)
    return {"title": title, "code": code, "isco": isco, "uri": uri, "exposure": exposure(isco),
            "suggested_skills": {cid: {"level": 2, "esco_skills": v[:4]} for cid, v in suggested.items()}}


@app.get("/api/occupations/search")
def occupation_search(q: str) -> dict:
    """Live ESCO search with the ILO exposure of each hit. Falls back to the bundled list offline."""
    q = q.strip()[:80]
    if len(q) < 2:
        return {"results": [], "source": None}
    try:
        r = httpx.get(f"{ESCO_API}/search", params={"text": q, "type": "occupation", "language": "en",
                                                     "limit": 6, "full": "true"}, timeout=8)
        r.raise_for_status()
        hits = r.json()["_embedded"]["results"]
        res = [_occupation_hit(h["title"], h.get("code") or "", h["uri"],
                               [s["title"] for s in h.get("_links", {}).get("hasEssentialSkill", [])]) for h in hits]
        return {"results": res, "source": "ESCO API (live)"}
    except (httpx.HTTPError, KeyError, ValueError):
        low = q.lower()
        res = [_occupation_hit(o["title"], o["code"], o["uri"], o["essential"])
               for o in OCCUPATIONS.values() if low in o["title"].lower()]
        return {"results": res[:6], "source": f"Bundled ESCO extract ({ESCO_META['retrieved']}); live search unavailable"}


# ---------- analysis ------------------------------------------------------------------
@app.post("/api/analyze")
def analyze(body: AnalyzeIn) -> dict:
    snap = load_snapshot(body.snapshot_id)
    compare = load_snapshot(body.compare_id) if body.compare_id else None
    res = engine.analyze(body.skills, body.interests, snap, compare)
    return {"snapshot": snapshot_info(snap), "compare": snapshot_info(compare) if compare else None,
            "signals": engine.signal_table(snap), **res}


@app.post("/api/pathway")
def pathway(body: PathwayIn) -> dict:
    if body.role not in ROLE:
        raise HTTPException(404, "Unknown role")
    if body.scenario not in engine.SCENARIOS:
        raise HTTPException(400, "Unknown scenario")
    snap = load_snapshot(body.snapshot_id)
    p = engine.pathway(body.skills, body.role, body.hours, snap, body.scenario, body.interests)
    return {**p, "sdg": engine.sdg_links(body.role), "snapshot": snapshot_info(snap)}


@app.post("/api/extract")
def extract(body: ExtractIn) -> dict:
    return assist.extract(body.text, body.use_model)


@app.post("/api/explain")
def explain(body: ExplainIn) -> dict:
    if body.role not in ROLE or body.scenario not in engine.SCENARIOS:
        raise HTTPException(400, "Unknown role or scenario")
    snap = load_snapshot(body.snapshot_id)
    res = engine.evaluate(ROLE[body.role], engine.clean_skills(body.skills), body.interests, body.scenario, snap)
    return assist.explain(res, body.scenario, snap, body.lang, body.use_model)


# ---------- admin -----------------------------------------------------------------------
_refresh_state = {"running": False, "last": None, "error": None}


@app.post("/api/admin/refresh")
def admin_refresh(authorization: str = Header("")) -> dict:
    if not config.ADMIN_TOKEN or authorization != f"Bearer {config.ADMIN_TOKEN}":
        raise HTTPException(401, "Admin token required")
    if _refresh_state["running"]:
        return {"started": False, "message": "A refresh is already running"}

    def work() -> None:
        from ingest import refresh
        _refresh_state.update(running=True, error=None)
        try:
            _refresh_state["last"] = refresh.run(date.today())
        except Exception as e:  # report any failure to the admin
            _refresh_state["error"] = str(e)
        finally:
            _refresh_state["running"] = False

    threading.Thread(target=work, daemon=True).start()
    return {"started": True}


@app.get("/api/admin/refresh")
def admin_refresh_status() -> dict:
    return _refresh_state


# ---------- web app ----------------------------------------------------------------------
STATIC = ROOT / "static"
app.mount("/static", StaticFiles(directory=STATIC), name="static")


@app.get("/")
def index() -> FileResponse:
    return FileResponse(STATIC / "index.html")

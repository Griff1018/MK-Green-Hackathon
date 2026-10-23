"""HTTP API and static web app.

    uvicorn app.main:app --reload            # local
    uvicorn app.main:app --host 0.0.0.0 --port 8000   # Replit
"""
from __future__ import annotations

import json
import threading
import time
from contextlib import asynccontextmanager
from datetime import date

import httpx
from fastapi import FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from . import accounts, advice, agent, assist, config, cv, db, engine, interview, jobcheck, llm
from .config import ROOT, SEED_DIR
from .data import (CATALOGUE, CATALOGUE_META, CLUSTER, CLUSTERS, COUNTRIES, ESCO_META, ILO_META, OCCUPATIONS,
                   ROLE, ROLES, SAMPLES, SDG_META, SELFSTUDY, TRACKS, exposure)

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
    accounts.ensure_accounts()
    if config.AUTO_REFRESH:
        threading.Thread(target=_daily_refresh, daemon=True).start()
    yield


app = FastAPI(title="Workforce Futures Engine", version="0.2.0", lifespan=lifespan)


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


def previous_of(snap: dict) -> dict | None:
    """The newest snapshot taken on an earlier date, used to show what changed."""
    for s in db.list_snapshots(50):
        if s["as_of"] < snap["as_of"]:
            return load_snapshot(s["id"])
    return None


def snapshot_info(s: dict | None) -> dict | None:
    if not s:
        return None
    return {"id": s["id"], "as_of": s["as_of"], "created_at": s["created_at"], "sources": s["sources"]}


# ---------- models ------------------------------------------------------------------
class Profile(BaseModel):
    skills: dict[str, int] = Field(default_factory=dict)
    interests: list[str] = Field(default_factory=list)
    hours: int = Field(5, ge=1, le=40)
    country: str = "MY"
    budget: str = "free"
    age_band: str | None = None
    situation: str | None = None


class AnalyzeIn(Profile):
    snapshot_id: int | None = None
    compare: bool = False


class TeamIn(BaseModel):
    # [name, {skill: level}] pairs; names are used only to label rows in the reply, never stored
    people: list[tuple[str, dict[str, int]]] = Field(min_length=1, max_length=300)
    target_role: str
    budget: str = "free"
    snapshot_id: int | None = None


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


class AdviceIn(Profile):
    role: str | None = None
    path_hours: int | None = None


class PolishIn(BaseModel):
    role: str
    summary: str = Field("", max_length=1200)
    bullets: list[str] = Field(default_factory=list, max_length=30)


class SectionIn(BaseModel):
    kind: str = Field("custom", max_length=20)
    title: str = Field(..., min_length=1, max_length=60)
    context: dict = Field(default_factory=dict)


# ---------- accounts ------------------------------------------------------------------
class SaveIn(BaseModel):
    data: dict


class TeamChat(BaseModel):
    # skill levels only; the browser replaces names before sending
    people: list[tuple[str, dict[str, int]]] = Field(min_length=1, max_length=300)
    target_role: str
    budget: str = "free"
    kind: str = "hr"


class ChatIn(BaseModel):
    message: str = Field(..., min_length=1, max_length=600)
    lang: str = "en"
    page: str = "dashboard"
    team: TeamChat | None = None
    quote: str | None = Field(None, max_length=500)     # text the person highlighted on the page
    section: str | None = Field(None, max_length=120)   # heading of the card it came from


def _token(authorization: str) -> str | None:
    return authorization[7:] if authorization.startswith("Bearer ") else None


def _auth(authorization: str) -> dict:
    try:
        return accounts.user_for(_token(authorization))
    except accounts.AuthError as e:
        raise HTTPException(e.status, str(e)) from e


@app.get("/api/accounts")
def account_list() -> dict:
    return {"accounts": accounts.list_accounts()}


@app.post("/api/accounts/{uid}/signin")
def account_sign_in(uid: str) -> dict:
    try:
        return accounts.sign_in(uid)
    except accounts.AuthError as e:
        raise HTTPException(e.status, str(e)) from e


@app.get("/api/me")
def me(authorization: str = Header("")) -> dict:
    return _auth(authorization)


@app.put("/api/me")
def me_save(body: SaveIn, authorization: str = Header("")) -> dict:
    u = _auth(authorization)
    try:
        return {"saved_at": accounts.save_data(u["id"], body.data)}
    except accounts.AuthError as e:
        raise HTTPException(e.status, str(e)) from e


@app.post("/api/me/reset")
def me_reset(authorization: str = Header("")) -> dict:
    return {"data": accounts.reset_data(_auth(authorization)["id"])}


# ---------- assistant ---------------------------------------------------------------------
@app.get("/api/chat")
def chat_history(authorization: str = Header("")) -> dict:
    return {"messages": agent.history(_auth(authorization)["id"])}


@app.post("/api/chat")
def chat(body: ChatIn, authorization: str = Header("")) -> dict:
    u = _auth(authorization)
    snap = load_snapshot(None)
    team = body.team.model_dump() if body.team and body.team.target_role in ROLE else None
    quote = (body.quote or "").strip() or None
    return agent.ask(u["id"], u["data"], body.message.strip(), body.lang, body.page, snap, previous_of(snap), team,
                     quote, (body.section or "").strip() or None)


@app.delete("/api/chat")
def chat_clear(authorization: str = Header("")) -> dict:
    agent.clear(_auth(authorization)["id"])
    return {"ok": True}


@app.post("/api/signout")
def sign_out(authorization: str = Header("")) -> dict:
    accounts.sign_out(_token(authorization))
    return {"ok": True}


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
            "ladder": [{"stage": s["stage"], "title": s["title"], "isco": s["isco"],
                        "exposure": s["exposure"], "esco_uri": s["esco"]["uri"]} for s in r["stages"]],
            "sdg": engine.sdg_links(r["id"]),
        })
    return {
        "clusters": [{k: c[k] for k in ("id", "label", "kind", "ai")} | {"sdg": c.get("sdg", []), "aliases": c.get("aliases", [])} for c in CLUSTERS],
        "roles": roles,
        "tracks": {"families": TRACKS["families"], "tracks": TRACKS["tracks"]},
        "selfstudy": SELFSTUDY,
        "scenarios": {k: {"label": v["label"], "note": v["note"], "weights": v["w"], "amp": v["amp"]}
                      for k, v in engine.SCENARIOS.items()},
        "levels": engine.LEVELS,
        "samples": SAMPLES,
        "countries": {k: {"name": v["name"], "currency": v["currency"], "budgets": v["budgets"]}
                      for k, v in COUNTRIES.items()},
        "age_bands": advice.AGE_BANDS,
        "situations": advice.SITUATIONS,
        "snapshots": db.list_snapshots(20),
        "catalogue": {"items": CATALOGUE, **CATALOGUE_META},
        "sdg_targets": {t: engine.sdg_target(t) for c in CLUSTERS for t in c.get("sdg", [])}
                       | {l["target"]: engine.sdg_target(l["target"]) for r in ROLES for l in engine.sdg_links(r["id"])},
        "sources": {"ilo": ILO_META, "esco": ESCO_META, "sdg": SDG_META},
        "llm": llm.status(),
        "refresh": {"auto": config.AUTO_REFRESH, "running": _refresh_state["running"], "error": _refresh_state["error"]},
        # the team's own artwork wins when static/art/lamb.png exists; otherwise the SVG
        "art": {"lamb": "/static/art/lamb.png" if (ROOT / "static/art/lamb.png").exists() else "/static/art/lamb.svg"},
    }


@app.get("/api/snapshots/{snapshot_id}")
def snapshot(snapshot_id: int) -> dict:
    s = load_snapshot(snapshot_id)
    return {**snapshot_info(s), "signals": engine.signal_table(s)}


class WhatIfIn(Profile):
    role: str
    scenario: str = "moderate"
    snapshot_id: int | None = None


@app.post("/api/whatif")
def whatif(body: WhatIfIn) -> dict:
    """What it takes for a career to rise, and the best next skills per hour of study."""
    if body.role not in ROLE or body.scenario not in engine.SCENARIOS:
        raise HTTPException(400, "Unknown role or scenario")
    snap = load_snapshot(body.snapshot_id)
    return {**engine.what_it_takes(body.skills, body.interests, body.role, body.scenario, snap, body.budget),
            "next": engine.next_skills(body.skills, body.interests, body.role, body.scenario, snap, body.budget)}


class JobCheckIn(BaseModel):
    text: str = Field("", max_length=20000)
    url: str = Field("", max_length=600)
    skills: dict[str, int] = Field(default_factory=dict)
    budget: str = "free"
    use_model: bool = False


@app.post("/api/jobcheck")
def jobcheck_api(body: JobCheckIn) -> dict:
    """Compare one real job ad with the person's skills. The ad is not stored."""
    return jobcheck.job_check(body.text, body.url, body.skills, body.use_model, body.budget)


@app.get("/api/tasks/{isco}")
def tasks_api(isco: str) -> dict:
    """ILO task scores for one occupation, most exposed first, with the human skills each relies on."""
    res = jobcheck.task_xray(isco[:4])
    if not res:
        raise HTTPException(404, "No ILO task scores for this occupation")
    return res


class TaskTipIn(BaseModel):
    task: str = Field(..., max_length=400)
    band: str = Field("help", max_length=10)
    job: str = Field("", max_length=120)
    lang: str = "en"


@app.post("/api/tasks/tip")
def task_tip_api(body: TaskTipIn) -> dict:
    return jobcheck.task_tip(body.task, body.band, body.job, body.lang)


class TrackDraftIn(BaseModel):
    goal: str = Field(..., min_length=3, max_length=400)
    direction: str = Field("", max_length=300)
    change: str = Field("", max_length=300)
    previous: dict | None = None
    role: str | None = None
    country: str = ""
    hours: int | None = None
    budget: str = ""
    lang: str = "en"


@app.post("/api/tracks/draft")
def track_draft(body: TrackDraftIn) -> dict:
    """A custom action track from the person's own words (needs the AI model)."""
    context = {"career": ROLE[body.role]["title"] if body.role in ROLE else None,
               "country": COUNTRIES[body.country]["name"] if body.country in COUNTRIES else body.country or None,
               "hours_per_week": body.hours, "budget": body.budget or None}
    return assist.draft_track(body.goal, body.direction, body.change, body.previous, context, body.lang)


_news_cache: dict = {}
_news_lock = threading.Lock()


def latest_news() -> dict:
    """Headlines saved with the newest snapshot; fetched once a day here if that snapshot has none."""
    try:
        snap = load_snapshot(None)
        if snap.get("news"):
            return snap["news"]
    except HTTPException:
        pass
    today = date.today().isoformat()
    with _news_lock:
        if _news_cache.get("day") != today:
            from ingest.news import fetch_news
            try:
                _news_cache.update(day=today, data=fetch_news(), error=None)
            except Exception as e:  # no internet: an empty feed with the reason, retried next day
                _news_cache.update(day=today, data=None, error=str(e))
    if _news_cache.get("data"):
        return _news_cache["data"]
    return {"fetched_at": None, "days": 0, "source": None, "topics": [], "items": [], "error": _news_cache.get("error")}


@app.get("/api/news")
def news() -> dict:
    return latest_news()


class NewsSummaryIn(BaseModel):
    ids: list[str] = Field(default_factory=list, max_length=40)
    lang: str = "en"
    focus: str = Field("", max_length=120)
    use_model: bool = False


@app.post("/api/news/summary")
def news_summary(body: NewsSummaryIn) -> dict:
    feed = latest_news()
    by_id = {x["id"]: x for x in feed["items"]}
    items = [by_id[i] for i in body.ids if i in by_id] or feed["items"][:20]
    topics = {t["id"]: t["label"] for t in feed["topics"]}
    res = assist.summarise_news(items, topics, body.lang, body.focus, body.use_model)
    return {**res, "ids": [x["id"] for x in items]}


@app.get("/api/updates")
def updates() -> dict:
    """Today's check: what moved since the previous trend snapshot, and which new tools are rising."""
    snap = load_snapshot(None)
    prev = previous_of(snap)
    moved = []
    if prev:
        for cid in CLUSTER:
            a = prev["clusters"].get(cid, {}).get("demand_change")
            b = snap["clusters"].get(cid, {}).get("demand_change")
            if a is not None and b is not None and abs(b - a) >= 0.1:
                moved.append({"cluster": cid, "before": a, "after": b})
    moved.sort(key=lambda x: -abs(x["after"] - x["before"]))
    tech = [{"cluster": cid, **w} for cid in CLUSTER for w in engine.new_tech(cid, snap)]
    tech.sort(key=lambda x: -x["change"])
    return {"checked_on": date.today().isoformat(), "snapshot": snapshot_info(snap),
            "previous": snapshot_info(prev), "moved": moved[:8], "new_tech": tech[:8]}


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
    compare = previous_of(snap) if body.compare else None
    res = engine.analyze(body.skills, body.interests, snap, compare)
    local = COUNTRIES.get(body.country, COUNTRIES["OTHER"])
    return {"snapshot": snapshot_info(snap), "compare": snapshot_info(compare),
            "signals": engine.signal_table(snap), "local_demand": local["local_demand"],
            "local_demand_source": local["local_demand_source"], **res}


@app.post("/api/pathway")
def pathway(body: PathwayIn) -> dict:
    if body.role not in ROLE:
        raise HTTPException(404, "Unknown role")
    if body.scenario not in engine.SCENARIOS:
        raise HTTPException(400, "Unknown scenario")
    snap = load_snapshot(body.snapshot_id)
    p = engine.career_path(body.skills, body.role, body.hours, snap, previous_of(snap), body.scenario,
                           body.budget, body.country)
    return {**p, "sdg": engine.sdg_links(body.role), "snapshot": snapshot_info(snap)}


@app.post("/api/team")
def team(body: TeamIn) -> dict:
    if body.target_role not in ROLE:
        raise HTTPException(404, "Unknown role")
    people = [(name.strip()[:60] or f"Person {i}", skills) for i, (name, skills) in enumerate(body.people, 1)]
    snap = load_snapshot(body.snapshot_id)
    return {**engine.team_report(people, body.target_role, snap, body.budget), "snapshot": snapshot_info(snap)}


@app.post("/api/advice")
def get_advice(body: AdviceIn) -> dict:
    return advice.advice(engine.clean_skills(body.skills), body.country, body.age_band, body.situation,
                         body.budget, body.hours, body.role if body.role in ROLE else None, body.path_hours)


class InterviewQ(BaseModel):
    kind: str = Field(..., max_length=20)
    text: str = Field(..., max_length=300)
    params: dict[str, str] = {}
    skill: str | None = None


class InterviewIn(BaseModel):
    question: InterviewQ
    answer: str = Field(..., min_length=1, max_length=interview.MAX_ANSWER)
    lang: str = "en"
    use_model: bool = False


# ---------- mock interview (answers are checked, never stored) ------------------------------
@app.get("/api/interview")
def interview_questions(stage: int | None = None, authorization: str = Header("")) -> dict:
    return interview.questions(_auth(authorization)["data"], stage)


@app.post("/api/interview/feedback")
def interview_feedback(body: InterviewIn, authorization: str = Header("")) -> dict:
    _auth(authorization)
    return interview.feedback(body.question.model_dump(), body.answer, body.lang, body.use_model)


@app.post("/api/extract")
def extract(body: ExtractIn) -> dict:
    return assist.extract(body.text, body.use_model)


@app.post("/api/cv")
async def cv_import(file: UploadFile = File(...), use_model: bool = Form(False)) -> dict:
    data = await file.read(cv.MAX_BYTES + 1)
    try:
        return cv.parse(file.filename or "cv.txt", data, use_model)
    except ValueError as e:
        raise HTTPException(400, str(e)) from e


@app.post("/api/explain")
def explain(body: ExplainIn) -> dict:
    if body.role not in ROLE or body.scenario not in engine.SCENARIOS:
        raise HTTPException(400, "Unknown role or scenario")
    snap = load_snapshot(body.snapshot_id)
    res = engine.evaluate(ROLE[body.role], engine.clean_skills(body.skills), body.interests, body.scenario, snap)
    return assist.explain(res, body.scenario, snap, body.lang, body.use_model)


@app.post("/api/resume/section")
def resume_section(body: SectionIn) -> dict:
    """Draft one extra resume section from the person's own profile (needs the AI model)."""
    return assist.draft_section(body.kind, body.title, body.context)


@app.post("/api/resume/polish")
def resume_polish(body: PolishIn) -> dict:
    if body.role not in ROLE:
        raise HTTPException(400, "Unknown role")
    return assist.polish(body.summary, body.bullets, ROLE[body.role]["title"])


# ---------- admin -----------------------------------------------------------------------
_refresh_state = {"running": False, "last": None, "error": None, "step": None, "finished_at": None}
REFRESH_COOLDOWN_S = 15 * 60  # the public Update button fetches at most this often


_refresh_lock = threading.Lock()


def _run_refresh() -> None:
    """Fetch today's trend snapshot. Only one refresh runs at a time."""
    if not _refresh_lock.acquire(blocking=False):
        return
    from ingest import refresh
    _refresh_state.update(running=True, error=None, step="start")
    try:
        _refresh_state["last"] = refresh.run(date.today(), progress=lambda s: _refresh_state.update(step=s))
        _refresh_state["finished_at"] = time.time()
        _news_cache.clear()  # headlines now come with the new snapshot
    except Exception as e:  # keep the app running; the error shows on the Sources page
        _refresh_state["error"] = str(e)
    finally:
        _refresh_state.update(running=False, step=None)
        _refresh_lock.release()


def _refresh_status() -> dict:
    done = _refresh_state["finished_at"]
    snaps = db.list_snapshots(1)
    return {"running": _refresh_state["running"], "step": _refresh_state["step"], "error": _refresh_state["error"],
            "snapshot": snaps[0] if snaps else None,
            "cooldown": max(0, int(done + REFRESH_COOLDOWN_S - time.time())) if done else 0}


@app.get("/api/refresh")
def refresh_status() -> dict:
    return _refresh_status()


@app.post("/api/refresh")
def refresh_now() -> dict:
    """Fetch new job posts, research counts and headlines now, unless that happened in the last 15 minutes."""
    st = _refresh_status()
    if not st["running"] and not st["cooldown"]:
        threading.Thread(target=_run_refresh, daemon=True).start()
        st.update(running=True, step="start", started=True)
    return {**st, "started": st.get("started", False)}


def _daily_refresh() -> None:
    """Background job: at start-up and then every hour, fetch a snapshot if today's is missing.
    So the trend data updates once a day, and a failed fetch (e.g. no internet) is retried."""
    while True:
        snaps = db.list_snapshots(1)
        if not snaps or snaps[0]["as_of"] < date.today().isoformat():
            _run_refresh()
        time.sleep(3600)


@app.post("/api/admin/refresh")
def admin_refresh(authorization: str = Header("")) -> dict:
    if not config.ADMIN_TOKEN or authorization != f"Bearer {config.ADMIN_TOKEN}":
        raise HTTPException(401, "Admin token required")
    if _refresh_state["running"]:
        return {"started": False, "message": "A refresh is already running"}
    threading.Thread(target=_run_refresh, daemon=True).start()
    return {"started": True}


@app.get("/api/admin/refresh")
def admin_refresh_status() -> dict:
    return _refresh_state


# ---------- web app ----------------------------------------------------------------------
@app.middleware("http")
async def revalidate_pages(request, call_next):
    """Make browsers check for a newer page and script on every load, so an old cached
    page is never paired with a newer script after a redeploy."""
    response = await call_next(request)
    if not request.url.path.startswith("/api/"):
        response.headers["Cache-Control"] = "no-cache"
    return response


STATIC = ROOT / "static"
app.mount("/static", StaticFiles(directory=STATIC), name="static")


@app.get("/")
def index() -> FileResponse:
    return FileResponse(STATIC / "index.html")

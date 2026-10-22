"""Job-ad reality check and Task X-ray.

Job check: read a real job ad (pasted text, or a link we try to fetch), find the skills it asks for
with the same extraction as the CV reader, and compare them with the person's skills. Nothing is
stored; the ad text stays in this request.

Task X-ray: the ILO 2025 task list for an occupation, from most to least exposed to generative AI,
with the human skills each task relies on (rules in data/seed/task_skills.json).
"""
from __future__ import annotations

import html
import ipaddress
import re
import socket
from urllib.parse import urlparse

import httpx

from . import assist, engine, llm
from .data import CLUSTER, ILO, ROLES, _load

UA = {"User-Agent": "Mozilla/5.0 (compatible; workforce-futures/0.1; reads one job ad on request)"}
MAX_BYTES = 2_000_000
TASK_RULES = _load("task_skills.json")


# ---------- job check -----------------------------------------------------------------------
def _public_url(url: str) -> bool:
    """Only fetch public http(s) addresses, never this machine or a private network."""
    p = urlparse(url)
    if p.scheme not in ("http", "https") or not p.hostname:
        return False
    try:
        for info in socket.getaddrinfo(p.hostname, None):
            ip = ipaddress.ip_address(info[4][0])
            if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast:
                return False
    except (socket.gaierror, ValueError):
        return False
    return True


def page_text(url: str) -> tuple[str, str]:
    """The readable text of a job-ad page and its title, or ('', reason) when it cannot be read."""
    if not _public_url(url):
        return "", "That link can't be opened. Paste the ad text instead."
    try:
        with httpx.Client(timeout=10, headers=UA, follow_redirects=True, max_redirects=4) as c:
            with c.stream("GET", url) as r:
                if r.status_code != 200 or "html" not in r.headers.get("content-type", ""):
                    return "", "The job site didn't let us read that page. Paste the ad text instead."
                raw = b""
                for chunk in r.iter_bytes():
                    raw += chunk
                    if len(raw) > MAX_BYTES:
                        break
    except httpx.HTTPError:
        return "", "The job site didn't let us read that page. Paste the ad text instead."
    doc = raw.decode("utf-8", "ignore")
    title = html.unescape(re.sub(r"\s+", " ", (re.search(r"<title[^>]*>(.*?)</title>", doc, re.I | re.S) or [None, ""])[1])).strip()
    doc = re.sub(r"(?is)<(script|style|noscript|svg|nav|footer|header)[^>]*>.*?</\1>", " ", doc)
    text = html.unescape(re.sub(r"\s+", " ", re.sub(r"(?s)<[^>]+>", " ", doc))).strip()
    if len(text) < 300:
        return "", "The page had too little text (it may need a login or JavaScript). Paste the ad text instead."
    return text[:assist.MAX_TEXT], title[:120]


def job_check(text: str, url: str, skills: dict, use_llm: bool, budget: str = "free") -> dict:
    title = ""
    if not text.strip() and url.strip():
        text, title = page_text(url.strip())
        if not text:
            return {"ok": False, "need_text": True, "note": title}
    if len(text.strip()) < 80:
        return {"ok": False, "need_text": True, "note": "Paste the full ad: we need at least a few sentences."}
    if not title:
        first = next((l.strip() for l in text.splitlines() if len(l.strip()) >= 3), "")
        title = first if len(first) <= 100 else re.split(r"(?<=[.!?])\s|\s[-–|]\s", first)[0].rstrip(".")[:100]
    found = assist.extract(text, use_llm)
    have = engine.clean_skills(skills)
    asks = []
    for cid, f in found["skills"].items():
        need, own = f["level"], have.get(cid, 0)
        pick = None if own >= need else engine._pick(cid, need, engine.BUDGET_COSTS[budget if budget in engine.BUDGET_COSTS else "free"], set())
        asks.append({"cluster": cid, "need": need, "have": own, "evidence": f["evidence"],
                     "status": "have" if own >= need else "part" if own else "missing",
                     "hours": sum(i["hours"] for i in pick["items"]) or None if pick else None,
                     "course": pick["items"][0] if pick and pick["items"] else None})
    asks.sort(key=lambda a: ({"missing": 0, "part": 1, "have": 2}[a["status"]], -a["need"]))
    need_total = sum(a["need"] for a in asks)
    fit = round(sum(min(a["have"], a["need"]) for a in asks) / need_total * 100) if need_total else None
    ad = {a["cluster"] for a in asks}
    close = []
    for r in ROLES:  # careers in our list whose entry skills overlap most with this ad
        req = {i["cluster"] for i in r["req_list"]}
        if ad and req:
            j = len(ad & req) / len(ad | req)
            if j > 0:
                close.append({"role": r["id"], "overlap": round(j, 2)})
    close.sort(key=lambda x: -x["overlap"])
    return {"ok": True, "title": title, "asks": asks, "fit": fit, "close": close[:3],
            "method": found["method"], "model": found["model"], "note": found["note"],
            "hours": sum(a["hours"] or 0 for a in asks if a["status"] != "have")}


# ---------- task X-ray ------------------------------------------------------------------------
def _band(score: float) -> str:
    return next(b["id"] for b in TASK_RULES["bands"] if score >= b["min"])


def _human_skills(task: str) -> list[str]:
    low = task.lower()
    out: list[str] = []
    for rule in TASK_RULES["rules"]:
        if any(w in low for w in rule["words"]):
            out += [c for c in rule["clusters"] if c not in out and c in CLUSTER]
        if len(out) >= 2:
            break
    return out[:2]


def task_xray(isco: str) -> dict | None:
    o = ILO.get(isco)
    if not o:
        return None
    tasks = [{"task": t["task"].rstrip(";. "), "score": t["score"], "band": _band(t["score"]),
              "skills": _human_skills(t["task"])} for t in sorted(o["tasks"], key=lambda t: -t["score"])]
    counts = {b["id"]: sum(1 for t in tasks if t["band"] == b["id"]) for b in TASK_RULES["bands"]}
    return {"isco": isco, "title": o["title"], "mean": o["mean_2025"], "category": o["category"],
            "tasks": tasks, "counts": counts, "bands": TASK_RULES["bands"]}


TIP_SYSTEM = (
    "You give a worker one practical tip for a single task of their job, given how exposed the task is to "
    "generative AI. For exposed tasks, say how to use AI tools for the routine part and what the person should "
    "still check or own. For human tasks, say how to get better at the human part. Two sentences, plain words. "
    "No statistics, percentages, prices or product claims. Return JSON only."
)
TIP_SHAPE = '{"tip": "<two sentences>"}'


def task_tip(task: str, band: str, job: str, lang: str) -> dict:
    if not llm.status()["available"]:
        return {"ok": False, "note": "No AI model is connected, so tips cannot be written right now."}
    try:
        out = llm.run_json(f"Write in {assist.LANG.get(lang, 'English')}.\nJob: {job}\nTask: {task}\nExposure band: {band}",
                           TIP_SHAPE, TIP_SYSTEM)
    except llm.LLMError as e:
        return {"ok": False, "note": f"Model unavailable ({e})."}
    tip = re.sub(r"\s+", " ", str(out.get("tip", ""))).strip()[:400]
    if not tip or assist.STAT.search(tip):
        return {"ok": False, "note": "The tip stated figures or was empty, so it was not shown. Try again."}
    return {"ok": True, "tip": tip, "model": llm.status()["model"]}

"""Fetch fresh trend signals and store them as a dated snapshot.

    python -m ingest.refresh                     # signals as of today
    python -m ingest.refresh --as-of 2026-07-20  # rebuild a past snapshot (backfill)

On Replit this is the command of the Scheduled Deployment (e.g. weekly).

Sources (all public, no personal data):
  hn      Hacker News "Ask HN: Who is hiring?" monthly threads, via the Algolia HN API.
          Share of job posts mentioning each skill: last 3 threads vs the 3 before.
  arxiv   arXiv API. Papers on AI topics: last 90 days vs the 90 days before.
  adzuna  Optional. Live job-ad counts for one market (default Singapore as a labelled
          regional proxy) when ADZUNA_APP_ID / ADZUNA_APP_KEY are set. Change is measured
          against the previous snapshot.
"""
from __future__ import annotations

import argparse
import json
import re
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timedelta, timezone

import httpx

from app import config, db
from app.data import CLUSTERS

HN = "https://hn.algolia.com/api/v1"
ARXIV = "https://export.arxiv.org/api/query"
UA = {"User-Agent": "workforce-futures/0.1 (SDC hackathon prototype; trend counts only)"}
SHRINK = 30  # observations needed before a change counts at full strength


def shrunk_change(cur: float, prev: float, n: int) -> float:
    """Relative change, pulled toward 0 when the sample is small."""
    eps = 1e-4
    raw = (cur + eps) / (prev + eps) - 1
    raw = max(-0.6, min(0.6, raw))
    return raw * n / (n + SHRINK)


# ---------- Hacker News "Who is hiring" -----------------------------------
def hn_threads(client: httpx.Client, as_of: date, count: int = 6) -> list[dict]:
    r = client.get(f"{HN}/search_by_date", params={
        "tags": "story,author_whoishiring", "query": "who is hiring", "hitsPerPage": 40,
        "numericFilters": f"created_at_i<={int(datetime.combine(as_of, datetime.max.time(), timezone.utc).timestamp())}",
    })
    r.raise_for_status()
    threads = [h for h in r.json()["hits"] if h["title"].startswith("Ask HN: Who is hiring?")]
    return [{"id": h["objectID"], "title": h["title"], "date": h["created_at"][:10]} for h in threads[:count]]


def hn_count(client: httpx.Client, story_id: str, term: str | None) -> int:
    params = {"tags": f"comment,story_{story_id}", "hitsPerPage": 0, "typoTolerance": "false"}
    if term:
        params["query"] = term
    for attempt in range(4):
        try:
            r = client.get(f"{HN}/search", params=params)
            r.raise_for_status()
            return int(r.json()["nbHits"])
        except httpx.HTTPError:
            time.sleep(1 + attempt)
    raise RuntimeError(f"HN count failed for {term!r}")


def fetch_hn(client: httpx.Client, as_of: date) -> tuple[dict, dict]:
    threads = hn_threads(client, as_of)
    if len(threads) < 6:
        raise RuntimeError("Not enough 'Who is hiring' threads before this date")
    cur_t, prev_t = threads[:3], threads[3:6]
    jobs = [(t["id"], None) for t in threads]
    jobs += [(t["id"], term) for c in CLUSTERS for term in c["hn"] for t in threads]
    with ThreadPoolExecutor(max_workers=8) as pool:
        counts = dict(zip(jobs, pool.map(lambda j: hn_count(client, *j), jobs)))
    totals = {t["id"]: counts[(t["id"], None)] for t in threads}
    out = {}
    for c in CLUSTERS:
        if not c["hn"]:
            continue
        hits = {t["id"]: sum(counts[(t["id"], term)] for term in c["hn"]) for t in threads}
        cur_n = sum(hits[t["id"]] for t in cur_t)
        prev_n = sum(hits[t["id"]] for t in prev_t)
        cur_share = cur_n / max(1, sum(totals[t["id"]] for t in cur_t))
        prev_share = prev_n / max(1, sum(totals[t["id"]] for t in prev_t))
        out[c["id"]] = {"cur": cur_n, "prev": prev_n, "cur_share": round(cur_share, 4),
                        "prev_share": round(prev_share, 4),
                        "change": round(shrunk_change(cur_share, prev_share, cur_n + prev_n), 4)}
    meta = {"name": "Hacker News 'Who is hiring?' threads (global tech job posts)",
            "url": "https://news.ycombinator.com/submitted?id=whoishiring",
            "current_window": [t["title"] for t in cur_t],
            "previous_window": [t["title"] for t in prev_t],
            "posts_current": sum(totals[t["id"]] for t in cur_t),
            "posts_previous": sum(totals[t["id"]] for t in prev_t)}
    return out, meta


# ---------- arXiv ---------------------------------------------------------
def arxiv_count(client: httpx.Client, term: str, start: date, end: date) -> int:
    q = f'abs:"{term}" AND submittedDate:[{start:%Y%m%d}0000 TO {end:%Y%m%d}2359]'
    for attempt in range(4):
        time.sleep(3.1)  # arXiv API terms: at most one request every three seconds
        try:
            r = client.get(ARXIV, params={"search_query": q, "max_results": 1})
            r.raise_for_status()
            m = re.search(r"<opensearch:totalResults[^>]*>(\d+)<", r.text)
            if m:
                return int(m.group(1))
        except httpx.HTTPError:
            pass
        time.sleep(5 * (attempt + 1))
    raise RuntimeError(f"arXiv count failed for {term!r}")


def fetch_arxiv(client: httpx.Client, as_of: date) -> tuple[dict, dict]:
    cur_start, prev_start = as_of - timedelta(days=89), as_of - timedelta(days=179)
    prev_end = cur_start - timedelta(days=1)
    out = {}
    for c in CLUSTERS:
        if not c["arxiv"]:
            continue
        cur = arxiv_count(client, c["arxiv"], cur_start, as_of)
        prev = arxiv_count(client, c["arxiv"], prev_start, prev_end)
        out[c["id"]] = {"term": c["arxiv"], "cur": cur, "prev": prev,
                        "change": round(shrunk_change(cur, prev, cur + prev), 4)}
    meta = {"name": "arXiv API (paper abstracts)", "url": "https://arxiv.org",
            "current_window": [cur_start.isoformat(), as_of.isoformat()],
            "previous_window": [prev_start.isoformat(), prev_end.isoformat()]}
    return out, meta


# ---------- Adzuna (optional) --------------------------------------------
def fetch_adzuna(client: httpx.Client, previous: dict | None) -> tuple[dict, dict] | None:
    if not (config.ADZUNA_APP_ID and config.ADZUNA_APP_KEY):
        return None
    prev_counts = (previous or {}).get("adzuna", {}) if previous else {}
    out = {}
    for c in CLUSTERS:
        term = c["hn"][0] if c["hn"] else c["aliases"][0]
        r = client.get(f"https://api.adzuna.com/v1/api/jobs/{config.ADZUNA_COUNTRY}/search/1", params={
            "app_id": config.ADZUNA_APP_ID, "app_key": config.ADZUNA_APP_KEY,
            "what": term, "max_days_old": 30, "results_per_page": 1, "content-type": "application/json"})
        if r.status_code != 200:
            continue
        cur = int(r.json().get("count", 0))
        prev = prev_counts.get(c["id"], {}).get("cur")
        change = round(shrunk_change(cur, prev, cur + prev), 4) if prev is not None else None
        out[c["id"]] = {"term": term, "cur": cur, "prev": prev, "change": change}
        time.sleep(0.4)
    meta = {"name": f"Adzuna job ads, market '{config.ADZUNA_COUNTRY}' (regional proxy), last 30 days",
            "url": "https://developer.adzuna.com"}
    return out, meta


# ---------- combine -------------------------------------------------------
def combine(hn: dict, ax: dict, az: dict | None) -> dict:
    clusters = {}
    for c in CLUSTERS:
        parts, n = [], 0
        if c["id"] in hn:
            parts.append(hn[c["id"]]["change"])
            n += hn[c["id"]]["cur"] + hn[c["id"]]["prev"]
        if az and az.get(c["id"], {}).get("change") is not None:
            parts.append(az[c["id"]]["change"])
            n += az[c["id"]]["cur"]
        demand = round(sum(parts) / len(parts), 4) if parts else None
        research = ax[c["id"]]["change"] if c["id"] in ax else None
        clusters[c["id"]] = {"demand_change": demand, "research_change": research, "n": n}
    return clusters


def run(as_of: date) -> int:
    previous = None
    snaps = db.list_snapshots(1)
    if snaps:
        previous = db.get_snapshot(snaps[0]["id"])["payload"].get("raw")
    with httpx.Client(timeout=60, headers=UA) as client:
        print(f"Hacker News threads up to {as_of}…")
        hn, hn_meta = fetch_hn(client, as_of)
        print(f"arXiv windows ending {as_of}…")
        ax, ax_meta = fetch_arxiv(client, as_of)
        az_res = fetch_adzuna(client, previous) if as_of == date.today() else None
    az, az_meta = az_res if az_res else ({}, None)
    payload = {
        "as_of": as_of.isoformat(),
        "sources": {k: v for k, v in {"hn": hn_meta, "arxiv": ax_meta, "adzuna": az_meta}.items() if v},
        "clusters": combine(hn, ax, az or None),
        "raw": {"hn": hn, "arxiv": ax, "adzuna": az},
    }
    sid = db.save_snapshot(as_of.isoformat(), payload)
    print(f"Saved snapshot {sid} as of {as_of}")
    return sid


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--as-of", type=date.fromisoformat, default=date.today())
    args = ap.parse_args()
    run(args.as_of)


if __name__ == "__main__":
    main()

"""Job and work headlines from Hacker News (Algolia HN Search API, public, no key).

Only the headline, link, date, points, comment count and the article's own preview image
link (the og:image a site publishes for link previews) are kept; articles are never copied. Each headline is tagged with the topics whose words appear in its title, and each
topic lists the skill clusters it relates to, so the app can filter headlines by career.

    python -m ingest.news        # print today's headlines
"""
from __future__ import annotations

import re
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone

import httpx

HN = "https://hn.algolia.com/api/v1"
UA = {"User-Agent": "workforce-futures/0.1 (SDC hackathon prototype; headlines only)"}
DAYS = 45
SOURCE = {"name": "Hacker News via Algolia (headlines only)", "url": "https://hn.algolia.com/api"}

# id, label, search query, words that must appear in the title, related skill clusters
TOPICS = [
    ("work", "Jobs and hiring", "hiring", ["hiring", "jobs", "job market", "layoff", "labor market", "labour market", "workers", "unemployment", "recruit"], []),
    ("aiwork", "AI and work", "AI jobs", [" ai ", " ai's", " ai-", "a.i.", " llm", "chatgpt", "automat"], ["genai", "processmap"]),
    ("skills", "Skills and learning", "upskilling", ["upskill", "reskill", "skills", "bootcamp", "apprentice", "training", "learn"], ["coaching"]),
    ("remote", "Remote and flexible work", "remote work", ["remote work", "remote job", "work from home", "wfh", "hybrid work", "four-day", "4-day", "return to office", "rto"], ["stakeholder"]),
    ("data", "Data and analytics", "data scientist", ["data scien", "data analyst", "analytics", "sql", "data engineer"], ["mlds", "python", "sql", "dataviz", "dataquality", "excel"]),
    ("software", "Software and IT", "software engineers", ["software engineer", "developer", "programmer", "devops", "sysadmin", "it support", "help desk"], ["python", "networking", "helpdesk"]),
    ("security", "Cybersecurity", "cybersecurity jobs", ["cybersecurity", "security engineer", "infosec", "security team"], ["cyber"]),
    ("marketing", "Marketing and content", "marketing", ["marketing", "seo", "advertis", "copywrit", "content creator", "writers"], ["digimarketing", "content"]),
    ("design", "Design", "designers", ["designer", "design jobs", "figma"], ["design"]),
    ("office", "Office and admin work", "office workers", ["office", "assistant", "secretar", "clerical", "admin"], ["scheduling", "correspondence", "dataentry"]),
    ("finance", "Accounting and finance", "accountants", ["accountant", "accounting", "bookkeep", "finance jobs", "audit"], ["bookkeeping", "excel"]),
    ("service", "Customer service", "customer service", ["customer service", "customer support", "call center", "call centre"], ["customer", "languages"]),
    ("health", "Health care", "healthcare workers", ["healthcare", "health care", "nurse", "doctor", "hospital", "medical", "clinical"], ["clinical", "healthdata"]),
    ("biotech", "Biotech and labs", "biotech", ["biotech", "laborator", " lab ", "genom", "bioinformatic"], ["labwork", "bioinfo"]),
    ("farming", "Farming and food", "agriculture", ["agricultur", "farm", "crop", "agtech"], ["agronomy", "precisionag"]),
    ("industry", "Manufacturing and robots", "manufacturing", ["manufactur", "factory", "factories", "robot", "industrial"], ["automation", "quality", "electrical"]),
    ("energy", "Energy and climate", "renewable energy", ["solar", "renewable", "climate", "energy", "carbon", "emission", "sustainab"], ["solar", "esg", "ghg", "energyaudit", "electrical"]),
    ("leaders", "Managers and leadership", "managers", ["managers", "manager ", "leadership", "executives", "ceo"], ["leadership", "strategy"]),
]


# A headline must be about work, not only mention a topic word ("file manager", "remote GPU").
WORK = re.compile(r"\b(jobs?|hiring|hires?|hired|workers?|workforce|employees?|employment|unemploy\w*|employers?|careers?|"
                  r"layoffs?|lay off|laid off|labou?r|salar\w*|wages?|gig economy|recruit\w*|interns?|internships?|apprentice\w*|"
                  r"retention|staff\w*|skills?|upskill\w*|reskill\w*|trades|occupations?|professions?|engineers|nurses|doctors|"
                  r"teachers|accountants|designers|developers|managers|graduates|junior|resumes?|interview\w*|remote work|"
                  r"return to office|four-day week|4-day week|workplace|colleagues|boss)\b", re.I)
LAUNCH = re.compile(r"^(show|launch) hn\b", re.I)


# Extra searches; their hits are tagged by title like any other.
EXTRA = ["layoffs", "workers", "employees", "careers", "salary", "job market", "unemployment", "labor",
         "nurses", "teachers", "farmers", "factory workers", "gig workers", "interns"]


def _match(title: str, words: list[str]) -> bool:
    t = f" {title.lower()} "
    return any(w in t for w in words)


def _search(client: httpx.Client, query: str, since: int) -> list[dict]:
    for attempt in range(3):
        try:
            r = client.get(f"{HN}/search", params={
                "query": query, "tags": "story", "hitsPerPage": 50,
                "numericFilters": f"created_at_i>{since},points>=8"})
            r.raise_for_status()
            return r.json().get("hits", [])
        except httpx.HTTPError:
            time.sleep(1 + attempt)
    return []


META_IMG = re.compile(r"""<meta[^>]+(?:property|name)=["'](?:og:image(?::secure_url)?|twitter:image(?::src)?)["'][^>]*>""", re.I)
CONTENT = re.compile(r"""content=["']([^"']+)["']""", re.I)


def preview_image(client: httpx.Client, url: str) -> str | None:
    """The preview image a page declares for link previews, read from the first part of its HTML."""
    if not url.startswith("http") or "news.ycombinator.com" in url:
        return None
    try:
        with client.stream("GET", url, timeout=8, follow_redirects=True) as r:
            if r.status_code != 200 or "html" not in r.headers.get("content-type", ""):
                return None
            head = b""
            for chunk in r.iter_bytes():
                head += chunk
                if len(head) > 300_000 or b"</head>" in head.lower():
                    break
    except (httpx.HTTPError, ValueError):
        return None
    for tag in META_IMG.findall(head.decode("utf-8", "ignore")):
        m = CONTENT.search(tag)
        if m:
            img = str(httpx.URL(str(r.url)).join(m.group(1).replace("&amp;", "&")))
            return img if img.startswith("https://") else None
    return None


def fetch_news(client: httpx.Client | None = None, now: datetime | None = None) -> dict:
    """Headlines from the last DAYS days that match at least one topic, newest first."""
    now = now or datetime.now(timezone.utc)
    since = int(now.timestamp()) - DAYS * 86400
    own = client is None
    client = client or httpx.Client(timeout=30, headers=UA)
    try:
        return _collect(client, since, now)
    finally:
        if own:
            client.close()


def _collect(client: httpx.Client, since: int, now: datetime) -> dict:
    with ThreadPoolExecutor(max_workers=6) as pool:
        results = list(pool.map(lambda q: _search(client, q, since), [t[2] for t in TOPICS] + EXTRA))
    items: dict[str, dict] = {}
    for hits in results:
        for h in hits:
            title = re.sub(r"\s+", " ", h.get("title") or "").strip()
            if not title or h["objectID"] in items or LAUNCH.match(title) or not WORK.search(title):
                continue
            topics = [t[0] for t in TOPICS if _match(title, t[3])]
            if not topics:
                continue  # the search engine also matches links and text; keep only titles on topic
            hn_url = f"https://news.ycombinator.com/item?id={h['objectID']}"
            items[h["objectID"]] = {
                "id": h["objectID"], "title": title, "url": h.get("url") or hn_url, "hn_url": hn_url,
                "site": re.sub(r"^www\.", "", (re.match(r"https?://([^/]+)", h.get("url") or "") or [None, "news.ycombinator.com"])[1]),
                "date": h["created_at"][:10], "points": h.get("points") or 0, "comments": h.get("num_comments") or 0,
                "topics": topics,
                "clusters": sorted({c for t in TOPICS if t[0] in topics for c in t[4]}),
            }
    out = sorted(items.values(), key=lambda x: (x["date"], x["points"]), reverse=True)[:80]
    with ThreadPoolExecutor(max_workers=8) as pool:
        for x, img in zip(out, pool.map(lambda x: preview_image(client, x["url"]), out)):
            x["image"] = img
    return {"fetched_at": now.isoformat(timespec="seconds"), "days": DAYS, "source": SOURCE,
            "topics": [{"id": t[0], "label": t[1]} for t in TOPICS], "items": out}


if __name__ == "__main__":
    res = fetch_news()
    for x in res["items"][:30]:
        print(x["date"], x["points"], ",".join(x["topics"]), "|", x["title"])
    print(len(res["items"]), "headlines")

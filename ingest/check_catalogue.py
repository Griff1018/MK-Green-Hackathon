"""Check every learning-catalogue link and record the result in catalogue.json.

    python -m ingest.check_catalogue

A link that answers is marked link_status "ok" with today's date. This proves the page
exists, not that the course content, price or HRD Corp status is right; a person still
reviews those.
"""
from __future__ import annotations

import json
from datetime import date

import httpx

from app.config import SEED_DIR

PATH = SEED_DIR / "catalogue.json"
UA = {"User-Agent": "Mozilla/5.0 (compatible; workforce-futures link check)"}


def check(client: httpx.Client, url: str) -> str:
    try:
        r = client.get(url, follow_redirects=True)
        if r.status_code < 400:
            return "ok"
        # Some sites block automated requests but serve people normally.
        return "blocked" if r.status_code in (401, 403, 429) else f"http {r.status_code}"
    except httpx.HTTPError as e:
        return f"error: {type(e).__name__}"


def main() -> None:
    data = json.loads(PATH.read_text(encoding="utf-8"))
    today = date.today().isoformat()
    with httpx.Client(timeout=20, headers=UA) as client:
        for item in data["items"]:
            status = check(client, item["url"])
            item["link_status"] = status
            item["link_checked_on"] = today
            print(f"{status:>18}  {item['id']:<12} {item['url']}")
    PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()

"""What it takes, best next skills, job-ad check and Task X-ray."""
import json

import pytest

from app import engine, jobcheck
from app.config import SEED_DIR

SK = {"excel": 2, "customer": 2, "correspondence": 2, "scheduling": 2, "languages": 2}


@pytest.fixture(scope="module")
def snap():
    return json.loads((SEED_DIR / "snapshots_bootstrap.json").read_text(encoding="utf-8"))[-1]


def test_what_it_takes_learns_every_gap_and_never_loses_score(snap):
    w = engine.what_it_takes(SK, ["people"], "data_analyst", "moderate", snap)
    role = engine.ROLE["data_analyst"]
    gaps = {i["cluster"] for i in role["req_list"] if SK.get(i["cluster"], 0) < i["level"]}
    assert {s["cluster"] for s in w["steps"]} == gaps
    scores = [w["start"]["score"]] + [s["score"] for s in w["steps"]]
    assert scores == sorted(scores)  # each step adds or keeps fit
    assert w["end"]["rank"] <= w["start"]["rank"]
    if w["end"]["rank"] > 1:
        assert w["held_back"]["part"] in {"outlook", "transfer", "interest", "green", "exposure"}


def test_next_skills_sorted_by_points_per_hour(snap):
    out = engine.next_skills(SK, [], "data_analyst", "moderate", snap)
    ranked = [x["per_hour"] for x in out if x["per_hour"] is not None]
    assert ranked == sorted(ranked, reverse=True) and all(x["gain"] >= 0 for x in out)


def test_job_check_compares_ad_with_skills():
    ad = ("Junior Data Analyst\nWe need someone to write SQL queries, build dashboards in Power BI and "
          "clean data in Excel. Good stakeholder communication is required.")
    r = jobcheck.job_check(ad, "", {"excel": 2}, use_llm=False)
    by = {a["cluster"]: a for a in r["asks"]}
    assert r["ok"] and r["title"] == "Junior Data Analyst"
    assert by["excel"]["status"] == "have" and by["sql"]["status"] == "missing"
    assert r["close"][0]["role"] == "data_analyst"


def test_job_check_refuses_private_links_and_short_text():
    assert jobcheck.job_check("", "http://127.0.0.1:8000/admin", {}, False)["need_text"]
    assert jobcheck.job_check("too short", "", {}, False)["need_text"]


def test_task_xray_orders_tasks_and_bands():
    x = jobcheck.task_xray("4120")
    scores = [t["score"] for t in x["tasks"]]
    assert scores == sorted(scores, reverse=True)
    assert sum(x["counts"].values()) == len(x["tasks"])
    assert jobcheck.task_xray("0000") is None

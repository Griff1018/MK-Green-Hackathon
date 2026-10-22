"""Tests for the guardrails the Domain rules depend on.

Run with:  python -m pytest -q
"""
from __future__ import annotations

import json

import pytest

from app import assist, engine, llm
from app.config import SEED_DIR
from app.data import CATALOGUE, CLUSTER, ROLES, SAMPLES

SNAPS = json.loads((SEED_DIR / "snapshots_bootstrap.json").read_text(encoding="utf-8"))
OLD, NEW = SNAPS[0], SNAPS[-1]
PERSONA = SAMPLES["personas"][0]


def test_every_role_has_esco_ilo_and_sdg():
    for r in ROLES:
        assert r["esco"]["uri"].startswith("http://data.europa.eu/esco/occupation/")
        assert r["exposure"] is not None, r["id"]
        assert 0 <= r["exposure"]["mean"] <= 1
        assert r["sdg"], r["id"]


def test_scores_are_bounded_and_deterministic():
    a = engine.analyze(PERSONA["skills"], PERSONA["interests"], NEW)
    b = engine.analyze(PERSONA["skills"], PERSONA["interests"], NEW)
    assert a == b
    for rows in a["scenarios"].values():
        assert len(rows) == len(ROLES)
        assert all(0 <= x["score"] <= 100 for x in rows)
        assert [x["rank"] for x in rows] == list(range(1, len(ROLES) + 1))


def test_scenarios_change_rankings():
    a = engine.analyze(PERSONA["skills"], PERSONA["interests"], NEW)["scenarios"]
    orders = {s: [x["role"] for x in rows] for s, rows in a.items()}
    assert len({tuple(o) for o in orders.values()}) > 1


def test_more_skills_never_lower_skill_match():
    role = ROLES[0]
    base = engine.evaluate(role, {}, [], "moderate", NEW)["components"]["skill"]
    full = {i["cluster"]: 3 for i in role["req_list"]}
    assert engine.evaluate(role, full, [], "moderate", NEW)["components"]["skill"] == 1.0 > base


def test_diff_between_snapshots_runs():
    d = engine.diff(engine.clean_skills(PERSONA["skills"]), PERSONA["interests"], OLD, NEW, "moderate")
    for c in d:
        assert c["driver"] in CLUSTER


def test_career_path_uses_only_catalogue_items_and_real_stages():
    ids = {c["id"] for c in CATALOGUE}
    for r in ROLES:
        p = engine.career_path({}, r["id"], 5, NEW, OLD, budget="any")
        assert len(p["stages"]) == 3
        assert all(s["esco"]["uri"].startswith("http://data.europa.eu/esco/occupation/") for s in p["stages"])
        for s in p["stages"]:
            assert s["nodes"][-1]["type"] == "checkpoint"
            for n in s["nodes"]:
                if n["type"] == "skill":
                    assert all(i["id"] in ids for i in n["items"])
                    assert n["items"] or n["no_resource"] or n["covered_earlier"] or n["partial"] or n["budget_blocked"]
                if n["type"] == "cert":
                    assert n["item"]["id"] in ids


def test_free_budget_never_requires_paid_courses():
    for r in ROLES:
        p = engine.career_path({}, r["id"], 5, NEW, budget="free")
        for s in p["stages"]:
            for n in s["nodes"]:
                if n["type"] == "skill":
                    assert all(i["cost"] == "free" for i in n["items"])
                if n["type"] == "cert" and n["item"]["cost"] != "free":
                    assert n["optional"]


def test_sdg_links_do_not_change_default_rankings():
    assert engine.SCENARIOS["moderate"]["w"]["green"] == 0 and engine.SCENARIOS["fast"]["w"]["green"] == 0
    role = next(r for r in ROLES if r["green"])
    a = engine.evaluate(role, PERSONA["skills"], [], "moderate", NEW)["score"]
    b = engine.evaluate({**role, "green": False}, PERSONA["skills"], [], "moderate", NEW)["score"]
    assert a == b


def test_every_skill_has_an_sdg_target():
    from app.data import CLUSTERS, SDG_TARGETS
    for c in CLUSTERS:
        assert c["sdg"] and all(t in SDG_TARGETS for t in c["sdg"]), c["id"]


def test_cv_contact_details_are_removed_before_the_model():
    from app import cv
    text = "Siti Example\nsiti@example.com | +60 12-345 6789 | IC 900101-14-5678\nExperience\nClerk, Sample Sdn Bhd, 2010 - 2014\n- Filed invoices in Excel"
    contact = cv.find_contact(text)
    red = cv.redact(text, contact)
    assert contact["email"] == "siti@example.com" and "+60" in contact["phone"]
    for secret in ("siti@example.com", "345 6789", "900101-14-5678", "Siti Example"):
        assert secret not in red
    assert "2010 - 2014" in red
    exp = cv.heuristic(red)["experience"]
    assert exp[0]["organisation"] == "Sample Sdn Bhd" and exp[0]["highlights"] == ["Filed invoices in Excel"]


def test_unknown_skill_ids_are_ignored():
    assert engine.clean_skills({"excel": 2, "made_up": 3, "sql": 0}) == {"excel": 2}


def test_extraction_rejects_quotes_not_in_text(monkeypatch):
    monkeypatch.setattr(llm, "run_json", lambda *a, **k: {"skills": [
        {"id": "excel", "level": 2, "quote": "use Excel every day"},
        {"id": "cyber", "level": 3, "quote": "ten years of penetration testing"},  # not in the text
        {"id": "not_a_cluster", "level": 2, "quote": "use Excel"},
    ]})
    out = assist.extract("I use Excel every day for invoices.", use_llm=True)
    assert out["skills"]["excel"]["method"] == "llm"
    assert "cyber" not in out["skills"]
    assert "not_a_cluster" not in out["skills"]


def test_explanation_with_invented_numbers_is_rejected(monkeypatch):
    res = engine.evaluate(ROLES[0], PERSONA["skills"], [], "moderate", NEW)
    monkeypatch.setattr(llm, "run_json", lambda *a, **k: {"text": "This role pays RM 8,500 a month and is 97% safe."})
    out = assist.explain(res, "moderate", NEW, "en", use_llm=True)
    assert out["method"] == "template"
    assert "rejected" in out["note"]


def test_model_failure_falls_back(monkeypatch):
    def boom(*a, **k):
        raise llm.LLMError("offline")
    monkeypatch.setattr(llm, "run_json", boom)
    assert assist.extract("I answer customer calls.", use_llm=True)["method"] == "keywords"


@pytest.fixture(scope="module")
def client(tmp_path_factory):
    import os
    os.environ["DATABASE_URL"] = f"sqlite:///{tmp_path_factory.mktemp('db') / 'test.db'}"
    os.environ["TEST_ACCOUNTS"] = "tina:Tina,tom:Tom"
    import importlib
    from app import config, db
    importlib.reload(config)
    importlib.reload(db)
    from app import main
    importlib.reload(main)
    from fastapi.testclient import TestClient
    with TestClient(main.app) as c:
        yield c


def test_api_end_to_end(client):
    meta = client.get("/api/meta").json()
    assert len(meta["snapshots"]) >= 2
    a = client.post("/api/analyze", json={"skills": PERSONA["skills"], "interests": PERSONA["interests"],
                                          "compare": True}).json()
    assert set(a["scenarios"]) == set(engine.SCENARIOS) and "diff" in a
    top = a["scenarios"]["moderate"][0]["role"]
    p = client.post("/api/pathway", json={"skills": PERSONA["skills"], "role": top}).json()
    assert p["sdg"] and all(s["weeks"][0] <= s["weeks"][1] for s in p["stages"])
    assert client.post("/api/admin/refresh").status_code == 401


def test_age_and_situation_never_change_matches(client):
    base = {"skills": PERSONA["skills"], "interests": PERSONA["interests"], "country": "MY"}
    a = client.post("/api/analyze", json={**base, "age_band": "18-24", "situation": "student"}).json()
    b = client.post("/api/analyze", json={**base, "age_band": "55+", "situation": "employed"}).json()
    assert a["scenarios"] == b["scenarios"]


def test_cv_upload_endpoint(client):
    from app.config import ROOT
    data = (ROOT / "static" / "samples" / "sample-cv-hafiz.txt").read_bytes()
    r = client.post("/api/cv", files={"file": ("cv.txt", data, "text/plain")}, data={"use_model": "false"}).json()
    assert r["contact"]["email"] == "hafiz.sample@example.com"
    assert "electrical" in r["skills"]
    assert client.post("/api/cv", files={"file": ("cv.exe", b"x" * 50, "application/octet-stream")}).status_code == 400


def test_updates_and_advice(client):
    u = client.get("/api/updates").json()
    assert u["snapshot"]["as_of"] > u["previous"]["as_of"]
    adv = client.post("/api/advice", json={"skills": PERSONA["skills"], "country": "MY", "budget": "free",
                                           "situation": "switcher", "age_band": "45-54"}).json()
    assert adv["tips"] and adv["side_income"] and adv["funding"]


def test_pages_are_revalidated_but_api_is_not(client):
    assert client.get("/").headers.get("cache-control") == "no-cache"
    assert client.get("/static/app.js").headers.get("cache-control") == "no-cache"
    assert client.get("/api/health").headers.get("cache-control") is None


def test_tester_accounts_start_with_the_setup(client):
    accts = {a["id"]: a for a in client.get("/api/accounts").json()["accounts"]}
    assert accts["tina"]["kind"] == "tester" and not accts["tina"]["onboarded"]
    token = client.post("/api/accounts/tina/signin").json()["token"]
    me = client.get("/api/me", headers={"Authorization": f"Bearer {token}"}).json()
    assert me["data"]["onboarded"] is False and me["data"]["profile"]["skills"] == {}
    assert client.post("/api/accounts/nobody/signin").status_code == 404


def test_profile_saves_to_database_and_needs_a_session(client):
    assert client.get("/api/me").status_code == 401
    token = client.post("/api/accounts/tom/signin").json()["token"]
    h = {"Authorization": f"Bearer {token}"}
    data = client.get("/api/me", headers=h).json()["data"]
    data["onboarded"], data["role"] = True, "dba"
    assert client.put("/api/me", headers=h, json={"data": data}).status_code == 200
    other = client.post("/api/accounts/tom/signin").json()["token"]   # a second device sees the same profile
    assert client.get("/api/me", headers={"Authorization": f"Bearer {other}"}).json()["data"]["role"] == "dba"
    assert client.put("/api/me", headers=h, json={"data": {"x": "y" * 400_000}}).status_code == 413
    client.post("/api/signout", headers=h)
    assert client.get("/api/me", headers=h).status_code == 401


def test_sample_accounts_start_with_sample_data(client):
    r = client.post("/api/accounts/sample-meiling/signin").json()
    me = client.get("/api/me", headers={"Authorization": f"Bearer {r['token']}"}).json()
    assert me["kind"] == "sample" and me["data"]["profile"]["skills"]


def test_team_report_ranks_all_careers_and_orders_the_plan_by_shared_gaps():
    team = next(t for t in SAMPLES["teams"] if t["id"] == "hr")
    rep = engine.team_report(team["people"], team["target_role"], NEW, budget="free")
    ids = {c["id"] for c in CATALOGUE}
    assert rep["size"] == len(team["people"])
    for rows in rep["careers"].values():
        assert len(rows) == len(ROLES) and [x["rank"] for x in rows] == list(range(1, len(ROLES) + 1))
        assert all(x["min"] <= x["score"] <= x["max"] for x in rows)
    assert all(len(p["top"]) == 3 for p in rep["people"]["moderate"])
    steps = rep["plan"]["steps"]
    assert [s["n"] for s in steps] == sorted((s["n"] for s in steps), reverse=True)
    for s in steps:
        assert all(i["id"] in ids and i["cost"] == "free" for i in s["items"])

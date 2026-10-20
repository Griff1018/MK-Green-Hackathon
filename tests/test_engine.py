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


def test_pathway_uses_only_catalogue_items():
    ids = {c["id"] for c in CATALOGUE}
    for r in ROLES:
        p = engine.pathway({}, r["id"], 5, NEW)
        for s in p["steps"]:
            assert all(i["id"] in ids for i in s["items"])
            assert s["items"] or s["no_resource"] or s["covered_earlier"] or s["partial"]


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
                                          "compare_id": meta["snapshots"][1]["id"]}).json()
    assert set(a["scenarios"]) == set(engine.SCENARIOS) and "diff" in a
    top = a["scenarios"]["moderate"][0]["role"]
    p = client.post("/api/pathway", json={"skills": PERSONA["skills"], "role": top}).json()
    assert p["sdg"] and p["weeks"][0] <= p["weeks"][1]
    assert client.post("/api/admin/refresh").status_code == 401

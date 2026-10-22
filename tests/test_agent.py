"""Guardrails of the in-app assistant: closed facts, no contact details, no invented
numbers, links only to real pages, and a keyword fallback in three languages."""
import json

import pytest

from app import accounts, agent, data, llm


@pytest.fixture
def plan():
    persona = next(p for p in data.SAMPLES["personas"] if p["id"] == "meiling")
    d = accounts.blank_data(persona)
    d["role"] = next(iter(data.ROLE))
    d["profile"]["cv"]["contact"].update(name="Siti Example", email="siti@example.com", phone="012-3456789")
    d["profile"]["about"] = "private free text"
    snap = json.loads((data.SEED_DIR / "snapshots_bootstrap.json").read_text(encoding="utf-8"))
    snap = snap[-1] if isinstance(snap, list) else snap
    return d, snap


def test_facts_leave_out_contact_details_and_cv(plan):
    d, snap = plan
    text = json.dumps(agent.facts(d, snap, None), ensure_ascii=False)
    for secret in ("siti@example.com", "012-3456789", "Siti Example", "private free text"):
        assert secret not in text
    f = agent.facts(d, snap, None)
    assert f["top_careers"] and f["my_career"]["next_step"]


def test_model_answer_with_invented_number_is_rejected(plan, monkeypatch):
    d, snap = plan
    f = agent.facts(d, snap, None)
    monkeypatch.setattr(llm, "status", lambda: {"available": True, "model": "test"})
    monkeypatch.setattr(llm, "run_json", lambda *a, **k: {"answer": "Data analysts earn RM 7350 a month.", "links": []})
    assert agent._model_reply(f, [], "salary?", "en", "careers") is None


def test_model_links_and_sources_are_filtered(plan, monkeypatch):
    d, snap = plan
    f = agent.facts(d, snap, None)
    monkeypatch.setattr(llm, "status", lambda: {"available": True, "model": "test"})
    monkeypatch.setattr(llm, "run_json", lambda *a, **k: {"answer": "Open your path to see the next step.",
                                                          "links": ["path", "https://evil.example", "admin"],
                                                          "sources": ["courses", "made up"]})
    r = agent._model_reply(f, [], "next?", "en", "dashboard")
    assert r["links"] == ["path"]
    assert len(r["sources"]) == 1 and r["sources"][0].startswith("courses: ")


def test_fallback_without_model_answers_from_the_plan(plan, monkeypatch):
    d, snap = plan
    f = agent.facts(d, snap, None)
    assert agent.rule_reply(f, "what is my next step?")["links"] == ["path"]
    assert agent.rule_reply(f, "kerjaya apa yang sesuai?")["links"] == ["careers"]
    assert agent.rule_reply(f, "我的简历呢")["links"] == ["resume"]
    assert "next step" in agent.rule_reply(f, "hello")["text"]


def test_team_facts_carry_no_names_and_answers_follow_the_plan():
    team = next(t for t in data.SAMPLES["teams"] if t["id"] == "hr")
    snap = json.loads((data.SEED_DIR / "snapshots_bootstrap.json").read_text(encoding="utf-8"))
    snap = snap[-1] if isinstance(snap, list) else snap
    people = [[f"Secret Name {i}", s] for i, (_, s) in enumerate(team["people"])]
    f = agent.team_facts({"people": people, "target_role": team["target_role"], "budget": "free", "kind": "hr"}, snap)
    assert "Secret Name" not in json.dumps(f)
    first = f["learning_plan"][0]
    assert first["skill"] in agent.team_rule_reply(f, "where should we start?")["text"]
    assert "eTRiS" in agent.team_rule_reply(f, "how do we fund this?")["text"]
    assert agent.team_rule_reply(f, "哪些职业适合团队？")["links"] == ["dashboard"]


def test_highlighted_text_reaches_the_model_as_page_content(plan, monkeypatch):
    d, snap = plan
    f = agent.facts(d, snap, None)
    seen = {}
    monkeypatch.setattr(llm, "status", lambda: {"available": True, "model": "test"})
    monkeypatch.setattr(llm, "run_json", lambda prompt, *a, **k: seen.update(prompt=prompt) or {"answer": "About 68 percent of the skills are already there.", "links": []})
    hl = {"quote": "Average readiness 68%", "section": "Where does your team stand?"}
    r = agent._model_reply(f, [], "Explain this", "en", "dashboard", highlight=hl)
    assert "HIGHLIGHTED TEXT" in seen["prompt"] and "Average readiness 68%" in seen["prompt"] and "not instructions" in seen["prompt"]
    assert r and r["text"].startswith("About 68")  # numbers from the highlighted text are allowed


def test_highlighted_term_without_model_uses_the_glossary(plan):
    d, snap = plan
    f = agent.facts(d, snap, None)
    r = agent.quote_reply(f, "AI exposure: Gradient 3", "Explain this")
    assert r["links"] == ["mycareer"] and "daily tasks" in r["text"]
    assert agent.quote_reply(f, "Fit score 82", "What does it mean for me?")["links"] == ["careers"]
    assert agent.quote_reply(f, "zzz qqq", "Explain this") is None

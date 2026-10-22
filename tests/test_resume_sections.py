"""Drafted resume sections keep only entries backed by a quote from the person's profile."""
from app import assist, llm


def test_section_entries_need_evidence(monkeypatch):
    monkeypatch.setattr(llm, "status", lambda: {"available": True, "model": "test", "via": "test"})
    monkeypatch.setattr(llm, "run_json", lambda *a, **k: {"entries": [
        {"text": "Malay — native", "quote": "native Malay speaker"},
        {"text": "Won a national award", "quote": "national award winner"},  # not in the profile
        {"text": "Handled 500 calls a day", "quote": "handle customer calls"},  # number not in the profile
    ]})
    ctx = {"about": "I am a native Malay speaker and I handle customer calls in English."}
    r = assist.draft_section("languages", "Languages", ctx)
    assert r["ok"] and r["lines"] == ["Malay — native"] and "2 suggestion" in r["note"]


def test_section_without_support_is_refused(monkeypatch):
    monkeypatch.setattr(llm, "status", lambda: {"available": True, "model": "test", "via": "test"})
    monkeypatch.setattr(llm, "run_json", lambda *a, **k: {"entries": []})
    assert not assist.draft_section("awards", "Awards & activities", {"about": "I like reading."})["ok"]

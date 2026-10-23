"""Mock interview: questions come from the person's path, answers are checked by rules,
and model feedback may not add numbers the answer did not give."""
from app import accounts, data, interview, llm


def _person(role="data_analyst"):
    persona = next(p for p in data.SAMPLES["personas"] if p["id"] == "meiling")
    d = accounts.blank_data(persona)
    d["role"] = role
    return d


def test_questions_follow_the_path():
    r = interview.questions(_person())
    kinds = [q["kind"] for q in r["questions"]]
    assert r["job"] == "Data analyst" and len(r["questions"]) == 5
    assert kinds[0] == "intro" and "ai" in kinds and "skill" in kinds
    templates = {interview.Q_INTRO, interview.Q_SKILL, interview.Q_GAP, interview.Q_AI, interview.Q_CLOSE}
    assert all(q["text"] in templates for q in r["questions"])  # fixed templates, translated by the client
    assert interview.questions(_person(None))["questions"] == []


def test_checklist_rules():
    q = {"kind": "skill", "skill": "excel", "text": interview.Q_SKILL, "params": {"skill": "Spreadsheets"}}
    good = ("In my last job at a clinic I was asked to tidy the monthly stock report. I built an Excel sheet with a "
            "pivot table and checked every supplier code by hand first. The result was that the report took two hours "
            "instead of a full day, and my manager used it for every order after that.")
    c = interview.checks(q, good)
    assert c == {"example": True, "action": True, "result": True, "skill": True, "length": True}
    weak = interview.checks(q, "I am good at it.")
    assert not weak["example"] and not weak["length"] and weak["skill"] is False
    assert interview.checks({"kind": "intro", "skill": None}, good)["skill"] is None


def test_feedback_without_model_gives_tips():
    q = {"kind": "skill", "skill": "excel", "text": interview.Q_SKILL, "params": {"skill": "Spreadsheets"}}
    r = interview.feedback(q, "I am good at it.")
    assert r["method"] == "rules" and r["tips"] and r["score"] < r["of"]


def test_model_feedback_with_invented_numbers_is_dropped(monkeypatch):
    q = {"kind": "intro", "skill": None, "text": interview.Q_INTRO, "params": {"job": "data analyst"}}
    monkeypatch.setattr(llm, "status", lambda: {"available": True, "model": "test"})
    monkeypatch.setattr(llm, "run_json", lambda *a, **k: {"feedback": "Great, you saved 40 hours a month.", "better_start": "x"})
    r = interview.feedback(q, "I like working with data and I helped my team with reports.", use_model=True)
    assert r["method"] == "rules" and r["text"] is None
    monkeypatch.setattr(llm, "run_json", lambda *a, **k: {"feedback": "Nice start. Add one example.", "better_start": "I help my team with reports."})
    r = interview.feedback(q, "I like working with data and I helped my team with reports.", use_model=True)
    assert r["method"] == "llm" and r["better_start"]

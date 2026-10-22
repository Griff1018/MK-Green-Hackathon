"""Custom action tracks from the model are trimmed and checked before they are shown."""
import pytest

from app import assist


def _draft(**over):
    step = {"title": "Ask a freelancer for a chat", "why": "You learn how they find clients.", "how": ["Message two people."],
            "links": [{"label": "Upwork", "url": "https://www.upwork.com"}, {"label": "bad", "url": "javascript:alert(1)"}]}
    out = {"title": "Freelance on weekends", "about": "Start small.", "chapters": [
        {"title": "Explore", "steps": [step, dict(step, title="Pick one service")]},
        {"title": "First client", "steps": [step, dict(step, title="Send three offers")]}]}
    out.update(over)
    return out


def test_draft_is_trimmed_and_links_filtered():
    t = assist._check_track(_draft())
    assert len(t["chapters"]) == 2 and t["chapters"][0]["steps"][0]["id"] == "c0s0"
    assert [l["url"] for l in t["chapters"][0]["steps"][0]["links"]] == ["https://www.upwork.com"]


def test_figures_and_prices_are_rejected():
    bad = _draft(about="Freelancers earn RM 5000 a month.")
    with pytest.raises(assist.TrackRejected):
        assist._check_track(bad)
    with pytest.raises(assist.TrackRejected):
        assist._check_track(_draft(about="Demand grew 40% last year."))
    assert assist._check_track(_draft(about="Post 3 times a week."))  # plain counts are fine


def test_incomplete_draft_is_rejected():
    with pytest.raises(assist.TrackRejected):
        assist._check_track({"title": "x", "chapters": [{"title": "only one", "steps": []}]})

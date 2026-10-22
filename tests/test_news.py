"""Headline tagging and the headline summary (no network, no model)."""
from app import assist
from ingest import news


def test_titles_must_be_about_work():
    assert news.WORK.search("Netflix lays off 6%, about 1k jobs")
    assert not news.WORK.search("Tabernacle: a tree-style tab manager for Firefox")
    assert news.LAUNCH.match("Show HN: an AI bookmark manager")


def test_topics_link_to_known_clusters():
    from app.data import CLUSTER
    for _id, _label, _query, words, clusters in news.TOPICS:
        assert words and all(c in CLUSTER for c in clusters)


def test_summary_without_model_counts_topics():
    items = [{"title": "Nurses are quitting", "date": "2026-10-20", "topics": ["health", "work"]},
             {"title": "Call center jobs decline", "date": "2026-10-15", "topics": ["service", "work"]}]
    res = assist.summarise_news(items, {"work": "Jobs and hiring"}, "en", "", use_llm=False)
    assert res["method"] == "template"
    first = res["points"][0]
    assert first["topic"] == "work" and first["n"] == 2 and first["refs"] == [1, 2]

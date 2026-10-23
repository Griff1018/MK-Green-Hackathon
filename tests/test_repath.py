"""Other routes when a skill loses demand: swapping only the top job, and careers that need less of it."""
import json

import pytest

from app import data, engine
from app.config import SEED_DIR


@pytest.fixture
def snap():
    s = json.loads((SEED_DIR / "snapshots_bootstrap.json").read_text(encoding="utf-8"))
    return s[-1] if isinstance(s, list) else s


def test_alternatives_avoid_the_falling_skill(snap):
    skills = {"excel": 2, "correspondence": 2}
    a = engine.alternatives(skills, [], "env_scientist", "strategy", snap)
    assert a["peaks"] and a["label"] == data.CLUSTER["strategy"]["label"]
    for p in a["peaks"]:  # a swapped top job never asks for the skill the person is avoiding
        other, _, i = p["peak"].partition(":")
        stage = data.ROLE[other]["stages"][int(i)]
        assert all(r["cluster"] != "strategy" for r in stage["req_list"])
        assert other != "env_scientist"
    need = max(engine._needs(s, "strategy") for s in data.ROLE["env_scientist"]["stages"])
    assert all(c["needs"] < need and c["role"] != "env_scientist" for c in a["careers"])


def test_swapped_top_job_keeps_earlier_stages(snap):
    a = engine.alternatives({}, [], "env_scientist", "strategy", snap)
    peak = a["peaks"][0]["peak"]
    base = engine.career_path({}, "env_scientist", 5, snap)
    swapped = engine.career_path({}, "env_scientist", 5, snap, peak=peak)
    assert swapped["peak"] == peak and base["peak"] is None
    assert [s["title"] for s in swapped["stages"][:-1]] == [s["title"] for s in base["stages"][:-1]]
    assert swapped["stages"][-1]["title"] == a["peaks"][0]["title"]
    assert swapped["stages"][-1]["stage"] == base["stages"][-1]["stage"]  # still shown as the Peak stage


def test_bad_peak_values_are_ignored():
    for bad in ("nope:1", "env_scientist:1", "data_analyst:0", "data_analyst:9", "data_analyst", ""):
        assert engine.with_peak("env_scientist", bad) is data.ROLE["env_scientist"]

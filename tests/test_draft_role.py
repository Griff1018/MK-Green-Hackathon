"""Drafting a new career from ESCO data: offline, from occupations already bundled with the app."""
import json

from app import data
from ingest import draft_role
from ingest.build_seed import SEED


def _draft():
    occ = data.OCCUPATIONS
    return draft_role.draft(occ["data analyst"], [("Experienced", occ["data scientist"])], data.CLUSTERS,
                            data.CATALOGUE, data.ILO, json.loads((SEED / "sdg_targets.json").read_text(encoding="utf-8")),
                            title="Test analyst")


def test_draft_uses_known_ids_and_flags_review():
    d = _draft()
    role = d["role"]
    assert role["id"] == "test_analyst" and role["esco_title"] == "data analyst"
    assert set(role["req"]) <= set(data.CLUSTER) and all(1 <= v <= 3 for v in role["req"].values())
    assert role["req"]["genai"] >= 1  # every career includes working with AI tools
    assert role["ladder"][0]["esco_title"] == "data scientist"
    assert all(t in data.SDG_TARGETS for t, _ in role["sdg"])
    assert all("REVIEW" in reason for _, reason in role["sdg"])  # reasons are for a person to write
    assert d["family"] in json.loads((SEED / "tracks.json").read_text(encoding="utf-8"))["families"]
    assert set(d["occupations"]) == {"data analyst", "data scientist"}


def test_family_line_and_layout_are_kept():
    old = '{\n  "families": {\n    "tech": ["a", "b"],\n    "lab": []\n  }\n}\n'
    out = draft_role._add_to_family(old, "tech", "new")
    assert '"tech": ["a", "b", "new"]' in out and out.replace(', "new"', "") == old
    assert '"lab": ["new"]' in draft_role._add_to_family(old, "lab", "new")
    assert draft_role._dump_like(' {\n  "x": 1\n}\n', {"x": "é"}) == '{\n  "x": "\\u00e9"\n}\n'

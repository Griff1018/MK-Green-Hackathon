"""Action tracks: every career has a family, steps are complete, links are https."""
from app.data import ROLE, TRACKS


def test_every_career_in_one_family():
    seen = [r for roles in TRACKS["families"].values() for r in roles]
    assert sorted(seen) == sorted(ROLE) and len(seen) == len(set(seen))


def test_steps_are_complete():
    fams = set(TRACKS["families"])
    for t in TRACKS["tracks"]:
        ids = [s["id"] for c in t["chapters"] for s in c["steps"]]
        assert len(ids) == len(set(ids)), t["id"]
        for c in t["chapters"]:
            for s in c["steps"]:
                assert s["title"] and s["why"] and s["how"]
                assert set(s.get("examples", {})) <= fams
                for link in s.get("links", []):
                    assert link["url"].startswith("https://")
                    assert link.get("country") in (None, "MY", "SG") and link.get("family") in (None, *fams)

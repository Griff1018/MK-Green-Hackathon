"""Draft a new career path from any ESCO occupation, for a person to review before it goes live.

The 20 careers in data/seed/roles.json are curated: each needs a ladder, skills mapped to the
app's skill clusters, checked courses and SDG reasons. This script does the first draft of that
work from public data, and flags what a person still has to check.

    # 1. draft: looks the jobs up in ESCO, writes data/seed/drafts/<id>.json and prints a review list
    python -m ingest.draft_role "web developer" --next "ICT application developer" --peak "chief technology officer"

    # 2. open the draft, fix anything marked REVIEW (levels, tags, SDG reasons, gates), then add it:
    python -m ingest.draft_role --apply data/seed/drafts/web_developer.json

What it fills in automatically:
  * the ESCO occupation for each stage (live ESCO API), with its ISCO code and essential skills
  * the skill clusters those skills map to, with a first guess at the level needed
  * the ILO GenAI exposure of each stage (bundled ILO Working Paper 140 scores)
  * SDG targets from the clusters, with a draft reason to rewrite
  * which clusters have no course in the checked catalogue yet (the path would show "no course")

--apply adds the role to roles.json, its occupations to occupations.json and the role to its
family in tracks.json, then loads the app's
data layer in a fresh process, which checks every id, SDG target and course. Nothing is written
if a check fails.
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys

import httpx

from ingest.build_seed import ESCO_API, SEED, esco_occupation, get_json, map_to_clusters

DRAFTS = SEED / "drafts"
MAX_CLUSTERS = 8

# A first guess at the interest tags the career cards and filters use.
TAG_OF = {
    "excel": "data", "sql": "data", "dataviz": "data", "dataquality": "data", "mlds": "data", "dataentry": "organising",
    "python": "tech", "cyber": "tech", "networking": "tech", "helpdesk": "tech", "genai": "tech", "processmap": "tech",
    "bookkeeping": "organising", "scheduling": "organising", "correspondence": "organising",
    "customer": "people", "stakeholder": "people", "coaching": "people", "languages": "people", "leadership": "people",
    "digimarketing": "creative", "content": "creative", "design": "creative",
    "esg": "environment", "ghg": "environment", "fieldwork": "environment", "solar": "energy", "energyaudit": "energy",
    "electrical": "hands-on", "automation": "making", "quality": "making",
    "labwork": "science", "bioinfo": "science", "agronomy": "farming", "precisionag": "farming",
    "clinical": "health", "healthdata": "health",
}


# Each career belongs to one family in tracks.json, which decides its action tracks.
FAMILY_OF = {"tech": "tech", "data": "tech", "organising": "office", "people": "office", "creative": "marketing",
             "environment": "green", "energy": "green", "science": "lab", "health": "health", "farming": "farming",
             "making": "making", "hands-on": "making"}


def _id(title: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", title.lower()).strip("_")[:40]


def _load(name: str) -> dict:
    return json.loads((SEED / name).read_text(encoding="utf-8"))


def _dump_like(old: str, data: dict) -> str:
    """JSON in the same indent and file ending as the file it replaces, so a diff shows only what was added."""
    lines = old.splitlines()
    second = lines[1] if len(lines) > 1 else ""
    text = json.dumps(data, ensure_ascii=old.isascii(), indent=len(second) - len(second.lstrip(" ")) or 1)
    return text + "\n" if old.endswith("\n") else text


def _add_to_family(old: str, family: str, role_id: str) -> str:
    """tracks.json is laid out by hand, so the new id goes into its family's line rather than re-dumping the file."""
    pat = re.compile(r'("' + re.escape(family) + r'":\s*\[)([^\]]*)(\])')
    if not pat.search(old):
        raise SystemExit(f"Could not find the {family!r} family line in tracks.json.")
    return pat.sub(lambda m: f'{m[1]}{m[2].rstrip()}{", " if m[2].strip() else ""}"{role_id}"{m[3]}', old, count=1)


def levels(occ: dict, base: int = 1) -> dict[str, int]:
    """Clusters an occupation's essential skills point to, strongest first. More matching ESCO skills
    means the cluster is more central to the job: 3+ matches -> base+2, 2 -> base+1, 1 -> base."""
    hits = sorted(occ["clusters"].items(), key=lambda kv: (-len(kv[1]), kv[0]))[:MAX_CLUSTERS]
    return {cid: min(3, base + (2 if len(s) >= 3 else 1 if len(s) == 2 else 0)) for cid, s in hits}


def draft(entry: dict, ladder: list[tuple[str, dict]], clusters: list[dict], catalogue: list[dict],
          ilo: dict, sdg: dict, title: str | None = None) -> dict:
    """Build a roles.json entry from ESCO occupations already mapped to clusters. Pure: no network."""
    cl = {c["id"]: c for c in clusters}
    req = levels(entry)
    req.setdefault("genai", 1)  # every career here includes working with AI tools (ESCO predates GenAI)
    stages, review = [], []
    for stage, occ in ladder:
        add = {cid: min(3, lv + 1) for cid, lv in levels(occ).items()}
        stages.append({"stage": stage, "esco_title": occ["title"], "add": add,
                       "gates": [f"REVIEW: real work needed before becoming {occ['title']}"], "certs": []})
    tags = sorted({TAG_OF[c] for c in req if c in TAG_OF}, key=lambda t: -sum(TAG_OF.get(c) == t for c in req))[:2]
    targets = list(dict.fromkeys(t for c in req for t in cl[c].get("sdg", [])))[:2]
    sdg_list = [[t, f"REVIEW: uses {', '.join(cl[c]['label'].lower() for c in req if t in cl[c].get('sdg', []))} "
                    f"towards '{sdg['targets'][t]['title'][:90]}'"] for t in targets if t in sdg["targets"]]
    role = {"id": _id(title or entry["title"]), "title": title or entry["title"][0].upper() + entry["title"][1:],
            "esco_title": entry["title"], "tags": tags or ["REVIEW"], "green": any(cl[c]["kind"] == "green" for c in req),
            "req": req, "sdg": sdg_list, "ladder": stages}

    def exp(occ: dict) -> str:
        o = ilo.get(occ["isco"])
        return f"{o['mean_2025']:.2f} ({o['category']})" if o else "not scored by the ILO"

    all_req = set(req) | {c for s in stages for c in s["add"]}
    no_course = sorted(c for c in all_req if not any(i["covers"].get(c) for i in catalogue))
    review.append(f"Levels: guessed from how many ESCO essential skills match each cluster. Check them: {req}")
    if "genai" not in entry["clusters"]:
        review.append("Added 'Working with AI tools' at level 1, as for every career here; ESCO does not list it.")
    unmapped = [s for s in entry["essential"] if not any(s in v for v in entry["clusters"].values())]
    if unmapped:
        review.append(f"{len(unmapped)} of {len(entry['essential'])} ESCO essential skills match no cluster, e.g. "
                      + "; ".join(unmapped[:6]) + ". Add a cluster or its keywords if one is important.")
    review.append("Tags, the career title and every line marked REVIEW (SDG reasons, gates) need a person.")
    if no_course:
        review.append("No checked course covers: " + ", ".join(cl[c]["label"] for c in no_course)
                      + ". Add one to catalogue.json, or the path shows 'no course' for that step.")
    if not stages:
        review.append("Only one stage: pass --next and --peak to give the path a ladder.")
    family = next((FAMILY_OF[t] for t in tags if t in FAMILY_OF), "office")
    review.append(f"Family '{family}' (decides the action tracks) is a guess from the tags. Families: "
                  + ", ".join(sorted(set(FAMILY_OF.values()))) + ".")
    return {"role": role, "family": family, "occupations": {o["title"]: o for o in [entry] + [occ for _, occ in ladder]},
            "exposure": {o["title"]: exp(o) for o in [entry] + [occ for _, occ in ladder]}, "review": review}


def _find(client: httpx.Client, title: str, clusters: list[dict]) -> dict:
    occ = esco_occupation(client, title)
    if not occ:
        res = get_json(client, f"{ESCO_API}/search", {"text": title, "type": "occupation", "language": "en", "limit": 8})
        near = [h["title"] for h in res["_embedded"]["results"]]
        sys.exit(f"No ESCO occupation is called exactly {title!r}. Closest: " + "; ".join(near))
    occ["clusters"] = map_to_clusters(occ["essential"], clusters)
    return occ


def make(args: argparse.Namespace) -> None:
    clusters, catalogue = _load("clusters.json")["clusters"], _load("catalogue.json")["items"]
    ilo, sdg = _load("ilo_scores.json")["occupations"], _load("sdg_targets.json")
    with httpx.Client(timeout=60, headers={"User-Agent": "workforce-futures/0.1 (hackathon prototype)"}) as client:
        entry = _find(client, args.title, clusters)
        ladder = [(stage, _find(client, t, clusters)) for stage, t in (("Experienced", args.next), ("Peak", args.peak)) if t]
    d = draft(entry, ladder, clusters, catalogue, ilo, sdg, args.name)
    if d["role"]["id"] in {r["id"] for r in _load("roles.json")["roles"]}:
        sys.exit(f"A career with id {d['role']['id']!r} already exists. Pass --name to give the draft another title.")
    DRAFTS.mkdir(exist_ok=True)
    path = DRAFTS / f"{d['role']['id']}.json"
    path.write_text(json.dumps(d, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"Draft: {path}\n")
    for title, e in d["exposure"].items():
        print(f"  ILO GenAI exposure, {title}: {e}")
    print("\nReview before adding:")
    for line in d["review"]:
        print(f"  - {line}")
    print(f"\nThen: python -m ingest.draft_role --apply {path.relative_to(SEED.parent.parent).as_posix()}")


def apply(path: str) -> None:
    d = json.loads(open(path, encoding="utf-8").read())
    role = d["role"]
    left = [k for k, v in role.items() if "REVIEW" in json.dumps(v, ensure_ascii=False)]
    if left:
        sys.exit("Still marked REVIEW in: " + ", ".join(left) + ". Edit the draft first.")
    roles, occ, tracks = _load("roles.json"), _load("occupations.json"), _load("tracks.json")
    if d.get("family") not in tracks["families"]:
        sys.exit(f"Family {d.get('family')!r} is not one of: " + ", ".join(tracks["families"]))
    if role["id"] in {r["id"] for r in roles["roles"]}:
        sys.exit(f"{role['id']!r} is already in roles.json.")
    old = {n: (SEED / n).read_text(encoding="utf-8") for n in ("roles.json", "occupations.json", "tracks.json")}
    roles["roles"].append(role)
    for title, o in d["occupations"].items():  # never replace an occupation other careers already use
        occ["occupations"].setdefault(title, o)
    (SEED / "roles.json").write_text(_dump_like(old["roles.json"], roles), encoding="utf-8")
    (SEED / "occupations.json").write_text(_dump_like(old["occupations.json"], occ), encoding="utf-8")
    (SEED / "tracks.json").write_text(_add_to_family(old["tracks.json"], d["family"], role["id"]), encoding="utf-8")
    check = subprocess.run([sys.executable, "-c", f"from app.data import ROLE; ROLE[{role['id']!r}]"],
                           cwd=SEED.parent.parent, capture_output=True, text=True)
    if check.returncode:
        for n, text in old.items():
            (SEED / n).write_text(text, encoding="utf-8")
        sys.exit("The app rejected the new career, so nothing was changed:\n" + check.stderr.strip().splitlines()[-1])
    print(f"Added {role['title']!r} ({role['id']}). Restart the app to see it; run the tests to be sure.")


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    p.add_argument("title", nargs="?", help="ESCO occupation for the entry job, exactly as ESCO names it")
    p.add_argument("--next", help="ESCO occupation for the experienced stage")
    p.add_argument("--peak", help="ESCO occupation for the top stage")
    p.add_argument("--name", help="career title shown in the app (default: the ESCO title)")
    p.add_argument("--apply", metavar="DRAFT", help="add a reviewed draft to the seed data")
    a = p.parse_args()
    if a.apply:
        apply(a.apply)
    elif a.title:
        make(a)
    else:
        p.error("give an ESCO occupation title, or --apply DRAFT")


if __name__ == "__main__":
    main()

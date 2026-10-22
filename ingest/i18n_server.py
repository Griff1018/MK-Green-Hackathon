"""Collect the English texts the server sends to the browser, so the interface can
translate them: python -m ingest.i18n_server  (writes ingest/i18n_server.json).

Exact texts come from the seed data and settings. Texts the server builds with values
inside are listed as templates; {name} matches any value. Job titles, skill names,
course names and quoted UN or ILO text are not listed: they stay in English.
"""
from __future__ import annotations

import json
from pathlib import Path

from app import advice, data, engine

TEMPLATES = [
    # advice tips (app/advice.py)
    "Courses are chosen to fit your budget: {budget}. Paid certificates appear as optional upgrades, never as required steps.",
    "At {hours} hours a week, the full path takes about {weeks} weeks of study, plus the work experience each stage needs. Finish the first stage before planning the rest.",
    # path steps (app/engine.py)
    "Work as {a} {job} and use these skills on real tasks.",
    "Ready to apply for {job} roles.",
    # CV reading, skill finding, resume wording (app/cv.py, app/assist.py)
    "Read by {model} after removing contact details.",
    "Read by {model} after removing contact details. Removed {n} items the CV did not support.",
    "Model unavailable ({e}); read with section and keyword rules.",
    "{accepted} skills confirmed by the model; {rejected} suggestions rejected because they were not supported by your text.",
    "Model unavailable ({e}); used keyword matching only.",
    "Model text rejected (numbers not in the data: {numbers}); showing the standard explanation.",
    "Model unavailable ({e}); showing the standard explanation.",
    "Model unavailable ({e}); your text is unchanged.",
    # job check and task tips (app/jobcheck.py)
    "That link can't be opened. Paste the ad text instead.",
    "The job site didn't let us read that page. Paste the ad text instead.",
    "The page had too little text (it may need a login or JavaScript). Paste the ad text instead.",
    "Paste the full ad: we need at least a few sentences.",
    "No AI model is connected, so tips cannot be written right now.",
    "The tip stated figures or was empty, so it was not shown. Try again.",
    # resume sections (app/assist.py)
    "No AI model is connected, so sections cannot be drafted right now.",
    "Nothing in your profile supports this section yet. Add it in your own words.",
    "{n} suggestion(s) left out because your profile did not support them.",
    # custom action tracks (app/assist.py)
    "Model unavailable ({e}).",
    "The draft was incomplete. Please try again or reword your goal.",
    "The draft stated figures or prices, which we do not allow. Please try again or reword your goal.",
    "Wording improved. Check every line before you use it. {n} line(s) kept as written because the new wording changed the facts.",
    # assistant quick answers when the model is unavailable (app/agent.py)
    "Your next step is {step}, in the {stage} stage ({job}).",
    "Your next step is {step}, in the {stage} stage ({job}). A course that fits your budget: {course} by {provider}, about {hours} hours.",
    "Your best matches right now are {careers}. The numbers are fit scores out of 100, and they are estimates, not predictions.",
    "Your resume is {status}. It only lists skills and courses you have finished.",
    "unlocked for {job}",
    "locked until the {stage} stage is finished",
    "Your plan only picks courses within your budget ({budget}). Paid certificates show as optional. Help with costs is listed under Advice on the My career page.",
    # assistant quick answers for HR and career-centre users (app/agent.py)
    "Start with {skill}: {n} of {total} people need it for {role}.",
    "Start with {skill}: {n} of {total} people need it for {role}. A course that fits the budget: {course} by {provider}, about {hours} hours.",
    "For the group as a whole, the best matches are {careers}. These are average fit scores out of 100: estimates, not predictions.",
    "Course time per person ranges from {min} to {max} hours, about {avg} hours on average, plus practice at work.",
]
FIXED = [
    "Read with section and keyword rules.",
    "Your CV contains an IC number. It was removed and is not needed here.",
    "No language model connected; your text is unchanged.",
    "Wording improved. Check every line before you use it.",
    "With under 5 hours a week, study in short daily sessions and pick one course at a time.",
    "Employers hiring for entry roles look for proof you can do the work. Turn each course into a small project you can show, and list it on your resume.",
    "Apply for internships and graduate programmes while you study; they count as real experience.",
    "Start with free courses that build on skills you already have, so you can apply for jobs sooner.",
    "Ask your HR team whether a course can be claimed under your employer's HRD Corp levy.",
    "Look for a project at your current job that uses a new skill; it counts as experience.",
    "Your years of work are an asset. Lead your resume with the skills you already use well, then show the new skills you are adding.",
    "Early in a career, certificates and portfolio projects can stand in for years of experience.",
    "While you study, you could earn with skills you already have. Ideas are listed below; check any client or platform before you start.",
    "Age and situation only shape this advice. They never change your career matches.",
    "AI impact shows how much of a job's daily tasks AI tools can already do. High means the job will change more, not that it disappears.",
    "Every number comes from a named source: ESCO for careers and skills, the ILO for AI exposure, job posts for demand trends, and a checked course list.",
    "Use the language switch in the top bar. It changes the whole app and the AI explanations.",
    "I can help with your next step, courses, the careers that fit you, your resume, AI impact and where the data comes from. Try asking one of those.",
    "careers and skills", "AI exposure", "job demand trends", "UN goals", "courses", "HRD Corp",
    "The plan only uses courses that fit the budget you set. In Malaysia, to pay from the HRD Corp levy, get the grant approved in eTRiS before the training starts; approval is not retrospective, and you claim after the training.",
    "Each dot is a career placed by the group's average. Further left means AI can do less of the work; higher means more job posts want its skills. The ringed dot is your target; tap another dot to change it.",
    "AI exposure shows how much of a job's daily tasks AI tools can already do. High means the job will change more, not that it disappears.",
    "I can help you decide where to start, which careers suit the group, how long it takes, how to fund it, and how to read the map. Try asking one of those.",
]


def collect() -> list[str]:
    out: list[str] = FIXED + TEMPLATES
    for c in data.COUNTRIES.values():
        out += [c["name"]] + [b[1] for b in c["budgets"]] + [f[1] for f in c["funding"]] + [c["trend_note"]]
        out += sorted(set(c.get("local_demand", {}).values()))
        if c.get("local_demand_source"):
            out.append(c["local_demand_source"])
    out += list(advice.SITUATIONS.values())
    for v in engine.SCENARIOS.values():
        out += [v["label"], v["note"]]
    side = json.loads((Path(data.__file__).parent.parent / "data/seed/side_income.json").read_text(encoding="utf-8"))
    for ideas in side["ideas"].values():
        out += ideas
    out += list(side["caution"].values())
    for r in data.ROLES:
        out += sorted({s["stage"] for s in r["stages"]})
        for s in r["stages"]:
            out += s["gates"]
        out += [link["why"] for link in engine.sdg_links(r["id"])]
    out += sorted({str(i.get("cost")) for i in data.CATALOGUE if i.get("cost")})
    out += sorted({str(i.get("hrdc")) for i in data.CATALOGUE if i.get("hrdc")})
    out += sorted({i["price"]["text"] for i in data.CATALOGUE if i.get("price")})  # checked course prices
    for t in data.TRACKS["tracks"]:  # action tracks on the Path page
        out += [t["title"], t["about"]]
        for c in t["chapters"]:
            out.append(c["title"])
            for st in c["steps"]:
                out += [st["title"], st["why"], *st["how"], *st.get("examples", {}).values(), *(link["label"] for link in st.get("links", []))]
    for t in data.SAMPLES.get("teams", []):
        out += [t["who"], t["label"], t["desc"]]
    seen: list[str] = []
    for s in out:
        if s and s not in seen:
            seen.append(s)
    return seen


if __name__ == "__main__":
    dest = Path(__file__).with_name("i18n_server.json")
    dest.write_text(json.dumps(collect(), ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"wrote {dest}")

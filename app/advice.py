"""Plain-language advice shaped by the person's situation, budget and country.

Age band and situation are used only here, to suggest cheaper or faster ways to learn
and earn. They are never inputs to role matching or scores.
"""
from __future__ import annotations

import math

from .data import CLUSTER, COUNTRIES, ROLE, SIDE_INCOME

AGE_BANDS = ["18-24", "25-34", "35-44", "45-54", "55+"]
SITUATIONS = {
    "student": "Student",
    "graduate": "Fresh graduate looking for work",
    "employed": "Employed, planning a move",
    "between": "Between jobs",
    "switcher": "Changing career on a tight budget",
    "returning": "Returning to work after a break",
    # planning for others: these open the team flow instead of a personal plan
    "hr": "HR or L&D manager planning for a team",
    "tvet": "TVET or university career centre advising students",
}
TEAM = {"hr", "tvet"}
TIGHT = {"student", "graduate", "between", "switcher", "returning"}


def advice(skills: dict, country: str, age_band: str | None, situation: str | None, budget: str,
           hours: int, role_id: str | None = None, path_hours: int | None = None) -> dict:
    c = COUNTRIES.get(country, COUNTRIES["OTHER"])
    budgets = dict(c["budgets"])
    tight = situation in TIGHT or budget == "free"
    tips: list[str] = []

    tips.append(f"Courses are chosen to fit your budget: {budgets.get(budget, budgets['free']).lower()}. "
                "Paid certificates appear as optional upgrades, never as required steps.")
    if path_hours:
        weeks = math.ceil(path_hours / max(1, hours))
        tips.append(f"At {hours} hours a week, the full path takes about {weeks} weeks of study, "
                    "plus the work experience each stage needs. Finish the first stage before planning the rest.")
    if hours < 5:
        tips.append("With under 5 hours a week, study in short daily sessions and pick one course at a time.")
    if situation in ("student", "graduate"):
        tips.append("Employers hiring for entry roles look for proof you can do the work. Turn each course into a "
                    "small project you can show, and list it on your resume.")
        tips.append("Apply for internships and graduate programmes while you study; they count as real experience.")
    if situation in ("between", "switcher", "returning"):
        tips.append("Start with free courses that build on skills you already have, so you can apply for jobs sooner.")
    if situation == "employed":
        if country == "MY":
            tips.append("Ask your HR team whether a course can be claimed under your employer's HRD Corp levy.")
        tips.append("Look for a project at your current job that uses a new skill; it counts as experience.")
    if age_band in ("45-54", "55+"):
        tips.append("Your years of work are an asset. Lead your resume with the skills you already use well, "
                    "then show the new skills you are adding.")
    if age_band == "18-24":
        tips.append("Early in a career, certificates and portfolio projects can stand in for years of experience.")

    side = []
    if tight:
        for cid, lvl in sorted(skills.items(), key=lambda x: -x[1]):
            if lvl >= 2 and cid in SIDE_INCOME["ideas"]:
                for idea in SIDE_INCOME["ideas"][cid]:
                    side.append({"skill": CLUSTER[cid]["label"], "idea": idea,
                                 "caution": SIDE_INCOME["caution"].get(cid)})
        if side:
            tips.append("While you study, you could earn with skills you already have. Ideas are listed below; "
                        "check any client or platform before you start.")
    role = ROLE.get(role_id) if role_id else None
    return {
        "tips": tips,
        "side_income": side[:6],
        "funding": [{"name": n, "text": t, "url": u} for n, t, u in c["funding"]],
        "job_search": [{"name": n, "url": u} for n, u in c["job_search"]],
        "role_title": role["title"] if role else None,
        "trend_note": c["trend_note"],
        "fairness_note": "Age and situation only shape this advice. They never change your career matches.",
    }

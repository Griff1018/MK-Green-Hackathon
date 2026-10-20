"""User accounts stored in the database.

Two kinds of account:
  tester  real people testing the app. New testers start with an empty profile, so the
          app shows the "About you" setup first.
  sample  the synthetic sample people, shared by everyone for demos.

Sign-in has no password or PIN (prototype). It returns a random session token; only a
SHA-256 hash of the token is kept.
"""
from __future__ import annotations

import hashlib
import json
import secrets
from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, insert, select, update

from . import config, db
from .data import SAMPLES

SESSION_DAYS = 30
MAX_DATA_BYTES = 300_000
PERSONA_EXTRA = {"meiling": {"age_band": "45-54", "situation": "employed"},
                 "aisha": {"age_band": "18-24", "situation": "student"},
                 "hafiz": {"age_band": "18-24", "situation": "student"}}


class AuthError(Exception):
    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status = status


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _iso(t: datetime) -> str:
    return t.isoformat(timespec="seconds")


def blank_data(persona: dict | None = None) -> dict:
    profile = {"skills": {}, "pathSkills": {}, "evidence": {}, "interests": [], "hours": 5, "country": "MY",
               "budget": "free", "age_band": "", "situation": "", "current": None, "about": "", "useModel": False,
               "cv": {"contact": {"name": "", "email": "", "phone": "", "location": ""}, "headline": "", "summary": "",
                      "experience": [], "education": [], "certifications": [], "languages": []}}
    if persona:
        profile.update({"skills": dict(persona["skills"]), "interests": list(persona["interests"]),
                        "hours": persona["hours"], "budget": "low" if persona["budget"] == "low-cost" else "free",
                        "about": persona["about"], **PERSONA_EXTRA.get(persona["id"], {})})
    return {"onboarded": False, "prefs": {"mode": "simple", "lang": "en"}, "profile": profile,
            "progress": {}, "role": None, "seen": None}


def ensure_accounts() -> None:
    """Create sample and tester accounts that do not exist yet. Existing ones are never overwritten."""
    db.init()
    wanted = [(f"sample-{p['id']}", p["name"].split(",")[0], "sample", blank_data(p)) for p in SAMPLES["personas"]]
    wanted += [(uid, name, "tester", blank_data()) for uid, name in config.TEST_ACCOUNTS]
    now = _iso(_now())
    with db.engine.begin() as conn:
        have = {r[0] for r in conn.execute(select(db.users.c.id))}
        for uid, name, kind, data in wanted:
            if uid not in have:
                conn.execute(insert(db.users).values(id=uid, name=name, kind=kind, data=json.dumps(data),
                                                     created_at=now, updated_at=now))


def list_accounts() -> list[dict]:
    with db.engine.connect() as conn:
        rows = conn.execute(select(db.users.c.id, db.users.c.name, db.users.c.kind, db.users.c.data)
                            .order_by(db.users.c.kind.desc(), db.users.c.name)).all()
    return [{"id": r.id, "name": r.name, "kind": r.kind, "onboarded": bool(json.loads(r.data).get("onboarded"))}
            for r in rows]


def _new_session(conn, uid: str) -> str:
    token = secrets.token_urlsafe(32)
    conn.execute(insert(db.sessions).values(token_hash=hashlib.sha256(token.encode()).hexdigest(), user_id=uid,
                                            expires_at=_iso(_now() + timedelta(days=SESSION_DAYS))))
    return token


def sign_in(uid: str) -> dict:
    with db.engine.begin() as conn:
        if not conn.execute(select(db.users.c.id).where(db.users.c.id == uid)).first():
            raise AuthError(404, "Account not found")
        return {"token": _new_session(conn, uid)}


def user_for(token: str | None) -> dict:
    if not token:
        raise AuthError(401, "Please sign in")
    th = hashlib.sha256(token.encode()).hexdigest()
    with db.engine.connect() as conn:
        s = conn.execute(select(db.sessions).where(db.sessions.c.token_hash == th)).first()
        if not s or s.expires_at < _iso(_now()):
            raise AuthError(401, "Your session has ended. Please sign in again.")
        u = conn.execute(select(db.users).where(db.users.c.id == s.user_id)).first()
    if not u:
        raise AuthError(401, "Account not found")
    return {"id": u.id, "name": u.name, "kind": u.kind, "data": json.loads(u.data), "updated_at": u.updated_at}


def save_data(uid: str, data: dict) -> str:
    raw = json.dumps(data, ensure_ascii=False)
    if len(raw.encode()) > MAX_DATA_BYTES:
        raise AuthError(413, "Profile is too large to save")
    now = _iso(_now())
    with db.engine.begin() as conn:
        conn.execute(update(db.users).where(db.users.c.id == uid).values(data=raw, updated_at=now))
    return now


def reset_data(uid: str) -> dict:
    with db.engine.connect() as conn:
        u = conn.execute(select(db.users.c.kind).where(db.users.c.id == uid)).first()
    persona = None
    if u and u.kind == "sample":
        persona = next((p for p in SAMPLES["personas"] if f"sample-{p['id']}" == uid), None)
    data = blank_data(persona)
    save_data(uid, data)
    return data


def sign_out(token: str | None) -> None:
    if not token:
        return
    with db.engine.begin() as conn:
        conn.execute(delete(db.sessions).where(db.sessions.c.token_hash == hashlib.sha256(token.encode()).hexdigest()))

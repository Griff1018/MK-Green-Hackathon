"""Trend snapshots and user accounts live in a database so they survive redeploys.

Locally this is SQLite (data/app.db). On Replit, add a PostgreSQL database and
DATABASE_URL is set automatically; nothing else changes.
"""
from __future__ import annotations

import json
from datetime import datetime, timezone

from sqlalchemy import Column, Integer, MetaData, String, Table, Text, create_engine, desc, insert, select

from . import config

_url = config.DATABASE_URL
if _url.startswith("postgres://"):  # some hosts still hand out the old scheme
    _url = "postgresql://" + _url[len("postgres://"):]
if _url.startswith("postgresql://"):
    _url = "postgresql+psycopg://" + _url[len("postgresql://"):]
if _url.startswith("sqlite:///"):
    (config.ROOT / "data").mkdir(exist_ok=True)

engine = create_engine(_url, pool_pre_ping=True, future=True)
meta = MetaData()

snapshots = Table(
    "snapshots", meta,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("as_of", String(10), nullable=False, index=True),
    Column("created_at", String(32), nullable=False),
    Column("payload", Text, nullable=False),
)

users = Table(
    "users", meta,
    Column("id", String(40), primary_key=True),
    Column("name", String(80), nullable=False),
    Column("kind", String(10), nullable=False),          # "tester", "sample" or "fresh" (the New account)
    Column("data", Text, nullable=False),                 # profile, progress and settings (JSON)
    Column("created_at", String(32), nullable=False),
    Column("updated_at", String(32), nullable=False),
)

sessions = Table(
    "sessions", meta,
    Column("token_hash", String(64), primary_key=True),   # only a hash of the token is stored
    Column("user_id", String(40), nullable=False, index=True),
    Column("expires_at", String(32), nullable=False),
)


def init() -> None:
    meta.create_all(engine)


def save_snapshot(as_of: str, payload: dict) -> int:
    init()
    with engine.begin() as conn:
        res = conn.execute(insert(snapshots).values(
            as_of=as_of,
            created_at=datetime.now(timezone.utc).isoformat(timespec="seconds"),
            payload=json.dumps(payload, ensure_ascii=False),
        ))
        return int(res.inserted_primary_key[0])


def list_snapshots(limit: int = 20) -> list[dict]:
    init()
    with engine.connect() as conn:
        rows = conn.execute(
            select(snapshots.c.id, snapshots.c.as_of, snapshots.c.created_at)
            .order_by(desc(snapshots.c.as_of), desc(snapshots.c.id)).limit(limit)
        ).all()
    return [dict(r._mapping) for r in rows]


def get_snapshot(snapshot_id: int) -> dict | None:
    init()
    with engine.connect() as conn:
        row = conn.execute(select(snapshots).where(snapshots.c.id == snapshot_id)).first()
    if not row:
        return None
    d = dict(row._mapping)
    d["payload"] = json.loads(d["payload"])
    return d

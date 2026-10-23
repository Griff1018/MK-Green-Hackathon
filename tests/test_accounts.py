"""The shared "New account" starts from an empty profile on every sign-in and sign-out."""
import pytest
from sqlalchemy import create_engine

from app import accounts, agent, db


@pytest.fixture
def fresh_db(tmp_path, monkeypatch):
    monkeypatch.setattr(db, "engine", create_engine(f"sqlite:///{(tmp_path / 'test.db').as_posix()}", future=True))
    accounts.ensure_accounts(); agent.init()


def _use_it(uid):
    token = accounts.sign_in(uid)["token"]
    u = accounts.user_for(token)
    data = u["data"] | {"onboarded": True, "role": "some-role"}
    data["profile"]["skills"] = {"data": 3}
    accounts.save_data(uid, data)
    agent._store(uid, [{"role": "user", "text": "hello"}])
    return token


def test_new_account_is_listed_and_starts_empty(fresh_db):
    new = next(a for a in accounts.list_accounts() if a["kind"] == "fresh")
    assert new["id"] == accounts.FRESH_ID and not new["onboarded"]


def test_new_account_resets_on_sign_out(fresh_db):
    token = _use_it(accounts.FRESH_ID)
    accounts.sign_out(token)
    data = accounts.user_for(accounts.sign_in(accounts.FRESH_ID)["token"])["data"]
    assert not data["onboarded"] and data["role"] is None and data["profile"]["skills"] == {}
    assert agent.history(accounts.FRESH_ID) == []


def test_new_account_resets_on_sign_in_even_without_sign_out(fresh_db):
    old = _use_it(accounts.FRESH_ID)
    accounts.sign_in(accounts.FRESH_ID)
    with pytest.raises(accounts.AuthError):  # the earlier visit's session is ended
        accounts.user_for(old)


def test_other_accounts_keep_their_data_on_sign_out(fresh_db):
    token = _use_it("sample-meiling")
    accounts.sign_out(token)
    data = accounts.user_for(accounts.sign_in("sample-meiling")["token"])["data"]
    assert data["onboarded"] and data["role"] == "some-role"

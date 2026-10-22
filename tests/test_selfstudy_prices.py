"""Every skill has free self-study links; every shown price has a source and a check date."""
from app.data import CATALOGUE, CLUSTER, SELFSTUDY


def test_every_skill_has_selfstudy():
    res = SELFSTUDY["resources"]
    assert set(res) == set(CLUSTER)
    for cid, items in res.items():
        assert items, cid
        assert all(i["url"].startswith("https://") and i["title"] and i["provider"] for i in items)


def test_prices_are_sourced():
    priced = [c for c in CATALOGUE if c.get("price")]
    assert priced
    for c in priced:
        p = c["price"]
        assert c["cost"] != "free" and p["currency"] == "USD" and p["amount"] > 0
        assert p["source"].startswith("https://") and p["checked_on"] and p["per"] in {"exam", "month"}

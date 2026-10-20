"""Manage accounts from the command line (team use only).

    python -m ingest.manage_accounts list
    python -m ingest.manage_accounts reset-profile chew   # back to a blank profile and the setup
"""
from __future__ import annotations

import sys

from app import accounts


def main(argv: list[str]) -> None:
    accounts.ensure_accounts()
    if not argv or argv[0] == "list":
        for a in accounts.list_accounts():
            print(f"{a['id']:<16} {a['name']:<18} {a['kind']:<7} setup={'done' if a['onboarded'] else 'not done'}")
        return
    cmd, uid = argv[0], argv[1]
    if cmd == "reset-profile":
        accounts.reset_data(uid)
        print(f"Profile reset for {uid}. They will see the setup again.")
    else:
        print(__doc__)


if __name__ == "__main__":
    main(sys.argv[1:])

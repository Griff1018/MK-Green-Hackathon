"""Report interface text that has no Bahasa Melayu or Chinese translation yet, and
translations whose {placeholders} do not match the English.

    python -m ingest.i18n_server      # refresh the list of server texts first
    python -m ingest.check_i18n

Untranslated text still works: the app falls back to English.
"""
from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def main() -> int:
    out = subprocess.run(["node", str(ROOT / "ingest/i18n_keys.js")], capture_output=True, text=True,
                         encoding="utf-8", check=True).stdout
    keys = json.loads(out)
    ph = lambda s: set(re.findall(r"\{\w+\}", s))  # noqa: E731
    problems = 0
    for lang in ("ms", "zh"):
        tr = json.loads((ROOT / f"static/i18n/{lang}.json").read_text(encoding="utf-8"))
        missing = [k for k in keys if k not in tr]
        unused = [k for k in tr if k not in keys]
        bad = [k for k in tr if ph(tr[k]) - ph(k)]
        print(f"{lang}: {len(keys) - len(missing)} of {len(keys)} translated; "
              f"{len(missing)} missing, {len(unused)} unused, {len(bad)} with unknown placeholders")
        for k in missing:
            print(f"  missing: {k}")
        for k in bad:
            print(f"  placeholder: {k}")
        problems += len(missing) + len(bad)
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())

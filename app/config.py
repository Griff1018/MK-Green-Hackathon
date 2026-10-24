"""Settings read from environment variables (Replit Secrets in production)."""
from __future__ import annotations

import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SEED_DIR = ROOT / "data" / "seed"


def _load_dotenv() -> None:
    """Minimal .env loader for local runs; real environment variables win."""
    env = ROOT / ".env"
    if not env.exists():
        return
    for line in env.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, _, value = line.partition("=")
            os.environ.setdefault(key.strip(), value.strip())


_load_dotenv()

DATABASE_URL = os.environ.get("DATABASE_URL") or f"sqlite:///{(ROOT / 'data' / 'app.db').as_posix()}"
ADMIN_TOKEN = os.environ.get("ADMIN_TOKEN", "")

LLM_ENABLED = os.environ.get("LLM_ENABLED", "1") == "1"
CODEBUDDY_BIN = os.environ.get("CODEBUDDY_BIN", "codebuddy")
CODEBUDDY_MODEL = os.environ.get("CODEBUDDY_MODEL", "deepseek-v4.1-flash")
# OpenAI-compatible API (DeepSeek by default). When LLM_API_KEY is set it is used instead of the CLI.
LLM_API_KEY = os.environ.get("LLM_API_KEY", "")
LLM_BASE_URL = os.environ.get("LLM_BASE_URL", "https://api.deepseek.com")
LLM_MODEL = os.environ.get("LLM_MODEL", "deepseek-chat")

LLM_TIMEOUT_S = int(os.environ.get("LLM_TIMEOUT_S", "90"))
LLM_MAX_PARALLEL = int(os.environ.get("LLM_MAX_PARALLEL", "2"))

# Fetch a fresh trend snapshot once a day while the app runs (0 turns it off, e.g. in tests).
AUTO_REFRESH = os.environ.get("AUTO_REFRESH", "1") == "1"

ADZUNA_APP_ID = os.environ.get("ADZUNA_APP_ID", "")
ADZUNA_APP_KEY = os.environ.get("ADZUNA_APP_KEY", "")
ADZUNA_COUNTRY = os.environ.get("ADZUNA_COUNTRY", "sg")

# Tester accounts created at start-up, as "id:Display name" pairs separated by commas.
# Kept out of the repository: set it in .env locally or in Replit Secrets.
TEST_ACCOUNTS: list[tuple[str, str]] = []
for _item in os.environ.get("TEST_ACCOUNTS", "").split(","):
    _uid, _, _name = _item.strip().partition(":")
    if _uid:
        TEST_ACCOUNTS.append((_uid.strip().lower(), (_name or _uid).strip()))

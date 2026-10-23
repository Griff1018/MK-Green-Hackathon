#!/usr/bin/env bash
# Starts the web app from the app's own virtual environment (made by build.sh).
# A locally installed WorkBuddy CLI is put on PATH if present.
set -euo pipefail
if [ -d .codebuddy-cli/node_modules/.bin ]; then
  export PATH="$PWD/.codebuddy-cli/node_modules/.bin:$PATH"
fi
needs_cli() { [ ! -d .codebuddy-cli ] && [ "${LLM_ENABLED:-1}" = "1" ] && [ -z "${LLM_API_KEY:-}" ]; }
if [ ! -x .venv/bin/python ] || needs_cli; then bash scripts/build.sh; fi
exec .venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"

#!/usr/bin/env bash
# Starts the web app. A locally installed WorkBuddy CLI is put on PATH if present.
set -euo pipefail
if [ -d .codebuddy-cli/node_modules/.bin ]; then
  export PATH="$PWD/.codebuddy-cli/node_modules/.bin:$PATH"
fi
[ -d .codebuddy-cli ] || [ "${LLM_ENABLED:-1}" != "1" ] || bash scripts/build.sh
exec python -m uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"

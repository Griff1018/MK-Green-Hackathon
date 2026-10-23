#!/usr/bin/env bash
# Installs Python packages, and the WorkBuddy (CodeBuddy) CLI when the model is enabled.
# Replit's Python lives in the read-only Nix store and refuses both system and "--user"
# installs, so the packages go into the app's own virtual environment (.venv).
set -euo pipefail
[ -x .venv/bin/python ] || python -m venv .venv
.venv/bin/python -m pip install --quiet --upgrade pip
.venv/bin/python -m pip install --quiet -r requirements.txt
if [ "${LLM_ENABLED:-1}" = "1" ] && [ -z "${LLM_API_KEY:-}" ]; then  # the API needs no CLI
  npm install --silent --no-audit --no-fund --prefix .codebuddy-cli @tencent-ai/codebuddy-code \
    || echo "WorkBuddy CLI install failed; the app will run without the language model."
fi

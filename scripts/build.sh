#!/usr/bin/env bash
# Installs Python packages, and the WorkBuddy (CodeBuddy) CLI when the model is enabled.
set -euo pipefail
# PIP_USER=0: never a "--user" install; packages go into Replit's Python environment
PIP_USER=0 python -m pip install --quiet -r requirements.txt
if [ "${LLM_ENABLED:-1}" = "1" ] && [ -z "${LLM_API_KEY:-}" ]; then  # the API needs no CLI
  npm install --silent --no-audit --no-fund --prefix .codebuddy-cli @tencent-ai/codebuddy-code \
    || echo "WorkBuddy CLI install failed; the app will run without the language model."
fi

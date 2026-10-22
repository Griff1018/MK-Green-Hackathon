#!/usr/bin/env bash
# Installs Python packages, and the WorkBuddy (CodeBuddy) CLI when the model is enabled.
set -euo pipefail
python -m pip install --quiet -r requirements.txt
if [ "${LLM_ENABLED:-1}" = "1" ] && [ -z "${LLM_API_KEY:-}" ]; then  # the API needs no CLI
  npm install --silent --no-audit --no-fund --prefix .codebuddy-cli @tencent-ai/codebuddy-code \
    || echo "WorkBuddy CLI install failed; the app will run without the language model."
fi

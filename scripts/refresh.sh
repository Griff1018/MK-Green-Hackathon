#!/usr/bin/env bash
# Command for the Replit Scheduled Deployment: fetch fresh trend signals.
set -euo pipefail
[ -x .venv/bin/python ] || python -m venv .venv
.venv/bin/python -m pip install --quiet -r requirements-app.txt
exec .venv/bin/python -m ingest.refresh

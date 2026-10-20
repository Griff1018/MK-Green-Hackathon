#!/usr/bin/env bash
# Command for the Replit Scheduled Deployment: fetch fresh trend signals.
set -euo pipefail
python -m pip install --quiet -r requirements.txt
exec python -m ingest.refresh

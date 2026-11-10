#!/usr/bin/env bash
# Fallback deploy: Railway now auto-deploys every push to GitHub `main`, so normally just `git push`.
# This script uploads a clean `git archive` of HEAD straight from this computer (bypasses GitHub),
# because the home-folder .gitignore above this repo breaks `railway up`'s ignore-file parsing.
#   Usage (Git Bash):  bash scripts/deploy.sh
set -euo pipefail
cd "$(dirname "$0")/.."
OUT="$(mktemp -d)"
git archive HEAD | tar -x -C "$OUT"
railway up "$OUT" --path-as-root --no-gitignore --service web --detach
echo "Deploying. Live site: https://web-production-563d3.up.railway.app"

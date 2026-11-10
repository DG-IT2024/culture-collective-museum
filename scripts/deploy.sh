#!/usr/bin/env bash
# Deploy the committed code to Railway (project "culture-collective", service "web").
# Uploads a clean `git archive` of HEAD, because the home-folder .gitignore above this repo
# breaks `railway up`'s ignore-file parsing. Commit your changes first.
#   Usage (Git Bash):  bash scripts/deploy.sh
set -euo pipefail
cd "$(dirname "$0")/.."
OUT="$(mktemp -d)"
git archive HEAD | tar -x -C "$OUT"
railway up "$OUT" --path-as-root --no-gitignore --service web --detach
echo "Deploying. Live site: https://web-production-563d3.up.railway.app"

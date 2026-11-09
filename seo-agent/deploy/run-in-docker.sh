#!/usr/bin/env bash
# Runs the daily SEO audit inside a throw-away Node container, so the VPS needs no Node install and
# the job cannot touch the app, the database or other sites on the server.
#
# Template only: NOT installed. See seo-agent/README.md ("Server scheduling") for the one-time setup.
set -euo pipefail

REPO="${SEO_REPO_DIR:-/opt/yeshotels}"                 # git checkout; mounted READ-ONLY
DATA="${SEO_AGENT_DATA_DIR:-/var/lib/yeshotels-seo}"   # state, reports, logs; OUTSIDE the checkout (deploys run `git reset --hard`)
ENV_FILE="${SEO_ENV_FILE:-/etc/yeshotels-seo.env}"     # optional, chmod 600, root-owned; never committed
IMAGE="${SEO_NODE_IMAGE:-node:22-slim}"                # same major version as the app's Dockerfile

mkdir -p "$DATA"
chown 1000:1000 "$DATA"   # the container runs as uid 1000 ("node")

ENV_ARGS=()
[ -f "$ENV_FILE" ] && ENV_ARGS=(--env-file "$ENV_FILE")

# flock: if yesterday's run is somehow still going, this one exits instead of overlapping (the script also keeps its own lock file).
exec flock -n "$DATA/.runner.lock" docker run --rm \
  --name yeshotels-seo-daily \
  --user 1000:1000 \
  --read-only --tmpfs /tmp:rw,size=16m \
  --cap-drop ALL --security-opt no-new-privileges \
  --memory 256m --pids-limit 128 \
  -e TZ=Asia/Kolkata \
  -e SEO_AGENT_DATA_DIR=/data \
  "${ENV_ARGS[@]}" \
  -v "$REPO/seo-agent:/app/seo-agent:ro" \
  -v "$DATA:/data:rw" \
  -w /app \
  "$IMAGE" node seo-agent/scripts/run-daily.mjs

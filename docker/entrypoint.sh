#!/bin/sh
set -e

node /app/server/index.cjs &
NODE_PID="$!"

trap 'kill "$NODE_PID" 2>/dev/null || true' INT TERM EXIT

exec nginx -g 'daemon off;'

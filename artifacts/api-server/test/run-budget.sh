#!/usr/bin/env bash
set -euo pipefail

# A private Unix socket and fresh cluster: never touch developer or live data.
dir=$(mktemp -d /tmp/slipless-budget.XXXXXXXX)
cleanup() {
  pg_ctl -D "$dir/data" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$dir"
}
trap cleanup EXIT
initdb -D "$dir/data" -U postgres -A trust --no-locale >/dev/null
pg_ctl -D "$dir/data" -l "$dir/postgres.log" -o "-c listen_addresses='' -k $dir" -w start >/dev/null
export DATABASE_URL="postgresql://postgres@localhost/postgres?host=$dir"
pnpm --filter @workspace/db run push
node test/run.mjs --budget

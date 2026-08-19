#!/usr/bin/env bash
#
# Run the Postgres/Prisma integration tests against a real database.
#
# This is the script that could NOT run in the build sandbox (no Postgres / no
# npm / no container registry). Run it in a networked environment:
#
#   docker compose up -d db
#   ./scripts/run-integration.sh
#
# It assumes `npm install` has already been run so @prisma/client + @types/node
# exist. If not, run `npm install` first.
set -euo pipefail

export DATABASE_URL="${DATABASE_URL:-postgresql://postgres:dev@localhost:5432/loyalty?schema=public}"

echo "==> Waiting for Postgres at $DATABASE_URL"
# Give docker-compose healthcheck / a fresh DB a moment.
for i in $(seq 1 30); do
  if npx --yes prisma db push --skip-generate >/dev/null 2>&1; then
    break
  fi
  echo "   ...retrying ($i)"; sleep 2
done

echo "==> prisma generate"
npx --yes prisma generate

echo "==> prisma db push (apply schema)"
npx --yes prisma db push

echo "==> Running Postgres integration tests"
node --experimental-strip-types --test integration/pg/*.pgtest.ts

#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────
# One-shot data migration: Supabase Cloud → self-hosted Postgres.
#
# Dumps schemas public + auth from your cloud project and restores
# them into the local `db` container. Schema is NOT touched (it's
# already created via server/migrations/000_init.sql).
#
# Prereqs:
#   - docker compose up -d db   (local DB must be running)
#   - SOURCE_DB_URL env var pointing to the cloud project's pooler
#     e.g. postgres://postgres.<ref>:<pwd>@aws-0-...pooler.supabase.com:6543/postgres
#
# Usage:
#   SOURCE_DB_URL='postgres://...' ./scripts/migrate-from-cloud.sh
# ─────────────────────────────────────────────────────────────────
set -euo pipefail

: "${SOURCE_DB_URL:?Set SOURCE_DB_URL to the cloud Postgres URI}"

# shellcheck disable=SC1091
set -a; . ./.env; set +a

DUMP_FILE=/tmp/legche-cloud-dump.sql

echo "▸ Dumping public + auth data from cloud…"
pg_dump \
  --data-only \
  --no-owner \
  --no-privileges \
  --schema=public \
  --schema=auth \
  --disable-triggers \
  "$SOURCE_DB_URL" > "$DUMP_FILE"

echo "▸ Restoring into local db container…"
docker compose exec -T db \
  psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" < "$DUMP_FILE"

echo "✓ Migration complete. Dump kept at $DUMP_FILE"

#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────
# One-shot data migration: Supabase Cloud → self-hosted Postgres.
#
# Dumps public.* (and the historical auth.users → app_credentials mapping)
# from your legacy Supabase project and restores the data into the local
# `db` container. The destination schema must already be created via
# server/migrations/*.sql.
#
# What this script does:
#   1. pg_dump --schema=public (data only) from SOURCE_DB_URL.
#   2. pg_dump auth.users → /tmp/auth-users.csv.
#   3. Restore public.* into the local db container.
#   4. Insert one row per auth.users user into public.app_credentials
#      (password_hash kept as the legacy bcrypt; users with social-only
#      logins get a NULL hash and must use OAuth or password reset).
#   5. Preserves public.users.auth_id for historical traceability.
#
# Prereqs:
#   - docker compose up -d db        (local DB must be running)
#   - server/migrations/*.sql applied (tables, app_credentials present)
#   - SOURCE_DB_URL: pooler connection to the legacy Supabase project
#     postgres://postgres.<ref>:<pwd>@aws-0-...pooler.supabase.com:6543/postgres
#
# Usage:
#   SOURCE_DB_URL='postgres://...' ./scripts/migrate-from-supabase.sh
# ─────────────────────────────────────────────────────────────────
set -euo pipefail

: "${SOURCE_DB_URL:?Set SOURCE_DB_URL to the cloud Postgres URI}"

# shellcheck disable=SC1091
set -a; . ./.env; set +a

PUBLIC_DUMP=/tmp/legche-public-dump.sql
AUTH_USERS_CSV=/tmp/legche-auth-users.csv

echo "▸ Dumping public.* data from Supabase Cloud…"
pg_dump \
  --data-only \
  --no-owner \
  --no-privileges \
  --schema=public \
  --disable-triggers \
  "$SOURCE_DB_URL" > "$PUBLIC_DUMP"

echo "▸ Exporting auth.users → CSV for credential mapping…"
psql "$SOURCE_DB_URL" -At -F',' \
  -c "COPY (
        SELECT id, email, encrypted_password, created_at
        FROM auth.users
        WHERE email IS NOT NULL
      ) TO STDOUT WITH CSV HEADER" \
  > "$AUTH_USERS_CSV"

echo "▸ Restoring public.* into local db container…"
docker compose exec -T db \
  psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" < "$PUBLIC_DUMP"

echo "▸ Loading auth.users → public.app_credentials…"
docker compose exec -T db \
  psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" <<SQL
CREATE TEMP TABLE _legacy_auth (
  auth_id uuid,
  email text,
  password_hash text,
  created_at timestamptz
);
\\copy _legacy_auth FROM '/dev/stdin' WITH CSV HEADER;
$(cat "$AUTH_USERS_CSV")
\\.

INSERT INTO public.app_credentials (user_id, email, password_hash, created_at)
SELECT u.user_id, la.email, NULLIF(la.password_hash, ''), la.created_at
FROM _legacy_auth la
JOIN public.users u ON u.auth_id = la.auth_id
ON CONFLICT (email) DO NOTHING;
SQL

echo "✓ Migration complete."
echo "  public dump:      $PUBLIC_DUMP"
echo "  auth.users CSV:   $AUTH_USERS_CSV"
echo "  public.users.auth_id preserved for historical reference."

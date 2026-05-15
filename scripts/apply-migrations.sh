#!/usr/bin/env bash
# Применяет ВСЕ миграции из supabase/migrations/ к указанной Postgres БД.
# Использование:
#   DATABASE_URL=postgresql://postgres:PASSWORD@HOST:5432/postgres ./scripts/apply-migrations.sh
#
# Подходит и для своего Supabase, и для чистого Postgres
# (auth.users в чистом Postgres придётся заменить на свою таблицу пользователей —
#  см. docs/SELF_HOSTING.md, раздел «Перенос на свой Postgres»).

set -euo pipefail

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "ERROR: переменная DATABASE_URL не задана." >&2
  exit 1
fi

DIR="$(cd "$(dirname "$0")/.." && pwd)/supabase/migrations"

if [[ ! -d "$DIR" ]]; then
  echo "ERROR: не найдена папка миграций: $DIR" >&2
  exit 1
fi

echo "==> Применяю миграции из $DIR"
for f in $(ls "$DIR"/*.sql | sort); do
  echo "--> $f"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$f"
done
echo "==> Готово."

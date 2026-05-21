#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────
# Создаёт недостающие Supabase-роли в УЖЕ существующей БД.
#
# Когда нужен:
#   Если при старте видишь ошибки вида:
#     • Role "supabase_admin" does not exist
#     • password authentication failed for user "supabase_auth_admin"
#     • PostgREST: "no password supplied"
#   Это значит, том legche_pgdata был создан без supabase-init-скриптов
#   (или прерванным первым запуском). Этот скрипт чинит без потери данных.
#
# Использование:
#   ./scripts/bootstrap-roles.sh
# ─────────────────────────────────────────────────────────────────────────
set -euo pipefail

# Подхватываем .env
if [ -f .env ]; then
  set -a; . ./.env; set +a
fi

: "${POSTGRES_USER:?POSTGRES_USER не задан в .env}"
: "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD не задан в .env}"
: "${POSTGRES_DB:=postgres}"

echo "→ Создаю/обновляю системные роли Supabase в БД $POSTGRES_DB…"

docker compose exec -T db psql -v ON_ERROR_STOP=1 \
  -U "$POSTGRES_USER" -d "$POSTGRES_DB" <<SQL
-- Идемпотентно: создаём роли только если их нет, и выставляем пароль.

DO \$\$
DECLARE
  pwd text := '${POSTGRES_PASSWORD}';
BEGIN
  -- Привилегированные служебные роли
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'supabase_admin') THEN
    EXECUTE format('CREATE ROLE supabase_admin LOGIN SUPERUSER CREATEDB CREATEROLE REPLICATION BYPASSRLS PASSWORD %L', pwd);
  ELSE
    EXECUTE format('ALTER ROLE supabase_admin WITH LOGIN SUPERUSER CREATEDB CREATEROLE REPLICATION BYPASSRLS PASSWORD %L', pwd);
  END IF;

  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN
    EXECUTE format('CREATE ROLE supabase_auth_admin LOGIN NOINHERIT CREATEROLE PASSWORD %L', pwd);
  ELSE
    EXECUTE format('ALTER ROLE supabase_auth_admin WITH LOGIN NOINHERIT CREATEROLE PASSWORD %L', pwd);
  END IF;

  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'supabase_storage_admin') THEN
    EXECUTE format('CREATE ROLE supabase_storage_admin LOGIN NOINHERIT CREATEROLE PASSWORD %L', pwd);
  ELSE
    EXECUTE format('ALTER ROLE supabase_storage_admin WITH LOGIN NOINHERIT CREATEROLE PASSWORD %L', pwd);
  END IF;

  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticator') THEN
    EXECUTE format('CREATE ROLE authenticator LOGIN NOINHERIT NOCREATEDB NOCREATEROLE NOSUPERUSER PASSWORD %L', pwd);
  ELSE
    EXECUTE format('ALTER ROLE authenticator WITH LOGIN NOINHERIT NOCREATEDB NOCREATEROLE NOSUPERUSER PASSWORD %L', pwd);
  END IF;

  -- Безпарольные роли, в которые переключается authenticator
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN NOINHERIT BYPASSRLS;
  END IF;

  -- authenticator должен уметь переключаться в эти роли
  GRANT anon, authenticated, service_role TO authenticator;
END
\$\$;

-- Схемы, на которые опираются auth / storage / realtime
CREATE SCHEMA IF NOT EXISTS auth      AUTHORIZATION supabase_auth_admin;
CREATE SCHEMA IF NOT EXISTS storage   AUTHORIZATION supabase_storage_admin;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE SCHEMA IF NOT EXISTS _realtime AUTHORIZATION supabase_admin;

-- Базовые расширения
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;

-- Доступы на public для REST
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL  ON ALL TABLES    IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL  ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL  ON ALL ROUTINES  IN SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES    TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES  TO anon, authenticated, service_role;
SQL

echo "✓ Роли созданы. Перезапускаю auth / rest / realtime / storage…"
docker compose restart auth rest realtime storage
echo "✓ Готово. Проверь: docker compose ps  и  docker compose logs -f auth rest"

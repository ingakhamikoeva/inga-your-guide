# Self-Hosting Guide — Личный диетолог Инга

Полностью автономный деплой на ваш сервер. Никаких облачных зависимостей, кроме DeepSeek и (опционально) SMTP-провайдера.

## Архитектура

```
Browser → Nginx/Caddy (TLS)
              ├── legche.online        → web (Vite SPA)
              └── api.legche.online    → kong:8000
                                          ├── /auth/v1/*       → gotrue
                                          ├── /rest/v1/*       → postgrest
                                          ├── /realtime/v1/*   → realtime
                                          ├── /storage/v1/*    → storage-api
                                          └── /functions/v1/*  → api (DeepSeek)
                                                 ↓
                                              db (postgres:15 + RLS)
```

## Требования

- Docker 24+ и Docker Compose v2
- Домен с двумя записями: `legche.online` и `api.legche.online`
- 4 GB RAM минимум (рекомендуется 8 GB)
- Node 18+ на машине администратора (для генерации ключей)

## Установка

### 1. Подготовка `.env`

```bash
cp .env.example .env
./scripts/generate-keys.sh >> .env
# Откройте .env, заполните DEEPSEEK_API_KEY, SMTP, OAuth по желанию
# Сгенерируйте REALTIME_SECRET_KEY_BASE: openssl rand -base64 64
```

### 2. Запуск

```bash
docker compose up -d
docker compose logs -f db          # дождитесь "ready to accept connections"
docker compose ps                  # все сервисы — Up (healthy)
```

При **первом** запуске `db` автоматически применит схему из `server/migrations/*.sql` — все таблицы, RLS, триггеры, ENUM-ы создаются 1-в-1 как было на Supabase Cloud.

### 3. Обратный прокси (Caddy — пример)

```caddy
legche.online {
    reverse_proxy localhost:80
}

api.legche.online {
    reverse_proxy localhost:8000
}
```

Или Nginx — стандартный `proxy_pass` на `80` и `8000`.

### 4. (опционально) Перенос данных из Supabase Cloud

```bash
export SOURCE_DB_URL='postgres://postgres.<ref>:<pwd>@aws-0-...pooler.supabase.com:6543/postgres'
./scripts/migrate-from-cloud.sh
```

Скрипт делает `pg_dump --data-only` схем `public` и `auth` и заливает в локальный контейнер. Пользователи, пароли, профили, food-логи — переносятся as-is.

### 5. Создание первого админа

```bash
# Зарегистрируйтесь обычным образом через UI, затем:
docker compose exec db psql -U inga_db_user -d postgres -c \
  "INSERT INTO public.user_roles(user_id, role) VALUES ('<your-auth-id>', 'admin');"
```

## Полезные команды

| Действие | Команда |
|---|---|
| Логи всех сервисов | `docker compose logs -f` |
| Логи одного | `docker compose logs -f auth` |
| Psql в БД | `docker compose exec db psql -U inga_db_user -d postgres` |
| Studio (web admin) | http://your-server:3001 |
| Бэкап БД | `docker compose exec db pg_dump -U inga_db_user postgres > backup.sql` |
| Рестарт сервиса | `docker compose restart api` |
| Полная остановка | `docker compose down` (данные в volume сохраняются) |
| Пересборка с сохранением данных | `docker compose up -d --build` ✅ |
| Обновление образов | `docker compose pull && docker compose up -d` ✅ |
| Снести данные | `docker compose down -v` ⚠️ (необратимо) |

### Постоянное хранилище

Данные живут в **named volumes** (не внутри контейнеров):

| Volume | Что хранит | Путь в контейнере |
|---|---|---|
| `legche_pgdata` | Postgres: пользователи, профили, чек-ины, RLS — **вся БД** | `/var/lib/postgresql/data` |
| `legche_storage` | Файлы Supabase Storage (аватары, загрузки) | `/var/lib/storage` |

Volumes **переживают**: `restart`, `stop`, `down`, `up --build`, `pull`, обновление образа, переименование папки проекта (имена закреплены через `name:` в `docker-compose.yml`).

Volumes **удаляются только** командой `docker compose down -v` или `docker volume rm`.

Бэкап на хосте:
```bash
docker run --rm -v legche_pgdata:/data -v $(pwd):/backup alpine \
  tar czf /backup/pgdata-$(date +%F).tar.gz -C /data .
```

Init-скрипт `server/migrations/000_init.sql` монтируется в `/docker-entrypoint-initdb.d/` и выполняется **только на пустом томе** — повторный `up --build` его не перезапустит и данные не затрёт.

## Переменные окружения

| Переменная | Назначение |
|---|---|
| `SITE_URL` | Публичный URL фронта (для редиректов OAuth, email-confirm). |
| `API_EXTERNAL_URL` | Публичный URL API (Kong). |
| `POSTGRES_*` | Креды БД. **Уже совпадают с вашими настройками.** |
| `DATABASE_URL` | DSN для нашего Node-API. |
| `JWT_SECRET` | Подписывает все JWT (auth, anon, service). Генерируется. |
| `ANON_KEY` | Публичный JWT с role=anon. Используется фронтом и Kong. |
| `SERVICE_ROLE_KEY` | Админский JWT (обходит RLS). Только для серверного кода. |
| `GOTRUE_MAILER_AUTOCONFIRM` | `true` → не требовать подтверждения email. Удобно для дева. |
| `GOTRUE_EXTERNAL_GOOGLE_*` | Включить вход через Google. |
| `GOTRUE_EXTERNAL_APPLE_*` | Включить вход через Apple. |
| `DEEPSEEK_*` | LLM для ask-inga и estimate-nutrition. |
| `VITE_SUPABASE_URL` | На фронте: указывает на Kong. |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | = `ANON_KEY`. |

## Что НЕ изменилось

- Весь код фронта (`src/**`) — переезжает без правок.
- Все RLS-политики, триггеры, `handle_new_user`, `has_role`.
- API edge-функций (`ask-inga`, `estimate-nutrition`, `start-trial`) — фронт по-прежнему зовёт их через `supabase.functions.invoke(...)`, Kong маршрутизирует на наш Node-сервер.

## Траблшутинг

**`auth` падает с "role does not exist"** — supabase/postgres-образ создаёт нужные роли при первом старте. Если использовали чистый `postgres:15`, поменяйте на `supabase/postgres:15.8.1.060` (как в compose).

**`401` на `/rest/v1/*`** — Kong требует `apikey` header или `Authorization: Bearer <jwt>`. supabase-js клиент шлёт оба автоматически — убедитесь, что `VITE_SUPABASE_PUBLISHABLE_KEY` равен `ANON_KEY`.

**Email не приходит** — проверьте SMTP-креды или поставьте `GOTRUE_MAILER_AUTOCONFIRM=true` для тестов.

**Realtime не работает** — проверьте, что задан `REALTIME_SECRET_KEY_BASE` (64 байта).

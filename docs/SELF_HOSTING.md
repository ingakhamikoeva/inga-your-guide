# Self-Hosting Guide — Личный диетолог Инга

Полностью автономный деплой на ваш сервер. Только 3 контейнера, никаких Supabase-компонентов. Внешние зависимости — DeepSeek и (опционально) SMTP / OAuth-провайдеры.

## Архитектура

```
Browser → Nginx/Caddy (TLS)
              ├── legche.online        → web:80     (Vite SPA, nginx)
              └── api.legche.online    → api:8787   (Node + Express, JWT)
                                              ↓
                                         db (postgres:15)
```

Никаких Kong / GoTrue / PostgREST / Realtime / Storage / Studio. Фронт ходит **только** в Node API по `/api/v1/*` со своим JWT (HS256).

## Требования

- Docker 24+ и Docker Compose v2
- Домен с двумя записями: `legche.online` (фронт) и `api.legche.online` (API)
- 1 GB RAM минимум (рекомендуется 2 GB)

## Установка

### 1. Подготовка `.env`

```bash
cp .env.example .env
# Сгенерируйте JWT-секрет и подставьте в .env:
openssl rand -base64 48
# Заполните POSTGRES_PASSWORD, DATABASE_URL, DEEPSEEK_API_KEY, SMTP_*
```

### 2. Запуск

```bash
docker compose up -d
docker compose ps                  # все 3 сервиса — Up
docker compose logs -f api         # видим "legche-api listening on :8787"
```

При **первом** запуске `db` автоматически прогонит все файлы из `server/migrations/*.sql` (схема таблиц + auth tables из Phase 1). На последующих запусках init-скрипты пропускаются — данные не затираются.

### 3. Обратный прокси (Caddy — пример)

```caddy
legche.online {
    reverse_proxy localhost:8080
}

api.legche.online {
    reverse_proxy localhost:8787
}
```

Nginx — стандартный `proxy_pass` на `8080` и `8787`.

### 4. Создание первого админа

Зарегистрируйтесь обычным образом через UI, затем:

```bash
docker compose exec db psql -U inga_db_user -d postgres -c \
  "INSERT INTO public.user_roles(user_id, role) \
     SELECT user_id, 'admin' FROM public.app_credentials WHERE email='you@example.com';"
```

## Полезные команды

| Действие | Команда |
|---|---|
| Логи всех сервисов | `docker compose logs -f` |
| Логи API | `docker compose logs -f api` |
| Psql в БД | `docker compose exec db psql -U inga_db_user -d postgres` |
| Бэкап БД | `docker compose exec db pg_dump -U inga_db_user postgres > backup.sql` |
| Рестарт API | `docker compose restart api` |
| Полная остановка | `docker compose down` (данные в volume сохраняются) |
| Пересборка с сохранением данных | `docker compose up -d --build` |
| Обновление образов | `docker compose pull && docker compose up -d` |
| Снести данные | `docker compose down -v` ⚠️ (необратимо) |

### Постоянное хранилище

| Volume | Что хранит | Путь в контейнере |
|---|---|---|
| `legche_pgdata` | Postgres: вся БД (пользователи, профили, чек-ины, плейн) | `/var/lib/postgresql/data` |

Volume переживает: `restart`, `stop`, `down`, `up --build`, `pull`, обновление образа. Удаляется только командой `docker compose down -v`.

Бэкап тома на хост:
```bash
docker run --rm -v legche_pgdata:/data -v $(pwd):/backup alpine \
  tar czf /backup/pgdata-$(date +%F).tar.gz -C /data .
```

## Переменные окружения

| Переменная | Назначение |
|---|---|
| `SITE_URL` | Публичный URL фронта (для email-redirect). |
| `WEB_HTTP_PORT` | Порт хоста для SPA-nginx (default 8080). |
| `POSTGRES_*` / `DATABASE_URL` | Креды и DSN Postgres. |
| `JWT_SECRET` | Подписывает все JWT (HS256). Обязательно ≥32 байт. |
| `CORS_ORIGIN` | Список origin'ов, которым API отвечает с CORS. |
| `DEEPSEEK_*` | LLM для `ask-inga` и `estimate-nutrition`. |
| `SMTP_*` | Транзакционные email (сброс пароля). |
| `OAUTH_GOOGLE_*` / `OAUTH_APPLE_*` | OAuth-провайдеры (Phase 6). |
| `VITE_API_URL` | Build-time. URL Node API c `/api/v1`. Зашивается в JS-бандл. |

## API-эндпоинты

Всё под `https://api.legche.online/api/v1/...`:

- `auth/{signup, login, logout, refresh, me, forgot-password, reset-password}`
- `profile`, `plan`, `behavior`, `assessment` (GET/PUT or POST)
- `checkins`, `checkins/:date`, `reflections/:date`
- `meal-plans/:date`, `food-logs`, `chat-events`, `events`, `consultations`
- `nutrition/summary/:date`, `food-reference?q=...`
- `admin/me`, `admin/settings/:key` (только для `user_roles.role='admin'`)
- `ask-inga`, `estimate-nutrition`, `start-trial`

## Траблшутинг

**API падает с `JWT_SECRET is not set`** — пропустили шаг с генерацией; задайте в `.env` любую случайную строку ≥32 байта.

**`401 unauthorized` на любом эндпоинте** — фронт не приложил `Authorization: Bearer <token>`. Проверьте `VITE_API_URL` в собранном бандле и наличие токена в `localStorage` (`inga_access_token`).

**CORS-ошибка** — добавьте origin фронта в `CORS_ORIGIN` (через запятую).

**Email со сбросом пароля не уходит** — пока SMTP не сконфигурирован, ссылка сброса просто **печатается в логи API**:
```bash
docker compose logs api | grep "password reset"
```

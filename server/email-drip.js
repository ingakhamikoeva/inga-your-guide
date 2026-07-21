// Планировщик email-цепочки триала: День 3, День 6 (вечер), День 10.
// Тексты утверждены Ингой 20.07.2026 (Email_cepochka_triala_v2.md).
// День 0 отправляется сразу при регистрации — см. auth.js (sendDay0Email).
//
// Без новых миграций для самой логики (кроме отписки — см. 070_email_unsubscribe.sql,
// применяется вручную как остальные). Отправленность каждого письма помечается
// событием в user_events, чтобы при перезапуске сервера письма не дублировались.
//
// Место рассылки управляется флагом EMAIL_DRIP_ENABLED — включить после того,
// как в .env прописаны SMTP_INGA_USER/PASS и всё проверено тестовой отправкой.

import { pool } from "./index.js";
import { sendDay3Email, sendDay6Email, sendDay10Email } from "./mailer.js";

const ENABLED = String(process.env.EMAIL_DRIP_ENABLED || "false") === "true";
const CHECK_INTERVAL_MS = 60 * 60 * 1000; // раз в час достаточно для писем день-в-день

// ── Статистика активности пользователя для подстановки в письма ───────────
async function computeUserStats(userId) {
  const [diaryRes, dishRes, kopilkaRes] = await Promise.all([
    pool.query(
      `SELECT COUNT(DISTINCT datetime::date)::int AS n FROM public.food_logs WHERE user_id = $1`,
      [userId]
    ),
    pool.query(
      `SELECT COUNT(DISTINCT lower(trim(payload_json->>'query')))::int AS n
       FROM public.user_events WHERE user_id = $1 AND type = 'light_version_search'`,
      [userId]
    ),
    pool.query(
      `SELECT COALESCE(SUM((meta->'lightSwap'->>'savedKcal')::numeric), 0)::int AS n
       FROM public.food_logs
       WHERE user_id = $1 AND meta ? 'lightSwap'
         AND (meta->'lightSwap'->>'savedKcal') ~ '^[0-9]+(\\.[0-9]+)?$'`,
      [userId]
    ),
  ]);
  return {
    diary_days: diaryRes.rows[0]?.n || 0,
    dish_count: dishRes.rows[0]?.n || 0,
    kopilka_kcal: kopilkaRes.rows[0]?.n || 0,
  };
}

// ── Места основателей: app_settings.key = 'founder_spots_remaining' ────────
// Значение вида {"remaining": 37} — сколько мест из первых 100 осталось.
// Если настройка не задана — считаем места
// доступными (по умолчанию, пока Инга явно не проставит remaining=0).
// Управляется через существующий admin-эндпоинт PUT /admin/settings/founder_spots_remaining.
async function founderPricingAvailable() {
  try {
    const { rows } = await pool.query(
      `SELECT value FROM public.app_settings WHERE key = 'founder_spots_remaining'`
    );
    if (!rows.length) return true;
    const remaining = Number(rows[0].value?.remaining);
    return !Number.isFinite(remaining) || remaining > 0;
  } catch {
    return true; // при любой ошибке — не блокируем письма, просто без спецпредложения не останутся
  }
}

// ── Кандидаты на письмо: триал стартовал >= N дней назад, письмо не отправлено,
// от рассылки не отписывались. Опционально — только неоплатившие (для дня 10). ─
async function findDue(dayOffset, eventType, { onlyUnpaid = false } = {}) {
  const unpaidClause = onlyUnpaid ? "AND s.paid_until IS NULL" : "";
  const { rows } = await pool.query(
    `SELECT s.user_id, c.email, u.name
     FROM public.subscriptions s
     JOIN public.app_credentials c ON c.user_id = s.user_id
     JOIN public.users u ON u.user_id = s.user_id
     WHERE s.trial_started_at IS NOT NULL
       AND s.trial_started_at <= now() - ($1 || ' days')::interval
       AND u.email_unsubscribed_at IS NULL
       ${unpaidClause}
       AND NOT EXISTS (
         SELECT 1 FROM public.user_events e
         WHERE e.user_id = s.user_id AND e.type = $2
       )
     LIMIT 200`,
    [String(dayOffset), eventType]
  );
  return rows;
}

async function markSent(userId, eventType) {
  await pool.query(
    `INSERT INTO public.user_events (user_id, type, payload_json) VALUES ($1, $2, '{}'::jsonb)`,
    [userId, eventType]
  );
}

async function runOnce() {
  if (!ENABLED) return;

  try {
    // День 3
    const day3 = await findDue(3, "email_day3_sent");
    for (const u of day3) {
      const stats = await computeUserStats(u.user_id);
      const r = await sendDay3Email(u.email, u.name || null, u.user_id, stats);
      if (r.sent) await markSent(u.user_id, "email_day3_sent");
    }

    // День 6 (вечер) — за день до конца недельного триала
    const day6 = await findDue(6, "email_day6_sent");
    if (day6.length) {
      const founderAvailable = await founderPricingAvailable();
      for (const u of day6) {
        const stats = await computeUserStats(u.user_id);
        const r = await sendDay6Email(u.email, u.name || null, u.user_id, stats, founderAvailable);
        if (r.sent) await markSent(u.user_id, "email_day6_sent");
      }
    }

    // День 10 — только для тех, кто не оплатил
    const day10 = await findDue(10, "email_day10_sent", { onlyUnpaid: true });
    for (const u of day10) {
      const r = await sendDay10Email(u.email, u.name || null, u.user_id);
      if (r.sent) await markSent(u.user_id, "email_day10_sent");
    }

    if (day3.length || day6.length || day10.length) {
      console.log(`[email-drip] отправлено: день3=${day3.length}, день6=${day6.length}, день10=${day10.length}`);
    }
  } catch (e) {
    console.error("[email-drip] ошибка прохода:", e.message);
  }
}

export function startEmailDripScheduler() {
  if (!ENABLED) {
    console.log("[email-drip] выключен (EMAIL_DRIP_ENABLED не true)");
    return;
  }
  console.log("[email-drip] включён, интервал проверки — раз в час");
  runOnce();
  setInterval(runOnce, CHECK_INTERVAL_MS).unref();
}

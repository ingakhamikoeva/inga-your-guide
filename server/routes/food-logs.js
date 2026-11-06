import { sendResourceLimit, DIARY_AI_LIMIT_MESSAGE } from '../resource-limits.js';
import { createFoodLog, patchFoodLog } from '../nutrition/food-write.js';
import { analyzeSavedMeal } from "../nutrition/meal-estimation.js";
import { requireAccessForWrite } from '../access.js';
import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { pool } from "./_helpers.js";

const r = Router();
r.use(requireAuth);
r.use(requireAccessForWrite);

// Resolve internal user_id (public.users) from the JWT auth_id
async function resolveUserId(req) {
  // requireAuth puts the auth user id on req.userId already; but the
  // food_logs.user_id column references public.users(user_id). Some
  // deployments use the auth_id directly, others use the mapping. We
  // mirror what existing routes do: pass req.userId straight through.
  return req.userId;
}

// List food logs. Optional ?date=YYYY-MM-DD filters to that local day (UTC).
r.get("/", async (req, res) => {
  try {
    const userId = await resolveUserId(req);
    const { date } = req.query;
    const timezone = typeof req.query.timezone === 'string' ? req.query.timezone : 'UTC';
    try { new Intl.DateTimeFormat('en', { timeZone: timezone }).format(); }
    catch { return res.status(400).json({ error: 'invalid_timezone' }); }
    let rows;
    if (date && /^\d{4}-\d{2}-\d{2}$/.test(String(date))) {
      const result = await pool.query(
        `SELECT log_id, raw_text, meal_tag, datetime, meta
           FROM public.food_logs
          WHERE user_id = $1
            AND datetime >= ($2::date::timestamp AT TIME ZONE $3)
            AND datetime < (($2::date + INTERVAL '1 day') AT TIME ZONE $3)
          ORDER BY datetime ASC`,
        [userId, date, timezone]
      );
      rows = result.rows;
    } else {
      const result = await pool.query(
        `SELECT log_id, raw_text, meal_tag, datetime, meta
           FROM public.food_logs
          WHERE user_id = $1
          ORDER BY datetime ASC`,
        [userId]
      );
      rows = result.rows;
    }
    res.json(rows);
  } catch (e) {
    console.error("GET /food-logs:", e);
    res.status(500).json({ error: "load_failed" });
  }
});

// Копилка лёгкости: сумма сэкономленных ккал за месяц.
// Считаем только записи с meta.lightSwap (реальная еда через «Из лёгких рецептов»).
// ?month=YYYY-MM (по умолчанию — текущий месяц UTC).
r.get("/savings", async (req, res) => {
  try {
    const userId = await resolveUserId(req);
    let { month } = req.query;
    if (!month || !/^\d{4}-\d{2}$/.test(String(month))) {
      month = new Date().toISOString().slice(0, 7);
    }
    const result = await pool.query(
      `SELECT
         COALESCE(SUM((meta->'lightSwap'->>'savedKcal')::numeric), 0)::int AS total_kcal,
         COUNT(*)::int AS swaps_count
       FROM public.food_logs
       WHERE user_id = $1
         AND meta ? 'lightSwap'
         AND (meta->'lightSwap'->>'savedKcal') ~ '^[0-9]+(\\.[0-9]+)?$'
         AND datetime >= ($2 || '-01')::date::timestamptz
         AND datetime <  ((($2 || '-01')::date) + INTERVAL '1 month')::timestamptz`,
      [userId, month]
    );
    res.json(result.rows[0] || { total_kcal: 0, swaps_count: 0 });
  } catch (e) {
    console.error("GET /food-logs/savings:", e);
    res.status(500).json({ error: "load_failed" });
  }
});

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const validMeta = value => value == null || (typeof value === 'object' && !Array.isArray(value));
const validDescription = value => typeof value === 'string' && !!value.trim();

r.post("/", async (req, res) => {
  const { description = "", mealTag = "unknown", datetime, meta, requestId } = req.body || {};
  if (!validDescription(description) || !validMeta(meta) || (requestId != null && !uuid.test(requestId))) {
    return res.status(400).json({ error: 'invalid_meal' });
  }
  try {
    const userId = await resolveUserId(req);
    const saved = await createFoodLog(pool, userId, { description, mealTag, datetime: datetime ?? null, meta: meta ?? {} }, requestId);
    res.json(saved);
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: e.code });
    console.error("POST /food-logs:", e);
    res.status(500).json({ error: "save_failed" });
  }
});

r.post('/:id/analyze', async (req, res) => {
  if (!/^[0-9a-f-]{36}$/i.test(req.params.id)) return res.status(400).json({error:'invalid_id'});
  try {
    const meal = await analyzeSavedMeal(req.userId, req.params.id);
    if (!meal) return res.status(404).json({error:'not_found'});
    res.json(meal);
  } catch (error) {
    if (sendResourceLimit(res, error, DIARY_AI_LIMIT_MESSAGE)) return;
    res.status(503).json({error:'nutrition_unavailable'});
  }
});

r.patch("/:id", async (req, res) => {
  const { id } = req.params;
  const patch = req.body || {};
  if (!uuid.test(id) || !validMeta(patch.meta) || (patch.description != null && !validDescription(patch.description))) {
    return res.status(400).json({ error: 'invalid_meal' });
  }
  try {
    const saved = await patchFoodLog(pool, req.userId, id, patch);
    if (!saved) return res.status(404).json({ error: "not_found" });
    res.json(saved);
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: e.code });
    console.error("PATCH /food-logs:", e);
    res.status(500).json({ error: "update_failed" });
  }
});

r.delete("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const userId = await resolveUserId(req);
    const result = await pool.query(
      `DELETE FROM public.food_logs WHERE log_id = $1 AND user_id = $2`,
      [id, userId]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: "not_found" });
    res.json({ ok: true });
  } catch (e) {
    console.error("DELETE /food-logs:", e);
    res.status(500).json({ error: "delete_failed" });
  }
});

export default r;

// Data routes for the self-hosted API.
// Mirrors the old supabase.from(...) calls used in src/lib/db.ts and friends.
// All routes require Bearer JWT; user_id is taken from the token (req.auth.authId).

import { pool, requireAuth } from "./index.js";

// ── tiny helpers ───────────────────────────────────────────────────

async function auth(req, res) {
  const a = await requireAuth(req, res);
  return a; // { authId, token, payload } or null (response already sent)
}

function bad(res, msg) { return res.status(400).json({ error: msg }); }

async function upsertSingle(table, keyCols, keyVals, row) {
  // keyCols: array of column names that identify the row
  // returns inserted/updated row
  const setEntries = Object.entries(row).filter(([k]) => !keyCols.includes(k));
  const allCols = [...keyCols, ...setEntries.map(([k]) => k)];
  const allVals = [...keyVals, ...setEntries.map(([, v]) => v)];
  const placeholders = allVals.map((_, i) => `$${i + 1}`).join(", ");
  const updates = setEntries.length
    ? setEntries.map(([k], i) => `${k} = $${keyVals.length + 1 + i}`).join(", ")
    : null;
  const sql = `
    INSERT INTO ${table} (${allCols.join(", ")})
    VALUES (${placeholders})
    ON CONFLICT (${keyCols.join(", ")})
    DO ${updates ? `UPDATE SET ${updates}` : "NOTHING"}
    RETURNING *`;
  const r = await pool.query(sql, allVals);
  return r.rows[0];
}

// ── PROFILE ────────────────────────────────────────────────────────

async function getProfile(req, res) {
  const a = await auth(req, res); if (!a) return;
  const [u, p] = await Promise.all([
    pool.query(`SELECT name FROM public.users WHERE user_id = $1`, [a.authId]),
    pool.query(`SELECT * FROM public.user_profile WHERE user_id = $1`, [a.authId]),
  ]);
  res.json({ user: u.rows[0] || null, profile: p.rows[0] || null });
}

async function putProfile(req, res) {
  const a = await auth(req, res); if (!a) return;
  const b = req.body || {};
  if (Object.prototype.hasOwnProperty.call(b, "name")) {
    const trimmed = String(b.name ?? "").trim();
    await pool.query(`UPDATE public.users SET name = $1 WHERE user_id = $2`, [trimmed || null, a.authId]);
  }
  // Build profile row from whitelisted columns only.
  const cols = [
    "sex","age","height_cm","start_weight_kg","current_weight_kg","goal_weight_kg",
    "waist_cm","hips_cm","steps_baseline","weight_gain_reasons","emotional_trigger",
    "current_stage","goal_reached_at","fixation_started_at","maintenance_started_at",
    "equilibrium_calories","current_fixation_calories","fixation_week_number","last_calorie_increase_at",
  ];
  const row = {};
  for (const c of cols) if (Object.prototype.hasOwnProperty.call(b, c)) row[c] = b[c];
  if (Object.keys(row).length) {
    await upsertSingle("public.user_profile", ["user_id"], [a.authId], row);
  }
  res.json({ ok: true });
}

// ── PLAN ───────────────────────────────────────────────────────────

async function getPlan(req, res) {
  const a = await auth(req, res); if (!a) return;
  const r = await pool.query(`SELECT * FROM public.user_plan WHERE user_id = $1`, [a.authId]);
  res.json({ plan: r.rows[0] || null });
}
async function putPlan(req, res) {
  const a = await auth(req, res); if (!a) return;
  const cols = ["pace","calorie_target","calorie_corridor_low","calorie_corridor_high","tracking_method"];
  const row = {};
  for (const c of cols) if (Object.prototype.hasOwnProperty.call(req.body || {}, c)) row[c] = req.body[c];
  await upsertSingle("public.user_plan", ["user_id"], [a.authId], row);
  res.json({ ok: true });
}

// ── BEHAVIOR PROFILE ───────────────────────────────────────────────

async function getBehavior(req, res) {
  const a = await auth(req, res); if (!a) return;
  const r = await pool.query(`SELECT * FROM public.behavior_profile WHERE user_id = $1`, [a.authId]);
  res.json({ behavior: r.rows[0] || null });
}
async function putBehavior(req, res) {
  const a = await auth(req, res); if (!a) return;
  const cols = ["eating_pattern","primary_trigger","vulnerable_time","interoception_level","recommended_coaching_style"];
  const row = {};
  for (const c of cols) if (Object.prototype.hasOwnProperty.call(req.body || {}, c)) row[c] = req.body[c];
  await upsertSingle("public.behavior_profile", ["user_id"], [a.authId], row);
  res.json({ ok: true });
}

// ── ASSESSMENT ─────────────────────────────────────────────────────

async function getAssessment(req, res) {
  const a = await auth(req, res); if (!a) return;
  const r = await pool.query(
    `SELECT answers_json FROM public.assessment_answers
      WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [a.authId]
  );
  res.json({ answers: r.rows[0]?.answers_json ?? null });
}
async function postAssessment(req, res) {
  const a = await auth(req, res); if (!a) return;
  const answers = req.body?.answers;
  if (!Array.isArray(answers)) return bad(res, "answers must be an array");
  await pool.query(
    `INSERT INTO public.assessment_answers (user_id, answers_json) VALUES ($1, $2::jsonb)`,
    [a.authId, JSON.stringify(answers)]
  );
  res.json({ ok: true });
}

// ── DAILY CHECK-INS ────────────────────────────────────────────────

async function postCheckin(req, res) {
  const a = await auth(req, res); if (!a) return;
  const { date, weight_kg = null, sleep_hours = null, steps_yesterday = null } = req.body || {};
  if (!date) return bad(res, "date required");
  await upsertSingle(
    "public.daily_checkins",
    ["user_id","date"],
    [a.authId, date],
    { weight_kg, sleep_hours, steps_yesterday }
  );
  res.json({ ok: true });
}
async function getCheckins(req, res) {
  const a = await auth(req, res); if (!a) return;
  const r = await pool.query(
    `SELECT date, weight_kg FROM public.daily_checkins
      WHERE user_id = $1 AND weight_kg IS NOT NULL ORDER BY date ASC`,
    [a.authId]
  );
  res.json({ checkins: r.rows.map(d => ({ date: d.date, weight: Number(d.weight_kg) })) });
}

// ── MEAL PLANS ─────────────────────────────────────────────────────

async function getMealPlan(req, res) {
  const a = await auth(req, res); if (!a) return;
  const r = await pool.query(
    `SELECT plan_text FROM public.meal_plans WHERE user_id = $1 AND date_for = $2`,
    [a.authId, req.params.date]
  );
  res.json({ plan_text: r.rows[0]?.plan_text ?? null });
}
async function putMealPlan(req, res) {
  const a = await auth(req, res); if (!a) return;
  const planText = String(req.body?.plan_text ?? "");
  await upsertSingle(
    "public.meal_plans",
    ["user_id","date_for"],
    [a.authId, req.params.date],
    { plan_text: planText }
  );
  res.json({ ok: true });
}

// ── FOOD LOGS / CHAT / REFLECTIONS / EVENTS ────────────────────────

async function postFoodLog(req, res) {
  const a = await auth(req, res); if (!a) return;
  const { raw_text = "", meal_tag = "unknown" } = req.body || {};
  await pool.query(
    `INSERT INTO public.food_logs (user_id, raw_text, meal_tag) VALUES ($1, $2, $3)`,
    [a.authId, raw_text, meal_tag]
  );
  res.json({ ok: true });
}

async function postChatEvent(req, res) {
  const a = await auth(req, res); if (!a) return;
  const { event_type, message_summary, related_food_log_id = null } = req.body || {};
  await pool.query(
    `INSERT INTO public.chat_events (user_id, event_type, message_summary, related_food_log_id)
     VALUES ($1, $2, $3, $4)`,
    [a.authId, event_type, message_summary, related_food_log_id]
  );
  res.json({ ok: true });
}

async function postReflection(req, res) {
  const a = await auth(req, res); if (!a) return;
  const { date, emotion = null, hunger_level = null, hardest_part = null } = req.body || {};
  if (!date) return bad(res, "date required");
  await upsertSingle(
    "public.evening_reflections",
    ["user_id","date"],
    [a.authId, date],
    { emotion, hunger_level, hardest_part }
  );
  res.json({ ok: true });
}

async function postEvent(req, res) {
  const a = await auth(req, res); if (!a) return;
  const { type, payload = null } = req.body || {};
  if (!type) return bad(res, "type required");
  await pool.query(
    `INSERT INTO public.user_events (user_id, type, payload_json) VALUES ($1, $2, $3::jsonb)`,
    [a.authId, type, payload === null ? null : JSON.stringify(payload)]
  );
  res.json({ ok: true });
}

async function postConsultation(req, res) {
  const a = await auth(req, res); if (!a) return;
  await pool.query(
    `INSERT INTO public.consultations (user_id, status) VALUES ($1, 'requested')`,
    [a.authId]
  );
  res.json({ ok: true });
}

// ── NUTRITION SUMMARY ──────────────────────────────────────────────

async function getNutritionSummary(req, res) {
  const a = await auth(req, res); if (!a) return;
  const r = await pool.query(
    `SELECT * FROM public.daily_nutrition_summary WHERE user_id = $1 AND date = $2`,
    [a.authId, req.params.date]
  );
  res.json({ summary: r.rows[0] || null });
}
async function putNutritionSummary(req, res) {
  const a = await auth(req, res); if (!a) return;
  const cols = [
    "calorie_target","calories_eaten_estimated","calories_left",
    "protein_estimated_g","fat_estimated_g","carbs_estimated_g","fiber_estimated_g",
    "protein_status","fat_status","carbs_status","fiber_status",
    "summary_comment","is_estimate",
  ];
  const row = {};
  for (const c of cols) if (Object.prototype.hasOwnProperty.call(req.body || {}, c)) row[c] = req.body[c];
  await upsertSingle(
    "public.daily_nutrition_summary",
    ["user_id","date"],
    [a.authId, req.params.date],
    row
  );
  res.json({ ok: true });
}

// ── FOOD REFERENCE LOOKUP ──────────────────────────────────────────

async function getFoodReference(req, res) {
  const a = await auth(req, res); if (!a) return;
  const q = String(req.query?.q ?? "").trim().toLowerCase();
  if (!q) return res.json({ item: null });
  const r = await pool.query(
    `SELECT calories_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g,
            fiber_per_100g, recommended_portion_g, liquid_calories
       FROM public.food_reference
      WHERE lower(product_name_ru) LIKE $1
      LIMIT 1`,
    [q]
  );
  res.json({ item: r.rows[0] || null });
}

// ── SETTINGS / ROLES ───────────────────────────────────────────────

async function isAdmin(userId) {
  const r = await pool.query(
    `SELECT 1 FROM public.user_roles WHERE user_id = $1 AND role = 'admin' LIMIT 1`,
    [userId]
  );
  return !!r.rowCount;
}

async function getMyRoles(req, res) {
  const a = await auth(req, res); if (!a) return;
  res.json({ admin: await isAdmin(a.authId) });
}

async function getSetting(req, res) {
  const a = await auth(req, res); if (!a) return;
  const r = await pool.query(`SELECT value FROM public.app_settings WHERE key = $1`, [req.params.key]);
  res.json({ value: r.rows[0]?.value ?? null });
}

async function putSetting(req, res) {
  const a = await auth(req, res); if (!a) return;
  if (!(await isAdmin(a.authId))) return res.status(403).json({ error: "forbidden" });
  const { value } = req.body || {};
  await pool.query(
    `INSERT INTO public.app_settings (key, value, updated_by, updated_at)
     VALUES ($1, $2::jsonb, $3, now())
     ON CONFLICT (key) DO UPDATE
       SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = EXCLUDED.updated_at`,
    [req.params.key, JSON.stringify(value), a.authId]
  );
  res.json({ ok: true });
}

// ── route wiring ───────────────────────────────────────────────────

export function registerDataRoutes(app, prefix = "/api/v1") {
  app.get(`${prefix}/me/profile`, getProfile);
  app.put(`${prefix}/me/profile`, putProfile);

  app.get(`${prefix}/me/plan`, getPlan);
  app.put(`${prefix}/me/plan`, putPlan);

  app.get(`${prefix}/me/behavior`, getBehavior);
  app.put(`${prefix}/me/behavior`, putBehavior);

  app.get(`${prefix}/me/assessment`, getAssessment);
  app.post(`${prefix}/me/assessment`, postAssessment);

  app.post(`${prefix}/me/checkin`, postCheckin);
  app.get(`${prefix}/me/checkins`, getCheckins);

  app.get(`${prefix}/me/meal-plan/:date`, getMealPlan);
  app.put(`${prefix}/me/meal-plan/:date`, putMealPlan);

  app.post(`${prefix}/me/food-log`, postFoodLog);
  app.post(`${prefix}/me/chat-event`, postChatEvent);
  app.post(`${prefix}/me/reflection`, postReflection);
  app.post(`${prefix}/me/event`, postEvent);
  app.post(`${prefix}/me/consultation`, postConsultation);

  app.get(`${prefix}/me/roles`, getMyRoles);

  app.get(`${prefix}/nutrition/summary/:date`, getNutritionSummary);
  app.put(`${prefix}/nutrition/summary/:date`, putNutritionSummary);

  app.get(`${prefix}/food-reference`, getFoodReference);

  app.get(`${prefix}/settings/:key`, getSetting);
  app.put(`${prefix}/settings/:key`, putSetting);
}

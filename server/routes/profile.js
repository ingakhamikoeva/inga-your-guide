import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { pool, upsert } from "./_helpers.js";

const r = Router();
r.use(requireAuth);

// camelCase (frontend) ↔ snake_case (db) maps
const TO_DB = {
  gender: "sex",
  age: "age",
  height: "height_cm",
  weight: "current_weight_kg",     // also updates start_weight_kg on first set
  goalWeight: "goal_weight_kg",
  waist: "waist_cm",
  hips: "hips_cm",
  stepsPerDay: "steps_baseline",
  weightGainReasons: "weight_gain_reasons",
  emotionalTrigger: "emotional_trigger",
  currentStage: "current_stage",
  goalReachedAt: "goal_reached_at",
  fixationStartedAt: "fixation_started_at",
  maintenanceStartedAt: "maintenance_started_at",
  equilibriumCalories: "equilibrium_calories",
  currentFixationCalories: "current_fixation_calories",
  fixationWeekNumber: "fixation_week_number",
  lastCalorieIncreaseAt: "last_calorie_increase_at",
};

function rowToProfile(p, u) {
  if (!p && !u) return null;
  return {
    name: u?.name ?? undefined,
    gender: p?.sex === "male" ? "male" : "female",
    age: p?.age ?? undefined,
    height: p?.height_cm ?? undefined,
    weight: p?.current_weight_kg != null ? Number(p.current_weight_kg) : undefined,
    goalWeight: p?.goal_weight_kg != null ? Number(p.goal_weight_kg) : undefined,
    waist: p?.waist_cm != null ? Number(p.waist_cm) : undefined,
    hips: p?.hips_cm != null ? Number(p.hips_cm) : undefined,
    stepsPerDay: p?.steps_baseline ?? undefined,
    weightGainReasons: p?.weight_gain_reasons ?? undefined,
    emotionalTrigger: p?.emotional_trigger ?? undefined,
    currentStage: p?.current_stage ?? "loss",
    goalReachedAt: p?.goal_reached_at ?? undefined,
    fixationStartedAt: p?.fixation_started_at ?? undefined,
    maintenanceStartedAt: p?.maintenance_started_at ?? undefined,
    equilibriumCalories: p?.equilibrium_calories ?? undefined,
    currentFixationCalories: p?.current_fixation_calories ?? undefined,
    fixationWeekNumber: p?.fixation_week_number ?? undefined,
    lastCalorieIncreaseAt: p?.last_calorie_increase_at ?? undefined,
  };
}

r.get("/", async (req, res) => {
  try {
    const [u, p] = await Promise.all([
      pool.query(`SELECT name FROM public.users WHERE user_id = $1`, [req.userId]),
      pool.query(`SELECT * FROM public.user_profile WHERE user_id = $1`, [req.userId]),
    ]);
    res.json(rowToProfile(p.rows[0], u.rows[0]) ?? null);
  } catch (e) {
    console.error("GET /profile:", e);
    res.status(500).json({ error: "load_failed" });
  }
});

r.put("/", async (req, res) => {
  const body = req.body || {};
  try {
    if (Object.prototype.hasOwnProperty.call(body, "name")) {
      const trimmed = String(body.name ?? "").trim();
      await pool.query(
        `UPDATE public.users SET name = $1 WHERE user_id = $2`,
        [trimmed || null, req.userId]
      );
    }

    const row = {};
    for (const [camel, col] of Object.entries(TO_DB)) {
      if (Object.prototype.hasOwnProperty.call(body, camel)) row[col] = body[camel];
    }
    if (Object.prototype.hasOwnProperty.call(body, "weight")) {
      // Ensure start_weight_kg gets set on first save too.
      const existing = await pool.query(
        `SELECT start_weight_kg FROM public.user_profile WHERE user_id = $1`,
        [req.userId]
      );
      if (!existing.rows[0] || existing.rows[0].start_weight_kg == null) {
        row.start_weight_kg = body.weight;
      }
    }
    if (Object.keys(row).length) {
      await upsert("public.user_profile", ["user_id"], [req.userId], row);
    }
    res.json({ ok: true });
  } catch (e) {
    console.error("PUT /profile:", e);
    res.status(500).json({ error: "save_failed" });
  }
});

export default r;

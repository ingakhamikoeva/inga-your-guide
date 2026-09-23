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
  motivation: "motivation",
  kgToLose: "kg_to_lose",
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
    gender: p?.sex === "male" || p?.sex === "female" ? p.sex : null,
    age: p?.age ?? undefined,
    height: p?.height_cm ?? undefined,
    weight: p?.current_weight_kg != null ? Number(p.current_weight_kg) : undefined,
    goalWeight: p?.goal_weight_kg != null ? Number(p.goal_weight_kg) : undefined,
    waist: p?.waist_cm != null ? Number(p.waist_cm) : undefined,
    hips: p?.hips_cm != null ? Number(p.hips_cm) : undefined,
    stepsPerDay: p?.steps_baseline ?? undefined,
    weightGainReasons: p?.weight_gain_reasons ?? undefined,
    emotionalTrigger: p?.emotional_trigger ?? undefined,
    motivation: p?.motivation ?? undefined,
    kgToLose: p?.kg_to_lose != null ? Number(p.kg_to_lose) : undefined,
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
  const has = key => Object.prototype.hasOwnProperty.call(body, key);
  const asNumber = value => (typeof value === "number" || (typeof value === "string" && value.trim()))
    ? Number(value) : NaN;
  let client;
  try {
    client = await pool.connect();
    await client.query("BEGIN");
    // Serialize height/goal changes, including the first profile insert.
    const user = await client.query("SELECT user_id FROM public.users WHERE user_id = $1 FOR UPDATE", [req.userId]);
    if (!user.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "user_not_found" });
    }
    const existing = await client.query(
      "SELECT height_cm, goal_weight_kg, start_weight_kg FROM public.user_profile WHERE user_id = $1",
      [req.userId]
    );
    const previous = existing.rows[0];
    const row = {};
    for (const [camel, col] of Object.entries(TO_DB)) {
      if (has(camel)) row[col] = body[camel];
    }

    if (has("height") || has("goalWeight")) {
      const rawHeight = has("height") ? body.height : previous?.height_cm;
      const rawGoal = has("goalWeight") ? body.goalWeight : previous?.goal_weight_kg;
      const height = asNumber(rawHeight);
      const goal = asNumber(rawGoal);
      if ((rawHeight != null && (!Number.isInteger(height) || height <= 0))
        || (rawGoal != null && (!Number.isFinite(goal) || goal <= 0 || !Number.isInteger(height) || height <= 0))) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "invalid_goal_profile" });
      }
      if (rawGoal != null) {
        const minGoalWeight = Math.ceil(18.5 * (height / 100) ** 2 * 10) / 10;
        if (goal < minGoalWeight) {
          await client.query("ROLLBACK");
          return res.status(400).json({ error: "goal_weight_too_low", height, minGoalWeight });
        }
      }
      if (has("height") && rawHeight != null) row.height_cm = height;
      if (has("goalWeight") && rawGoal != null) row.goal_weight_kg = goal;
    }

    if (has("name")) {
      const trimmed = String(body.name ?? "").trim();
      await client.query("UPDATE public.users SET name = $1 WHERE user_id = $2", [trimmed || null, req.userId]);
    }
    if (has("weight") && (!previous || previous.start_weight_kg == null)) {
      row.start_weight_kg = body.weight;
    }
    if (Object.keys(row).length) {
      await upsert("public.user_profile", ["user_id"], [req.userId], row, client);
    }
    await client.query("COMMIT");
    res.json({ ok: true });
  } catch (e) {
    if (client) await client.query("ROLLBACK").catch(() => {});
    console.error("PUT /profile:", e);
    res.status(500).json({ error: "save_failed" });
  } finally {
    client?.release();
  }
});

export default r;

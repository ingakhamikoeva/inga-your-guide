import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { pool, upsert } from "./_helpers.js";

const r = Router();
r.use(requireAuth);

// Daily nutrition summary
function rowToSummary(d) {
  if (!d) return null;
  return {
    calorie_target: d.calorie_target,
    calories_eaten_estimated: d.calories_eaten_estimated,
    calories_left: d.calories_left,
    protein_estimated_g: Number(d.protein_estimated_g),
    fat_estimated_g: Number(d.fat_estimated_g),
    carbs_estimated_g: Number(d.carbs_estimated_g),
    fiber_estimated_g: Number(d.fiber_estimated_g),
    protein_status: d.protein_status ?? "low",
    fat_status: d.fat_status ?? "ok",
    carbs_status: d.carbs_status ?? "ok",
    fiber_status: d.fiber_status ?? "low",
    summary_comment: d.summary_comment ?? "",
    is_estimate: !!d.is_estimate,
    meal_count: (d.calories_eaten_estimated ?? 0) > 0 ? 1 : 0,
  };
}

r.get("/summary/:date", async (req, res) => {
  try {
    const q = await pool.query(
      `SELECT * FROM public.daily_nutrition_summary WHERE user_id = $1 AND date = $2`,
      [req.userId, req.params.date]
    );
    res.json(rowToSummary(q.rows[0]));
  } catch (e) {
    console.error("GET /nutrition/summary:", e);
    res.status(500).json({ error: "load_failed" });
  }
});

r.put("/summary/:date", async (req, res) => {
  const cols = [
    "calorie_target","calories_eaten_estimated","calories_left",
    "protein_estimated_g","fat_estimated_g","carbs_estimated_g","fiber_estimated_g",
    "protein_status","fat_status","carbs_status","fiber_status",
    "summary_comment","is_estimate",
  ];
  const row = {};
  for (const c of cols) if (Object.prototype.hasOwnProperty.call(req.body || {}, c)) row[c] = req.body[c];
  try {
    await upsert(
      "public.daily_nutrition_summary",
      ["user_id", "date"],
      [req.userId, req.params.date],
      row
    );
    res.json({ ok: true });
  } catch (e) {
    console.error("PUT /nutrition/summary:", e);
    res.status(500).json({ error: "save_failed" });
  }
});

// Food reference lookup (used by food-lookup.ts before AI fallback).
// Mounted at /api/v1/food-reference (not under /nutrition).
export const foodReferenceRouter = Router();
foodReferenceRouter.use(requireAuth);
foodReferenceRouter.get("/", async (req, res) => {
  const q = String(req.query?.q ?? "").trim().toLowerCase();
  if (!q) return res.json(null);
  try {
    const r2 = await pool.query(
      `SELECT calories_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g,
              fiber_per_100g, recommended_portion_g, liquid_calories
         FROM public.food_reference
        WHERE lower(product_name_ru) LIKE $1
        LIMIT 1`,
      [q]
    );
    res.json(r2.rows[0] ?? null);
  } catch (e) {
    console.error("GET /food-reference:", e);
    res.status(500).json({ error: "load_failed" });
  }
});

export default r;

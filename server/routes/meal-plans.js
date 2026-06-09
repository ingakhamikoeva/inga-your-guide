import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { pool, upsert } from "./_helpers.js";

const r = Router();
r.use(requireAuth);

r.get("/:date", async (req, res) => {
  try {
    const q = await pool.query(
      `SELECT plan_text FROM public.meal_plans WHERE user_id = $1 AND date_for = $2`,
      [req.userId, req.params.date]
    );
    res.json(q.rows[0]?.plan_text ?? null);
  } catch (e) {
    console.error("GET /meal-plans/:date:", e);
    res.status(500).json({ error: "load_failed" });
  }
});

r.put("/:date", async (req, res) => {
  const planText = String(req.body?.planText ?? req.body?.plan_text ?? "");
  try {
    await upsert(
      "public.meal_plans",
      ["user_id", "date_for"],
      [req.userId, req.params.date],
      { plan_text: planText }
    );
    res.json({ ok: true });
  } catch (e) {
    console.error("PUT /meal-plans/:date:", e);
    res.status(500).json({ error: "save_failed" });
  }
});

export default r;

import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { pool, upsert } from "./_helpers.js";

const r = Router();
r.use(requireAuth);

r.get("/", async (req, res) => {
  try {
    const q = await pool.query(`SELECT * FROM public.user_plan WHERE user_id = $1`, [req.userId]);
    const d = q.rows[0];
    if (!d) return res.json(null);
    res.json({
      paceChoice: d.pace ?? undefined,
      trackingMethod: d.tracking_method ?? undefined,
      calorieTarget: d.calorie_target ?? undefined,
      corridorMin: d.calorie_corridor_low ?? undefined,
      corridorMax: d.calorie_corridor_high ?? undefined,
    });
  } catch (e) {
    console.error("GET /plan:", e);
    res.status(500).json({ error: "load_failed" });
  }
});

r.put("/", async (req, res) => {
  const b = req.body || {};
  const row = {
    pace: b.paceChoice ?? null,
    calorie_target: b.calorieTarget ?? null,
    calorie_corridor_low: b.corridorMin ?? null,
    calorie_corridor_high: b.corridorMax ?? null,
    tracking_method: b.trackingMethod ?? null,
  };
  try {
    await upsert("public.user_plan", ["user_id"], [req.userId], row);
    res.json({ ok: true });
  } catch (e) {
    console.error("PUT /plan:", e);
    res.status(500).json({ error: "save_failed" });
  }
});

export default r;

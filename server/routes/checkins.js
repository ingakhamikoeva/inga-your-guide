import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { pool, upsert } from "./_helpers.js";

const r = Router();
r.use(requireAuth);

r.get("/", async (req, res) => {
  try {
    const q = await pool.query(
      `SELECT date, weight_kg FROM public.daily_checkins
        WHERE user_id = $1 AND weight_kg IS NOT NULL ORDER BY date ASC`,
      [req.userId]
    );
    res.json(q.rows.map((d) => ({ date: d.date, weight: Number(d.weight_kg) })));
  } catch (e) {
    console.error("GET /checkins:", e);
    res.status(500).json({ error: "load_failed" });
  }
});

r.get("/:date", async (req, res) => {
  const { date } = req.params;
  try {
    const q = await pool.query(
      `SELECT date, weight_kg, sleep_hours, steps_yesterday
         FROM public.daily_checkins
        WHERE user_id = $1 AND date = $2
        LIMIT 1`,
      [req.userId, date]
    );
    if (!q.rows.length) return res.json(null);
    const d = q.rows[0];
    res.json({
      date: d.date,
      weight: d.weight_kg != null ? Number(d.weight_kg) : null,
      sleepHours: d.sleep_hours != null ? Number(d.sleep_hours) : null,
      stepsYesterday: d.steps_yesterday != null ? Number(d.steps_yesterday) : null,
    });
  } catch (e) {
    console.error("GET /checkins/:date:", e);
    res.status(500).json({ error: "load_failed" });
  }
});

r.put("/:date", async (req, res) => {
  const { date } = req.params;
  const { weight = null, sleepHours = null, stepsYesterday = null } = req.body || {};
  try {
    await upsert(
      "public.daily_checkins",
      ["user_id", "date"],
      [req.userId, date],
      { weight_kg: weight, sleep_hours: sleepHours, steps_yesterday: stepsYesterday }
    );
    res.json({ ok: true });
  } catch (e) {
    console.error("PUT /checkins/:date:", e);
    res.status(500).json({ error: "save_failed" });
  }
});

export default r;

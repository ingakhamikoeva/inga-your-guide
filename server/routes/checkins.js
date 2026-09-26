import { requireAccessForWrite } from '../access.js';
import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { pool, upsert } from "./_helpers.js";

const r = Router();
r.use(requireAuth);
r.use(requireAccessForWrite);

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
      `SELECT date, weight_kg, sleep_hours, steps_yesterday, stool_yesterday
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
      stoolYesterday: d.stool_yesterday != null ? Boolean(d.stool_yesterday) : null,
    });
  } catch (e) {
    console.error("GET /checkins/:date:", e);
    res.status(500).json({ error: "load_failed" });
  }
});

r.put("/:date", async (req, res) => {
  const { date } = req.params;
  const body = req.body || {};
  // Missing/null fields are unanswered, including requests from older clients.
  // Update only supplied values; keep valid zero and false values.
  const row = {};
  const fields = {
    weight: "weight_kg",
    sleepHours: "sleep_hours",
    stepsYesterday: "steps_yesterday",
    stoolYesterday: "stool_yesterday",
  };
  for (const [field, column] of Object.entries(fields)) {
    if (Object.prototype.hasOwnProperty.call(body, field) && body[field] != null) {
      row[column] = body[field];
    }
  }
  if (!Object.keys(row).length) return res.json({ ok: true });
  try {
    await upsert(
      "public.daily_checkins",
      ["user_id", "date"],
      [req.userId, date],
      row
    );
    res.json({ ok: true });
  } catch (e) {
    console.error("PUT /checkins/:date:", e);
    res.status(500).json({ error: "save_failed" });
  }
});

export default r;

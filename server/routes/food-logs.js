import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { pool } from "./_helpers.js";

const r = Router();
r.use(requireAuth);

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
    let rows;
    if (date && /^\d{4}-\d{2}-\d{2}$/.test(String(date))) {
      const result = await pool.query(
        `SELECT log_id, raw_text, meal_tag, datetime, meta
           FROM public.food_logs
          WHERE user_id = $1
            AND datetime >= ($2::date)::timestamptz
            AND datetime <  (($2::date) + INTERVAL '1 day')::timestamptz
          ORDER BY datetime ASC`,
        [userId, date]
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

r.post("/", async (req, res) => {
  const { description = "", mealTag = "unknown", datetime, meta } = req.body || {};
  try {
    const userId = await resolveUserId(req);
    const result = await pool.query(
      `INSERT INTO public.food_logs (user_id, raw_text, meal_tag, datetime, meta)
       VALUES ($1, $2, $3, COALESCE($4::timestamptz, now()), COALESCE($5::jsonb, '{}'::jsonb))
       RETURNING log_id, raw_text, meal_tag, datetime, meta`,
      [userId, description, mealTag, datetime ?? null, meta ? JSON.stringify(meta) : null]
    );
    res.json(result.rows[0]);
  } catch (e) {
    console.error("POST /food-logs:", e);
    res.status(500).json({ error: "save_failed" });
  }
});

r.patch("/:id", async (req, res) => {
  const { id } = req.params;
  const { description, mealTag, datetime, meta } = req.body || {};
  try {
    const userId = await resolveUserId(req);
    const result = await pool.query(
      `UPDATE public.food_logs
          SET raw_text = COALESCE($3, raw_text),
              meal_tag = COALESCE($4, meal_tag),
              datetime = COALESCE($5::timestamptz, datetime),
              meta     = COALESCE($6::jsonb, meta)
        WHERE log_id = $1 AND user_id = $2
        RETURNING log_id, raw_text, meal_tag, datetime, meta`,
      [
        id,
        userId,
        description ?? null,
        mealTag ?? null,
        datetime ?? null,
        meta ? JSON.stringify(meta) : null,
      ]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: "not_found" });
    res.json(result.rows[0]);
  } catch (e) {
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

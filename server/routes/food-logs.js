import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { pool } from "./_helpers.js";

const r = Router();
r.use(requireAuth);

r.post("/", async (req, res) => {
  const { description = "", mealTag = "unknown" } = req.body || {};
  try {
    await pool.query(
      `INSERT INTO public.food_logs (user_id, raw_text, meal_tag) VALUES ($1, $2, $3)`,
      [req.userId, description, mealTag]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error("POST /food-logs:", e);
    res.status(500).json({ error: "save_failed" });
  }
});

export default r;

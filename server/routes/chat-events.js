import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { pool } from "./_helpers.js";

const r = Router();
r.use(requireAuth);

r.post("/", async (req, res) => {
  const { eventType, summary, relatedFoodLogId = null } = req.body || {};
  if (!eventType) return res.status(400).json({ error: "eventType required" });
  try {
    await pool.query(
      `INSERT INTO public.chat_events (user_id, event_type, message_summary, related_food_log_id)
       VALUES ($1, $2, $3, $4)`,
      [req.userId, eventType, summary ?? null, relatedFoodLogId]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error("POST /chat-events:", e);
    res.status(500).json({ error: "save_failed" });
  }
});

export default r;

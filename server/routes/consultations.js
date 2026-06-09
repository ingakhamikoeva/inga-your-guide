import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { pool } from "./_helpers.js";

const r = Router();
r.use(requireAuth);

r.post("/", async (req, res) => {
  try {
    await pool.query(
      `INSERT INTO public.consultations (user_id, status) VALUES ($1, 'requested')`,
      [req.userId]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error("POST /consultations:", e);
    res.status(500).json({ error: "save_failed" });
  }
});

export default r;

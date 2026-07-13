import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { pool } from "./_helpers.js";

const r = Router();
r.use(requireAuth);

const MAX_PHOTOS = 20;

// Список фото пользователя вместе с миниатюрами (для галереи — без тяжёлых полноразмерных картинок)
r.get("/", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, thumb_data, taken_at, created_at FROM public.profile_photos
       WHERE user_id = $1 ORDER BY taken_at ASC`,
      [req.userId]
    );
    res.json({ photos: rows });
  } catch (e) {
    console.error("GET /profile-photos:", e);
    res.status(500).json({ error: "fetch_failed" });
  }
});

// Полное изображение одного фото (по требованию — для коллажа, не для общего списка)
r.get("/:id/image", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT image_data FROM public.profile_photos WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.userId]
    );
    if (!rows.length) return res.status(404).json({ error: "not_found" });
    res.json({ image_data: rows[0].image_data });
  } catch (e) {
    console.error("GET /profile-photos/:id/image:", e);
    res.status(500).json({ error: "fetch_failed" });
  }
});

// Загрузка нового фото
r.post("/", async (req, res) => {
  const { image_data, thumb_data, taken_at } = req.body || {};
  if (!image_data || typeof image_data !== "string") {
    return res.status(400).json({ error: "image_data required" });
  }
  if (!thumb_data || typeof thumb_data !== "string") {
    return res.status(400).json({ error: "thumb_data required" });
  }
  try {
    const { rows: countRows } = await pool.query(
      `SELECT count(*)::int AS n FROM public.profile_photos WHERE user_id = $1`,
      [req.userId]
    );
    if (countRows[0].n >= MAX_PHOTOS) {
      return res.status(400).json({ error: "limit_reached", limit: MAX_PHOTOS });
    }
    const { rows } = await pool.query(
      `INSERT INTO public.profile_photos (user_id, image_data, thumb_data, taken_at)
       VALUES ($1, $2, $3, COALESCE($4::timestamptz, now()))
       RETURNING id, thumb_data, taken_at, created_at`,
      [req.userId, image_data, thumb_data, taken_at || null]
    );
    res.json({ photo: rows[0] });
  } catch (e) {
    console.error("POST /profile-photos:", e);
    res.status(500).json({ error: "save_failed" });
  }
});

// Удаление фото
r.delete("/:id", async (req, res) => {
  try {
    await pool.query(
      `DELETE FROM public.profile_photos WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.userId]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error("DELETE /profile-photos/:id:", e);
    res.status(500).json({ error: "delete_failed" });
  }
});

export default r;

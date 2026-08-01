// Промокоды: бесплатный доступ без участия платёжной системы.
// Пользователь вводит код → продлевается paid_until в subscriptions.
//
// Правила (согласовано 23.07.2026):
//  - один код нельзя применить дважды одним аккаунтом (UNIQUE в promo_redemptions)
//  - у кода может быть лимит применений (max_uses) и срок жизни (expires_at)
//  - дни добавляются к уже оплаченному сроку, если он в будущем, иначе от «сейчас»

import { Router } from "express";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { pool } from "./_helpers.js";

const r = Router();
r.use(requireAuth);

// Кириллические буквы, неотличимые на вид от латинских. Человек набирает код
// с русской раскладки, видит «FIRST30» и не понимает, почему он не подходит.
// Приводим к латинице ДО поиска в базе — код срабатывает в обеих раскладках.
const LOOKALIKES = {
  "А": "A", "В": "B", "Е": "E", "К": "K", "М": "M", "Н": "H", "О": "O",
  "Р": "P", "С": "C", "Т": "T", "У": "Y", "Х": "X", "І": "I", "Ѕ": "S",
};

function normalizeCode(input) {
  return String(input || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .split("")
    .map((ch) => LOOKALIKES[ch] || ch)
    .join("");
}

// POST /promo/redeem { code } — погасить промокод
r.post("/redeem", async (req, res) => {
  const raw = normalizeCode(req.body?.code);
  if (!raw) return res.status(400).json({ error: "code_required" });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Блокируем строку кода, чтобы два одновременных запроса не превысили лимит
    const codeQ = await client.query(
      `SELECT code, days, max_uses, used_count, expires_at
       FROM public.promo_codes WHERE code = $1 FOR UPDATE`,
      [raw]
    );
    if (!codeQ.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "not_found" });
    }
    const promo = codeQ.rows[0];

    if (promo.expires_at && new Date(promo.expires_at) < new Date()) {
      await client.query("ROLLBACK");
      return res.status(410).json({ error: "expired" });
    }
    if (promo.max_uses !== null && promo.used_count >= promo.max_uses) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "exhausted" });
    }

    // Уже применял этот код?
    const usedQ = await client.query(
      `SELECT 1 FROM public.promo_redemptions WHERE code = $1 AND user_id = $2`,
      [raw, req.userId]
    );
    if (usedQ.rowCount) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "already_used" });
    }

    // Продлеваем доступ: от большей из дат — текущий paid_until или сейчас
    const subQ = await client.query(
      `INSERT INTO public.subscriptions (user_id, paid_until)
       VALUES ($1, now() + ($2 || ' days')::interval)
       ON CONFLICT (user_id) DO UPDATE
         SET paid_until = GREATEST(COALESCE(public.subscriptions.paid_until, now()), now())
                          + ($2 || ' days')::interval,
             subscription_status = 'active'
       RETURNING paid_until`,
      [req.userId, String(promo.days)]
    );

    await client.query(
      `INSERT INTO public.promo_redemptions (code, user_id, days) VALUES ($1, $2, $3)`,
      [raw, req.userId, promo.days]
    );
    await client.query(
      `UPDATE public.promo_codes SET used_count = used_count + 1 WHERE code = $1`,
      [raw]
    );

    await client.query("COMMIT");
    res.json({ ok: true, days: promo.days, paid_until: subQ.rows[0].paid_until });
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("POST /promo/redeem:", e);
    res.status(500).json({ error: "redeem_failed" });
  } finally {
    client.release();
  }
});

// ── Админка ────────────────────────────────────────────────────────────────

// GET /promo/admin/list — все коды со статистикой
r.get("/admin/list", requireAdmin, async (_req, res) => {
  try {
    const q = await pool.query(
      `SELECT code, days, max_uses, used_count, expires_at, note, created_at
       FROM public.promo_codes ORDER BY created_at DESC`
    );
    res.json({ codes: q.rows });
  } catch (e) {
    console.error("GET /promo/admin/list:", e);
    res.status(500).json({ error: "load_failed" });
  }
});

// POST /promo/admin/create { code, days, max_uses?, expires_at?, note? }
r.post("/admin/create", requireAdmin, async (req, res) => {
  const code = normalizeCode(req.body?.code);
  const days = Number(req.body?.days);
  if (!code || !Number.isFinite(days) || days <= 0) {
    return res.status(400).json({ error: "code_and_days_required" });
  }
  try {
    await pool.query(
      `INSERT INTO public.promo_codes (code, days, max_uses, expires_at, note)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        code,
        Math.round(days),
        req.body?.max_uses ? Number(req.body.max_uses) : null,
        req.body?.expires_at || null,
        req.body?.note || null,
      ]
    );
    res.json({ ok: true });
  } catch (e) {
    if (e.code === "23505") return res.status(409).json({ error: "already_exists" });
    console.error("POST /promo/admin/create:", e);
    res.status(500).json({ error: "create_failed" });
  }
});

// DELETE /promo/admin/:code — удалить код (погашения сохраняются каскадом? нет — они удалятся,
// поэтому доступ у уже применивших НЕ отзывается: paid_until остаётся как есть)
r.delete("/admin/:code", requireAdmin, async (req, res) => {
  try {
    await pool.query(`DELETE FROM public.promo_codes WHERE code = $1`, [
      normalizeCode(req.params.code),
    ]);
    res.json({ ok: true });
  } catch (e) {
    console.error("DELETE /promo/admin:", e);
    res.status(500).json({ error: "delete_failed" });
  }
});

export default r;

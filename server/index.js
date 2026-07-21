// Self-hosted API server. JWT (HS256) + direct Postgres. No Supabase.
import express from "express";
import cors from "cors";

import { pool } from "./db.js";
import { requireAuthInline as requireAuth } from "./middleware/auth.js";
import { handleAskInga } from "./ask-inga.js";
import { handleEstimateNutrition } from "./estimate-nutrition.js";
import { handleStartTrial } from "./start-trial.js";
import { registerAuthRoutes } from "./auth.js";
import { registerRoutes } from "./routes/index.js";
import { startEmailDripScheduler } from "./email-drip.js";
import { verifyUnsubscribeToken } from "./mailer.js";

const { PORT = "8787", JWT_SECRET, CORS_ORIGIN = "*" } = process.env;
if (!JWT_SECRET) console.warn("[boot] JWT_SECRET is not set — auth will fail");

// Re-export for legacy importers (server/auth.js, ask-inga.js, etc.).
export { pool, requireAuth };

const app = express();
app.use(cors({ origin: CORS_ORIGIN === "*" ? true : CORS_ORIGIN.split(",") }));
app.use(express.json({ limit: "2mb" }));

// --- Простой rate limiter (в памяти, без зависимостей) ---
// Защита от перебора паролей и от выжигания AI-бюджета.
function makeLimiter({ windowMs, max }) {
  const hits = new Map();
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of hits) if (now - v.start > windowMs) hits.delete(k);
  }, windowMs).unref();
  return (req, res, next) => {
    const key = req.headers["x-real-ip"] || req.ip || "unknown";
    const now = Date.now();
    let rec = hits.get(key);
    if (!rec || now - rec.start > windowMs) { rec = { start: now, count: 0 }; hits.set(key, rec); }
    rec.count += 1;
    if (rec.count > max) return res.status(429).json({ error: "too_many_requests" });
    next();
  };
}
const authLimiter = makeLimiter({ windowMs: 15 * 60 * 1000, max: 20 });   // 20 попыток / 15 мин с IP
const aiLimiter = makeLimiter({ windowMs: 60 * 60 * 1000, max: 60 });     // 60 AI-запросов / час с IP
app.use("/api/v1/auth/login", authLimiter);
app.use("/api/v1/auth/signup", authLimiter);
app.use("/api/v1/ask-inga", aiLimiter);
app.use("/api/v1/estimate-nutrition", aiLimiter);

app.get("/healthz", (_req, res) => res.json({ ok: true }));

// Публичная отписка от email-цепочки (без авторизации — по требованию закона,
// ссылка из письма должна работать в один клик). Токен — HMAC от userId,
// не хранится отдельно, см. server/mailer.js.
app.get("/api/v1/email/unsubscribe", async (req, res) => {
  const uid = String(req.query.uid || "");
  const token = String(req.query.token || "");
  if (!uid || !verifyUnsubscribeToken(uid, token)) {
    return res.status(400).send("Ссылка недействительна.");
  }
  try {
    await pool.query(
      `UPDATE public.users SET email_unsubscribed_at = now() WHERE user_id = $1 AND email_unsubscribed_at IS NULL`,
      [uid]
    );
    res.send("Вы отписались от писем legche.online. Приложением можно пользоваться как обычно.");
  } catch (e) {
    console.error("unsubscribe failed:", e.message);
    res.status(500).send("Не получилось отписаться — попробуйте ещё раз позже.");
  }
});

// Auth (Phase 1)
registerAuthRoutes(app, "/api/v1/auth");

// Data routes (Phase 2)
registerRoutes(app, "/api/v1");

// AI endpoints — all under /api/v1.
app.post("/api/v1/ask-inga", handleAskInga);
app.post("/api/v1/estimate-nutrition", handleEstimateNutrition);
app.post("/api/v1/start-trial", handleStartTrial);

app.listen(Number(PORT), () => {
  console.log(`[boot] legche-api listening on :${PORT}`);
  startEmailDripScheduler();
});

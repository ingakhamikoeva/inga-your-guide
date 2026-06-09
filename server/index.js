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

const { PORT = "8787", JWT_SECRET, CORS_ORIGIN = "*" } = process.env;
if (!JWT_SECRET) console.warn("[boot] JWT_SECRET is not set — auth will fail");

// Re-export for legacy importers (server/auth.js, ask-inga.js, etc.).
export { pool, requireAuth };

const app = express();
app.use(cors({ origin: CORS_ORIGIN === "*" ? true : CORS_ORIGIN.split(",") }));
app.use(express.json({ limit: "100kb" }));

app.get("/healthz", (_req, res) => res.json({ ok: true }));

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
});

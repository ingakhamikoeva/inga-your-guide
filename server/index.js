// Self-hosted API server. JWT is verified locally against JWT_SECRET (HS256).
// DB is reached directly via DATABASE_URL.

import express from "express";
import cors from "cors";
import pg from "pg";
import jwt from "jsonwebtoken";

import { handleAskInga } from "./ask-inga.js";
import { handleEstimateNutrition } from "./estimate-nutrition.js";
import { handleStartTrial } from "./start-trial.js";
import { registerAuthRoutes } from "./auth.js";
import { registerDataRoutes } from "./data.js";

const {
  PORT = "8787",
  DATABASE_URL,
  JWT_SECRET,
  CORS_ORIGIN = "*",
} = process.env;

if (!DATABASE_URL) console.warn("[boot] DATABASE_URL is not set");
if (!JWT_SECRET) console.warn("[boot] JWT_SECRET is not set — auth will fail");

export const pool = new pg.Pool({
  connectionString: DATABASE_URL,
  max: 5,
  ssl: DATABASE_URL?.includes("sslmode=") ? undefined : { rejectUnauthorized: false },
});

export async function requireAuth(req, res) {
  const h = req.headers.authorization || "";
  if (!h.startsWith("Bearer ")) {
    res.status(401).json({ error: "unauthorized" });
    return null;
  }
  const token = h.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET, { algorithms: ["HS256"] });
    if (!payload?.sub) {
      res.status(401).json({ error: "unauthorized" });
      return null;
    }
    return { authId: payload.sub, token, payload };
  } catch (e) {
    res.status(401).json({ error: "unauthorized" });
    return null;
  }
}

const app = express();
app.use(cors({ origin: CORS_ORIGIN === "*" ? true : CORS_ORIGIN.split(",") }));
app.use(express.json({ limit: "100kb" }));

app.get("/healthz", (_req, res) => res.json({ ok: true }));

// Auth (Phase 1)
registerAuthRoutes(app, "/api/v1/auth");

// Data routes (Phase 2)
registerDataRoutes(app, "/api/v1");

// AI endpoints — exposed under /api/v1 (new) and at root (legacy).
app.post("/api/v1/ask-inga", handleAskInga);
app.post("/api/v1/estimate-nutrition", handleEstimateNutrition);
app.post("/api/v1/start-trial", handleStartTrial);

app.post("/ask-inga", handleAskInga);
app.post("/estimate-nutrition", handleEstimateNutrition);
app.post("/start-trial", handleStartTrial);

app.listen(Number(PORT), () => {
  console.log(`[boot] legche-api listening on :${PORT}`);
});

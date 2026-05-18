// Self-hosted API server replacing Lovable edge functions.
// All secrets come from .env. The frontend talks to this server when
// VITE_API_BASE_URL is set; otherwise it still uses supabase.functions.invoke.

import express from "express";
import cors from "cors";
import pg from "pg";
import { createClient } from "@supabase/supabase-js";

import { handleAskInga } from "./ask-inga.js";
import { handleEstimateNutrition } from "./estimate-nutrition.js";
import { handleStartTrial } from "./start-trial.js";

const {
  PORT = "8787",
  DATABASE_URL,
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  CORS_ORIGIN = "*",
} = process.env;

if (!DATABASE_URL) console.warn("[boot] DATABASE_URL is not set");
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn("[boot] SUPABASE_URL / SUPABASE_ANON_KEY missing — JWT validation will fail");
}

// Single pg pool, shared across handlers
export const pool = new pg.Pool({
  connectionString: DATABASE_URL,
  max: 5,
  ssl: DATABASE_URL?.includes("sslmode=") ? undefined : { rejectUnauthorized: false },
});

// Auth-only client: used to validate the user's JWT.
const supabaseAuth = createClient(SUPABASE_URL || "", SUPABASE_ANON_KEY || "", {
  auth: { persistSession: false, autoRefreshToken: false },
});

export async function requireAuth(req, res) {
  const h = req.headers.authorization || "";
  if (!h.startsWith("Bearer ")) {
    res.status(401).json({ error: "unauthorized" });
    return null;
  }
  const token = h.slice(7);
  const { data, error } = await supabaseAuth.auth.getUser(token);
  if (error || !data?.user) {
    res.status(401).json({ error: "unauthorized" });
    return null;
  }
  return { authId: data.user.id, token };
}

const app = express();
app.use(cors({ origin: CORS_ORIGIN === "*" ? true : CORS_ORIGIN.split(",") }));
app.use(express.json({ limit: "100kb" }));

app.get("/healthz", (_req, res) => res.json({ ok: true }));

app.post("/ask-inga", handleAskInga);
app.post("/estimate-nutrition", handleEstimateNutrition);
app.post("/start-trial", handleStartTrial);

app.listen(Number(PORT), () => {
  console.log(`[boot] legche-api listening on :${PORT}`);
});

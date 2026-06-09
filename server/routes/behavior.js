import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { pool, upsert } from "./_helpers.js";

const r = Router();
r.use(requireAuth);

// Russian-label → enum maps, ported from old src/lib/db.ts.
const patternMap = {
  "эмоциональное питание": "emotional",
  "восстановительное питание": "restorative",
  "хаотичное питание": "chaotic",
  "интуитивное питание": "intuitive",
};
const triggerMap = {
  "усталость": "fatigue", "стресс": "stress", "скука": "social", "привычка": "no_plan",
};
const timeMap = {
  "утро": "morning", "день": "day", "вечер": "evening", "ночь": "night",
};
const awarenessMap = {
  "высокий": "high", "средний": "medium", "низкий": "low",
};
const styleMap = {
  "мягкий поддерживающий": "supportive", "структурный": "structured", "смешанный": "mixed",
};

function invert(m, v) {
  if (!v) return "";
  const hit = Object.entries(m).find(([, x]) => x === v);
  return hit ? hit[0] : "";
}

r.get("/", async (req, res) => {
  try {
    const q = await pool.query(`SELECT * FROM public.behavior_profile WHERE user_id = $1`, [req.userId]);
    const d = q.rows[0];
    if (!d) return res.json(null);
    res.json({
      pattern: invert(patternMap, d.eating_pattern),
      trigger: invert(triggerMap, d.primary_trigger),
      vulnerableTime: invert(timeMap, d.vulnerable_time),
      awareness: invert(awarenessMap, d.interoception_level),
      supportStyle: invert(styleMap, d.recommended_coaching_style),
    });
  } catch (e) {
    console.error("GET /behavior:", e);
    res.status(500).json({ error: "load_failed" });
  }
});

r.put("/", async (req, res) => {
  const b = req.body || {};
  const row = {
    eating_pattern: patternMap[b.pattern] ?? null,
    primary_trigger: triggerMap[b.trigger] ?? null,
    vulnerable_time: timeMap[b.vulnerableTime] ?? null,
    interoception_level: awarenessMap[b.awareness] ?? null,
    recommended_coaching_style: styleMap[b.supportStyle] ?? null,
  };
  try {
    await upsert("public.behavior_profile", ["user_id"], [req.userId], row);
    res.json({ ok: true });
  } catch (e) {
    console.error("PUT /behavior:", e);
    res.status(500).json({ error: "save_failed" });
  }
});

export default r;

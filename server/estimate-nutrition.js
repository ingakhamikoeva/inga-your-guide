import { requireAuth } from "./index.js";
import { deepseekChat } from "./deepseek.js";

const FALLBACK = {
  calories: 0, protein_g: 0, fat_g: 0, carbs_g: 0, fiber_g: 0,
  has_protein: false, has_veg: false, has_fast_carbs_only: false,
  liquid_calories: false, confidence: "low",
};

const SYSTEM_PROMPT = `Ты — нутриционный калькулятор. Оцени приём пищи и верни СТРОГО JSON:
{"calories":number,"protein_g":number,"fat_g":number,"carbs_g":number,"fiber_g":number,
"has_protein":boolean,"has_veg":boolean,"has_fast_carbs_only":boolean,"liquid_calories":boolean,
"confidence":"low"|"medium"|"high"}`;

export async function handleEstimateNutrition(req, res) {
  const auth = await requireAuth(req, res);
  if (!auth) return;

  const text = ((req.body?.text) || "").toString().trim();
  if (!text) return res.json({ estimate: FALLBACK, source: "empty" });
  if (text.length > 1000) {
    return res.status(400).json({
      estimate: FALLBACK, source: "too_long",
      userMessage: "Запись слишком длинная. Опиши приём пищи короче.",
    });
  }

  try {
    const content = await deepseekChat(
      [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: text },
      ],
      { temperature: 0.2, maxTokens: 300, jsonMode: true }
    );
    const parsed = JSON.parse(content);
    const estimate = {
      calories: Math.max(0, Math.round(Number(parsed.calories) || 0)),
      protein_g: Math.max(0, Number(parsed.protein_g) || 0),
      fat_g: Math.max(0, Number(parsed.fat_g) || 0),
      carbs_g: Math.max(0, Number(parsed.carbs_g) || 0),
      fiber_g: Math.max(0, Number(parsed.fiber_g) || 0),
      has_protein: !!parsed.has_protein,
      has_veg: !!parsed.has_veg,
      has_fast_carbs_only: !!parsed.has_fast_carbs_only,
      liquid_calories: !!parsed.liquid_calories,
      confidence: ["high","medium"].includes(parsed.confidence) ? parsed.confidence : "low",
    };
    res.json({ estimate, source: "ai_estimate" });
  } catch (e) {
    console.error("estimate-nutrition failed:", e);
    res.json({ estimate: FALLBACK, source: "error" });
  }
}

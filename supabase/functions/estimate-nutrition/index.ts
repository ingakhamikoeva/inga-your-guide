// estimate-nutrition: returns an approximate nutrient breakdown for a free-text meal.
// Provider-agnostic: today uses DeepSeek; later can be swapped for USDA / other backend.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface EstimateRequest {
  text: string;
  mealTag?: string;
}

interface NutritionEstimate {
  calories: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
  fiber_g: number;
  has_protein: boolean;
  has_veg: boolean;
  has_fast_carbs_only: boolean;
  liquid_calories: boolean;
  confidence: "low" | "medium" | "high";
}

const FALLBACK: NutritionEstimate = {
  calories: 0,
  protein_g: 0,
  fat_g: 0,
  carbs_g: 0,
  fiber_g: 0,
  has_protein: false,
  has_veg: false,
  has_fast_carbs_only: false,
  liquid_calories: false,
  confidence: "low",
};

const SYSTEM_PROMPT = `Ты — нутриционный калькулятор. Оцени приём пищи по короткому описанию и верни СТРОГО JSON без пояснений.

Используй средние порции (если не указан вес). Считай калории и макронутриенты в граммах.

Возвращай только этот JSON:
{
  "calories": number,
  "protein_g": number,
  "fat_g": number,
  "carbs_g": number,
  "fiber_g": number,
  "has_protein": boolean,
  "has_veg": boolean,
  "has_fast_carbs_only": boolean,
  "liquid_calories": boolean,
  "confidence": "low" | "medium" | "high"
}

Правила:
- has_protein: true если есть мясо, рыба, яйца, творог, тофу, бобовые
- has_veg: true если есть овощи или зелень
- has_fast_carbs_only: true если только хлеб/булка/печенье/сладкое/лаваш/макароны без белка
- liquid_calories: true если это в основном напиток (кефир, сок, смузи, капучино с молоком)
- confidence: low если описание очень общее, high если есть граммы`;

async function callDeepSeek(userText: string): Promise<NutritionEstimate> {
  const apiKey = Deno.env.get("DEEPSEEK_API_KEY");
  const baseUrl = Deno.env.get("DEEPSEEK_BASE_URL") || "https://api.deepseek.com";
  const model = Deno.env.get("DEEPSEEK_MODEL") || "deepseek-chat";

  if (!apiKey) {
    console.warn("DEEPSEEK_API_KEY missing");
    return FALLBACK;
  }

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userText },
      ],
      temperature: 0.2,
      response_format: { type: "json_object" },
      max_tokens: 300,
    }),
  });

  if (!res.ok) {
    console.error("DeepSeek error:", res.status, await res.text());
    return FALLBACK;
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) return FALLBACK;

  try {
    const parsed = JSON.parse(content);
    return {
      calories: Math.max(0, Math.round(Number(parsed.calories) || 0)),
      protein_g: Math.max(0, Number(parsed.protein_g) || 0),
      fat_g: Math.max(0, Number(parsed.fat_g) || 0),
      carbs_g: Math.max(0, Number(parsed.carbs_g) || 0),
      fiber_g: Math.max(0, Number(parsed.fiber_g) || 0),
      has_protein: !!parsed.has_protein,
      has_veg: !!parsed.has_veg,
      has_fast_carbs_only: !!parsed.has_fast_carbs_only,
      liquid_calories: !!parsed.liquid_calories,
      confidence:
        parsed.confidence === "high" || parsed.confidence === "medium"
          ? parsed.confidence
          : "low",
    };
  } catch (e) {
    console.error("JSON parse failed:", e, content);
    return FALLBACK;
  }
}

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Auth check — only signed-in users may call this paid AI endpoint.
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(
      JSON.stringify({ estimate: FALLBACK, source: "unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace("Bearer ", "");
    const { data, error } = await supabase.auth.getClaims(token);
    if (error || !data?.claims?.sub) {
      return new Response(
        JSON.stringify({ estimate: FALLBACK, source: "unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
  } catch (_) {
    return new Response(
      JSON.stringify({ estimate: FALLBACK, source: "unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  try {
    const body = (await req.json()) as EstimateRequest;
    const text = (body.text || "").trim();

    if (!text) {
      return new Response(JSON.stringify({ estimate: FALLBACK, source: "empty" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // TODO: future — try food_reference + USDA before falling back to AI estimate
    const estimate = await callDeepSeek(text);

    return new Response(JSON.stringify({ estimate, source: "ai_estimate" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("estimate-nutrition failed:", e);
    return new Response(
      JSON.stringify({ estimate: FALLBACK, source: "error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  }
});

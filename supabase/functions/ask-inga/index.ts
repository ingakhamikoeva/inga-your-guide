// ask-inga: provider-agnostic AI endpoint for Inga.
// Frontend calls only this function. The provider (currently DeepSeek) is hidden behind callAIProvider().

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ---------- Types ----------

type RouteType =
  | "food_recommendation"
  | "support"
  | "safety"
  | "food_analysis"
  | "fixation"
  | "maintenance"
  | "general";

interface SafeUserContext {
  name?: string;
  gender?: "female" | "male";
  age?: number;
  height?: number;
  weight?: number;
  goalWeight?: number;
  stage?: "active" | "fixation" | "maintenance";
  trackingMethod?: "calories" | "palm" | "plate";
  triggers?: string[];
  pattern?: string;
  calorieTarget?: number;
  anonymousUserId?: string;
}

interface DayContext {
  todayMeals?: string[];
  sleepHours?: number;
  stepsYesterday?: number;
  yesterdayConclusion?: string;
}

interface AskBody {
  message: string;
  routeType?: RouteType;
  userContext?: SafeUserContext;
  dayContext?: DayContext;
}

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

// ---------- Routing (server-side fallback if client didn't classify) ----------

function detectRoute(message: string, ctx?: SafeUserContext): RouteType {
  const text = (message || "").toLowerCase();

  const safety = [
    "обморок", "теряю сознание", "слабость", "головокруж",
    "боль в груди", "сильная боль", "рвота", "вызвать рвоту",
    "не приходят месячные", "нет месячных", "нет менструац",
    "хочу голодать", "перестать есть", "не есть совсем",
  ];
  if (safety.some((w) => text.includes(w))) return "safety";

  const support = [
    "устала", "устал", "сорвалась", "сорвался", "переела", "переел",
    "хочу сладкого", "тянет на сладкое", "стресс", "тревога",
    "нет сил", "поддержка", "плохо", "грустно", "выгорела",
  ];
  if (support.some((w) => text.includes(w))) return "support";

  const food = [
    "что съесть", "что поесть", "что мне поесть", "что мне съесть",
    "что выбрать", "чем перекусить", "что перекусить", "что приготовить", "помоги выбрать",
    "что-то лёгкое", "что то лёгкое", "что-то легкое", "что то легкое",
    "что можно сейчас", "что можно съесть", "что можно поесть",
    "хочу перекусить", "хочется перекусить",
  ];
  if (food.some((w) => text.includes(w))) return "food_recommendation";

  const analysis = ["разбери рацион", "проанализируй", "оцени мой день", "разбери день"];
  if (analysis.some((w) => text.includes(w))) return "food_analysis";

  if (ctx?.stage === "fixation") return "fixation";
  if (ctx?.stage === "maintenance") return "maintenance";

  return "general";
}

// ---------- System prompts ----------

function baseUserBlock(ctx?: SafeUserContext, day?: DayContext): string {
  const c = ctx ?? {};
  const d = day ?? {};
  return `ДАННЫЕ ПОЛЬЗОВАТЕЛЯ:
- Имя: ${c.name || "(не указано)"}
- Пол: ${c.gender === "male" ? "мужчина" : "женщина"}
- Возраст: ${c.age ?? "—"}
- Рост: ${c.height ?? "—"} см
- Текущий вес: ${c.weight ?? "—"} кг
- Целевой вес: ${c.goalWeight ?? "—"} кг
- Этап: ${c.stage ?? "—"}
- Метод питания: ${c.trackingMethod ?? "—"}
- Цель по калориям: ${c.calorieTarget ?? "—"}
- Пищевые триггеры: ${(c.triggers ?? []).join(", ") || "—"}
- Пищевой профиль: ${c.pattern ?? "—"}

КОНТЕКСТ ДНЯ:
- Приёмы пищи сегодня: ${d.todayMeals?.length ? d.todayMeals.join("; ") : "(пусто)"}
- Сон: ${d.sleepHours ?? "—"} ч
- Шаги вчера: ${d.stepsYesterday ?? "—"}
- Анализ вчера: ${d.yesterdayConclusion ?? "—"}`;
}

const TONE = `Ты — Инга, тёплый и спокойный AI-помощник по снижению веса.
О себе говоришь в женском роде. К пользователю обращаешься в роде, соответствующем полу.
Без обвинений, без чувства вины, без сложных медицинских терминов.
Коротко, по-человечески, 1–2 практических шага.`;

function foodRecommendationPrompt(ctx?: SafeUserContext, day?: DayContext): string {
  return `${TONE}

${baseUserBlock(ctx, day)}

МЕТОД "МЯГКАЯ ЗАМЕНА" (важно для рекомендаций еды):

ЖЁСТКОЕ ПРАВИЛО ПРО ЖИДКИЕ КАЛОРИИ:
- НИКОГДА не предлагай как ответ на "что съесть/перекусить/что-то лёгкое/что можно сейчас":
  кефир (любой жирности, включая 1%), питьевой йогурт, смузи, сок, морс, капучино, латте, какао,
  молочный коктейль, любые сладкие напитки. Это жидкие калории — они почти не насыщают.
- Не называй кефир "лёгким перекусом". Не предлагай его "на ночь", "перед сном", "если хочется чего-то лёгкого".
- Кефир можно упомянуть ТОЛЬКО если пользователь сам прямо спрашивает про кефир.
  В этом случае ответ: "Можно, но лучше не использовать его как замену еды. Кефир — это жидкие калории,
  и он не всегда хорошо держит сытость. Если ты ${ctx?.gender === "male" ? "голоден" : "голодна"}, лучше собрать нормальный приём пищи: белок + овощи + немного углеводов."

КАК ОТВЕЧАТЬ НА "ЧТО СЪЕСТЬ?" / "ЧТО ПЕРЕКУСИТЬ?":
1) Если прошло 3–4 часа после последнего приёма пищи — предлагай ПОЛНОЦЕННЫЙ приём пищи:
   нежирный белок + сложный углевод + клетчатка/овощи.
   Примеры: курица + гречка + овощи; рыба + картофель + салат; индейка + рис + овощи;
   белковый омлет + овощи + кусочек цельнозернового хлеба.
2) Если ${ctx?.gender === "male" ? "пользователь" : "пользовательница"} прямо просит перекус — предлагай лёгкие СЫТНЫЕ варианты, НЕ жидкие калории:
   творог 0%, густой йогурт без сахара (не питьевой), яичный белок / белковый омлет,
   овощи + нежирный белок, ягоды вместе с белковым продуктом, небольшая порция нежирного белка.
3) НЕ предлагай как перекус: кефир, питьевой йогурт, сыр, орехи, авокадо, шоколад, сладости, булочки, бутерброды.
4) Сладкое — только как "сладкая точка" сразу после еды, не вместо неё.

Подстраивайся под метод (palm/plate/calories), но правила выше работают всегда.`;
}

function supportPrompt(ctx?: SafeUserContext, day?: DayContext): string {
  return `${TONE}

${baseUserBlock(ctx, day)}

РЕЖИМ ПОДДЕРЖКИ:
1) Сначала отрази чувства человека одной короткой фразой ("Слышу тебя", "Это правда тяжело").
2) Сними вину: срыв, усталость, тяга на сладкое — нормальная реакция тела/психики, не провал.
3) Один маленький шаг сейчас (стакан воды, 5 минут паузы, тёплый чай, лечь раньше).
Не давай длинных лекций. Не считай калории в этом режиме.`;
}

function safetyPrompt(ctx?: SafeUserContext, day?: DayContext): string {
  return `${TONE}

${baseUserBlock(ctx, day)}

РЕЖИМ БЕЗОПАСНОСТИ:
Пользователь описал тревожный симптом или опасное намерение (голодание, рвота, обмороки, боль).
1) Спокойно прояви заботу и серьёзность ситуации.
2) Прямо скажи: это сигнал тела, который нельзя игнорировать.
3) Рекомендуй обратиться к врачу/специалисту очно. При острых симптомах — скорая помощь.
4) НЕ давай диет-советов в этом сообщении. НЕ обесценивай симптом.
5) Предложи поддержку и возможность поговорить о чувствах.`;
}

function foodAnalysisPrompt(ctx?: SafeUserContext, day?: DayContext): string {
  return `${TONE}

${baseUserBlock(ctx, day)}

РЕЖИМ РАЗБОРА РАЦИОНА:
- Без оценок "хорошо/плохо". Смотри на структуру: белок, овощи, сложные углеводы, жиры, жидкие калории.
- Подсветь 1–2 сильные стороны и 1 мягкое улучшение по принципу "Мягкая замена".
- Не перегружай цифрами, если метод не "calories".`;
}

function fixationPrompt(ctx?: SafeUserContext, day?: DayContext): string {
  return `${TONE}

${baseUserBlock(ctx, day)}

ЭТАП ФИКСАЦИИ:
- Цель — закрепить достигнутый вес 2–4 недели, не уходить в новый дефицит.
- Поддерживай стабильность: те же приёмы пищи, аккуратные порции, минимум жидких калорий.
- Хвалим за устойчивость, а не за минус на весах.`;
}

function maintenancePrompt(ctx?: SafeUserContext, day?: DayContext): string {
  return `${TONE}

${baseUserBlock(ctx, day)}

ЭТАП УДЕРЖАНИЯ:
- Колебания ±1–2 кг — норма.
- Фокус на привычках, а не на цифрах.
- Возвращай к "Мягкой замене" мягко, без давления.`;
}

function generalPrompt(ctx?: SafeUserContext, day?: DayContext): string {
  return `${TONE}

${baseUserBlock(ctx, day)}

ОБЩИЙ РЕЖИМ:
- Отвечай по сути вопроса о питании, весе или приложении.
- Если вопрос уходит в медицину/диагнозы — мягко перенаправь к специалисту.

ЕСЛИ В ОТВЕТЕ КАСАЕШЬСЯ ЕДЫ — ВАЖНО:
- НИКОГДА не предлагай как перекус или "лёгкий вариант": кефир, питьевой йогурт, смузи, сок, капучино, латте, какао, молочный коктейль и любые сладкие напитки. Это жидкие калории.
- Кефир упоминай только если пользователь сам прямо про него спросил.
- Перекус = творог 0%, густой йогурт без сахара, яичный белок/омлет, овощи с нежирным белком, ягоды с белковым продуктом.`;
}

function buildSystemPrompt(route: RouteType, ctx?: SafeUserContext, day?: DayContext): string {
  switch (route) {
    case "food_recommendation": return foodRecommendationPrompt(ctx, day);
    case "support": return supportPrompt(ctx, day);
    case "safety": return safetyPrompt(ctx, day);
    case "food_analysis": return foodAnalysisPrompt(ctx, day);
    case "fixation": return fixationPrompt(ctx, day);
    case "maintenance": return maintenancePrompt(ctx, day);
    default: return generalPrompt(ctx, day);
  }
}

// ---------- Provider abstraction ----------

interface ProviderOptions {
  temperature?: number;
  maxTokens?: number;
}

async function callDeepseek(messages: ChatMessage[], opts: ProviderOptions): Promise<string> {
  const apiKey = Deno.env.get("DEEPSEEK_API_KEY");
  const baseUrl = Deno.env.get("DEEPSEEK_BASE_URL") || "https://api.deepseek.com";
  const model = Deno.env.get("DEEPSEEK_MODEL") || "deepseek-chat";

  if (!apiKey) throw new Error("DEEPSEEK_API_KEY is not configured");

  const url = `${baseUrl.replace(/\/+$/, "")}/chat/completions`;

  let resp: Response;
  try {
    resp = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: opts.temperature ?? 0.4,
        stream: false,
        max_tokens: opts.maxTokens ?? 700,
      }),
    });
  } catch (e) {
    console.error("deepseek network error:", e);
    throw new Error("provider_unreachable");
  }

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    console.error("deepseek error", resp.status, text);

    // Fallback: if model name is invalid, retry once with deepseek-chat.
    if (resp.status === 400 && /model/i.test(text) && model !== "deepseek-chat") {
      console.warn("retrying with deepseek-chat fallback");
      const retry = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages,
          temperature: opts.temperature ?? 0.4,
          stream: false,
          max_tokens: opts.maxTokens ?? 700,
        }),
      });
      if (!retry.ok) throw new Error("provider_error");
      const j = await retry.json();
      return j?.choices?.[0]?.message?.content ?? "";
    }

    throw new Error("provider_error");
  }

  const j = await resp.json();
  return j?.choices?.[0]?.message?.content ?? "";
}

type ProviderName = "deepseek" | "openai" | "yandexgpt" | "gigachat" | "custom_backend";

async function callAIProvider(
  provider: ProviderName,
  messages: ChatMessage[],
  options: ProviderOptions = {},
): Promise<string> {
  switch (provider) {
    case "deepseek":
      return callDeepseek(messages, options);
    // Placeholders — implement when needed.
    case "openai":
    case "yandexgpt":
    case "gigachat":
    case "custom_backend":
      throw new Error(`provider_not_implemented:${provider}`);
    default:
      throw new Error("unknown_provider");
  }
}

// ---------- HTTP entry ----------

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

async function requireAuth(req: Request): Promise<{ ok: true; userId: string } | { ok: false; response: Response }> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return {
      ok: false,
      response: new Response(
        JSON.stringify({ error: "unauthorized", userMessage: "Нужно войти в аккаунт, чтобы Инга могла ответить." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      ),
    };
  }
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const token = authHeader.replace("Bearer ", "");
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user?.id) {
    return {
      ok: false,
      response: new Response(
        JSON.stringify({ error: "unauthorized", userMessage: "Нужно войти в аккаунт, чтобы Инга могла ответить." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      ),
    };
  }
  return { ok: true, userId: data.user.id };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;

  try {
    // Reject oversized payloads early (defence in depth).
    const contentLength = Number(req.headers.get("content-length") || 0);
    if (contentLength > 50_000) {
      return new Response(
        JSON.stringify({ error: "payload_too_large", userMessage: "Сообщение слишком большое." }),
        { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = (await req.json()) as AskBody;
    const message = (body?.message || "").toString().trim();
    if (!message) {
      return new Response(JSON.stringify({ error: "empty_message" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (message.length > 3000) {
      return new Response(
        JSON.stringify({
          error: "message_too_long",
          userMessage: "Сообщение слишком длинное. Сократи его, пожалуйста, и отправь ещё раз.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const routeTypeRaw = (body?.routeType || "").toString();
    if (routeTypeRaw.length > 50) {
      return new Response(
        JSON.stringify({ error: "route_too_long" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    try {
      if (body?.userContext && JSON.stringify(body.userContext).length > 10_000) {
        return new Response(
          JSON.stringify({ error: "user_context_too_large" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (body?.dayContext && JSON.stringify(body.dayContext).length > 15_000) {
        return new Response(
          JSON.stringify({ error: "day_context_too_large" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    } catch (_) {
      return new Response(
        JSON.stringify({ error: "invalid_context" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Strip any potentially sensitive fields if frontend accidentally sends them.
    const rawCtx = (body.userContext ?? {}) as Record<string, unknown>;
    const safeCtx: SafeUserContext = {
      name: rawCtx.name as string | undefined,
      gender: rawCtx.gender as "female" | "male" | undefined,
      age: rawCtx.age as number | undefined,
      height: rawCtx.height as number | undefined,
      weight: rawCtx.weight as number | undefined,
      goalWeight: rawCtx.goalWeight as number | undefined,
      stage: rawCtx.stage as "active" | "fixation" | "maintenance" | undefined,
      trackingMethod: rawCtx.trackingMethod as "calories" | "palm" | "plate" | undefined,
      triggers: Array.isArray(rawCtx.triggers) ? (rawCtx.triggers as string[]) : undefined,
      pattern: rawCtx.pattern as string | undefined,
      calorieTarget: rawCtx.calorieTarget as number | undefined,
      anonymousUserId: rawCtx.anonymousUserId as string | undefined,
    };

    const route: RouteType = body.routeType ?? detectRoute(message, safeCtx);
    const systemPrompt = buildSystemPrompt(route, safeCtx, body.dayContext);

    const messages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: message },
    ];

    const provider: ProviderName = "deepseek";

    let answer: string;
    try {
      answer = await callAIProvider(provider, messages, { temperature: 0.4 });
    } catch (e) {
      console.error("ask-inga provider failure:", e);
      return new Response(
        JSON.stringify({
          error: "provider_unavailable",
          userMessage: "Инга сейчас временно не отвечает. Попробуй ещё раз чуть позже.",
        }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ answer, route, provider }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("ask-inga fatal:", e);
    return new Response(
      JSON.stringify({
        error: "internal_error",
        userMessage: "Инга сейчас временно не отвечает. Попробуй ещё раз чуть позже.",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

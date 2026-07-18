// "Ask Inga" AI endpoint — runs on the standalone Node API.
// Same prompts, routing and provider behaviour as the legacy edge function.

import { requireAuth, pool } from "./index.js";
import { deepseekChat } from "./deepseek.js";

function detectRoute(message, ctx) {
  const text = (message || "").toLowerCase();
  const safety = ["обморок","теряю сознание","слабость","головокруж","боль в груди","сильная боль","рвота","вызвать рвоту","не приходят месячные","нет месячных","нет менструац","хочу голодать","перестать есть","не есть совсем"];
  if (safety.some((w) => text.includes(w))) return "safety";
  const support = ["устала","устал","сорвалась","сорвался","переела","переел","хочу сладкого","тянет на сладкое","стресс","тревога","нет сил","поддержка","плохо","грустно","выгорела"];
  if (support.some((w) => text.includes(w))) return "support";
  const food = ["что съесть","что поесть","что мне поесть","что мне съесть","что выбрать","чем перекусить","что перекусить","что приготовить","помоги выбрать","что-то лёгкое","что то лёгкое","что-то легкое","что то легкое","что можно сейчас","что можно съесть","что можно поесть","хочу перекусить","хочется перекусить"];
  if (food.some((w) => text.includes(w))) return "food_recommendation";
  const analysis = ["разбери рацион","проанализируй","оцени мой день","разбери день"];
  if (analysis.some((w) => text.includes(w))) return "food_analysis";
  if (ctx?.stage === "fixation") return "fixation";
  if (ctx?.stage === "maintenance") return "maintenance";
  return "general";
}

function baseUserBlock(ctx = {}, d = {}) {
  return `ДАННЫЕ ПОЛЬЗОВАТЕЛЯ:
- Имя: ${ctx.name || "(не указано)"}
- Пол: ${ctx.gender === "male" ? "мужчина" : "женщина"}
- Возраст: ${ctx.age ?? "—"}
- Рост: ${ctx.height ?? "—"} см
- Текущий вес: ${ctx.weight ?? "—"} кг
- Целевой вес: ${ctx.goalWeight ?? "—"} кг
- Этап: ${ctx.stage ?? "—"}
- Метод питания: ${ctx.trackingMethod ?? "—"}
- Цель по калориям: ${ctx.calorieTarget ?? "—"}
- Пищевые триггеры: ${(ctx.triggers ?? []).join(", ") || "—"}
- Пищевой профиль: ${ctx.pattern ?? "—"}

КОНТЕКСТ ДНЯ:
- Приёмы пищи сегодня: ${d.todayMeals?.length ? d.todayMeals.join("; ") : "(пусто)"}
- Сон: ${d.sleepHours ?? "—"} ч
- Шаги вчера: ${d.stepsYesterday ?? "—"}
- Анализ вчера: ${d.yesterdayConclusion ?? "—"}`;
}

let TONE_DEFAULT = `Ты — Инга, тёплый и спокойный AI-помощник по снижению веса по методу «Лёгкая замена».
О себе говоришь в женском роде. К пользователю обращаешься СТРОГО на «вы», в роде, соответствующем полу.
Без обвинений, без чувства вины, без сложных медицинских терминов.
Коротко, по-человечески, 1–2 практических шага.
ПИШИ ТОЛЬКО ОБЫЧНЫМ ТЕКСТОМ. Никакого markdown: никаких **, *, #, _. Только слова и знаки препинания.

ПРАВИЛА МЕТОДА «ЛЁГКАЯ ЗАМЕНА» — соблюдай их в КАЖДОМ ответе:
1. Замены вместо запретов: любимое блюдо не запрещаем, а предлагаем его лёгкую версию.
2. Калории едим, а не пьём. НИКОГДА не советуй жидкие калории: кефир, ряженку, смузи, соки, молоко как напиток, капучино, латте, какао, молочные коктейли, сладкие напитки. Из напитков можно: вода, чай и кофе без сахара (можно с сахарозаменителем), протеиновый капучино, белковый коктейль на воде.
3. Сахар не советуем — только безопасные сахарозаменители (аллюлоза, трегалоза, стевия, эритрит).
4. Алкоголь не одобряем и не хвалим. Если пользователь спрашивает или сообщает об алкоголе — не осуждай, но мягко напомни: во время снижения веса лучше отказаться, так как алкоголь вызывает отёки; если без этого никак — сухое вино до 150 мл. Пиво, сало, колбасы, майонезные закуски НЕ хвали и не называй допустимым выбором — предложи лёгкую альтернативу без чувства вины.
5. Сладкая точка — десерт без сахара до 100 ккал на 100 г (или фрукты/ягоды до 100 г), только после основного приёма пищи.
6. Вечерний перекус перед сном: 60–100 г нежирного белка + 60–100 г клетчатки, без масла и углеводов.
7. Тарелка: ¼ белок, ¼ сложные углеводы, ½ клетчатка. Не советуй голодание и жёсткие ограничения.
8. Если пользователь сообщает о еде не по методу — не хвали её, но и не стыди: спокойно признай, поддержи и предложи один шаг, как вернуться к методу со следующего приёма пищи.`;

function promptFor(route, tone, overrides, ctx, day) {
  const override = (overrides[route] || "").trim();
  if (override) return `${override}\n\n${baseUserBlock(ctx, day)}`;

  const head = `${tone}\n\n${baseUserBlock(ctx, day)}\n\n`;
  switch (route) {
    case "food_recommendation":
      return head + `МЕТОД «ЛЁГКАЯ ЗАМЕНА». Не предлагай жидкие калории (кефир, смузи, соки, капучино, латте, какао, молочный коктейль, сладкие напитки) как перекус или "лёгкое". Перекус = творог 0%, густой йогурт без сахара, белковый омлет, овощи + нежирный белок, ягоды с белком.`;
    case "support":
      return head + `РЕЖИМ ПОДДЕРЖКИ. 1) Отрази чувства. 2) Сними вину. 3) Один маленький шаг сейчас. Без длинных лекций, без подсчёта калорий.`;
    case "safety":
      return head + `РЕЖИМ БЕЗОПАСНОСТИ. Спокойно прояви заботу, не давай диет-советов, рекомендуй очно к врачу, при острых симптомах — скорая.`;
    case "food_analysis":
      return head + `РЕЖИМ РАЗБОРА РАЦИОНА. Без оценок "хорошо/плохо". Подсветь 1–2 сильные стороны и одно мягкое улучшение.`;
    case "fixation":
      return head + `ЭТАП ФИКСАЦИИ. Поддерживай стабильность 2–4 недели, минимум жидких калорий.`;
    case "maintenance":
      return head + `ЭТАП УДЕРЖАНИЯ. Колебания ±1–2 кг — норма. Фокус на привычках.`;
    default:
      return head + `ОБЩИЙ РЕЖИМ. По сути вопроса. Не предлагай жидкие калории как перекус.`;
  }
}

const DEFAULT_LIMITS = {
  max_message_length: 3000,
  max_user_context_bytes: 10_000,
  max_day_context_bytes: 15_000,
  max_payload_bytes: 50_000,
};
const DEFAULT_MODEL = { provider: "deepseek", model: undefined, temperature: 0.4, max_tokens: 700 };

async function loadSettings() {
  let tone = TONE_DEFAULT;
  let overrides = {};
  let limits = { ...DEFAULT_LIMITS };
  let model = { ...DEFAULT_MODEL };
  try {
    const { rows } = await pool.query(
      `SELECT key, value FROM public.app_settings WHERE key IN ('ai_prompts','ai_model','ai_limits')`
    );
    for (const row of rows) {
      if (row.key === "ai_prompts" && row.value) {
        const v = row.value;
        if (typeof v.tone === "string" && v.tone.trim()) tone = v.tone;
        for (const k of ["food_recommendation","support","safety","food_analysis","fixation","maintenance","general"]) {
          if (typeof v[k] === "string") overrides[k] = v[k];
        }
      }
      if (row.key === "ai_model" && row.value) model = { ...DEFAULT_MODEL, ...row.value };
      if (row.key === "ai_limits" && row.value) limits = { ...DEFAULT_LIMITS, ...row.value };
    }
  } catch (e) {
    console.warn("loadSettings failed, using defaults:", e.message);
  }
  return { tone, overrides, limits, model };
}

export async function handleAskInga(req, res) {
  const auth = await requireAuth(req, res);
  if (!auth) return;

  try {
    const { tone, overrides, limits, model: modelCfg } = await loadSettings();

    const body = req.body || {};
    const message = (body.message || "").toString().trim();
    if (!message) return res.status(400).json({ error: "empty_message" });
    if (message.length > limits.max_message_length) {
      return res.status(400).json({
        error: "message_too_long",
        userMessage: "Сообщение слишком длинное. Сократи его, пожалуйста, и отправь ещё раз.",
      });
    }

    const ctx = body.userContext || {};
    const day = body.dayContext || {};
    if (JSON.stringify(ctx).length > limits.max_user_context_bytes) {
      return res.status(400).json({ error: "user_context_too_large" });
    }
    if (JSON.stringify(day).length > limits.max_day_context_bytes) {
      return res.status(400).json({ error: "day_context_too_large" });
    }

    const route = body.routeType || detectRoute(message, ctx);
    const systemPrompt = promptFor(route, tone, overrides, ctx, day);

    let answer;
    try {
      answer = await deepseekChat(
        [
          { role: "system", content: systemPrompt },
          { role: "user", content: message },
        ],
        {
          temperature: modelCfg.temperature ?? 0.4,
          maxTokens: modelCfg.max_tokens ?? 700,
          model: modelCfg.model,
        }
      );
    } catch (e) {
      console.error("ask-inga provider failure:", e);
      return res.status(503).json({
        error: "provider_unavailable",
        userMessage: "Инга сейчас временно не отвечает. Попробуй ещё раз чуть позже.",
      });
    }

    res.json({ answer, route, provider: "deepseek" });
  } catch (e) {
    console.error("ask-inga fatal:", e);
    res.status(500).json({
      error: "internal_error",
      userMessage: "Инга сейчас временно не отвечает. Попробуй ещё раз чуть позже.",
    });
  }
}

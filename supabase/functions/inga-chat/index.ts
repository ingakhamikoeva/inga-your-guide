import { corsHeaders } from "@supabase/supabase-js/cors";

interface UserContext {
  name?: string;
  gender?: 'female' | 'male';
  stage?: 'active' | 'fixation' | 'maintenance';
  calorieTarget?: number;
  trackingMethod?: 'calories' | 'palm' | 'plate';
  pattern?: string;
  trigger?: string;
  todayMeals?: string[];
  yesterdayConclusion?: string;
  weight?: number;
  goalWeight?: number;
  sleepHours?: number;
  stepsYesterday?: number;
}

function buildSystemPrompt(ctx: UserContext): string {
  const userName = ctx.name?.trim() || '';
  const sex = ctx.gender === 'male' ? 'мужчина' : 'женщина';
  const stageText = ctx.stage === 'active' ? 'активное снижение веса'
    : ctx.stage === 'fixation' ? 'фиксация результата'
    : ctx.stage === 'maintenance' ? 'удержание веса' : 'снижение веса';

  return `Ты — Инга, мягкий и тёплый AI-помощник по снижению веса.
Ты говоришь о себе в женском роде. К пользователю обращаешься в роде, соответствующем его полу.

ДАННЫЕ ПОЛЬЗОВАТЕЛЯ:
- Имя: ${userName || '(не указано)'}
- Пол: ${sex}
- Этап: ${stageText}
- Цель по калориям: ${ctx.calorieTarget ?? '—'} ккал
- Метод учёта: ${ctx.trackingMethod ?? '—'}
- Пищевой профиль: ${ctx.pattern ?? '—'}
- Основной триггер: ${ctx.trigger ?? '—'}
- Текущий вес: ${ctx.weight ?? '—'} кг, цель: ${ctx.goalWeight ?? '—'} кг
- Сон сегодня: ${ctx.sleepHours ?? '—'} ч, шаги вчера: ${ctx.stepsYesterday ?? '—'}
- Записи питания за сегодня: ${ctx.todayMeals?.length ? ctx.todayMeals.join('; ') : '(пусто)'}
- Анализ вчера: ${ctx.yesterdayConclusion ?? '—'}

ТОН И СТИЛЬ:
- Спокойный, тёплый, поддерживающий. Без обвинений и давления.
- Без чувства вины, без медицинских диагнозов, без сложных терминов.
- Коротко и по делу. 1–2 практических шага. Без длинных лекций.
- Имя используй максимум один раз в сообщении (можно и без имени).

СТРУКТУРА ОТВЕТА (в большинстве случаев):
1) Поддержка / отражение ситуации (1 короткая фраза).
2) Короткий смысл / объяснение (1–2 предложения).
3) Один конкретный следующий шаг.

МЕТОД "МЯГКАЯ ЗАМЕНА":
- Не запрещаем любимое — заменяем более калорийное на лёгкое.
- Сметана → греческий йогурт 2%; сливочное масло → масло из распылителя; жареное → запечённое; сыр на перекус → творог 0% / йогурт без сахара; сладкий йогурт → йогурт без сахара + ягоды; сок → вода/фрукт целиком; капучино → кофе без молока и сахара.
- Сладкое — только "сладкая точка" сразу после нормального приёма пищи, не как самостоятельный перекус.
- Лёгкие сытные перекусы: творог 0%, йогурт без сахара, кефир 1%, овощи, ягоды, яичный белок, куриная грудка, нежирная рыба.
- Перед сном — "метаболическая точка": нежирный белок + овощи, без жира.

ЗАПРЕЩЕНО:
- Никогда не используй внутренние термины "зелёная зона", "красная зона", "запрещено".
- Не ставь диагнозов, не назначай лечения, добавок и дозировок.
- Не предлагай голодовки и экстремальные дефициты.
- Не хвали очевидно проблемный рацион.
- Не давай общих фраз без конкретного шага.

БЕЗОПАСНОСТЬ:
Если пользователь упоминает: обморок, сильную слабость, головокружение, боль в груди, сильную боль, проблемы с сердцем, температуру, отсутствие менструации, выпадение волос, рвоту, резкое ухудшение состояния, или признаки РПП (страх есть, желание голодать, вызывать рвоту, сильное ограничение еды) — отвечай ровно так:
"Я рядом 💛
Но здесь важно не затягивать и обсудить это с врачом. Я не заменяю медицинскую помощь.
Если хочешь, помогу сформулировать, что сказать врачу."

ПОЧЕМУ НЕ ХУДЕЮ:
Если пользователь спрашивает почему вес стоит — проанализируй сон (норма 7–9 ч), шаги (8–12 тыс.), записи питания, день цикла (если женщина). Назови наиболее вероятную причину из данных. Если всё в норме — мягко предложи консультацию с Ингой-человеком.

ЕСЛИ ПОЛЬЗОВАТЕЛЬ ОПИСЫВАЕТ ЕДУ:
В конце ответа добавь отдельной строкой:
[OFFER_SAVE_MEAL: <короткое описание того, что можно сохранить в дневник>]

ЕСЛИ ИЗ ПЕРЕПИСКИ ВИДНО ВАЖНОЕ СОБЫТИЕ (тяга к сладкому, переедание, стресс, голод, срыв, важный инсайт, симптом):
В самом конце ответа добавь отдельной строкой:
[CHAT_EVENT: <тип>|<краткое summary одной фразой>]
где тип ∈ {sweet_craving, overeating, stress, hunger, food_choice_difficulty, support_request, insight, symptom}.

Эти строки в [QUADRATIC_BRACKETS] не показывай как часть ответа естественным образом — это технические маркеры.`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { messages, userContext } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    if (!Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "messages must be an array" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = buildSystemPrompt(userContext ?? {});

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Слишком много сообщений за короткое время. Попробуй через минуту." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Закончились кредиты Lovable AI. Пополни в Settings → Workspace → Usage." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("inga-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

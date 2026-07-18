// Frontend AI provider layer.
// The app calls askInga() — it does NOT know which backend or provider serves the answer.
// Today this hits the Lovable Cloud edge function `ask-inga`. Tomorrow it can point at
// a different backend (e.g. RU-hosted) without touching UI code.

import { invokeFunction } from '@/lib/api-invoke';

export type RouteType =
  | 'food_recommendation'
  | 'support'
  | 'safety'
  | 'food_analysis'
  | 'fixation'
  | 'maintenance'
  | 'general';

export interface AskIngaUserContext {
  name?: string;
  gender?: 'female' | 'male';
  age?: number;
  height?: number;
  weight?: number;
  goalWeight?: number;
  stage?: 'loss' | 'active' | 'fixation' | 'maintenance';
  trackingMethod?: 'calories' | 'palm' | 'plate';
  triggers?: string[];
  pattern?: string;
  calorieTarget?: number;
  anonymousUserId?: string;
}

export interface AskIngaDayContext {
  todayMeals?: string[];
  sleepHours?: number;
  stepsYesterday?: number;
  yesterdayConclusion?: string;
}

export interface AskIngaInput {
  message: string;
  routeType?: RouteType;
  userContext?: AskIngaUserContext;
  dayContext?: AskIngaDayContext;
}

export interface AskIngaResult {
  answer: string;
  route: RouteType;
}

const FALLBACK_MESSAGE = 'Инга сейчас временно не отвечает. Попробуйте ещё раз чуть позже.';

// Lightweight client-side route hint. The server has its own fallback detection,
// so this only needs to be approximate.
export function classifyRoute(message: string, ctx?: AskIngaUserContext): RouteType {
  const t = (message || '').toLowerCase();

  if (/(обморок|теряю сознание|сильная слабость|головокруж|боль в груди|сильная боль|рвота|вызвать рвоту|нет месячных|не приходят месячные|хочу голодать|перестать есть)/.test(t)) {
    return 'safety';
  }
  if (/(устала|устал|сорвал|переел|хочу сладкого|тянет на сладкое|стресс|тревог|нет сил|поддержк|плохо|грустно)/.test(t)) {
    return 'support';
  }
  if (/(что съесть|что поесть|что мне поесть|что мне съесть|что выбрать|чем перекусить|что приготовить|помоги выбрать)/.test(t)) {
    return 'food_recommendation';
  }
  if (/(разбери рацион|проанализируй|оцени мой день|разбери день)/.test(t)) {
    return 'food_analysis';
  }
  if (ctx?.stage === 'fixation') return 'fixation';
  if (ctx?.stage === 'maintenance') return 'maintenance';
  return 'general';
}

export async function askInga(input: AskIngaInput): Promise<AskIngaResult> {
  const routeType = input.routeType ?? classifyRoute(input.message, input.userContext);

  try {
    const { data, error } = await invokeFunction<{ answer?: string; userMessage?: string }>('ask-inga', {
      message: input.message,
      routeType,
      userContext: input.userContext ?? {},
      dayContext: input.dayContext ?? {},
    });

    if (error || !data || typeof (data as { answer?: unknown }).answer !== 'string') {
      const userMessage = (data as { userMessage?: string } | null)?.userMessage;
      return { answer: userMessage || FALLBACK_MESSAGE, route: routeType };
    }

    return { answer: (data as { answer: string }).answer, route: routeType };
  } catch (e) {
    console.error('askInga failed:', e);
    return { answer: FALLBACK_MESSAGE, route: routeType };
  }
}

import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import type { UserProfile, Calculations, DailyReport, FoodProfile } from './types';
import { HAS_API, apiFetch } from './api-client';
import { currentSession } from './auth-storage';

// ── helpers ───────────────────────────────────────────────────────

async function getUserId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from('users')
    .select('user_id')
    .eq('auth_id', user.id)
    .single();
  return data?.user_id ?? null;
}

export async function isAuthenticated(): Promise<boolean> {
  if (HAS_API) return !!currentSession();
  const { data: { user } } = await supabase.auth.getUser();
  return !!user;
}

// ============ USER PROFILE ============

export async function saveUserProfile(profile: Partial<UserProfile>) {
  if (HAS_API) {
    const body: Record<string, unknown> = {};
    if (profile.name !== undefined) body.name = profile.name;
    if (profile.gender !== undefined) body.sex = profile.gender;
    if (profile.age !== undefined) body.age = profile.age;
    if (profile.height !== undefined) body.height_cm = profile.height;
    if (profile.weight !== undefined) {
      body.start_weight_kg = profile.weight;
      body.current_weight_kg = profile.weight;
    }
    if (profile.goalWeight !== undefined) body.goal_weight_kg = profile.goalWeight;
    if (profile.waist !== undefined) body.waist_cm = profile.waist;
    if (profile.hips !== undefined) body.hips_cm = profile.hips;
    if (profile.stepsPerDay !== undefined) body.steps_baseline = profile.stepsPerDay;
    if (profile.weightGainReasons !== undefined) body.weight_gain_reasons = profile.weightGainReasons;
    if (profile.emotionalTrigger !== undefined) body.emotional_trigger = profile.emotionalTrigger;
    if (profile.currentStage !== undefined) body.current_stage = profile.currentStage;
    if (profile.goalReachedAt !== undefined) body.goal_reached_at = profile.goalReachedAt;
    if (profile.fixationStartedAt !== undefined) body.fixation_started_at = profile.fixationStartedAt;
    if (profile.maintenanceStartedAt !== undefined) body.maintenance_started_at = profile.maintenanceStartedAt;
    if (profile.equilibriumCalories !== undefined) body.equilibrium_calories = profile.equilibriumCalories;
    if (profile.currentFixationCalories !== undefined) body.current_fixation_calories = profile.currentFixationCalories;
    if (profile.fixationWeekNumber !== undefined) body.fixation_week_number = profile.fixationWeekNumber;
    if (profile.lastCalorieIncreaseAt !== undefined) body.last_calorie_increase_at = profile.lastCalorieIncreaseAt;
    await apiFetch('/me/profile', { method: 'PUT', body });
    return;
  }

  const userId = await getUserId();
  if (!userId) return;

  if (profile.name !== undefined) {
    const trimmed = (profile.name ?? '').trim();
    await supabase.from('users').update({ name: trimmed || null }).eq('user_id', userId);
  }

  const row = {
    user_id: userId,
    sex: profile.gender ?? null,
    age: profile.age ?? null,
    height_cm: profile.height ?? null,
    start_weight_kg: profile.weight ?? null,
    current_weight_kg: profile.weight ?? null,
    goal_weight_kg: profile.goalWeight ?? null,
    waist_cm: profile.waist ?? null,
    hips_cm: profile.hips ?? null,
    steps_baseline: profile.stepsPerDay ?? null,
    weight_gain_reasons: profile.weightGainReasons ?? null,
    emotional_trigger: profile.emotionalTrigger ?? null,
    current_stage: (profile.currentStage ?? 'loss') as 'loss' | 'fixation' | 'maintenance',
    goal_reached_at: profile.goalReachedAt ?? null,
    fixation_started_at: profile.fixationStartedAt ?? null,
    maintenance_started_at: profile.maintenanceStartedAt ?? null,
    equilibrium_calories: profile.equilibriumCalories ?? null,
    current_fixation_calories: profile.currentFixationCalories ?? null,
    fixation_week_number: profile.fixationWeekNumber ?? null,
    last_calorie_increase_at: profile.lastCalorieIncreaseAt ?? null,
  };

  const { data: existing } = await supabase
    .from('user_profile').select('id').eq('user_id', userId).single();
  if (existing) {
    await supabase.from('user_profile').update(row).eq('user_id', userId);
  } else {
    await supabase.from('user_profile').insert(row);
  }
}

function profileFromRow(data: any, userRow: any): Partial<UserProfile> {
  return {
    name: userRow?.name ?? undefined,
    gender: data?.sex === 'male' ? 'male' : 'female',
    age: data?.age ?? undefined,
    height: data?.height_cm ?? undefined,
    weight: data?.current_weight_kg ? Number(data.current_weight_kg) : undefined,
    goalWeight: data?.goal_weight_kg ? Number(data.goal_weight_kg) : undefined,
    waist: data?.waist_cm ? Number(data.waist_cm) : undefined,
    hips: data?.hips_cm ? Number(data.hips_cm) : undefined,
    stepsPerDay: data?.steps_baseline ?? undefined,
    weightGainReasons: data?.weight_gain_reasons ?? undefined,
    emotionalTrigger: data?.emotional_trigger ?? undefined,
    currentStage: (data?.current_stage as 'loss' | 'fixation' | 'maintenance' | undefined) ?? 'loss',
    goalReachedAt: data?.goal_reached_at ?? undefined,
    fixationStartedAt: data?.fixation_started_at ?? undefined,
    maintenanceStartedAt: data?.maintenance_started_at ?? undefined,
    equilibriumCalories: data?.equilibrium_calories ?? undefined,
    currentFixationCalories: data?.current_fixation_calories ?? undefined,
    fixationWeekNumber: data?.fixation_week_number ?? undefined,
    lastCalorieIncreaseAt: data?.last_calorie_increase_at ?? undefined,
  };
}

export async function loadUserProfile(): Promise<Partial<UserProfile> | null> {
  if (HAS_API) {
    const r = await apiFetch<{ user: any; profile: any }>('/me/profile').catch(() => null);
    if (!r || (!r.profile && !r.user)) return null;
    return profileFromRow(r.profile, r.user);
  }

  const userId = await getUserId();
  if (!userId) return null;

  const [{ data }, { data: userRow }] = await Promise.all([
    supabase.from('user_profile').select('*').eq('user_id', userId).single(),
    supabase.from('users').select('name').eq('user_id', userId).single(),
  ]);

  if (!data && !userRow) return null;
  return profileFromRow(data, userRow);
}

// ============ USER PLAN ============

export async function loadUserPlan(): Promise<{
  paceChoice?: 'fast' | 'slow';
  trackingMethod?: 'calories' | 'palm' | 'plate';
  calorieTarget?: number;
  corridorMin?: number;
  corridorMax?: number;
} | null> {
  const map = (data: any) => data ? ({
    paceChoice: (data.pace as 'fast' | 'slow' | null) ?? undefined,
    trackingMethod: (data.tracking_method as 'calories' | 'palm' | 'plate' | null) ?? undefined,
    calorieTarget: data.calorie_target ?? undefined,
    corridorMin: data.calorie_corridor_low ?? undefined,
    corridorMax: data.calorie_corridor_high ?? undefined,
  }) : null;

  if (HAS_API) {
    const r = await apiFetch<{ plan: any }>('/me/plan').catch(() => null);
    return map(r?.plan);
  }
  const userId = await getUserId();
  if (!userId) return null;
  const { data } = await supabase.from('user_plan').select('*').eq('user_id', userId).maybeSingle();
  return map(data);
}

export async function loadBehaviorProfile(): Promise<FoodProfile | null> {
  const invert = <T extends string>(map: Record<string, T>, val: string | null) =>
    val ? Object.entries(map).find(([, v]) => v === val)?.[0] ?? '' : '';
  const build = (data: any): FoodProfile | null => data ? ({
    pattern: invert(patternMap, data.eating_pattern),
    trigger: invert(triggerMap, data.primary_trigger),
    vulnerableTime: invert(timeMap, data.vulnerable_time),
    awareness: invert(awarenessMap, data.interoception_level),
    supportStyle: invert(styleMap, data.recommended_coaching_style),
  }) : null;

  if (HAS_API) {
    const r = await apiFetch<{ behavior: any }>('/me/behavior').catch(() => null);
    return build(r?.behavior);
  }
  const userId = await getUserId();
  if (!userId) return null;
  const { data } = await supabase.from('behavior_profile').select('*').eq('user_id', userId).maybeSingle();
  return build(data);
}

export async function loadAssessmentAnswers(): Promise<number[] | null> {
  if (HAS_API) {
    const r = await apiFetch<{ answers: unknown }>('/me/assessment').catch(() => null);
    return Array.isArray(r?.answers) ? (r!.answers as number[]) : null;
  }
  const userId = await getUserId();
  if (!userId) return null;
  const { data } = await supabase
    .from('assessment_answers')
    .select('answers_json')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const arr = data?.answers_json as unknown;
  return Array.isArray(arr) ? (arr as number[]) : null;
}

export async function saveUserPlan(profile: Partial<UserProfile>, calculations: Calculations | null) {
  if (HAS_API) {
    await apiFetch('/me/plan', {
      method: 'PUT',
      body: {
        pace: profile.paceChoice ?? null,
        calorie_target: calculations?.totalCalories ?? null,
        calorie_corridor_low: calculations?.corridorMin ?? null,
        calorie_corridor_high: calculations?.corridorMax ?? null,
        tracking_method: profile.trackingMethod ?? null,
      },
    });
    return;
  }
  const userId = await getUserId();
  if (!userId) return;
  const row = {
    user_id: userId,
    pace: (profile.paceChoice as 'fast' | 'slow' | null) ?? null,
    calorie_target: calculations?.totalCalories ?? null,
    calorie_corridor_low: calculations?.corridorMin ?? null,
    calorie_corridor_high: calculations?.corridorMax ?? null,
    tracking_method: (profile.trackingMethod as 'calories' | 'palm' | 'plate' | null) ?? null,
  };
  const { data: existing } = await supabase.from('user_plan').select('id').eq('user_id', userId).single();
  if (existing) await supabase.from('user_plan').update(row).eq('user_id', userId);
  else await supabase.from('user_plan').insert(row);
}

// ============ ASSESSMENT ANSWERS ============

export async function saveAssessmentAnswers(answers: number[]) {
  if (HAS_API) { await apiFetch('/me/assessment', { method: 'POST', body: { answers } }); return; }
  const userId = await getUserId();
  if (!userId) return;
  await supabase.from('assessment_answers').insert({ user_id: userId, answers_json: answers });
}

// ============ BEHAVIOR PROFILE ============

const patternMap: Record<string, 'emotional' | 'restorative' | 'chaotic' | 'intuitive'> = {
  'эмоциональное питание': 'emotional',
  'восстановительное питание': 'restorative',
  'хаотичное питание': 'chaotic',
  'интуитивное питание': 'intuitive',
};
const triggerMap: Record<string, 'fatigue' | 'stress' | 'hunger' | 'no_plan' | 'social'> = {
  'усталость': 'fatigue', 'стресс': 'stress', 'скука': 'social', 'привычка': 'no_plan',
};
const timeMap: Record<string, 'morning' | 'day' | 'evening' | 'night'> = {
  'утро': 'morning', 'день': 'day', 'вечер': 'evening', 'ночь': 'night',
};
const awarenessMap: Record<string, 'high' | 'medium' | 'low'> = {
  'высокий': 'high', 'средний': 'medium', 'низкий': 'low',
};
const styleMap: Record<string, 'supportive' | 'structured' | 'mixed'> = {
  'мягкий поддерживающий': 'supportive', 'структурный': 'structured', 'смешанный': 'mixed',
};

export async function saveBehaviorProfile(foodProfile: FoodProfile) {
  const body = {
    eating_pattern: patternMap[foodProfile.pattern] ?? null,
    primary_trigger: triggerMap[foodProfile.trigger] ?? null,
    vulnerable_time: timeMap[foodProfile.vulnerableTime] ?? null,
    interoception_level: awarenessMap[foodProfile.awareness] ?? null,
    recommended_coaching_style: styleMap[foodProfile.supportStyle] ?? null,
  };
  if (HAS_API) { await apiFetch('/me/behavior', { method: 'PUT', body }); return; }

  const userId = await getUserId();
  if (!userId) return;
  const row = { user_id: userId, ...body };
  const { data: existing } = await supabase.from('behavior_profile').select('id').eq('user_id', userId).single();
  if (existing) await supabase.from('behavior_profile').update(row).eq('user_id', userId);
  else await supabase.from('behavior_profile').insert(row);
}

// ============ DAILY CHECKINS ============

export async function saveDailyCheckin(date: string, weight?: number, sleepHours?: number, stepsYesterday?: number) {
  if (HAS_API) {
    await apiFetch('/me/checkin', {
      method: 'POST',
      body: { date, weight_kg: weight ?? null, sleep_hours: sleepHours ?? null, steps_yesterday: stepsYesterday ?? null },
    });
    return;
  }
  const userId = await getUserId();
  if (!userId) return;
  const row = { user_id: userId, date, weight_kg: weight ?? null, sleep_hours: sleepHours ?? null, steps_yesterday: stepsYesterday ?? null };
  const { data: existing } = await supabase
    .from('daily_checkins').select('checkin_id').eq('user_id', userId).eq('date', date).single();
  if (existing) await supabase.from('daily_checkins').update(row).eq('checkin_id', existing.checkin_id);
  else await supabase.from('daily_checkins').insert(row);
}

export async function loadCheckins(): Promise<{ date: string; weight: number }[]> {
  if (HAS_API) {
    const r = await apiFetch<{ checkins: { date: string; weight: number }[] }>('/me/checkins').catch(() => null);
    return r?.checkins ?? [];
  }
  const userId = await getUserId();
  if (!userId) return [];
  const { data } = await supabase
    .from('daily_checkins').select('date, weight_kg')
    .eq('user_id', userId).not('weight_kg', 'is', null).order('date', { ascending: true });
  return (data ?? []).map(d => ({ date: d.date, weight: Number(d.weight_kg) }));
}

// ============ MEAL PLANS ============

export async function saveMealPlan(dateFor: string, planText: string) {
  if (HAS_API) { await apiFetch(`/me/meal-plan/${dateFor}`, { method: 'PUT', body: { plan_text: planText } }); return; }
  const userId = await getUserId();
  if (!userId) return;
  const { data: existing } = await supabase
    .from('meal_plans').select('id').eq('user_id', userId).eq('date_for', dateFor).maybeSingle();
  if (existing) await supabase.from('meal_plans').update({ plan_text: planText }).eq('id', existing.id);
  else await supabase.from('meal_plans').insert({ user_id: userId, date_for: dateFor, plan_text: planText });
}

export async function loadMealPlanForDate(dateFor: string): Promise<string | null> {
  if (HAS_API) {
    const r = await apiFetch<{ plan_text: string | null }>(`/me/meal-plan/${dateFor}`).catch(() => null);
    return r?.plan_text ?? null;
  }
  const userId = await getUserId();
  if (!userId) return null;
  const { data } = await supabase
    .from('meal_plans').select('plan_text').eq('user_id', userId).eq('date_for', dateFor).maybeSingle();
  return data?.plan_text ?? null;
}

// ============ FOOD LOGS ============

export async function saveFoodLog(description: string, mealTag: 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'unknown' = 'unknown') {
  if (HAS_API) { await apiFetch('/me/food-log', { method: 'POST', body: { raw_text: description, meal_tag: mealTag } }); return; }
  const userId = await getUserId();
  if (!userId) return;
  await supabase.from('food_logs').insert({ user_id: userId, raw_text: description, meal_tag: mealTag });
}

// ============ CHAT EVENTS ============

export async function saveChatEvent(eventType: string, summary: string, relatedFoodLogId?: string) {
  if (HAS_API) {
    await apiFetch('/me/chat-event', { method: 'POST', body: { event_type: eventType, message_summary: summary, related_food_log_id: relatedFoodLogId ?? null } });
    return;
  }
  const userId = await getUserId();
  if (!userId) return;
  await supabase.from('chat_events' as any).insert({
    user_id: userId, event_type: eventType, message_summary: summary, related_food_log_id: relatedFoodLogId ?? null,
  });
}

// ============ EVENING REFLECTIONS ============

export async function saveEveningReflection(date: string, emotion?: string, hungerLevel?: number, hardestPart?: string) {
  if (HAS_API) {
    await apiFetch('/me/reflection', {
      method: 'POST',
      body: { date, emotion: emotion ?? null, hunger_level: hungerLevel ?? null, hardest_part: hardestPart ?? null },
    });
    return;
  }
  const userId = await getUserId();
  if (!userId) return;
  const row = { user_id: userId, date, emotion: emotion ?? null, hunger_level: hungerLevel ?? null, hardest_part: hardestPart ?? null };
  const { data: existing } = await supabase
    .from('evening_reflections').select('reflection_id').eq('user_id', userId).eq('date', date).single();
  if (existing) await supabase.from('evening_reflections').update(row).eq('reflection_id', existing.reflection_id);
  else await supabase.from('evening_reflections').insert(row);
}

// ============ USER EVENTS ============

export async function logUserEvent(type: string, payload?: Json) {
  if (HAS_API) { await apiFetch('/me/event', { method: 'POST', body: { type, payload: payload ?? null } }); return; }
  const userId = await getUserId();
  if (!userId) return;
  await supabase.from('user_events').insert({ user_id: userId, type, payload_json: payload ?? null });
}

// ============ SUBSCRIPTIONS ============

export async function startTrial() {
  const { invokeFunction } = await import('@/lib/api-invoke');
  await invokeFunction('start-trial', {});
}

// ============ CONSULTATIONS ============

export async function requestConsultation() {
  if (HAS_API) { await apiFetch('/me/consultation', { method: 'POST', body: {} }); return; }
  const userId = await getUserId();
  if (!userId) return;
  await supabase.from('consultations').insert({ user_id: userId, status: 'requested' as const });
}

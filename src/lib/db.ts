import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import type { UserProfile, Calculations, DailyReport, FoodProfile } from './types';

// Helper to get the internal user_id from auth
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
  const { data: { user } } = await supabase.auth.getUser();
  return !!user;
}

// ============ USER PROFILE ============

export async function saveUserProfile(profile: Partial<UserProfile>) {
  const userId = await getUserId();
  if (!userId) return;

  // Save name to public.users (separate row keyed by auth_id)
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
  };

  const { data: existing } = await supabase
    .from('user_profile')
    .select('id')
    .eq('user_id', userId)
    .single();

  if (existing) {
    await supabase.from('user_profile').update(row).eq('user_id', userId);
  } else {
    await supabase.from('user_profile').insert(row);
  }
}

export async function loadUserProfile(): Promise<Partial<UserProfile> | null> {
  const userId = await getUserId();
  if (!userId) return null;

  const [{ data }, { data: userRow }] = await Promise.all([
    supabase.from('user_profile').select('*').eq('user_id', userId).single(),
    supabase.from('users').select('name').eq('user_id', userId).single(),
  ]);

  if (!data && !userRow) return null;

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
  };
}

// ============ USER PLAN ============

export async function saveUserPlan(profile: Partial<UserProfile>, calculations: Calculations | null) {
  const userId = await getUserId();
  if (!userId) return;

  const row = {
    user_id: userId,
    pace: profile.paceChoice as 'fast' | 'slow' | null ?? null,
    calorie_target: calculations?.totalCalories ?? null,
    calorie_corridor_low: calculations?.corridorMin ?? null,
    calorie_corridor_high: calculations?.corridorMax ?? null,
    tracking_method: profile.trackingMethod as 'calories' | 'palm' | 'plate' | null ?? null,
  };

  const { data: existing } = await supabase
    .from('user_plan')
    .select('id')
    .eq('user_id', userId)
    .single();

  if (existing) {
    await supabase.from('user_plan').update(row).eq('user_id', userId);
  } else {
    await supabase.from('user_plan').insert(row);
  }
}

// ============ ASSESSMENT ANSWERS ============

export async function saveAssessmentAnswers(answers: number[]) {
  const userId = await getUserId();
  if (!userId) return;

  await supabase.from('assessment_answers').insert({
    user_id: userId,
    answers_json: answers,
  });
}

// ============ BEHAVIOR PROFILE ============

const patternMap: Record<string, 'emotional' | 'restorative' | 'chaotic' | 'intuitive'> = {
  'эмоциональное питание': 'emotional',
  'восстановительное питание': 'restorative',
  'хаотичное питание': 'chaotic',
  'интуитивное питание': 'intuitive',
};

const triggerMap: Record<string, 'fatigue' | 'stress' | 'hunger' | 'no_plan' | 'social'> = {
  'усталость': 'fatigue',
  'стресс': 'stress',
  'скука': 'social',
  'привычка': 'no_plan',
};

const timeMap: Record<string, 'morning' | 'day' | 'evening' | 'night'> = {
  'утро': 'morning',
  'день': 'day',
  'вечер': 'evening',
  'ночь': 'night',
};

const awarenessMap: Record<string, 'high' | 'medium' | 'low'> = {
  'высокий': 'high',
  'средний': 'medium',
  'низкий': 'low',
};

const styleMap: Record<string, 'supportive' | 'structured' | 'mixed'> = {
  'мягкий поддерживающий': 'supportive',
  'структурный': 'structured',
  'смешанный': 'mixed',
};

export async function saveBehaviorProfile(foodProfile: FoodProfile) {
  const userId = await getUserId();
  if (!userId) return;

  const row = {
    user_id: userId,
    eating_pattern: patternMap[foodProfile.pattern] ?? null,
    primary_trigger: triggerMap[foodProfile.trigger] ?? null,
    vulnerable_time: timeMap[foodProfile.vulnerableTime] ?? null,
    interoception_level: awarenessMap[foodProfile.awareness] ?? null,
    recommended_coaching_style: styleMap[foodProfile.supportStyle] ?? null,
  };

  const { data: existing } = await supabase
    .from('behavior_profile')
    .select('id')
    .eq('user_id', userId)
    .single();

  if (existing) {
    await supabase.from('behavior_profile').update(row).eq('user_id', userId);
  } else {
    await supabase.from('behavior_profile').insert(row);
  }
}

// ============ DAILY CHECKINS ============

export async function saveDailyCheckin(date: string, weight?: number, sleepHours?: number, stepsYesterday?: number) {
  const userId = await getUserId();
  if (!userId) return;

  const row = {
    user_id: userId,
    date,
    weight_kg: weight ?? null,
    sleep_hours: sleepHours ?? null,
    steps_yesterday: stepsYesterday ?? null,
  };

  const { data: existing } = await supabase
    .from('daily_checkins')
    .select('checkin_id')
    .eq('user_id', userId)
    .eq('date', date)
    .single();

  if (existing) {
    await supabase.from('daily_checkins').update(row).eq('checkin_id', existing.checkin_id);
  } else {
    await supabase.from('daily_checkins').insert(row);
  }
}

export async function loadCheckins(): Promise<{ date: string; weight: number }[]> {
  const userId = await getUserId();
  if (!userId) return [];

  const { data } = await supabase
    .from('daily_checkins')
    .select('date, weight_kg')
    .eq('user_id', userId)
    .not('weight_kg', 'is', null)
    .order('date', { ascending: true });

  return (data ?? []).map(d => ({ date: d.date, weight: Number(d.weight_kg) }));
}

// ============ FOOD LOGS ============

export async function saveFoodLog(description: string, mealTag: 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'unknown' = 'unknown') {
  const userId = await getUserId();
  if (!userId) return;

  await supabase.from('food_logs').insert({
    user_id: userId,
    raw_text: description,
    meal_tag: mealTag,
  });
}

// ============ CHAT EVENTS ============

export async function saveChatEvent(eventType: string, summary: string, relatedFoodLogId?: string) {
  const userId = await getUserId();
  if (!userId) return;

  await supabase.from('chat_events' as any).insert({
    user_id: userId,
    event_type: eventType,
    message_summary: summary,
    related_food_log_id: relatedFoodLogId ?? null,
  });
}

// ============ EVENING REFLECTIONS ============

export async function saveEveningReflection(date: string, emotion?: string, hungerLevel?: number, hardestPart?: string) {
  const userId = await getUserId();
  if (!userId) return;

  const row = {
    user_id: userId,
    date,
    emotion: emotion ?? null,
    hunger_level: hungerLevel ?? null,
    hardest_part: hardestPart ?? null,
  };

  const { data: existing } = await supabase
    .from('evening_reflections')
    .select('reflection_id')
    .eq('user_id', userId)
    .eq('date', date)
    .single();

  if (existing) {
    await supabase.from('evening_reflections').update(row).eq('reflection_id', existing.reflection_id);
  } else {
    await supabase.from('evening_reflections').insert(row);
  }
}

// ============ USER EVENTS ============

export async function logUserEvent(type: string, payload?: Json) {
  const userId = await getUserId();
  if (!userId) return;

  await supabase.from('user_events').insert({
    user_id: userId,
    type,
    payload_json: payload ?? null,
  });
}

// ============ SUBSCRIPTIONS ============

export async function startTrial() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;

  await supabase.functions.invoke('start-trial', {
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
}

// ============ CONSULTATIONS ============

export async function requestConsultation() {
  const userId = await getUserId();
  if (!userId) return;

  await supabase.from('consultations').insert({
    user_id: userId,
    status: 'requested' as const,
  });
}

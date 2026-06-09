// Data layer: talks only to the self-hosted Node API. No Supabase.
// All endpoints take user_id from the JWT on the server side.

import type { Json } from '@/integrations/supabase/types';
import type { UserProfile, Calculations, FoodProfile } from './types';
import { apiFetch } from './api-client';
import { currentSession } from './auth-storage';
import { invokeFunction } from './api-invoke';

export async function isAuthenticated(): Promise<boolean> {
  return !!currentSession();
}

// ============ USER PROFILE ============

export async function saveUserProfile(profile: Partial<UserProfile>) {
  // Pass through every camelCase field the server knows about; it maps to columns.
  const body: Record<string, unknown> = {};
  const passthrough: (keyof UserProfile)[] = [
    'name','gender','age','height','weight','goalWeight','waist','hips',
    'stepsPerDay','weightGainReasons','emotionalTrigger','currentStage',
    'goalReachedAt','fixationStartedAt','maintenanceStartedAt',
    'equilibriumCalories','currentFixationCalories','fixationWeekNumber',
    'lastCalorieIncreaseAt',
  ];
  for (const k of passthrough) {
    if (profile[k] !== undefined) body[k as string] = profile[k];
  }
  await apiFetch('/profile', { method: 'PUT', body });
}

export async function loadUserProfile(): Promise<Partial<UserProfile> | null> {
  try {
    return await apiFetch<Partial<UserProfile> | null>('/profile');
  } catch (e) {
    console.error('loadUserProfile failed', e);
    return null;
  }
}

// ============ USER PLAN ============

export async function loadUserPlan(): Promise<{
  paceChoice?: 'fast' | 'slow';
  trackingMethod?: 'calories' | 'palm' | 'plate';
  calorieTarget?: number;
  corridorMin?: number;
  corridorMax?: number;
} | null> {
  try {
    return await apiFetch('/plan');
  } catch (e) {
    console.error('loadUserPlan failed', e);
    return null;
  }
}

export async function saveUserPlan(profile: Partial<UserProfile>, calculations: Calculations | null) {
  await apiFetch('/plan', {
    method: 'PUT',
    body: {
      paceChoice: profile.paceChoice ?? null,
      trackingMethod: profile.trackingMethod ?? null,
      calorieTarget: calculations?.totalCalories ?? null,
      corridorMin: calculations?.corridorMin ?? null,
      corridorMax: calculations?.corridorMax ?? null,
    },
  });
}

// ============ BEHAVIOR PROFILE ============

export async function loadBehaviorProfile(): Promise<FoodProfile | null> {
  try {
    return await apiFetch<FoodProfile | null>('/behavior');
  } catch (e) {
    console.error('loadBehaviorProfile failed', e);
    return null;
  }
}

export async function saveBehaviorProfile(foodProfile: FoodProfile) {
  await apiFetch('/behavior', { method: 'PUT', body: foodProfile });
}

// ============ ASSESSMENT ============

export async function loadAssessmentAnswers(): Promise<number[] | null> {
  try {
    const arr = await apiFetch<number[] | null>('/assessment');
    return Array.isArray(arr) ? arr : null;
  } catch (e) {
    console.error('loadAssessmentAnswers failed', e);
    return null;
  }
}

export async function saveAssessmentAnswers(answers: number[]) {
  await apiFetch('/assessment', { method: 'POST', body: { answers } });
}

// ============ DAILY CHECK-INS ============

export async function saveDailyCheckin(
  date: string,
  weight?: number,
  sleepHours?: number,
  stepsYesterday?: number,
) {
  await apiFetch(`/checkins/${date}`, {
    method: 'PUT',
    body: {
      weight: weight ?? null,
      sleepHours: sleepHours ?? null,
      stepsYesterday: stepsYesterday ?? null,
    },
  });
}

export async function loadCheckins(): Promise<{ date: string; weight: number }[]> {
  try {
    return await apiFetch<{ date: string; weight: number }[]>('/checkins');
  } catch (e) {
    console.error('loadCheckins failed', e);
    return [];
  }
}

// ============ MEAL PLANS ============

export async function saveMealPlan(dateFor: string, planText: string) {
  await apiFetch(`/meal-plans/${dateFor}`, { method: 'PUT', body: { planText } });
}

export async function loadMealPlanForDate(dateFor: string): Promise<string | null> {
  try {
    return await apiFetch<string | null>(`/meal-plans/${dateFor}`);
  } catch (e) {
    console.error('loadMealPlanForDate failed', e);
    return null;
  }
}

// ============ FOOD LOGS ============

export async function saveFoodLog(
  description: string,
  mealTag: 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'unknown' = 'unknown',
) {
  await apiFetch('/food-logs', { method: 'POST', body: { description, mealTag } });
}

// ============ CHAT EVENTS ============

export async function saveChatEvent(eventType: string, summary: string, relatedFoodLogId?: string) {
  await apiFetch('/chat-events', {
    method: 'POST',
    body: { eventType, summary, relatedFoodLogId: relatedFoodLogId ?? null },
  });
}

// ============ EVENING REFLECTIONS ============

export async function saveEveningReflection(
  date: string,
  emotion?: string,
  hungerLevel?: number,
  hardestPart?: string,
) {
  await apiFetch(`/reflections/${date}`, {
    method: 'PUT',
    body: {
      emotion: emotion ?? null,
      hungerLevel: hungerLevel ?? null,
      hardestPart: hardestPart ?? null,
    },
  });
}

// ============ USER EVENTS ============

export async function logUserEvent(type: string, payload?: Json) {
  await apiFetch('/events', { method: 'POST', body: { type, payload: payload ?? null } });
}

// ============ SUBSCRIPTIONS / CONSULTATIONS ============

export async function startTrial() {
  await invokeFunction('start-trial', {});
}

export async function requestConsultation() {
  await apiFetch('/consultations', { method: 'POST', body: {} });
}

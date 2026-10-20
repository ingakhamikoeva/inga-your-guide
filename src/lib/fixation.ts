import { calculateAll } from './calculations';
import type { UserProfile } from './types';

// Recalculate using saved data, not the onboarding plan or an unsaved form value.
// Missing survey fields must not silently become calculateAll's default profile.
export function fixationEquilibrium(
  profile: Partial<UserProfile>,
  weights: readonly { date: string; weight: number }[],
  today: string,
): number | null {
  const latest = weights
    .filter(entry => /^\d{4}-\d{2}-\d{2}$/.test(entry.date)
      && entry.date <= today && Number.isFinite(entry.weight) && entry.weight > 0)
    .reduce<{ date: string; weight: number } | undefined>(
      (last, entry) => !last || entry.date >= last.date ? entry : last, undefined);
  const weight = latest?.weight ?? profile.weight;
  const { gender, age, height, stepsPerDay } = profile;
  if ((gender !== 'female' && gender !== 'male')
    || !Number.isFinite(age) || age! <= 0
    || !Number.isFinite(height) || height! <= 0
    || !Number.isFinite(weight) || weight! <= 0
    || !Number.isFinite(stepsPerDay) || stepsPerDay! < 0) return null;
  const result = calculateAll({ ...profile, weight }).totalCalories;
  return Number.isFinite(result) && result > 0 ? result : null;
}

// A reached goal keeps the lesson available during fixation/maintenance.
// Before that, use a saved weigh-in, never an onboarding or unsaved input weight.
export function canOpenFixationLesson(
  profile: Partial<UserProfile>,
  weights: readonly { date: string; weight: number }[],
  today: string,
): boolean {
  if (profile.currentStage === 'fixation' || profile.currentStage === 'maintenance') return true;
  if (profile.goalReachedAt && /^\d{4}-\d{2}-\d{2}$/.test(profile.goalReachedAt)
    && profile.goalReachedAt <= today) return true;
  const goal = profile.goal_weight_kg || profile.goalWeight;
  if (!Number.isFinite(goal) || goal! <= 0) return false;
  const latest = weights
    .filter(entry => /^\d{4}-\d{2}-\d{2}$/.test(entry.date)
      && entry.date <= today && Number.isFinite(entry.weight) && entry.weight > 0)
    .reduce<{ date: string; weight: number } | undefined>(
      (last, entry) => !last || entry.date >= last.date ? entry : last, undefined);
  return latest !== undefined && latest.weight <= goal!;
}

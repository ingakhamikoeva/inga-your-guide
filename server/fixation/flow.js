import { dayInZone } from '../achievements/rules.js';
export class FixationError extends Error {
  constructor(code) { super(code); this.code = code; }
}
const fail = code => { throw new FixationError(code); };
const numeric = value => value == null || value === '' ? NaN : Number(value);
const positive = value => Number.isFinite(numeric(value)) && numeric(value) > 0;
const dateOnly = value => value instanceof Date ? value.toISOString().slice(0,10) : String(value || '').slice(0,10);

// Only explicit stage changes are written. Reading or saving a weigh-in never
// advances calories or stages, and elapsed days are not proof of eating changes.
export function transitionFixation(profile, weights, input, now = new Date()) {
  const timezone = input.timezone;
  if (typeof timezone !== 'string' || !timezone) fail('invalid_timezone');
  try { new Intl.DateTimeFormat('en', { timeZone: timezone }).format(now); }
  catch { fail('invalid_timezone'); }
  const today = dayInZone(now, timezone);
  const iso = now.toISOString();
  const goal = numeric(profile.goal_weight_kg);
  const latest = weights.filter(w => positive(w.weight_kg) && /^\d{4}-\d{2}-\d{2}$/.test(dateOnly(w.date)) && dateOnly(w.date) <= today)
    .sort((a,b) => dateOnly(a.date).localeCompare(dateOnly(b.date))).at(-1);
  const current = profile.fixation_progress;
  const action = input.action;
  if (!['enter','complete'].includes(action)) fail('invalid_action');
  if (!Number.isInteger(input.revision) || input.revision !== (current?.revision ?? 0)) fail('stale_fixation');
  if (!positive(goal)) fail('missing_goal');

  if (action === 'enter') {
    const newGoal = current && current.goalWeight !== goal;
    if (current && !newGoal) return { progress: current, row: {} };
    if (profile.current_stage === 'maintenance') fail('already_maintenance');
    const achieved = (!newGoal && (profile.current_stage === 'fixation' || profile.goal_reached_at))
      || (latest && numeric(latest.weight_kg) <= goal);
    if (!achieved) fail('goal_not_reached');
    const weight = latest ? numeric(latest.weight_kg) : numeric(profile.current_weight_kg);
    const age=numeric(profile.age), height=numeric(profile.height_cm), steps=numeric(profile.steps_baseline);
    if (!positive(weight) || !positive(age) || !positive(height) || !Number.isFinite(steps) || steps < 0
      || !['female','male'].includes(profile.sex)) fail('incomplete_profile');
    // Preserve the existing app calculation, using the saved current weight.
    const bmr = profile.sex === 'female'
      ? 655.1 + 9.563*weight + 1.85*height - 4.676*age
      : 66.5 + 13.75*weight + 5.003*height - 6.775*age;
    const eq = Math.round(Math.round(bmr + steps*(profile.sex === 'female' ? .02 : .04))/50)*50;
    if (!positive(eq)) fail('incomplete_profile');
    const progress = { version:2, revision:(current?.revision ?? 0)+1, phase:'fixation', goalWeight:goal,
      equilibriumCalories:eq, startedAt:iso, completedAt:null, timezone };
    if (newGoal) progress.previousPlan = current;
    return { progress, row: { current_stage:'fixation', goal_reached_at:newGoal ? today : profile.goal_reached_at || today,
      fixation_started_at:newGoal ? today : profile.fixation_started_at || today, equilibrium_calories:eq,
      current_fixation_calories:null, fixation_week_number:null, last_calorie_increase_at:null } };
  }

  if (profile.current_stage !== 'fixation') fail('invalid_phase');
  if (current && goal !== current.goalWeight) fail('goal_changed');
  if (input.confirmed !== true) fail('confirmation_required');
  if (!latest || dateOnly(latest.date) !== today || !latest.weight_recorded_at
    || dayInZone(latest.weight_recorded_at,timezone) !== today) fail('fresh_weight_required');
  if (Math.abs(numeric(latest.weight_kg)-goal) > 1) fail('weight_outside_corridor');
  // Legacy fixation accounts can complete without a new setup form. No diary
  // writes, nutrition questionnaire, weekly confirmations or extra waiting week.
  const progress = { version:2, revision:(current?.revision ?? 0)+1, phase:'complete', goalWeight:goal,
    equilibriumCalories:current?.equilibriumCalories ?? (positive(profile.equilibrium_calories) ? numeric(profile.equilibrium_calories) : null),
    startedAt:current?.startedAt ?? profile.fixation_started_at ?? null, completedAt:iso, timezone };
  if (current?.previousPlan) progress.previousPlan = current.previousPlan;
  return {progress, row:{current_stage:'maintenance',maintenance_started_at:today,
    current_fixation_calories:null,fixation_week_number:null,last_calorie_increase_at:null}};
}

import { upsert } from './routes/_helpers.js';

// Measurement date, not the time an old entry was edited, determines current weight.
// Keep profile-only onboarding weights as a fallback until the first measurement.
export async function readWeightState(db, userId) {
  const { rows: [row] } = await db.query(`
    SELECT COALESCE(latest.weight_kg, p.current_weight_kg) AS weight,
           COALESCE(p.start_weight_kg, p.current_weight_kg, first_weight.weight_kg) AS start_weight,
           latest.date::text AS weight_date
      FROM public.users u
      LEFT JOIN public.user_profile p ON p.user_id = u.user_id
      LEFT JOIN LATERAL (
        SELECT weight_kg, date FROM public.daily_checkins
        WHERE user_id = u.user_id AND weight_kg IS NOT NULL ORDER BY date DESC LIMIT 1
      ) latest ON true
      LEFT JOIN LATERAL (
        SELECT weight_kg FROM public.daily_checkins
        WHERE user_id = u.user_id AND weight_kg IS NOT NULL ORDER BY date ASC LIMIT 1
      ) first_weight ON true
      WHERE u.user_id = $1`, [userId]);
  return {
    weight: row?.weight != null ? Number(row.weight) : undefined,
    startWeight: row?.start_weight != null ? Number(row.start_weight) : undefined,
    weightDate: row?.weight_date ?? null,
  };
}

// Caller holds the user's row lock and transaction, shared with profile edits.
export async function syncWeightState(db, userId) {
  const state = await readWeightState(db, userId);
  if (state.weight != null) {
    await upsert('public.user_profile', ['user_id'], [userId], {
      current_weight_kg: state.weight, start_weight_kg: state.startWeight,
    }, db);
  }
  return state;
}

export function measurementDate(timezone = 'Europe/Moscow', now = new Date()) {
  if (typeof timezone !== 'string' || timezone.length > 100) throw new RangeError('invalid_timezone');
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  return ['year', 'month', 'day'].map(type => parts.find(p => p.type === type).value).join('-');
}

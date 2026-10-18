import { evaluate, definition, dayInZone } from './rules.js';

// User lock plus unique key makes simultaneous tabs/retries idempotent.
export async function syncAchievements(pool, userId, timezone, now = new Date()) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const user = await client.query('SELECT user_id FROM public.users WHERE user_id = $1 FOR UPDATE', [userId]);
    if (!user.rows.length) throw new Error('user_not_found');
    const { rows: profiles } = await client.query(
      'SELECT *, maintenance_started_at::text AS maintenance_started_at FROM public.user_profile WHERE user_id = $1', [userId]);
    const profile = profiles[0] || {};
    const { rows: weights } = await client.query(
      'SELECT date::text AS date, weight_kg, weight_recorded_at FROM public.daily_checkins WHERE user_id = $1 AND weight_kg IS NOT NULL', [userId]);
    const { rows: meals } = await client.query(
      'SELECT datetime, raw_text, meal_tag, meta FROM public.food_logs WHERE user_id = $1', [userId]);
    const result = evaluate({ profile, weights, meals, today: dayInZone(now, timezone), timezone });
    const newIds = [];
    for (const hit of result.hits) {
      const inserted = await client.query(`INSERT INTO public.user_achievements (user_id, achievement_id, evidence)
        VALUES ($1, $2, $3::jsonb) ON CONFLICT (user_id, achievement_id) DO NOTHING RETURNING achievement_id`,
      [userId, hit.id, JSON.stringify(hit.evidence)]);
      if (inserted.rowCount) newIds.push(hit.id);
    }
    const { rows } = await client.query(`SELECT achievement_id, awarded_at FROM public.user_achievements
      WHERE user_id = $1 ORDER BY awarded_at, achievement_id`, [userId]);
    const medals = rows.flatMap(row => {
      const item = definition(row.achievement_id, profile.sex);
      return item ? [{ ...item, date: dayInZone(row.awarded_at, timezone), weekKey: item.id }] : [];
    });
    await client.query('COMMIT');
    return { medals, newIds, streakDays: result.streakDays, uniqueRecipes: result.uniqueRecipes };
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally { client.release(); }
}

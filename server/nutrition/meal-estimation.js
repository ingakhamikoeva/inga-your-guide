import { pool } from '../db.js';
import { estimateMeal, applyEstimate, ESTIMATE_VERSION } from './estimate.js';
const running = new Map();
export function analyzeSavedMeal(userId, id, db = pool, estimate = estimateMeal) {
  const key = `${userId}:${id}`;
  if (running.has(key)) return running.get(key);
  const task = (async () => {
    const { rows:[meal] } = await db.query('SELECT * FROM public.food_logs WHERE log_id=$1 AND user_id=$2', [id,userId]);
    if (!meal) return null;
    if (meal.meta?.nutritionVersion === ESTIMATE_VERSION) return meal;
    if (!meal.raw_text?.trim() || meal.raw_text.length > 1000) throw new Error('unknown_composition');
    const result = await estimate(meal.raw_text, Array.isArray(meal.meta?.lightSwap?.recipeIds) ? meal.meta.lightSwap.recipeIds : []);
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      const { rows:[latest] } = await client.query('SELECT * FROM public.food_logs WHERE log_id=$1 AND user_id=$2 FOR UPDATE', [id,userId]);
      if (!latest || latest.raw_text !== meal.raw_text) { await client.query('ROLLBACK'); return latest || null; }
      const meta = applyEstimate(latest.meta || {}, result);
      const { rows:[saved] } = await client.query('UPDATE public.food_logs SET meta=$3::jsonb WHERE log_id=$1 AND user_id=$2 RETURNING log_id,raw_text,meal_tag,datetime,meta', [id,userId,JSON.stringify(meta)]);
      await client.query('COMMIT');
      return saved;
    } catch (e) { await client.query('ROLLBACK'); throw e; }
    finally { client.release(); }
  })().finally(() => running.delete(key));
  running.set(key,task);
  return task;
}

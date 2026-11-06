import { createHash, randomUUID } from 'node:crypto';

export function writeError(status, code) {
  return Object.assign(new Error(code), { status, code });
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k => [k, canonical(value[k])]));
  return value;
}

// A row lock on the action serializes duplicate requests across API processes.
// The action reservation and meal insert commit or roll back together.
export async function createFoodLog(db, userId, input, requestId) {
  const { description, mealTag, datetime, meta } = input;
  const hash = createHash('sha256').update(JSON.stringify(canonical(input))).digest('hex');
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const id = randomUUID();
    if (requestId) {
      const inserted = await client.query(`INSERT INTO public.food_write_requests(user_id,request_id,payload_hash,log_id)
        VALUES($1,$2,$3,$4) ON CONFLICT(user_id,request_id) DO NOTHING RETURNING log_id`, [userId,requestId,hash,id]);
      if (!inserted.rows.length) {
        const { rows:[action] } = await client.query('SELECT payload_hash,log_id FROM public.food_write_requests WHERE user_id=$1 AND request_id=$2 FOR UPDATE', [userId,requestId]);
        if (action.payload_hash !== hash) throw writeError(409, 'idempotency_conflict');
        const { rows:[existing] } = await client.query('SELECT log_id,raw_text,meal_tag,datetime,meta FROM public.food_logs WHERE log_id=$1 AND user_id=$2', [action.log_id,userId]);
        if (!existing) throw writeError(410, 'meal_deleted');
        await client.query('COMMIT');
        return existing;
      }
    }
    const { rows:[saved] } = await client.query(`INSERT INTO public.food_logs(log_id,user_id,raw_text,meal_tag,datetime,meta)
      VALUES($1,$2,$3,$4,COALESCE($5::timestamptz,now()),$6::jsonb)
      RETURNING log_id,raw_text,meal_tag,datetime,meta`, [id,userId,description,mealTag,datetime,JSON.stringify({...meta,compositionRevision:0})]);
    await client.query('COMMIT');
    return saved;
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}

const compositionKeys = ['protein','carbs','fiber','sweet','proteinFlagManual','carbsFlagManual','fiberFlagManual',
  'proteinPortion','proteinAi','proteinManual','nutrition','nutritionVersion','lightSwap'];

export function compositionIdentity(row) {
  return JSON.stringify([row.raw_text, row.meta?.compositionRevision || 0, row.meta?.lightSwap?.recipeIds || []]);
}

export async function patchFoodLog(db, userId, id, patch) {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { rows:[latest] } = await client.query('SELECT * FROM public.food_logs WHERE log_id=$1 AND user_id=$2 FOR UPDATE', [id,userId]);
    if (!latest) { await client.query('ROLLBACK'); return null; }
    const changed = patch.description != null && patch.description !== latest.raw_text;
    const old = latest.meta || {};
    if (changed && !patch.resetComposition && (old.proteinManual || old.proteinFlagManual || old.carbsFlagManual || old.fiberFlagManual || old.lightSwap || old.sweet)) {
      throw writeError(409, 'composition_reset_required');
    }
    const meta = { ...old, ...patch.meta };
    // Clients cannot reset the server's revision used to discard stale AI replies.
    meta.compositionRevision = Number.isSafeInteger(old.compositionRevision) ? old.compositionRevision : 0;
    const recipesChanged = JSON.stringify(old.lightSwap?.recipeIds || []) !== JSON.stringify(meta.lightSwap?.recipeIds || []);
    if (changed) {
      for (const key of compositionKeys) delete meta[key];
      meta.compositionRevision++;
    } else if (recipesChanged) {
      delete meta.nutrition; delete meta.nutritionVersion;
      if (!meta.proteinManual) delete meta.proteinAi;
      for (const key of ['protein','carbs','fiber']) if (!meta[`${key}FlagManual`]) delete meta[key];
      meta.compositionRevision++;
    }
    const { rows:[saved] } = await client.query(`UPDATE public.food_logs SET raw_text=$3,meal_tag=COALESCE($4,meal_tag),
      datetime=COALESCE($5::timestamptz,datetime),meta=$6::jsonb WHERE log_id=$1 AND user_id=$2
      RETURNING log_id,raw_text,meal_tag,datetime,meta`, [id,userId,patch.description ?? latest.raw_text,patch.mealTag ?? null,patch.datetime ?? null,JSON.stringify(meta)]);
    await client.query('COMMIT'); return saved;
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}

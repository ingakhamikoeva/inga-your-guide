// I2: bounded dialogue input and the authenticated user's current server diary.
export class ChatContextError extends Error {}
const fail = () => { throw new ChatContextError('invalid_chat_context'); };

export function chatHistory(value) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 12 || Buffer.byteLength(JSON.stringify(value), 'utf8') > 14000) fail();
  let size = 0;
  return value.map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)
      || item.role !== (index % 2 === 0 ? 'user' : 'assistant')
      || typeof item.content !== 'string' || !item.content.trim() || item.content.length > 3000) fail();
    size += Buffer.byteLength(item.content, 'utf8');
    if (size > 12000) fail();
    return { role: item.role, content: item.content.trim() };
  });
}

export function chatTimezone(value) {
  if (value === undefined) return 'Europe/Moscow'; // older clients
  if (typeof value !== 'string' || value.length > 100) fail();
  try { return new Intl.DateTimeFormat('en', { timeZone: value }).resolvedOptions().timeZone; }
  catch { fail(); }
}

function boundedText(text, budget) {
  let result = '', size = 0;
  for (const char of text) {
    const next = Buffer.byteLength(char, 'utf8');
    if (size + next > budget || result.length + char.length > 2000) break;
    result += char; size += next;
  }
  return result;
}

export async function currentChatDay(db, userId, timezone, now = new Date()) {
  const parts = new Intl.DateTimeFormat('en', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const part = type => parts.find(p => p.type === type).value;
  const date = `${part('year')}-${part('month')}-${part('day')}`;
  const [checkins, meals] = await Promise.all([
    db.query(`SELECT sleep_hours, steps_yesterday FROM public.daily_checkins
      WHERE user_id = $1 AND date = $2::date`, [userId, date]),
    db.query(`SELECT raw_text FROM public.food_logs WHERE user_id = $1
      AND datetime >= ($2::date::timestamp AT TIME ZONE $3)
      AND datetime < (($2::date + 1)::timestamp AT TIME ZONE $3)
      ORDER BY datetime ASC, log_id ASC`, [userId, date, timezone]),
  ]);
  // Keep requests within the existing payload budget; disclose any truncation.
  let budget = 10000, truncated = false;
  const todayMeals = [];
  for (const meal of meals.rows) {
    if (todayMeals.length >= 50 || budget <= 0) { truncated = true; break; }
    const raw = String(meal.raw_text ?? '');
    const text = boundedText(raw, budget);
    truncated ||= text.length < raw.length;
    todayMeals.push(text);
    budget -= Buffer.byteLength(text, 'utf8');
  }
  const row = checkins.rows[0];
  return {
    todayMeals, todayMealsCount: meals.rows.length, todayMealsTruncated: truncated,
    sleepHours: row?.sleep_hours == null ? undefined : Number(row.sleep_hours),
    stepsYesterday: row?.steps_yesterday == null ? undefined : Number(row.steps_yesterday),
    now: `${date}, ${now.toLocaleTimeString('ru-RU', { timeZone: timezone, hour: '2-digit', minute: '2-digit' })} (${timezone})`,
  };
}

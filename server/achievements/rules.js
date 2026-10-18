// Product rules, not medical thresholds. All inputs come from saved DB rows.
export const RECIPE_IDS = new Set([
  'oatmeal-plain', 'oatmeal', 'pate', 'zucchini', 'bliny', 'varenie',
  'shaurma', 'taco', 'pirozhki', 'nezhnost', 'nevesimost', 'oblaka',
  'slivovoe', 'grusha', 'milfey', 'morozhenoe', 'maffiny', 'sharlotka',
  'okroshka', 'turkey-cutlets', 'fried-potatoes-mushrooms', 'pizza', 'cappuccino',
]);
export const STREAKS = [7, 14, 21, 30, 60, 90];
export const MAINTENANCE = [[1, 'Практик'], [2, 'Мастер'], [3, 'Эксперт'], [6, 'Легенда']];
const catalog = {};
function add(id, type, title, description, icon) {
  catalog[id] = { id, type, title, description, icon };
}
add('swap-1', 'recipe', 'Первая замена', 'Первая лёгкая замена в дневнике.', '🍽️');
add('swap-5', 'recipe', 'Пять замен', '5 разных лёгких блюд в дневнике.', '🃏');
add('swap-10', 'recipe', 'В десяточку!', '10 разных лёгких блюд в дневнике.', '🎯');
add('recipe-bliny', 'recipe', 'Блинный мастер', 'Лёгкие блины в дневнике.', '🥞');
add('recipe-shaurma', 'recipe', 'Легенда шаурмы', 'Лёгкая шаурма в дневнике.', '🌯');
add('favorite', 'recipe', 'Любимчик', 'Одна лёгкая замена в три разные даты.', '💛');
for (const days of STREAKS) {
  const title = days < 30 ? `${days} дней в лёгкости` : days === 30 ? 'Месяц в лёгкости' : `${days / 30} месяца в лёгкости`;
  add(`streak-${days}`, 'consistency', title, `${days} дней подряд с записью веса и хотя бы одного приёма пищи.`, '🌟');
}
for (const [kg, title] of [[1, 'Минус один'], [5, 'Пятёрка'], [10, 'Десятка']]) {
  add(`loss-${kg}`, 'movement', title, `Снижение на ${kg} кг от стартового веса подтверждено в разные дни.`, '🏅');
}
add('halfway', 'movement', 'Половина пути', 'Пройдено 50% пути от стартового до целевого веса.', '🛣️');
add('goal', 'goal', 'Цель достигнута. Вы — королева!', 'Целевой вес подтверждён в разные дни.', '👑');
for (const [months, title] of MAINTENANCE) {
  add(`maintenance-${months}`, 'maintenance', `${title} стабильности`,
    `С начала этапа «Сохранение» прошло ${months} мес. Текущий вес в целевом коридоре ±1 кг.`, '🏆');
}
export function definition(id, sex) {
  const item = catalog[id];
  if (!item) return null;
  return id === 'goal' && sex === 'male'
    ? { ...item, title: 'Цель достигнута. Вы — мой герой!', icon: '🏆' }
    : { ...item };
}
export function dayInZone(value, timezone) {
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return null;
  return new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}
export function validDay(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
const shift = (day, days) => new Date(Date.parse(day) + days * 86400000).toISOString().slice(0, 10);
export function addMonths(day, months) {
  const [y, m, d] = day.split('-').map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, last));
  return target.toISOString().slice(0, 10);
}
export function evaluate({ profile = {}, weights = [], meals = [], today, timezone = 'Europe/Moscow' }) {
  if (!validDay(today)) throw new Error('invalid_today');
  const hits = [];
  const award = (id, evidence) => hits.push({ id, evidence });
  const byDay = new Map();
  for (const w of weights) {
    const n = Number(w.weight_kg);
    if (validDay(w.date) && w.date <= today && Number.isFinite(n) && n > 0) byDay.set(w.date, { ...w, value: n });
  }
  const entries = [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date));
  const mealDays = new Set();
  const recipes = new Map();
  for (const meal of meals) {
    const date = dayInZone(meal.datetime, timezone);
    // Unknown old chat records must not satisfy the food diary requirement.
    if (!date || date > today || !['breakfast', 'lunch', 'dinner', 'snack'].includes(meal.meal_tag)
      || typeof meal.raw_text !== 'string' || !meal.raw_text.trim()) continue;
    mealDays.add(date);
    const ids = meal.meta?.lightSwap?.recipeIds;
    if (!Array.isArray(ids)) continue;
    for (const id of new Set(ids.filter(id => RECIPE_IDS.has(id)))) {
      if (!recipes.has(id)) recipes.set(id, new Set());
      recipes.get(id).add(date);
    }
  }
  for (const n of [1, 5, 10]) if (recipes.size >= n) award(`swap-${n}`, { recipes: [...recipes.keys()] });
  for (const id of ['bliny', 'shaurma']) if (recipes.has(id)) award(`recipe-${id}`, { recipe: id });
  for (const [id, dates] of recipes) if (dates.size >= 3) {
    award('favorite', { recipe: id, dates: [...dates].sort() }); break;
  }
  let run = 0, longest = 0, previous;
  const active = new Set();
  for (const w of entries) {
    if (!mealDays.has(w.date)) continue;
    active.add(w.date);
    run = previous && shift(previous, 1) === w.date ? run + 1 : 1;
    previous = w.date;
    longest = Math.max(longest, run);
  }
  for (const n of STREAKS) if (longest >= n) award(`streak-${n}`, { consecutiveDays: n });
  // An unfinished today does not break yesterday's series.
  let cursor = active.has(today) ? today : shift(today, -1), streakDays = 0;
  while (active.has(cursor)) { streakDays++; cursor = shift(cursor, -1); }
  const start = Number(profile.start_weight_kg), goal = Number(profile.goal_weight_kg);
  const height = Number(profile.height_cm);
  const validGoal = goal > 0 && height > 0 && goal >= Math.ceil(18.5 * (height / 100) ** 2 * 10) / 10;
  const latest = entries.at(-1);
  const fresh = latest?.date === today && dayInZone(latest.weight_recorded_at, timezone) === today;
  // Require the latest measurement plus a different day's confirmation.
  const confirmed = threshold => latest && latest.value <= threshold
    && entries.some(w => w.date < latest.date && w.value <= threshold);
  if (validGoal && start > goal) {
    for (const kg of [1, 5, 10]) if (start - goal >= kg - 1e-8 && confirmed(start - kg)) {
      award(`loss-${kg}`, { start, goal, current: latest.value, date: latest.date });
    }
    if (confirmed(start - (start - goal) / 2)) award('halfway', { start, goal, date: latest.date });
    if (confirmed(goal)) award('goal', { start, goal, date: latest.date });
  }
  const began = profile.maintenance_started_at;
  if (profile.current_stage === 'maintenance' && validGoal && validDay(began) && fresh
    && Math.abs(latest.value - goal) <= 1 + 1e-8) {
    for (const [months] of MAINTENANCE) if (today >= addMonths(began, months)) {
      award(`maintenance-${months}`, { months, began, goal, weight: latest.value, date: today });
    }
  }
  return { hits, streakDays, uniqueRecipes: recipes.size };
}

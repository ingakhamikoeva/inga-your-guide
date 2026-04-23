import { UserSex, getText } from './gender-text';

type AnalysisMode = 'normal' | 'problematic';

export interface DailyNutritionAnalysis {
  mode: AnalysisMode;
  good: string[];
  obstacles: string[];
  conclusion: string;
  steps: string[];
}

const hasAny = (text: string, words: string[]) => words.some(word => text.includes(word));

const proteinWords = ['куриц', 'индейк', 'рыб', 'тунец', 'мяс', 'говяд', 'яйц', 'омлет', 'творог', 'йогурт', 'кефир', 'сыр', 'белок', 'морепр', 'кревет', 'фасол', 'чечевиц', 'нут'];
const vegetableWords = ['овощ', 'салат', 'огур', 'помид', 'томат', 'капуст', 'брокколи', 'зелень', 'шпинат', 'кабач', 'перец', 'морков', 'клетчат'];
const sweetWords = ['слад', 'конфет', 'шоколад', 'печень', 'булоч', 'пирож', 'торт', 'морож', 'вафл', 'сахар', 'десерт', 'джем', 'мёд', 'мед'];
const fastCarbWords = ['булоч', 'хлеб', 'батон', 'лаваш', 'пицц', 'паста', 'макарон', 'картош', 'рис', 'белый', 'круассан', 'блин', 'сухар', 'чипс'];
const fattyWords = ['жарен', 'фри', 'майонез', 'масло', 'сало', 'бекон', 'ребрыш', 'рёбрыш', 'колбас', 'сосиск', 'бургер', 'шаурм', 'сливоч', 'жирн'];
const alcoholWords = ['пиво', 'вино', 'шампан', 'алког', 'коктейл', 'водк', 'виски', 'ром', 'сидр'];
const overeatingWords = ['много', 'переел', 'переела', 'объел', 'объелась', 'доел', 'доела', 'ещё', 'еще', 'ночью'];
const redZoneSnackWords = ['сыр', 'орех', 'авокад', 'сало', 'свинин', 'жирн', 'сливоч', 'масло', 'майонез', 'соус', 'выпеч', 'булоч', 'печень', 'конфет', 'шоколад', 'сухофрукт', 'бутерброд', 'сэндвич', 'арахисов'];
const greenSnackSuggestion = 'для перекуса выбери зелёную зону: творог 0%, йогурт без сахара низкой жирности, кефир 1%, овощи, ягоды или яичный белок';

export function analyzeDailyNutrition(meals: string[], sex: UserSex): DailyNutritionAnalysis {
  const normalizedMeals = meals.map(meal => meal.toLowerCase());
  const dayText = normalizedMeals.join(' ');
  const mealCount = meals.length;

  const hasProtein = hasAny(dayText, proteinWords);
  const hasVegetables = hasAny(dayText, vegetableWords);
  const hasSweet = hasAny(dayText, sweetWords);
  const hasFastCarbs = hasAny(dayText, fastCarbWords);
  const hasFatty = hasAny(dayText, fattyWords);
  const hasAlcohol = hasAny(dayText, alcoholWords);
  const hasRedZoneSnack = normalizedMeals.some(meal => hasAny(meal, ['перекус', 'перекусила', 'перекусил']) && hasAny(meal, redZoneSnackWords));
  const lastMeal = normalizedMeals[normalizedMeals.length - 1] || '';
  const eveningHeavy = hasAny(lastMeal, [...sweetWords, ...fattyWords, ...alcoholWords, ...overeatingWords]);
  const chaotic = mealCount <= 1 || mealCount >= 6;
  const weakFirstHalf = mealCount > 0 && !hasAny(normalizedMeals.slice(0, Math.max(1, Math.ceil(mealCount / 2))).join(' '), proteinWords);

  const good: string[] = [];
  if (hasProtein) good.push('в рационе был белок — он помогает держать сытость и легче проходить день');
  if (hasVegetables) good.push('были овощи или клетчатка — это поддерживает объём еды без лишней калорийности');
  if (mealCount >= 3 && mealCount <= 5) good.push('питание выглядело достаточно стабильным по количеству приёмов пищи');
  if (!eveningHeavy && mealCount > 0) good.push('вечер не выглядел самым тяжёлым приёмом пищи');

  const obstacles: string[] = [];
  if (hasSweet) obstacles.push('сладкое днём быстро даёт энергию, но обычно плохо насыщает и может усиливать голод позже');
  if (hasFastCarbs && !hasProtein) obstacles.push('быстрые углеводы без нормального белка делают сытость короткой, поэтому дефицит держать сложнее');
  if (hasFatty) obstacles.push('жирные продукты легко дают перебор по калориям, даже если порция кажется небольшой');
  if (hasAlcohol) obstacles.push('алкоголь добавляет калорийность и часто снижает контроль над выбором еды');
  if (hasRedZoneSnack) obstacles.push('в перекусах были калорийные ловушки: сыр, орехи, авокадо, выпечка или сладкое легко перегружают день по калориям');
  if (!hasProtein) obstacles.push('сегодня почти не видно нормального белка — из-за этого голод может возвращаться быстрее');
  if (!hasVegetables) obstacles.push('почти не видно овощей или клетчатки — без них еда хуже насыщает по объёму');
  if (chaotic) obstacles.push('питание выглядит хаотичным, и из-за этого сложнее заранее удержать нормальную сытость');
  if (eveningHeavy) obstacles.push('вечером собрались самые калорийные продукты — это часто перекрывает дефицит за день');
  if (weakFirstHalf) obstacles.push('в первой половине дня мало белка, поэтому тяга к более калорийной еде позже может быть сильнее');

  const problematicScore = obstacles.length + (hasAlcohol ? 1 : 0) + (eveningHeavy ? 1 : 0) + (!hasProtein ? 1 : 0);
  const mode: AnalysisMode = problematicScore >= 3 ? 'problematic' : 'normal';

  const steps: string[] = [];
  if (!hasProtein || weakFirstHalf) steps.push('завтра начни с белкового завтрака: яйца, творог, йогурт, рыба или курица');
  if (hasSweet || hasFastCarbs || hasRedZoneSnack) steps.push(greenSnackSuggestion);
  if (hasFatty || eveningHeavy) steps.push('самую жирную еду уменьши или замени на куриную грудку, нежирную рыбу и овощи');
  if (hasAlcohol) steps.push('алкоголь лучше не оставлять на обычный будний день, особенно если цель — снижение веса');
  if (!hasVegetables) steps.push('добавь овощи хотя бы в один приём пищи');
  if (chaotic) steps.push('запланируй 3 понятных приёма пищи, чтобы не собирать голод к вечеру');

  const fallbackStep = 'завтра оставь основу дня такой же и улучши один приём пищи: добавь белок или овощи';
  const conclusion = mode === 'problematic'
    ? 'При таком наборе еды снижать вес будет сложно: калорийность легко набирается, а сытость держится недолго.'
    : getText('День в целом выглядит рабочим для снижения веса, но один небольшой шаг сделает его устойчивее.', 'День в целом выглядит рабочим для снижения веса, но один небольшой шаг сделает его устойчивее.', sex);

  return {
    mode,
    good: mode === 'problematic' ? good.slice(0, 1) : good.slice(0, 3),
    obstacles: obstacles.slice(0, mode === 'problematic' ? 4 : 2),
    conclusion,
    steps: (steps.length ? steps : [fallbackStep]).slice(0, mode === 'problematic' ? 1 : 2),
  };
}
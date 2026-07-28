import { UserSex, getText } from './gender-text';
import { findSwapsInMeal, SoftSwap } from './soft-swap';

type AnalysisMode = 'normal' | 'problematic';

export interface MealStructureIssue {
  meal: string;
  issue: string; // human-readable description for UI
}

export interface DailyNutritionAnalysis {
  mode: AnalysisMode;
  good: string[];
  obstacles: string[];
  conclusion: string;
  steps: string[];
  swaps: SoftSwap[];
  mealIssues: MealStructureIssue[];
}

const hasAny = (text: string, words: string[]) => words.some(word => text.includes(word));

// Solid protein only — liquid calories (kefir, drinkable yogurt) excluded by design.
const proteinWords = ['куриц', 'индейк', 'рыб', 'тунец', 'лосос', 'мяс', 'говяд', 'телятин', 'свинин', 'яйц', 'омлет', 'творог', 'белок', 'морепр', 'кревет', 'фасол', 'чечевиц', 'нут', 'тофу'];
const vegetableWords = ['овощ', 'салат', 'огур', 'помид', 'томат', 'капуст', 'брокколи', 'зелень', 'шпинат', 'кабач', 'перец', 'морков', 'клетчат', 'руккол', 'редис', 'спарж', 'грибы', 'баклаж'];
const complexCarbWords = ['гречк', 'овсян', 'булгур', 'киноа', 'перлов', 'цельнозерн', 'бурый рис', 'дикий рис', 'чечевиц', 'нут', 'фасол'];
const sweetWords = ['слад', 'конфет', 'шоколад', 'печень', 'булоч', 'пирож', 'торт', 'морож', 'вафл', 'сахар', 'десерт', 'джем', 'мёд', 'мед'];
const fastCarbWords = ['булоч', 'хлеб', 'батон', 'лаваш', 'пицц', 'паста', 'макарон', 'картош', 'белый рис', 'круассан', 'блин', 'сухар', 'чипс'];
// Treat plain "rice" / "potato" as fast carb when no qualifier — kept simple.
const onlyFastCarbWords = ['лаваш', 'хлеб', 'булоч', 'батон', 'круассан', 'печень', 'вафл', 'сухар', 'пирож', 'блин'];
const fattyWords = ['жарен', 'фри', 'майонез', 'сало', 'бекон', 'ребрыш', 'рёбрыш', 'колбас', 'сосиск', 'бургер', 'шаурм', 'сливоч', 'жирн'];
const alcoholWords = ['пиво', 'вино', 'шампан', 'алког', 'коктейл', 'водк', 'виски', 'ром', 'сидр'];
const overeatingWords = ['много', 'переел', 'переела', 'объел', 'объелась', 'доел', 'доела', 'ещё', 'еще', 'ночью'];
const liquidCalorieWords = ['кефир', 'питьевой йогурт', 'смузи', 'сок', 'капучино', 'латте', 'какао', 'молочный коктейль'];
const redZoneSnackWords = ['сыр', 'орех', 'авокад', 'сало', 'свинин', 'жирн', 'сливоч', 'майонез', 'соус', 'выпеч', 'булоч', 'печень', 'конфет', 'шоколад', 'сухофрукт', 'бутерброд', 'сэндвич', 'арахисов'];
const lightSnackSuggestion = 'для перекуса лучше выбрать что-то лёгкое и сытное: творог 0%, густой йогурт без сахара, яичный белок или белковый омлет, овощи с нежирным белком, ягоды вместе с белковым продуктом. Жидкие калории (кефир, питьевой йогурт, сок) перекус не заменяют';

// Heuristic: is the meal a "main meal" (not a small snack)?
function isMainMeal(meal: string): boolean {
  const m = meal.toLowerCase();
  if (hasAny(m, ['перекус', 'перекусила', 'перекусил'])) return false;
  // very short descriptions are often snacks
  if (m.length < 6) return false;
  return true;
}

function analyzeMealStructure(meal: string): string | null {
  const m = meal.toLowerCase();
  const hasProtein = hasAny(m, proteinWords);
  const hasVeg = hasAny(m, vegetableWords);
  const hasComplexCarb = hasAny(m, complexCarbWords);
  const hasFastCarb = hasAny(m, fastCarbWords) || hasAny(m, onlyFastCarbWords);
  const hasSweet = hasAny(m, sweetWords);

  // Only fast carbs / pastry / sweets — no protein, no veg.
  if ((hasFastCarb || hasSweet) && !hasProtein && !hasVeg && !hasComplexCarb) {
    return 'это в основном быстрые углеводы — такой приём пищи быстро даёт энергию, но плохо держит сытость и часто усиливает голод позже. Чтобы он работал на снижение веса, добавьте нежирный белок (курицу, рыбу, яйцо, творог) и овощи';
  }

  if (!hasProtein && isMainMeal(meal)) {
    return 'не видно нормального белка — без него сытость держится недолго. Добавьте курицу, рыбу, яйцо, творог или нежирное мясо';
  }

  if (!hasVeg && isMainMeal(meal) && !hasComplexCarb) {
    return 'не видно овощей или клетчатки — попробуйте добавить салат, тушёные овощи или зелень, чтобы приём пищи лучше насыщал';
  }

  return null;
}

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
  const hasLiquidCalories = hasAny(dayText, liquidCalorieWords);
  const hasRedZoneSnack = normalizedMeals.some(meal => hasAny(meal, ['перекус', 'перекусила', 'перекусил']) && hasAny(meal, redZoneSnackWords));
  const lastMeal = normalizedMeals[normalizedMeals.length - 1] || '';
  const eveningHeavy = hasAny(lastMeal, [...sweetWords, ...fattyWords, ...alcoholWords, ...overeatingWords]);
  const chaotic = mealCount <= 1 || mealCount >= 6;
  const weakFirstHalf = mealCount > 0 && !hasAny(normalizedMeals.slice(0, Math.max(1, Math.ceil(mealCount / 2))).join(' '), proteinWords);

  // Per-meal structure issues
  const mealIssues: MealStructureIssue[] = [];
  meals.forEach((meal, idx) => {
    const issue = analyzeMealStructure(meal);
    if (issue) {
      const isLast = idx === meals.length - 1 && meals.length >= 2;
      const prefix = isLast ? 'Вечером был «' : 'В приёме пищи «';
      mealIssues.push({ meal, issue: `${prefix}${meal.trim()}» — ${issue}.` });
    }
  });

  const good: string[] = [];
  if (hasProtein) good.push('в рационе был белок — он помогает держать сытость и легче проходить день');
  if (hasVegetables) good.push('были овощи или клетчатка — это поддерживает объём еды без лишней калорийности');
  if (mealCount >= 3 && mealCount <= 5 && mealIssues.length === 0) good.push('питание выглядело достаточно стабильным по количеству приёмов пищи');
  if (!eveningHeavy && mealCount > 0 && mealIssues.length === 0) good.push('вечер не выглядел самым тяжёлым приёмом пищи');

  const obstacles: string[] = [];
  // Per-meal issues take priority — show them first.
  mealIssues.forEach(mi => obstacles.push(mi.issue));

  if (hasSweet) obstacles.push('сладкое днём быстро даёт энергию, но обычно плохо насыщает и может усиливать голод позже');
  if (hasFastCarbs && !hasProtein) obstacles.push('быстрые углеводы без нормального белка делают сытость короткой, поэтому дефицит держать сложнее');
  if (hasFatty) obstacles.push('жирные продукты легко дают перебор по калориям, даже если порция кажется небольшой');
  if (hasAlcohol) obstacles.push('алкоголь добавляет калорийность и часто снижает контроль над выбором еды');
  if (hasLiquidCalories) obstacles.push('были жидкие калории (кефир, питьевой йогурт, сок, сладкие напитки) — они почти не насыщают, но добавляют калорий');
  if (hasRedZoneSnack) obstacles.push('в перекусах были калорийные ловушки: сыр, орехи, авокадо, выпечка или сладкое легко перегружают день по калориям');
  if (!hasProtein) obstacles.push('сегодня почти не видно нормального белка — из-за этого голод может возвращаться быстрее');
  if (!hasVegetables) obstacles.push('почти не видно овощей или клетчатки — без них еда хуже насыщает по объёму');
  if (chaotic) obstacles.push('питание выглядит хаотичным, и из-за этого сложнее заранее удержать нормальную сытость');
  if (eveningHeavy) obstacles.push('вечером собрались самые калорийные продукты — это часто перекрывает дефицит за день');
  if (weakFirstHalf) obstacles.push('в первой половине дня мало белка, поэтому тяга к более калорийной еде позже может быть сильнее');

  const problematicScore = obstacles.length + (hasAlcohol ? 1 : 0) + (eveningHeavy ? 1 : 0) + (!hasProtein ? 1 : 0) + mealIssues.length;
  const mode: AnalysisMode = problematicScore >= 3 ? 'problematic' : 'normal';

  const steps: string[] = [];
  // If meal-structure issues exist, the priority step is to fix structure.
  if (mealIssues.length > 0) {
    steps.push('в каждый основной приём пищи завтра добавьте нежирный белок (курица, рыба, яйцо, творог) и овощи — это держит сытость и помогает не тянуться к лишнему');
  }
  if (!hasProtein || weakFirstHalf) steps.push('завтра начните с белкового завтрака: яйца, творог, омлет, рыба или курица');
  if (hasSweet || hasFastCarbs || hasRedZoneSnack) steps.push(lightSnackSuggestion);
  if (hasFatty || eveningHeavy) steps.push('самую жирную еду уменьшите или замените на куриную грудку, нежирную рыбу и овощи');
  if (hasAlcohol) steps.push('алкоголь лучше не оставлять на обычный будний день, особенно если цель — снижение веса');
  if (!hasVegetables) steps.push('добавьте овощи хотя бы в один приём пищи');
  if (chaotic) steps.push('запланируйте 3 понятных приёма пищи, чтобы не собирать голод к вечеру');

  const fallbackStep = 'завтра оставьте основу дня такой же и улучшите один приём пищи: добавьте белок или овощи';

  let conclusion: string;
  if (mealIssues.length > 0) {
    conclusion = 'Основная мысль: чтобы вес снижался устойчивее, в каждый основной приём пищи нужен белок и клетчатка. Без этого сытость короткая и голод возвращается быстрее.';
  } else if (mode === 'problematic') {
    conclusion = 'При таком наборе еды снижать вес будет сложно: калорийность легко набирается, а сытость держится недолго.';
  } else {
    conclusion = getText('День в целом выглядит рабочим для снижения веса, но один небольшой шаг сделает его устойчивее.', 'День в целом выглядит рабочим для снижения веса, но один небольшой шаг сделает его устойчивее.', sex);
  }

  // Подобрать конкретные мягкие замены по приёмам пищи
  const swapMap = new Map<string, SoftSwap>();
  for (const meal of normalizedMeals) {
    for (const s of findSwapsInMeal(meal)) {
      swapMap.set(s.from, s);
    }
  }
  const swaps = Array.from(swapMap.values()).slice(0, 3);

  // If there are concrete meal issues, do not "auto-praise".
  const goodFinal = mealIssues.length > 0 && good.length === 0
    ? []
    : (mode === 'problematic' ? good.slice(0, 1) : good.slice(0, 3));

  return {
    mode,
    good: goodFinal,
    obstacles: obstacles.slice(0, mode === 'problematic' ? 5 : 3),
    conclusion,
    steps: (steps.length ? steps : [fallbackStep]).slice(0, mode === 'problematic' ? 2 : 2),
    swaps,
    mealIssues,
  };
}

// Метод "Мягкая замена" — основная логика рекомендаций по питанию.
// Не запреты, а замены более калорийных продуктов на более лёгкие,
// сохраняя сытость и удовольствие.

// 'loss' = active weight loss, 'fixation' = consolidating result, 'maintenance' = keeping weight.
// 'active' kept as a legacy alias of 'loss' for backwards compatibility.
export type WeightStage = 'loss' | 'fixation' | 'maintenance' | 'active';

export interface SoftSwap {
  from: string;
  to: string;
  why: string;
}

// Каталог мягких замен (используется в анализе и подсказках)
export const SOFT_SWAPS: SoftSwap[] = [
  { from: 'жирная рыба', to: 'треска, хек, минтай или горбуша', why: 'нежирная рыба даёт белок без лишних калорий' },
  { from: 'куриная ножка', to: 'куриная грудка', why: 'грудка легче по калориям при том же объёме белка' },
  { from: 'сметана', to: 'греческий йогурт 2%', why: 'тот же вкус, заметно меньше жира' },
  { from: 'сливочное масло', to: 'масло через распылитель', why: 'та же поджарка, в 5–10 раз меньше масла' },
  { from: 'сыр', to: 'творог 0% или йогурт без сахара', why: 'сыр быстро поднимает калорийность дня' },
  { from: 'булочка или выпечка', to: '«Бабушкина тайна» (Шарлотка) или «Грушевый пирог»', why: 'лёгкая версия того же удовольствия, а не отказ' },
  { from: 'майонез', to: 'лёгкий майонез 50/50 с греческим йогуртом', why: 'та же кремовость, меньше жира' },
  { from: 'жареное', to: 'запечённое или на пару', why: 'тот же продукт, минус скрытое масло' },
  { from: 'сок', to: 'вода или фрукт целиком', why: 'сок — это жидкие калории без сытости' },
  { from: 'капучино', to: '«Протеиновый капучино» (рецепт в базе)', why: 'та же кофейная привычка, заметно легче' },
  { from: 'сладкий йогурт', to: 'йогурт без сахара + ягоды', why: 'меньше сахара, такой же вкус' },
  { from: 'сухофрукты', to: 'свежие ягоды или фрукт', why: 'сухофрукты в 3–4 раза калорийнее свежих' },
  { from: 'банан или виноград', to: 'яблоко, груша, ягоды или цитрус', why: 'эти фрукты легче по калориям' },
];

// Продукты, которые на активном этапе лучше отложить (но не запрещаем!)
export const HEAVY_ON_ACTIVE = [
  'жирные сыры', 'плавленый сыр', 'сало', 'орехи как перекус', 'авокадо',
  'жирная молочка', 'сливочное масло', 'майонез', 'жирные соусы',
  'выпечка', 'сладости как перекус', 'сухофрукты без меры',
  'сладкие питьевые йогурты', 'капучино', 'соки', 'сладкие напитки',
];

// Лёгкие, сытные перекусы (без внутренних терминов "зелёная зона")
export const LIGHT_SNACKS = [
  'творог 0%',
  'зернистый творог 0%',
  'йогурт без сахара низкой жирности',
  'кефир 1%',
  'яичный белок',
  'куриная грудка',
  'нежирная рыба',
  'овощи',
  'ягоды',
  'белковый омлет без желтков',
];

// Поиск конкретной замены по тексту приёма пищи
export function findSwapsInMeal(mealText: string): SoftSwap[] {
  const text = mealText.toLowerCase();
  const found: SoftSwap[] = [];
  const triggers: { match: string[]; swap: SoftSwap }[] = [
    { match: ['сметан'], swap: SOFT_SWAPS[2] },
    { match: ['сливоч', 'на масле', 'масло слив'], swap: SOFT_SWAPS[3] },
    { match: ['сыр', 'плавлен'], swap: SOFT_SWAPS[4] },
    { match: ['булоч', 'круассан'], swap: SOFT_SWAPS[5] },
    { match: ['майонез'], swap: SOFT_SWAPS[6] },
    { match: ['жарен', 'фри'], swap: SOFT_SWAPS[7] },
    { match: ['сок ', 'сок,', 'сок.'], swap: SOFT_SWAPS[8] },
    { match: ['капучин', 'латте', 'раф '], swap: SOFT_SWAPS[9] },
    { match: ['сладк йогурт', 'питьевой йогурт', 'фруктовый йогурт'], swap: SOFT_SWAPS[10] },
    { match: ['курага', 'изюм', 'финик', 'чернослив', 'сухофрукт'], swap: SOFT_SWAPS[11] },
    { match: ['банан', 'виноград'], swap: SOFT_SWAPS[12] },
    { match: ['свинин', 'баран', 'утка', 'гусь', 'сёмг', 'семг', 'скумбри'], swap: SOFT_SWAPS[0] },
    { match: ['куриная ножк', 'окороч', 'бедр'], swap: SOFT_SWAPS[1] },
  ];
  for (const t of triggers) {
    if (t.match.some(m => text.includes(m)) && !found.includes(t.swap)) {
      found.push(t.swap);
    }
  }
  return found;
}

// Принцип метаболической тарелки
export const METABOLIC_PLATE_TEXT =
  'Собирай тарелку так: белок (60–100 г) + сложный углевод (60–100 г) + овощи (100–150 г). На активном этапе минимум добавленного жира.';

// Принцип "сладкой точки"
export const SWEET_SPOT_TEXT =
  'Если хочется сладкого — лучше съесть его сразу после основного приёма пищи, порцией до 100 г. Так меньше риск сорваться и легче удержать калорийность.';

// Метаболическая точка перед сном
export const METABOLIC_NIGHT_TEXT =
  'Если хочется есть вечером — выберите лёгкую "метаболическую точку": нежирный белок + овощи, без жира. Например: куриная грудка с перцем или белковый омлет с шампиньонами.';

// Текст про напитки на активном этапе
export const DRINKS_TEXT =
  'Пейте чистую воду, чай и кофе без сахара и молока. Соки, капучино и сладкие напитки — это жидкие калории, которые легко перебрать незаметно.';

// Объяснение принципа "почему жиры — главный рычаг"
export const FAT_LEVER_TEXT =
  'Жиры нужны организму, но 1 г жира = 9 ккал (белок и углеводы — по 4 ккал). На активном этапе их легко перебрать, поэтому выбираем более лёгкие варианты — без голода и запретов.';

export function stageLabel(stage: WeightStage): string {
  switch (stage) {
    case 'fixation': return 'Фиксация веса';
    case 'maintenance': return 'Сохранение веса';
    default: return 'Активное снижение веса';
  }
}

export function describeStage(stage: WeightStage): string {
  switch (stage) {
    case 'fixation':
      return 'Сейчас наша задача — закрепить результат и постепенно выйти на равновесную калорийность.';
    case 'maintenance':
      return 'На этом этапе задача — питаться нормально, сохранять результат и следить, чтобы вес оставался в безопасном коридоре.';
    default:
      return 'Сейчас этап активного снижения веса: фокус на дефиците калорий, нежирном белке и клетчатке.';
  }
}

// Stage is determined by the explicit currentStage stored in the profile.
// Transitions to fixation/maintenance happen only via user confirmation
// (after reaching goal weight, or after completing fixation).
export function detectStage(
  currentWeight?: number,
  goalWeight?: number,
  storedStage?: WeightStage,
): WeightStage {
  if (storedStage === 'fixation' || storedStage === 'maintenance') return storedStage;
  return 'loss';
}

// Has the user just reached (or passed) their goal? Used to trigger celebration.
export function hasReachedGoal(currentWeight?: number, goalWeight?: number): boolean {
  if (!currentWeight || !goalWeight) return false;
  return currentWeight <= goalWeight;
}

export function corridorStatus(
  currentWeight: number,
  goalWeight: number,
): 'below' | 'in_range' | 'above' {
  const low = goalWeight - 1;
  const high = goalWeight + 1;
  if (currentWeight < low) return 'below';
  if (currentWeight > high) return 'above';
  return 'in_range';
}

// База замен «Лёгкая замена» — 38 пар, согласовано Ингой (июль 2026).
// Источник: legche_swap_base_38.md. Все цифры и комментарии — утверждённые.
//
// Правила базы:
// 1. Не обещать лишнего: если вкус не тот же — не говорим «тот же вкус».
// 2. Не предлагать замену с сахаром или калорийнее 150 ккал/100 г.
// 3. Замена = лёгкая версия того же удовольствия, а не отказ.
// 4. Подсказки: после сохранения еды, макс. 2/день (на фиксации/сохранении — 1/день),
//    «Не сейчас» глушит пару на 14 дней. Начислений за клики НЕТ.
// 5. Копилка наполняется ТОЛЬКО от реальной еды через кнопку «Из лёгких рецептов».

import type { WeightStage } from './soft-swap';

export interface SwapPair {
  id: string;
  from: string;          // «Было»
  to: string;            // «Стало»
  savedKcal: number;     // ≈ ккал легче на типичную порцию (утверждено)
  comment?: string;      // комментарий Инги (утверждён дословно)
  tip?: string;          // дополнительный ориентир (утверждён)
  recipeId?: string;     // id рецепта в light-version.ts, если замена — рецепт Инги
  // Триггеры распознавания в тексте записи.
  // Префикс '=' — только точное совпадение слова (чтобы «фри» не ловил «фрикадельки»).
  // Фразы из нескольких слов ищутся как подстрока.
  triggers: string[];
  exclude?: string[];    // если слово начинается с этого — пара не срабатывает
}

// Порядок важен: более специфичные пары стоят раньше общих
// (например, «жареная картошка» раньше общего «жареное»).
export const SWAP_PAIRS: SwapPair[] = [
  // ===== Новые пары (25) =====
  {
    id: 'n16-fried-potatoes',
    from: 'Жареная картошка на масле',
    to: '«Жареная картошка с грибами» (пшики масла)',
    savedKcal: 170,
    recipeId: 'fried-potatoes-mushrooms',
    triggers: ['жареная картошка', 'жареный картофель', 'картошка жареная', 'картофель жареный', 'картошка на масле'],
  },
  {
    id: 'n06-fries',
    from: 'Картофель фри',
    to: 'Запечённые дольки',
    savedKcal: 180,
    comment: 'та же корочка без фритюра',
    triggers: ['картофель фри', 'картошка фри', '=фри'],
  },
  {
    id: 'n20-salad-mayo',
    from: 'Салат с майонезом',
    to: 'Заправка: лёгкий майонез 50/50 с греческим йогуртом',
    savedKcal: 110,
    triggers: ['салат с майонезом', 'салат с майонез', 'салатик с майонез'],
  },
  {
    id: 'n18-olivier',
    from: 'Оливье с майонезом',
    to: 'Заправка: лёгкий майонез (Кальве лёгкий/Zero) 50/50 с греческим йогуртом',
    savedKcal: 120,
    comment: 'вкус майонеза остаётся',
    triggers: ['оливье'],
  },
  {
    id: 'n19-shuba',
    from: 'Селёдка под шубой',
    to: 'Слабосолёная сельдь (не в масле) + соус лёгкий майонез/йогурт 50/50',
    savedKcal: 100,
    triggers: ['под шубой', 'селедка под', 'сельдь под'],
  },
  {
    id: 'n24-carbonara',
    from: 'Паста карбонара / сливочная',
    to: 'Просто спагетти (паста)',
    savedKcal: 180,
    comment: 'во время снижения веса пасту можно, а от жирных соусов и сыра лучше на время отказаться',
    triggers: ['карбонар', 'паста со сливками', 'сливочная паста', 'сливочный соус', 'паста в сливочном'],
  },
  {
    id: 'n05-pelmeni',
    from: 'Пельмени магазинные',
    to: 'Домашние с индейкой',
    savedKcal: 120,
    comment: 'контроль жирности фарша',
    triggers: ['пельмен'],
  },
  {
    id: 'n17-kotlety',
    from: 'Котлеты свиные',
    to: '«Котлеты из индейки»',
    savedKcal: 110,
    recipeId: 'turkey-cutlets',
    triggers: ['котлет'],
    exclude: ['индейк', 'курин', 'куриц'],
  },
  {
    id: 'n25-plov',
    from: 'Плов классический',
    to: 'С курицей или индейкой, обжариваем на пшиках масла',
    savedKcal: 130,
    triggers: ['плов'],
    exclude: ['курин', 'куриц', 'индейк'],
  },
  {
    id: 'n01-kolbasa',
    from: 'Колбаса / сосиски',
    to: 'Грудка курицы или индейки, или «лёгкая» колбаса до 100 ккал',
    savedKcal: 150,
    comment: 'меньше жира, больше белка',
    triggers: ['колбас', 'сосиск', 'сардельк'],
  },
  {
    id: 'n02-white-bread',
    from: 'Белый хлеб',
    to: 'Ржаной, чёрный, цельнозерновой, хлебцы',
    savedKcal: 60,
    comment: 'меньше скачков сахара в крови',
    tip: 'Ориентир по хлебу: до 200 ккал на 100 г, в один приём — до 40 г',
    triggers: ['белый хлеб', 'белого хлеба', '=батон', 'батона', 'багет'],
    exclude: ['батончик'],
  },
  {
    id: 'n03-sugar-tea',
    from: 'Сахар в чае/кофе (2 ложки)',
    to: 'Без сахара или сахзам',
    savedKcal: 40,
    comment: 'та же сладость, 0 ккал',
    triggers: ['с сахаром'],
  },
  {
    id: 'n04-cream-coffee',
    from: 'Сливки в кофе',
    to: 'Молоко 1,5%',
    savedKcal: 50,
    comment: 'вкус почти тот же',
    triggers: ['со сливками', '=сливки', 'сливками'],
    exclude: ['сливочн'],
  },
  {
    id: 'n07-granola',
    from: 'Гранола / мюсли с сахаром',
    to: 'Овсянка + ягоды',
    savedKcal: 130,
    comment: 'гранола — скрытый десерт',
    recipeId: 'oatmeal',
    triggers: ['гранол', 'мюсли'],
  },
  {
    id: 'n08-tvorozhnaya-massa',
    from: 'Творожная масса',
    to: 'Мягкий творог 0% + ягоды',
    savedKcal: 140,
    // «Глазированный сырок» намеренно НЕ триггер: пара №9 удалена Ингой — честной альтернативы нет
    triggers: ['творожная масс', 'творожной масс', 'творожную масс'],
  },
  {
    id: 'n10-plavleny',
    from: 'Плавленый сыр',
    to: 'Творожный сыр лайт',
    savedKcal: 60,
    triggers: ['плавлен'],
  },
  {
    id: 'n11-chips',
    from: 'Чипсы',
    to: 'Запечённый лаваш со специями',
    savedKcal: 200,
    comment: 'хруст тот же',
    triggers: ['чипс'],
  },
  {
    id: 'n12-batonchik',
    from: 'Шоколадный батончик',
    to: '«Нежность» (Шоколадный пирог)',
    savedKcal: 180,
    recipeId: 'nezhnost',
    triggers: ['батончик', 'сникерс', 'шоколадк'],
  },
  {
    id: 'n13-pechenye',
    from: 'Печенье к чаю (3 шт)',
    to: '«Бабушкина тайна» (Шарлотка)',
    savedKcal: 90,
    recipeId: 'sharlotka',
    triggers: ['печенье', 'печенья', 'печеньем', 'печеньк'],
  },
  {
    id: 'n14-plombir',
    from: 'Пломбир',
    to: '«Ягодный бриз» (Ягодное мороженое)',
    savedKcal: 120,
    recipeId: 'morozhenoe',
    triggers: ['пломбир', 'мороженое', 'мороженым', 'мороженого', 'эскимо'],
  },
  {
    id: 'n15-pizza',
    from: 'Пицца магазинная',
    to: 'Пицца «Я худею»',
    savedKcal: 150,
    recipeId: 'pizza',
    triggers: ['пицц'],
  },
  {
    id: 'n21-buterbrod',
    from: 'Бутерброд с маслом и сыром',
    to: 'Хлебец с творожным сыром',
    savedKcal: 130,
    triggers: ['бутерброд'],
  },
  {
    id: 'n22-bliny',
    from: 'Блины на масле',
    to: '«Солнце на тарелке» (Блины)',
    savedKcal: 140,
    recipeId: 'bliny',
    triggers: ['блин'],
  },
  {
    id: 'n23-vareniki',
    from: 'Вареники со сметаной',
    to: 'С йогуртом',
    savedKcal: 100,
    triggers: ['вареник'],
  },
  {
    id: 'n26-wine',
    from: 'Вино полусладкое/сладкое',
    to: 'Сухое, до 150 мл',
    savedKcal: 60,
    comment: 'во время снижения веса лучше отказаться от алкоголя, так как он вызывает отёки. Но если без этого никак — выбирайте сухое вино, до 150 мл',
    triggers: ['полусладк', '=вино', 'вина', 'вином'],
    exclude: ['сухое', 'сухим', 'сухого', 'виноград'],
  },

  // ===== Обновлённые существующие пары (13) =====
  {
    id: 's01-smetana',
    from: 'Сметана',
    to: 'Греческий йогурт 2%',
    savedKcal: 90,
    triggers: ['сметан'],
  },
  {
    id: 's02-butter',
    from: 'Сливочное масло при жарке',
    to: 'Пшики оливкового из распылителя',
    savedKcal: 80,
    triggers: ['сливочн', 'на масле'],
    exclude: ['пшик', 'оливков', 'растительн', 'сыр'],
  },
  {
    id: 's03-cheese',
    from: 'Сыр жирный',
    to: 'Творог / творожный сыр лёгкий',
    savedKcal: 100,
    triggers: ['сыр'],
    exclude: ['сырник', 'сырок', 'сырк', 'сырое', 'сырой', 'сырую', 'творожн'],
  },
  {
    id: 's04-bulochka',
    from: 'Булочка / выпечка',
    to: '«Бабушкина тайна» (Шарлотка) или «Грушевый пирог»',
    savedKcal: 150,
    comment: 'лёгкая версия того же удовольствия, а не отказ',
    recipeId: 'sharlotka',
    triggers: ['булоч', 'круассан', 'выпечк', 'плюшк', 'ватрушк'],
  },
  {
    id: 's05-mayo',
    from: 'Майонез',
    to: 'Лёгкий майонез 50/50 с греческим йогуртом',
    savedKcal: 100,
    triggers: ['майонез'],
  },
  {
    id: 's06-fried',
    from: 'Жареное',
    to: 'Запечённое / на гриле',
    savedKcal: 120,
    triggers: ['жарен'],
    exclude: ['пшик', 'гриль'],
  },
  {
    id: 's07-juice',
    from: 'Пакетированный сок',
    to: 'Вода / целый фрукт',
    savedKcal: 90,
    triggers: ['=сок', 'сока', 'соком'],
  },
  {
    id: 's08-cappuccino',
    from: 'Капучино / латте',
    to: '«Протеиновый капучино» (рецепт в базе)',
    savedKcal: 70,
    recipeId: 'cappuccino',
    triggers: ['капучин', 'латте', '=раф', 'макиато'],
  },
  {
    id: 's09-sweet-yogurt',
    from: 'Сладкий йогурт',
    to: 'Натуральный + ягоды',
    savedKcal: 60,
    triggers: ['сладкий йогурт', 'питьевой йогурт', 'фруктовый йогурт'],
  },
  {
    id: 's10-dried-fruit',
    from: 'Сухофрукты горстью',
    to: 'Свежие фрукты',
    savedKcal: 100,
    triggers: ['курага', 'кураг', 'изюм', 'финик', 'чернослив', 'сухофрукт'],
  },
  {
    id: 's11-banana',
    from: 'Банан / виноград',
    to: 'Яблоко / ягоды',
    savedKcal: 50,
    triggers: ['банан', 'виноград'],
  },
  {
    id: 's12-fatty-fish',
    from: 'Жирная рыба (сёмга)',
    to: 'Белая (треска, минтай)',
    savedKcal: 120,
    triggers: ['семг', 'лосос', 'скумбри'],
  },
  {
    id: 's13-okorochok',
    from: 'Куриный окорочок',
    to: 'Грудка',
    savedKcal: 70,
    triggers: ['окороч', 'куриная ножка', 'ножка курин', 'куриное бедро', 'куриные бедра', 'бедро курин', 'бедра курин'],
  },
];

// ===== Распознавание пары в тексте записи =====

function normalizeText(s: string): string {
  return s.toLowerCase().replace(/ё/g, 'е').replace(/[^a-zа-я0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}

function pairMatches(pair: SwapPair, text: string, tokens: string[]): boolean {
  if (pair.exclude?.some(ex => tokens.some(t => t.startsWith(ex)))) return false;
  return pair.triggers.some(trig => {
    if (trig.startsWith('=')) {
      const word = trig.slice(1);
      return tokens.includes(word);
    }
    if (trig.includes(' ')) return text.includes(trig);
    return tokens.some(t => t.startsWith(trig));
  });
}

// Первая подходящая пара (порядок в SWAP_PAIRS = приоритет), без учёта лимитов.
export function matchSwapPair(mealText: string): SwapPair | null {
  const text = normalizeText(mealText);
  if (!text) return null;
  const tokens = text.split(' ');
  for (const pair of SWAP_PAIRS) {
    if (pairMatches(pair, text, tokens)) return pair;
  }
  return null;
}

// ===== Движок подсказок (лимиты и «Не сейчас») =====
// Хранение в localStorage: счётчик за день + приглушённые пары.

const HINT_DAY_KEY = 'swapHintDay';
const HINT_COUNT_KEY = 'swapHintCount';
const HINT_MUTE_KEY = 'swapHintMuted'; // { [pairId]: 'YYYY-MM-DD' — молчим до этой даты }

const MUTE_DAYS = 14;

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function readMutes(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(HINT_MUTE_KEY) || '{}');
  } catch {
    return {};
  }
}

function hintsShownToday(): number {
  try {
    if (localStorage.getItem(HINT_DAY_KEY) !== todayStr()) return 0;
    return parseInt(localStorage.getItem(HINT_COUNT_KEY) || '0', 10) || 0;
  } catch {
    return 0;
  }
}

// Дневной лимит: 2 на снижении, 1 на фиксации/сохранении (подсказки реже).
export function dailyHintLimit(stage: WeightStage): number {
  return stage === 'fixation' || stage === 'maintenance' ? 1 : 2;
}

// Найти пару для подсказки с учётом лимита дня и приглушённых пар.
// НЕ увеличивает счётчик — для этого registerHintShown().
export function findSwapHint(mealText: string, stage: WeightStage): SwapPair | null {
  if (hintsShownToday() >= dailyHintLimit(stage)) return null;
  const pair = matchSwapPair(mealText);
  if (!pair) return null;
  const mutedUntil = readMutes()[pair.id];
  if (mutedUntil && todayStr() < mutedUntil) return null;
  return pair;
}

export function registerHintShown(): void {
  try {
    const t = todayStr();
    const count = localStorage.getItem(HINT_DAY_KEY) === t
      ? (parseInt(localStorage.getItem(HINT_COUNT_KEY) || '0', 10) || 0)
      : 0;
    localStorage.setItem(HINT_DAY_KEY, t);
    localStorage.setItem(HINT_COUNT_KEY, String(count + 1));
  } catch {}
}

// «Не сейчас» — пара молчит 14 дней.
export function muteSwapPair(pairId: string): void {
  try {
    const mutes = readMutes();
    const until = new Date();
    until.setDate(until.getDate() + MUTE_DAYS);
    mutes[pairId] = until.toISOString().slice(0, 10);
    localStorage.setItem(HINT_MUTE_KEY, JSON.stringify(mutes));
  } catch {}
}

// ===== Копилка лёгкости =====

export const KCAL_PER_KG = 7700; // утверждённая формула: 7700 ккал ≈ 1 кг

// «≈ 0,4 кг» — запятая как десятичный разделитель, один знак
export function kgEquivalent(kcal: number): string {
  const kg = Math.round((kcal / KCAL_PER_KG) * 10) / 10;
  return String(kg).replace('.', ',');
}

// Тексты Копилки (утверждены)
export const COPILKA_TEXTS = {
  title: 'Копилка лёгкости',
  monthLabel: 'ккал легче за месяц',
  kgLine: (kg: string) => `≈ ${kg} кг — не набрали благодаря заменам`,
  note: 'Считаем примерно: 7 700 ккал ≈ 1 кг. Это не обещание, а ориентир — но очень приятный.',
  empty: 'Здесь будут копиться ваши лёгкие решения. Первая замена — первый вклад.',
};

// Тексты подсказки в дневнике.
// Кнопки утверждены: «Покажи замену» / «Не сейчас».
// ⚠️ Заголовки teaser/title — НА СОГЛАСОВАНИЕ Инге (не деплоить без её «ок»).
export const HINT_TEXTS = {
  teaser: 'У этого блюда есть лёгкая версия', // ⚠️ на согласование
  title: 'Лёгкая замена',                      // ⚠️ на согласование
  showButton: 'Покажи замену',
  laterButton: 'Не сейчас',
  savedLabel: (kcal: number) => `≈ ${kcal} ккал легче на порцию`, // ⚠️ на согласование
};

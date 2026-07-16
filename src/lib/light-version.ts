// «Лёгкая версия» — поиск любимого блюда и его облегчённой версии.
// Суть метода: человек продолжает есть то, что любит, только легче — и худеет.
// Цифры классических версий согласованы с Ингой (июль 2026).

export interface LightRecipeEntry {
  recipeId: string;                 // id рецепта в MenuScreen
  recipeSection: 'breakfasts' | 'sweet' | 'soups' | 'lunches' | 'baking' | 'drinks';
  name: string;                     // фирменное название
  lightKcal: number;                // ккал/100г лёгкой версии
  hasVideo: boolean;
  aliases: string[];                // народные названия и вкусы для поиска
  classicLabel: string;             // с чем сравниваем
  classicKcal: number;              // ккал/100г классики
  tagline: string;                  // «тот же ... вкус»
}

export const LIGHT_RECIPES: LightRecipeEntry[] = [
  { recipeId: 'oatmeal', recipeSection: 'breakfasts', name: 'Овсянка', lightKcal: 50.8, hasVideo: true,
    aliases: ['овсянка', 'каша', 'геркулес', 'овсяная каша', 'нежное утро'],
    classicLabel: 'овсянка на молоке с маслом', classicKcal: 130, tagline: 'тот же нежный вкус' },
  { recipeId: 'pate', recipeSection: 'breakfasts', name: 'Печёночный паштет', lightKcal: 109.7, hasVideo: true,
    aliases: ['паштет', 'печёночный паштет', 'печеночный паштет', 'намазка', 'печень', 'железная леди'],
    classicLabel: 'печёночный паштет', classicKcal: 300, tagline: 'тот же насыщенный вкус' },
  { recipeId: 'zucchini', recipeSection: 'breakfasts', name: 'Оладьи из кабачков', lightKcal: 83.2, hasVideo: true,
    aliases: ['оладьи из кабачков', 'кабачковые оладьи', 'кабачки', 'оладьи', 'золотые зайчики'],
    classicLabel: 'оладьи из кабачков', classicKcal: 140, tagline: 'та же золотая корочка' },
  { recipeId: 'bliny', recipeSection: 'breakfasts', name: 'Блины', lightKcal: 99, hasVideo: true,
    aliases: ['блины', 'блинчики', 'блин', 'солнце на тарелке'],
    classicLabel: 'классические блины', classicKcal: 230, tagline: 'тот же домашний вкус' },
  { recipeId: 'varenie', recipeSection: 'breakfasts', name: 'Пектиновое варенье', lightKcal: 40, hasVideo: true,
    aliases: ['варенье', 'джем', 'повидло', 'конфитюр'],
    classicLabel: 'варенье с сахаром', classicKcal: 250, tagline: 'тот же ягодный вкус' },
  { recipeId: 'shaurma', recipeSection: 'breakfasts', name: 'Шаурма', lightKcal: 104.2, hasVideo: true,
    aliases: ['шаурма', 'шаверма', 'ролл', 'лаваш', 'заверните две'],
    classicLabel: 'уличная шаурма', classicKcal: 250, tagline: 'тот же сочный вкус' },
  { recipeId: 'taco', recipeSection: 'breakfasts', name: 'Тако', lightKcal: 80, hasVideo: true,
    aliases: ['тако', 'такос', 'мексиканское'],
    classicLabel: 'классическое тако', classicKcal: 220, tagline: 'тот же яркий вкус' },
  { recipeId: 'pirozhki', recipeSection: 'breakfasts', name: 'Пирожки', lightKcal: 113.2, hasVideo: true,
    aliases: ['пирожки', 'пирожок', 'как настоящие'],
    classicLabel: 'жареные пирожки', classicKcal: 290, tagline: 'тот же вкус из детства' },
  { recipeId: 'nezhnost', recipeSection: 'sweet', name: 'Шоколадный пирог', lightKcal: 95, hasVideo: true,
    aliases: ['шоколад', 'какао', 'шоколадный пирог', 'шоколадный кекс', 'брауни', 'торт', 'кекс', 'шоколадка', 'конфеты', 'нежность'],
    classicLabel: 'шоколадный кекс', classicKcal: 370, tagline: 'тот же шоколадный вкус' },
  { recipeId: 'nevesimost', recipeSection: 'sweet', name: 'Меренговый рулет', lightKcal: 56, hasVideo: true,
    aliases: ['безе', 'меренга', 'меренговый рулет', 'невесомость'],
    classicLabel: 'меренговый рулет', classicKcal: 300, tagline: 'та же воздушность' },
  { recipeId: 'oblaka', recipeSection: 'sweet', name: 'Яблочное суфле', lightKcal: 40.2, hasVideo: true,
    aliases: ['суфле', 'зефир', 'птичье молоко', 'яблочные облака', 'яблочное суфле'],
    classicLabel: 'зефир', classicKcal: 300, tagline: 'та же лёгкая сладость' },
  { recipeId: 'slivovoe', recipeSection: 'sweet', name: 'Сливовое варенье', lightKcal: 40, hasVideo: true,
    aliases: ['сливовое варенье', 'сливы', 'варенье'],
    classicLabel: 'варенье с сахаром', classicKcal: 250, tagline: 'тот же сливовый вкус' },
  { recipeId: 'grusha', recipeSection: 'sweet', name: 'Грушевый пирог', lightKcal: 117, hasVideo: true,
    aliases: ['грушевый пирог', 'пирог с грушей', 'пирог', 'фруктовый пирог'],
    classicLabel: 'фруктовый пирог', classicKcal: 300, tagline: 'тот же фруктовый вкус' },
  { recipeId: 'milfey', recipeSection: 'sweet', name: 'Яблочный мильфей', lightKcal: 68, hasVideo: true,
    aliases: ['мильфей', 'наполеон', 'слоёный десерт', 'слоеный десерт'],
    classicLabel: 'яблочный пирог', classicKcal: 230, tagline: 'тот же яблочный вкус' },
  { recipeId: 'morozhenoe', recipeSection: 'sweet', name: 'Ягодное мороженое', lightKcal: 60, hasVideo: true,
    aliases: ['мороженое', 'пломбир', 'сорбет', 'эскимо', 'ягодный бриз'],
    classicLabel: 'пломбир', classicKcal: 230, tagline: 'тот же сливочно-ягодный вкус' },
  { recipeId: 'maffiny', recipeSection: 'sweet', name: 'Маффины', lightKcal: 124.6, hasVideo: false,
    aliases: ['маффины', 'маффин', 'кексы', 'капкейки', 'мягкая посадка'],
    classicLabel: 'магазинные маффины', classicKcal: 380, tagline: 'тот же уютный вкус' },
  { recipeId: 'sharlotka', recipeSection: 'sweet', name: 'Шарлотка', lightKcal: 122, hasVideo: false,
    aliases: ['шарлотка', 'яблочный пирог', 'пирог с яблоками', 'бабушкина тайна'],
    classicLabel: 'классическая шарлотка', classicKcal: 230, tagline: 'тот же яблочный вкус' },
  { recipeId: 'okroshka', recipeSection: 'soups', name: 'Окрошка', lightKcal: 42, hasVideo: false,
    aliases: ['окрошка'],
    classicLabel: 'окрошка с колбасой и сметаной', classicKcal: 100, tagline: 'тот же летний вкус' },
  { recipeId: 'turkey-cutlets', recipeSection: 'lunches', name: 'Котлеты из индейки', lightKcal: 136, hasVideo: false,
    aliases: ['котлеты', 'котлета', 'биточки'],
    classicLabel: 'жареные котлеты', classicKcal: 250, tagline: 'тот же сочный вкус' },
  { recipeId: 'fried-potatoes-mushrooms', recipeSection: 'lunches', name: 'Жареная картошка с грибами', lightKcal: 60, hasVideo: false,
    aliases: ['жареная картошка', 'картошка жареная', 'картошка с грибами'],
    classicLabel: 'жареная картошка на масле', classicKcal: 190, tagline: 'та же хрустящая корочка' },
  { recipeId: 'pizza', recipeSection: 'baking', name: 'Пицца «Я худею»', lightKcal: 118.3, hasVideo: true,
    aliases: ['пицца'],
    classicLabel: 'магазинная пицца', classicKcal: 265, tagline: '' },
  { recipeId: 'cappuccino', recipeSection: 'drinks', name: 'Протеиновый капучино', lightKcal: 54, hasVideo: true,
    aliases: ['капучино', 'латте', 'кофе с молоком', 'раф'],
    classicLabel: 'капучино из кофейни (порция)', classicKcal: 120, tagline: '' },
];

// Запросы, на которые рецепта пока нет: отвечает Инга-AI,
// а запрос сохраняется — это план будущих съёмок.
export interface KnownQueryEntry {
  aliases: string[];
  label: string;          // как называем блюдо в ответе
  classicKcal: number;    // согласованная цифра классики
}

export const KNOWN_QUERIES: KnownQueryEntry[] = [
  { aliases: ['сырники', 'сырник'], label: 'сырники', classicKcal: 300 },
  { aliases: ['пельмени', 'вареники'], label: 'пельмени', classicKcal: 275 },
  { aliases: ['картофель фри', 'фри'], label: 'картофель фри', classicKcal: 312 },
  { aliases: ['пюре', 'картофельное пюре'], label: 'пюре с маслом', classicKcal: 110 },
  { aliases: ['макароны', 'паста', 'макароны с сыром', 'спагетти'], label: 'паста с сыром', classicKcal: 220 },
  { aliases: ['плов'], label: 'плов', classicKcal: 190 },
  { aliases: ['оливье'], label: 'оливье', classicKcal: 200 },
  { aliases: ['селёдка под шубой', 'селедка под шубой', 'шуба'], label: 'селёдка под шубой', classicKcal: 190 },
  { aliases: ['крабовый салат'], label: 'крабовый салат', classicKcal: 180 },
  { aliases: ['жюльен', 'жульен'], label: 'жюльен', classicKcal: 180 },
  { aliases: ['борщ'], label: 'борщ со сметаной', classicKcal: 90 },
  { aliases: ['солянка'], label: 'солянка', classicKcal: 100 },
  { aliases: ['сырный суп'], label: 'сырный суп', classicKcal: 90 },
  { aliases: ['хачапури'], label: 'хачапури', classicKcal: 290 },
  { aliases: ['чебуреки', 'чебурек'], label: 'чебуреки', classicKcal: 320 },
  { aliases: ['бургер', 'гамбургер', 'чизбургер'], label: 'бургер', classicKcal: 260 },
  { aliases: ['чизкейк'], label: 'чизкейк', classicKcal: 320 },
  { aliases: ['медовик'], label: 'медовик', classicKcal: 400 },
  { aliases: ['тирамису'], label: 'тирамису', classicKcal: 300 },
  { aliases: ['печенье'], label: 'печенье', classicKcal: 420 },
  { aliases: ['драники', 'картофельные оладьи'], label: 'жареные драники', classicKcal: 230 },
  { aliases: ['холодец', 'студень', 'заливное'], label: 'свиной холодец', classicKcal: 250 },
];

// «Безнадёжные» запросы — шутка Инги + всегда конструктивный хвост.
export interface HopelessEntry {
  aliases: string[];
  answer: string;
}

export const HOPELESS_QUERIES: HopelessEntry[] = [
  { aliases: ['сало'],
    answer: 'Есть вещи, которые легче не становятся — их лучше просто любить издалека 🙂 А если хочется солёного и сытного — попробуйте слабосолёную нежирную рыбу с чёрным хлебом.' },
  { aliases: ['чипсы'],
    answer: 'Чипсы легче не сделать — их лучше просто любить издалека 🙂 А если хочется похрустеть — запечённые пластинки лаваша со специями или хрустящие овощи с творожным соусом.' },
  { aliases: ['майонез'],
    answer: 'Майонез ложками — это любовь, которую лучше не облегчать, а заменить 🙂 Попробуйте лёгкий майонез 50/50 с греческим йогуртом: та же кремовость, в разы легче.' },
];

// --- Поиск ---

export type LightSearchResult =
  | { kind: 'recipes'; entries: LightRecipeEntry[] }
  | { kind: 'known'; entry: KnownQueryEntry }
  | { kind: 'hopeless'; entry: HopelessEntry }
  | { kind: 'unknown' };

function normalize(s: string): string {
  return s.toLowerCase().replace(/ё/g, 'е').replace(/[^a-zа-я0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}

function aliasMatches(alias: string, query: string): boolean {
  const a = normalize(alias);
  if (!a || !query) return false;
  if (a.includes(query) || query.includes(a)) return true;
  // совпадение по началу слова: «шарлот» найдёт «шарлотка»
  if (query.length >= 4 && a.split(' ').some(w => w.startsWith(query) || query.startsWith(w))) return true;
  return false;
}

export function searchLightVersion(rawQuery: string): LightSearchResult {
  const query = normalize(rawQuery);
  if (query.length < 2) return { kind: 'unknown' };

  const hopeless = HOPELESS_QUERIES.find(h => h.aliases.some(a => aliasMatches(a, query)));
  if (hopeless) return { kind: 'hopeless', entry: hopeless };

  const scored = LIGHT_RECIPES
    .map(r => {
      const exact = r.aliases.some(a => normalize(a) === query);
      const partial = r.aliases.some(a => aliasMatches(a, query));
      return { r, score: exact ? 2 : partial ? 1 : 0 };
    })
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length) return { kind: 'recipes', entries: scored.map(x => x.r) };

  const known = KNOWN_QUERIES.find(k => k.aliases.some(a => aliasMatches(a, query)));
  if (known) return { kind: 'known', entry: known };

  return { kind: 'unknown' };
}

// Во сколько раз легче — красиво: «в 1,9 раза», «в 3,4 раза»
export function timesLighter(classicKcal: number, lightKcal: number): string {
  const ratio = classicKcal / lightKcal;
  const rounded = Math.round(ratio * 10) / 10;
  const str = String(rounded).replace('.', ',');
  return `в ${str} раза легче`;
}

// Подсказки-чипсы на пустом экране
export const SUGGESTED_QUERIES = ['шарлотка', 'шоколад', 'блины', 'мороженое'];

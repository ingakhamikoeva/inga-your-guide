import { UserSex, getText } from './gender-text';
import { DailyReport } from './types';

export interface MorningWeightAnalysis {
  dayDelta: number | null;          // today - yesterday
  weekDelta: number | null;         // today - 7 days ago (or earliest available within last 7d window)
  weekDataAvailable: boolean;       // do we have a baseline ~7 days back
  meaning: string;                  // short interpretation paragraph
  weeklyComment: string;            // weekly trend comment
  focus: string;                    // single concrete focus for today
}

interface WeightEntry { date: string; weight: number }

const hasAny = (text: string, words: string[]) => words.some(w => text.includes(w));

const saltyWords = ['солён', 'солен', 'соль', 'колбас', 'сосиск', 'сыр', 'бекон', 'консерв', 'маринов', 'солён', 'селёдк', 'селедк', 'чипс', 'суши', 'роллы', 'соевый соус'];
const carbWords = ['хлеб', 'булоч', 'батон', 'паста', 'макарон', 'рис', 'картош', 'пицц', 'лаваш', 'блин', 'сухар', 'круассан', 'торт', 'пирож'];
const alcoholWords = ['пиво', 'вино', 'шампан', 'алког', 'коктейл', 'водк', 'виски', 'ром', 'сидр'];
const heavyWords = ['жарен', 'фри', 'майонез', 'сало', 'бекон', 'бургер', 'шаурм', 'жирн', 'сливоч'];

function diffDays(a: string, b: string): number {
  const da = new Date(a).getTime();
  const db = new Date(b).getTime();
  return Math.round((da - db) / (1000 * 60 * 60 * 24));
}

function findClosestEntry(entries: WeightEntry[], targetDate: string, targetDaysAgo: number, tolerance: number): WeightEntry | null {
  let best: WeightEntry | null = null;
  let bestDiff = Infinity;
  for (const e of entries) {
    const days = diffDays(targetDate, e.date);
    if (days <= 0) continue;
    const diff = Math.abs(days - targetDaysAgo);
    if (diff <= tolerance && diff < bestDiff) {
      best = e;
      bestDiff = diff;
    }
  }
  return best;
}

export function analyzeMorningWeight(
  todayDate: string,
  todayWeight: number,
  history: WeightEntry[],
  yesterdayReport: DailyReport | undefined,
  sleepHours: number | undefined,
  stepsYesterday: number | undefined,
  sex: UserSex,
): MorningWeightAnalysis {
  const past = history.filter(h => h.date < todayDate).sort((a, b) => a.date.localeCompare(b.date));
  const yesterday = findClosestEntry(past, todayDate, 1, 1);
  const weekAgo = findClosestEntry(past, todayDate, 7, 2);

  const dayDelta = yesterday ? +(todayWeight - yesterday.weight).toFixed(1) : null;
  const weekDelta = weekAgo ? +(todayWeight - weekAgo.weight).toFixed(1) : null;

  // Day-level meaning
  let meaning = '';
  let focus = '';

  if (dayDelta === null) {
    meaning = 'Это первый замер — пока не с чем сравнивать. Через несколько дней появится понятная картина.';
    focus = 'сегодня просто держим базу: вода, белок и овощи в каждом приёме пищи';
  } else if (dayDelta < -0.1) {
    meaning = 'Вес двигается вниз. Смотрим не на один день, а на тенденцию — и сейчас она хорошая 💛';
    focus = 'продолжаем в том же ритме: белок в каждом приёме пищи и движение в течение дня';
  } else if (Math.abs(dayDelta) <= 0.1) {
    meaning = 'Вес сегодня практически без изменений. Это нормально — нам важнее недельная динамика, а не один замер.';
    focus = 'сохрани привычный ритм питания и добавь активность днём';
  } else {
    // Weight up — investigate causes
    const causes: string[] = [];
    const mealsText = (yesterdayReport?.meals || []).map(m => m.description.toLowerCase()).join(' ');

    if (hasAny(mealsText, saltyWords)) causes.push('был солёный рацион');
    if (hasAny(mealsText, carbWords)) causes.push('много быстрых углеводов');
    if (hasAny(mealsText, alcoholWords)) causes.push('был алкоголь');
    if (hasAny(mealsText, heavyWords)) causes.push('была тяжёлая или жирная еда');

    // Late dinner heuristic: last meal exists and looks heavy/carby
    const lastMeal = (yesterdayReport?.meals || [])[ (yesterdayReport?.meals.length || 1) - 1 ]?.description.toLowerCase() || '';
    if (lastMeal && hasAny(lastMeal, [...carbWords, ...heavyWords, ...alcoholWords])) {
      causes.push('вечером был тяжёлый приём пищи');
    }

    if (sleepHours !== undefined && sleepHours > 0 && sleepHours < 6) causes.push('было мало сна');
    if (stepsYesterday !== undefined && stepsYesterday > 0 && stepsYesterday < 4000) causes.push('было мало движения');

    if (sex === 'female') causes.push('возможно, цикл или задержка жидкости');

    const causesText = causes.length
      ? `По вчерашнему дню вижу возможные причины: ${causes.slice(0, 3).join(', ')} — тело могло задержать воду.`
      : 'Чаще всего такие колебания связаны с водой, солью или вечерним приёмом пищи, а не с жиром.';

    meaning = `Сегодня вес чуть выше. Это не значит, что появился жир. ${causesText}`;
    focus = 'сегодня возвращаемся в ритм: вода, белок и клетчатка в каждом приёме пищи и 8–12 тысяч шагов';
  }

  // Weekly comment
  let weeklyComment = '';
  if (!weekAgo) {
    weeklyComment = 'Пока мало данных для недельной динамики. Через несколько дней я начну видеть тренд точнее.';
  } else if (weekDelta !== null && weekDelta < -0.1) {
    weeklyComment = `За неделю есть снижение: минус ${Math.abs(weekDelta)} кг. Это хороший темп, продолжаем.`;
  } else if (weekDelta !== null && weekDelta > 0.1) {
    weeklyComment = `За неделю вес немного вырос: плюс ${weekDelta} кг. Давай посмотрим, что могло повлиять: питание, сон, активность и вечерние перекусы. Сегодня выберем один фокус для коррекции.`;
  } else {
    weeklyComment = 'За неделю вес стабильный. Это тоже информация — продолжаем наблюдать тенденцию.';
  }

  return {
    dayDelta,
    weekDelta,
    weekDataAvailable: !!weekAgo,
    meaning,
    weeklyComment,
    focus,
  };
}

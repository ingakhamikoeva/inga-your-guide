import { UserSex } from './gender-text';
import { DailyReport, UserProfile } from './types';

export interface MorningWeightAnalysis {
  dayDelta: number | null;          // today - yesterday
  weekDelta: number | null;         // today - 7 days ago (or earliest available within last 7d window)
  weekDataAvailable: boolean;       // do we have a baseline ~7 days back
  dayInterval: number | null;
  weekInterval: number | null;
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
  stage: UserProfile['currentStage'] = 'loss',
): MorningWeightAnalysis {
  const validWeight = (weight: number) => Number.isFinite(weight) && weight > 0 && weight <= 999.9;
  const past = history.filter(h => h.date < todayDate && Number.isFinite(Date.parse(h.date)) && validWeight(h.weight))
    .sort((a, b) => a.date.localeCompare(b.date));
  const yesterday = past.at(-1);
  const weekAgo = findClosestEntry(past, todayDate, 7, 2);

  const dayDelta = yesterday && validWeight(todayWeight) ? +(todayWeight - yesterday.weight).toFixed(1) : null;
  const weekDelta = weekAgo && validWeight(todayWeight) ? +(todayWeight - weekAgo.weight).toFixed(1) : null;
  const dayInterval = dayDelta !== null ? diffDays(todayDate, yesterday!.date) : null;
  const weekInterval = weekDelta !== null ? diffDays(todayDate, weekAgo!.date) : null;
  const maintaining = stage === 'fixation' || stage === 'maintenance';

  // Day-level meaning
  let meaning = '';
  let focus = '';

  if (dayDelta === null) {
    meaning = 'Это первый замер — пока не с чем сравнивать. Через несколько дней появится понятная картина.';
    focus = 'сегодня просто держим базу: вода, белок и овощи в каждом приёме пищи';
  } else if (dayDelta < 0) {
    const x = Math.abs(dayDelta);
    meaning = `С предыдущего измерения вес снизился на ${x} кг.`;
    focus = 'белок в каждом приёме пищи и движение в течение дня';
  } else if (dayDelta === 0) {
    meaning = 'Вес сегодня без изменений. Это нормально — смотрим не на один день, а на тенденцию.';
    focus = 'сохраните привычный ритм питания и добавьте активность днём';
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

    const x = dayDelta;
    const comparison = dayInterval === 1 ? 'со вчерашнего дня' : 'с предыдущего измерения';
    const baseLine = `Сегодня плюс ${x} кг ${comparison}. Это не значит, что прибавился жир — вес может расти из-за соли, позднего ужина, углеводов, цикла, сна или задержки воды.`;
    const causesText = causes.length
      ? ` По вчерашнему дню вижу возможные причины: ${causes.slice(0, 3).join(', ')}.`
      : '';

    meaning = `${baseLine}${causesText}`;
    focus = 'сегодня возвращаемся в ритм: вода, белок и клетчатка в каждом приёме пищи и 8–12 тысяч шагов';
  }

  // Weekly comment
  let weeklyComment = '';
  if (weekDelta === null) {
    weeklyComment = 'Пока мало данных для недельной динамики. Через несколько дней я начну видеть тренд точнее.';
  } else if (weekDelta !== null && weekDelta < -0.1) {
    weeklyComment = `Между измерениями за ${weekInterval} дней вес снизился на ${Math.abs(weekDelta)} кг. Если изменение неожиданное, проверьте правильность записи и повторите взвешивание в привычных условиях.`;
  } else if (weekDelta !== null && weekDelta > 0.1) {
    weeklyComment = `За неделю вес немного вырос: плюс ${weekDelta} кг. Давайте посмотрим, что могло повлиять: питание, сон, активность и вечерние перекусы. Сегодня выберем один фокус для коррекции.`;
  } else {
    weeklyComment = 'За неделю вес стабильный. Это тоже информация — продолжаем наблюдать тенденцию.';
  }

  if (maintaining) {
    focus = 'Сейчас наша задача — сохранять достигнутый вес. Дальнейшее снижение не является целью.';
    // A gain during maintenance must not trigger a weight-loss correction prompt.
    if (weekDelta !== null && weekDelta > 0.1) weeklyComment = '';
  }

  return {
    dayDelta,
    weekDelta,
    weekDataAvailable: weekDelta !== null,
    dayInterval,
    weekInterval,
    meaning,
    weeklyComment,
    focus,
  };
}

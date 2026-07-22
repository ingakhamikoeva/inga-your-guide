import { DailyReport, Medal, MedalType } from './types';

interface WeightEntry { date: string; weight: number }

export interface GamificationSummary {
  streakDays: number;
  streakMessage: string;
  weekChange: number | null;
  weeklyInsight: string;
  nextMedal: Medal | null;
}

const medalStyles: Record<MedalType, { icon: string; tone: string }> = {
  movement: { icon: '🟢', tone: 'text-success' },
  stable: { icon: '🟡', tone: 'text-warning' },
  strong: { icon: '🔥', tone: 'text-primary' },
  consistency: { icon: '🔵', tone: 'text-info' },
};

const medalCopy: Record<MedalType, { titles: string[]; descriptions: string[] }> = {
  movement: {
    titles: ['Движение вниз', 'Есть движение', 'Мягкий минус', 'Шаг вниз'],
    descriptions: [
      'Есть движение вниз 💛 Вы держите ритм — и это даёт результат',
      'Вес начал двигаться. Спокойный ритм сейчас работает',
      'Небольшое снижение — это тоже результат системы',
      'Вы сохраняете процесс, и цифры постепенно отвечают',
    ],
  },
  stable: {
    titles: ['Стабильный результат', 'Неделя в ритме', 'Уверенное движение', 'Ровный курс'],
    descriptions: [
      'Вы держите ритм — и это даёт результат',
      'Спокойное движение вперёд всегда выигрывает',
      'Видно, что вы выстраиваете систему',
      'Это тот темп, который даёт устойчивый результат',
    ],
  },
  strong: {
    titles: ['Сильная неделя', 'Сильный курс', 'Неделя системы', 'Мощное движение'],
    descriptions: [
      'Очень сильный результат. Видно, что вы держите систему',
      'За неделю получилось заметное движение — продолжай без давления',
      'Система сработала. Важно сохранить спокойный ритм дальше',
      'Это сильная неделя, и её лучше закрепить стабильностью',
    ],
  },
  consistency: {
    titles: ['Стабильность', 'Возвращение в ритм', 'Опора недели', 'Ритм важнее идеала'],
    descriptions: [
      'Вы держите ритм всю неделю. Это база для результата',
      'Ты была в процессе — и это важнее идеального дня',
      'Регулярность уже работает как фундамент для изменений',
      'Ты возвращалась к дневнику, а значит сохраняла курс',
    ],
  },
};

function diffDays(a: string, b: string): number {
  return Math.round((new Date(a).getTime() - new Date(b).getTime()) / 86400000);
}

function weekKey(date: string): string {
  const d = new Date(date);
  const first = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - first.getTime()) / 86400000 + first.getDay() + 1) / 7);
  return `${d.getFullYear()}-${week}`;
}

function findWeekAgo(entries: WeightEntry[], today: string): WeightEntry | null {
  let best: WeightEntry | null = null;
  let bestDiff = Infinity;
  entries.forEach(entry => {
    const days = diffDays(today, entry.date);
    const delta = Math.abs(days - 7);
    if (days > 0 && delta <= 2 && delta < bestDiff) {
      best = entry;
      bestDiff = delta;
    }
  });
  return best;
}

function getActiveDates(reports: DailyReport[], weights: WeightEntry[]): string[] {
  return Array.from(new Set([
    ...reports.filter(r => r.meals.length || r.eveningEmotion || r.weight || r.sleepHours || r.stepsYesterday).map(r => r.date),
    ...weights.map(w => w.date),
  ])).sort((a, b) => b.localeCompare(a));
}

function calculateStreak(activeDates: string[], today: string): number {
  const active = new Set(activeDates);
  let streak = 0;
  for (let i = 0; i < 365; i += 1) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    if (!active.has(key)) break;
    streak += 1;
  }
  return streak;
}

function chooseVariant(type: MedalType, previous: Medal[]): Pick<Medal, 'title' | 'description'> {
  const copy = medalCopy[type];
  const recent = previous.slice(-3);
  const last = previous[previous.length - 1];
  const titlePool = copy.titles.filter(title => title !== last?.title && !recent.some(m => m.type === type && m.title === title));
  const descriptionPool = copy.descriptions.filter(description => description !== last?.description);
  return {
    title: (titlePool.length ? titlePool : copy.titles)[Math.floor(Math.random() * (titlePool.length || copy.titles.length))],
    description: (descriptionPool.length ? descriptionPool : copy.descriptions)[Math.floor(Math.random() * (descriptionPool.length || copy.descriptions.length))],
  };
}

export function getMedalStyle(type: MedalType) {
  return medalStyles[type];
}

export function buildGamificationSummary(
  today: string,
  weights: WeightEntry[],
  reports: DailyReport[],
  medals: Medal[],
): GamificationSummary {
  const sortedWeights = weights.filter(w => w.weight > 0).sort((a, b) => a.date.localeCompare(b.date));
  const todayWeight = [...sortedWeights].reverse().find(w => w.date <= today);
  const weekAgo = todayWeight ? findWeekAgo(sortedWeights.filter(w => w.date < todayWeight.date), todayWeight.date) : null;
  const weekChange = todayWeight && weekAgo ? +(todayWeight.weight - weekAgo.weight).toFixed(1) : null;
  const activeDates = getActiveDates(reports, weights);
  const streakDays = calculateStreak(activeDates, today);
  const currentWeekKey = weekKey(today);

  let type: MedalType | null = null;
  if (weekChange !== null && weekChange <= -2) type = 'strong';
  else if (weekChange !== null && weekChange <= -1) type = 'stable';
  else if (weekChange !== null && weekChange <= -0.1) type = 'movement';
  else if (activeDates.filter(date => diffDays(today, date) >= 0 && diffDays(today, date) <= 6).length >= 3) type = 'consistency';

  const alreadyAwarded = medals.some(m => m.weekKey === currentWeekKey);
  const variant = type && !alreadyAwarded ? chooseVariant(type, medals) : null;
  const nextMedal = type && variant ? {
    id: `${currentWeekKey}-${type}-${Date.now()}`,
    type,
    title: variant.title,
    description: variant.description,
    date: today,
    weekKey: currentWeekKey,
  } : null;

  const streakMessage = streakDays >= 14
    ? 'Вы реально держите курс. Это уровень, на котором приходит результат'
    : streakDays >= 7
      ? 'Неделя в ритме — это уже система'
      : streakDays >= 3
        ? 'Ты уже 3 дня в процессе 💛'
        : activeDates.length > 0
          ? 'Ничего страшного. Давайте просто продолжим ритм сегодня'
          : 'Начинаем спокойно: один заполненный день уже запускает процесс';

  const weeklyInsight = weekChange !== null && weekChange < 0
    ? 'За эту неделю есть движение. Важнее всего, что вы сохраняете регулярность и видите отклик.'
    : 'За эту неделю главный результат — стабильность в процессе. Это важнее одной цифры на весах.';

  return { streakDays, streakMessage, weekChange, weeklyInsight, nextMedal };
}
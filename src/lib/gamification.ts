import { DailyReport, Medal, MedalType } from './types';
interface WeightEntry { date: string; weight: number }
export function getMedalStyle(type: MedalType) {
  const icons: Record<MedalType, string> = {
    movement: '🏅', stable: '🏅', strong: '🏅', consistency: '🌟',
    recipe: '🍽️', goal: '👑', maintenance: '🏆',
  };
  return { icon: icons[type] || '🏅', tone: 'text-primary' };
}
// Presentation only. Award eligibility and persistence belong to the server.
export function buildGamificationSummary(
  today: string, weights: WeightEntry[], _reports: DailyReport[], _medals: Medal[],
  serverStreak: number | null = null,
) {
  const entries = [...new Map(weights.filter(w => w.date <= today && w.weight > 0)
    .map(w => [w.date, w])).values()].sort((a, b) => a.date.localeCompare(b.date));
  const latest = entries[entries.length - 1];
  const age = latest ? (Date.parse(today) - Date.parse(latest.date)) / 86400000 : Infinity;
  const prior = latest && age <= 2 ? entries.filter(w => {
    const days = (Date.parse(latest.date) - Date.parse(w.date)) / 86400000;
    return days >= 5 && days <= 9;
  }).sort((a, b) => Math.abs((Date.parse(latest.date) - Date.parse(a.date)) / 86400000 - 7)
    - Math.abs((Date.parse(latest.date) - Date.parse(b.date)) / 86400000 - 7))[0] : undefined;
  return {
    streakDays: serverStreak ?? 0,
    streakMessage: 'Дни подряд с записью веса и хотя бы одного приёма пищи.',
    weekChange: latest && prior ? +(latest.weight - prior.weight).toFixed(1) : null,
    weeklyInsight: latest && prior ? `${prior.date} — ${latest.date}` : '',
    nextMedal: null,
  };
}

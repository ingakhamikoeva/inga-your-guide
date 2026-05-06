// Short, practical Inga comment for the daily summary card.
// Style: fact → next step. No moralizing. No "zones".

import type { DailySummary } from './types';

export function buildSummaryComment(s: DailySummary): string {
  if (s.meal_count === 0) {
    return 'Пока нет записей по питанию. Добавь первый приём пищи — и я соберу сводку дня.';
  }

  const target = s.calorie_target ?? 0;
  const eaten = s.calories_eaten_estimated;
  const left = s.calories_left ?? 0;

  // Overshoot
  if (target > 0 && eaten > target * 1.05) {
    return 'Сегодня перебрали с калорийностью. Завтра вернёмся в ритм.';
  }

  // Almost out of calories
  if (target > 0 && left > 0 && left < target * 0.15) {
    return 'До дневной нормы калорий осталось немного — выбери белок + овощи, без жиров и углеводов.';
  }

  // Macro priorities
  if (s.protein_status === 'low') {
    return 'Добери белок до конца дня.';
  }
  if (s.fat_status === 'too_high' || s.fat_status === 'high') {
    return 'Жиры выше нормы. Постарайся ограничить их до конца дня.';
  }
  if (s.carbs_status === 'too_high' || s.carbs_status === 'high') {
    return 'Углеводов сегодня уже много — поужинай белковым продуктом с салатом.';
  }
  if (s.fiber_status === 'low') {
    return 'Добавь овощи в следующий приём пищи — так будет больше сытости.';
  }

  return 'Молодец, продолжай в том же духе!';
}

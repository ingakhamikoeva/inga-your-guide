import { expect, test } from 'vitest';
import { calculateAll, calculateCalorieCorridor, usesMinimumCalorieCorridor } from '@/lib/calculations';
import { analyzeMorningWeight } from '@/lib/morning-analysis';

const profile = { gender: 'female' as const, age: 60, height: 150, weight: 55, stepsPerDay: 3000 };

test.each([
  { weight: 55, bmr: 1178, rawTarget: 950 },
  { weight: 70, bmr: 1321, rawTarget: 1050 },
])('B4: $weight kg retains the original formula and applies the agreed minimum corridor', ({ weight, bmr, rawTarget }) => {
  const result = calculateAll({ ...profile, weight });
  expect(result.bmr).toBe(bmr);
  expect(result.deficit25).toBe(rawTarget);
  expect([result.corridorMin, result.corridorMax]).toEqual([1000, 1200]);
  expect(usesMinimumCalorieCorridor(result)).toBe(true);
});

test('B4: even an entirely sub-1000 formula corridor becomes 1000–1200', () => {
  const result = calculateAll({ ...profile, age: 80, height: 140, weight: 40, stepsPerDay: 0 });
  expect(result.deficit25 + 100).toBeLessThan(1000);
  expect([result.corridorMin, result.corridorMax]).toEqual([1000, 1200]);
});

test.each([
  { total: 1432, raw: 1050, min: 1000, max: 1200 },
  { total: 1434, raw: 1100, min: 1000, max: 1200 },
  { total: 1600, raw: 1200, min: 1100, max: 1300 },
  { total: 2200, raw: 1650, min: 1550, max: 1750 },
])('B4: saved-plan calculation preserves rounding at $total kcal', ({ total, raw, min, max }) => {
  expect(calculateCalorieCorridor(total)).toEqual({ deficit25: raw, corridorMin: min, corridorMax: max });
});

test.each(['female', 'male'] as const)('B4: ordinary %s calculation is unchanged', gender => {
  const p = { gender, age: 40, height: 165, weight: 70, stepsPerDay: 5000 };
  const bmr = gender === 'female' ? 655.1 + 9.563 * p.weight + 1.85 * p.height - 4.676 * p.age
    : 66.5 + 13.75 * p.weight + 5.003 * p.height - 6.775 * p.age;
  const target = Math.round(Math.round(bmr + p.stepsPerDay * (gender === 'female' ? 0.02 : 0.04)) * 0.75 / 50) * 50;
  const result = calculateAll(p);
  expect(result.deficit25).toBe(target);
  expect([result.corridorMin, result.corridorMax]).toEqual([target - 100, target + 100]);
  expect(usesMinimumCalorieCorridor(result)).toBe(false);
});

test('B4: a 5 kg weekly fall receives the agreed neutral wording, without praise', () => {
  const result = analyzeMorningWeight('2026-10-31', 49, [
    { date: '2026-10-24', weight: 54 }, { date: '2026-10-30', weight: 50 },
  ], undefined, undefined, undefined, 'female');
  expect(result.meaning).toBe('С предыдущего измерения вес снизился на 1 кг.');
  expect(result.weeklyComment).toBe('Между измерениями за 7 дней вес снизился на 5 кг. Если изменение неожиданное, проверьте правильность записи и повторите взвешивание в привычных условиях.');
  expect(JSON.stringify(result)).not.toMatch(/Отлично|хороший темп|в вашу сторону/);
});

test.each(['fixation', 'maintenance'] as const)('B4: %s focuses on stability even if weight falls', stage => {
  const result = analyzeMorningWeight('2026-10-31', 49, [{ date: '2026-10-24', weight: 54 }], undefined, undefined, undefined, 'female', stage);
  expect(result.focus).toBe('Сейчас наша задача — сохранять достигнутый вес. Дальнейшее снижение не является целью.');
  expect(result.meaning).toBe('С предыдущего измерения вес снизился на 5 кг.');
  expect(result.dayInterval).toBe(7);
});

test.each(['fixation', 'maintenance'] as const)('B4: %s gain does not prompt further weight-loss correction', stage => {
  const result = analyzeMorningWeight('2026-10-31', 55, [{ date: '2026-10-24', weight: 54 }], undefined, undefined, undefined, 'female', stage);
  expect(result.focus).toContain('Дальнейшее снижение не является целью');
  expect(result.weeklyComment).not.toContain('коррекции');
  expect(result.meaning).toContain('с предыдущего измерения');
  expect(result.meaning).not.toContain('со вчерашнего дня');
});

test('B4: a six-day comparison is not labelled as seven days', () => {
  const result = analyzeMorningWeight('2026-10-31', 69, [{ date: '2026-10-25', weight: 70 }], undefined, undefined, undefined, 'male');
  expect(result.weekInterval).toBe(6);
  expect(result.weeklyComment).toContain('за 6 дней');
});

test('B4: invalid historical measurements do not produce NaN or exaggerated changes', () => {
  const result = analyzeMorningWeight('2026-10-31', 70, [
    { date: '2026-10-24', weight: 0 }, { date: '2026-10-29', weight: Infinity },
    { date: '2026-10-30', weight: 7000 }, { date: '2026-10-23', weight: 71 },
  ], undefined, undefined, undefined, 'female');
  expect(result.dayDelta).toBe(-1); expect(result.dayInterval).toBe(8);
  expect(result.weekDelta).toBe(-1);
  expect(JSON.stringify(result)).not.toMatch(/NaN|Infinity/);
});

test('B4: no history and stable weight retain neutral existing messages', () => {
  const first = analyzeMorningWeight('2026-10-31', 70, [], undefined, undefined, undefined, 'female');
  expect(first.dayDelta).toBeNull(); expect(first.weekDataAvailable).toBe(false);
  const stable = analyzeMorningWeight('2026-10-31', 70, [{ date: '2026-10-24', weight: 70 }], undefined, undefined, undefined, 'female');
  expect(stable.dayDelta).toBe(0); expect(stable.weeklyComment).toContain('вес стабильный');
});

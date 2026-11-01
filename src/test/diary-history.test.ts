import { describe, expect, test, vi } from 'vitest';
import { diaryDayKey, groupDiary, diaryFortnight, diaryFortnightHtml, diaryPrintHtml, mealTime } from '@/lib/diary-history';
import type { FoodLogRow } from '@/lib/db';
vi.mock('@/lib/achievement-client', () => ({ deviceTimezone: () => 'Europe/Moscow' }));
const meal = (datetime: string, raw_text = 'Суп'): FoodLogRow => ({ log_id: datetime, datetime, raw_text, meal_tag: 'snack', meta: null });
const checkin = { date: '2026-11-01', weight_kg: '58.3', sleep_hours: '0', steps_yesterday: 0, stool_yesterday: false };

describe('I1: diary calendar and exports', () => {
  test('Moscow midnight merges the meal with its calendar checkin, including month boundary', () => {
    const meals = [meal('2026-10-31T20:59:00Z'), meal('2026-10-31T21:30:00Z')];
    const days = groupDiary({ checkins: [checkin], meals }, 'Europe/Moscow');
    expect(days.map(d => d.date)).toEqual(['2026-11-01', '2026-10-31']);
    expect(days[0].checkin).toEqual(checkin);
    expect(days[0].meals).toEqual([meals[1]]);
    expect(mealTime(meals[1].datetime, 'Europe/Moscow')).toBe('00:30');
  });
  test.each(['2026-12-31T21:30:00Z', '2024-02-29T21:30:00Z'])('handles year and leap-month boundaries: %s', iso => {
    const expected = iso.startsWith('2026') ? '2027-01-01' : '2024-03-01';
    expect(groupDiary({ checkins: [], meals: [meal(iso)] }, 'Europe/Moscow')[0].date).toBe(expected);
  });
  test('uses viewer timezone consistently, rather than assuming Moscow for every user', () => {
    const date = new Date('2026-11-01T02:30:00Z');
    expect(diaryDayKey(date, 'America/New_York')).toBe('2026-10-31');
    expect(mealTime(date.toISOString(), 'America/New_York')).toBe('22:30');
    expect(diaryDayKey(date, 'Asia/Vladivostok')).toBe('2026-11-01');
  });
  test('14 days include local today, exclude older/future entries, and have no DST gaps', () => {
    const dates = diaryFortnight([], new Date('2026-03-09T01:00:00Z'), 'America/New_York').map(d => d.date);
    expect(dates).toHaveLength(14); expect(new Set(dates).size).toBe(14);
    expect(dates[0]).toBe('2026-02-23'); expect(dates.at(-1)).toBe('2026-03-08');
    const now = new Date('2026-10-31T21:30:00Z');
    const days = groupDiary({ checkins: [checkin], meals: [meal('2026-10-18T09:00:00Z'), meal('2026-11-02T09:00:00Z')] });
    const recent = diaryFortnight(days, now);
    expect(recent[0].date).toBe('2026-10-19'); expect(recent.at(-1)?.date).toBe('2026-11-01');
    expect(recent.flatMap(d => d.meals)).toEqual([]); expect(recent.at(-1)?.checkin).toEqual(checkin);
  });
  test('both report formats contain saved food/checkin, preserve zero/false, and escape HTML', () => {
    const days = groupDiary({ checkins: [checkin], meals: [meal('2026-10-31T21:30:00Z', '<img src=x onerror=alert(1)> & суп')] });
    for (const html of [diaryPrintHtml('<script>name</script>', days), diaryFortnightHtml('<script>name</script>', days, new Date('2026-11-01T12:00:00Z'))]) {
      expect(html).toContain('58.3 кг'); expect(html).toContain('0 ч'); expect(html).toContain('Стул: Нет');
      expect(html).toContain('&lt;img'); expect(html).toContain('&amp; суп'); expect(html).toContain('&lt;script&gt;');
      const doc = new DOMParser().parseFromString(html, 'text/html');
      expect(doc.querySelector('img,script')).toBeNull(); expect(doc.body.textContent).toMatch(/👟\s*0/);
    }
  });
  test('sleep-only days count as data and empty days remain placeholders', () => {
    const days = groupDiary({ checkins: [{ ...checkin, weight_kg: null }], meals: [] });
    const html = diaryFortnightHtml('Мария', days, new Date('2026-11-01T12:00:00Z'));
    expect(html).toContain('1 из 14'); expect(html).toContain('Средний вес: <b>— кг');
    expect(new DOMParser().parseFromString(html, 'text/html').querySelectorAll('.day')).toHaveLength(14);
  });
});

import { apiFetch } from './api-client';
import type { FoodLogRow } from './db';

export interface DiaryCheckin {
  date: string;
  weight_kg: string | number | null;
  sleep_hours: string | number | null;
  steps_yesterday: number | null;
  stool_yesterday: boolean | null;
}
export interface DiaryDay {
  date: string;
  checkin?: DiaryCheckin;
  meals: FoodLogRow[];
}
export function groupDiary(data: { checkins: DiaryCheckin[]; meals: FoodLogRow[] }): DiaryDay[] {
  const days = new Map<string, DiaryDay>();
  const day = (date: string) => {
    if (!days.has(date)) days.set(date, { date, meals: [] });
    return days.get(date)!;
  };
  for (const c of data.checkins) day(c.date).checkin = c;
  for (const meal of data.meals) {
    const time = new Date(meal.datetime);
    if (!Number.isNaN(time.getTime())) day(time.toISOString().slice(0, 10)).meals.push(meal);
  }
  return [...days.values()].sort((a, b) => b.date.localeCompare(a.date));
}
export async function loadDiaryHistory(): Promise<DiaryDay[]> {
  return groupDiary(await apiFetch<{ checkins: DiaryCheckin[]; meals: FoodLogRow[] }>('/diary', { cache: 'no-store' }));
}
export const diaryDate = (date: string) => new Date(date + 'T12:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
export const mealTime = (iso: string) => new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
export const diaryValue = (value: string | number | null | undefined, suffix = '') => value == null ? '—' : `${value}${suffix}`;
export const stoolValue = (value: boolean | null | undefined) => value === true ? 'Да' : value === false ? 'Нет' : '—';
const escapeHtml = (value: unknown) => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
export function diaryPrintHtml(name: string | undefined, days: DiaryDay[]): string {
  const esc = escapeHtml;
  return `<!doctype html><html lang="ru"><head><meta charset="UTF-8"><title>Дневник питания</title>
<style>body{font:14px Arial,sans-serif;color:#2C1A0E;max-width:750px;margin:auto;padding:20px}h1,h2{color:#FF6200}section{border:1px solid #EDE5DF;border-radius:12px;padding:12px;margin:12px 0;break-inside:avoid}p{white-space:pre-wrap}.meta{font-size:12px}button{padding:12px;background:#FF6200;color:white;border:0;border-radius:12px}@media print{button{display:none}}</style></head><body>
<button onclick="window.print()">📥 Сохранить как PDF</button><h1>Дневник питания — ${esc(name || 'Пользователь')}</h1>
${days.map(day => `<section><h2>${esc(diaryDate(day.date))}</h2><p class="meta">⚖️ ${esc(diaryValue(day.checkin?.weight_kg, ' кг'))} · 😴 ${esc(diaryValue(day.checkin?.sleep_hours, ' ч'))} · 👟 ${esc(diaryValue(day.checkin?.steps_yesterday))} · Стул: ${esc(stoolValue(day.checkin?.stool_yesterday))}</p>
${day.meals.map(meal => `<p>${esc(mealTime(meal.datetime))} · ${esc(meal.raw_text)}</p>`).join('') || '<p>Приёмы пищи не записаны</p>'}</section>`).join('')}
</body></html>`;
}
export function printDiary(name: string | undefined, days: DiaryDay[]) {
  const popup = window.open('', '_blank');
  if (popup) { popup.opener = null; popup.document.write(diaryPrintHtml(name, days)); popup.document.close(); }
}

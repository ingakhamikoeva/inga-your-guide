import { apiFetch } from './api-client';
import type { FoodLogRow } from './db';
import { deviceTimezone } from './achievement-client';
import { diaryPrintIcons } from './diary-print-icons';

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
// Use the same device timezone as the daily meal screen, never UTC slicing.
export function diaryDayKey(date: Date, timeZone = deviceTimezone()): string {
  const parts = new Intl.DateTimeFormat('en', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const part = (type: string) => parts.find(p => p.type === type)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}
export function groupDiary(data: { checkins: DiaryCheckin[]; meals: FoodLogRow[] }, timeZone = deviceTimezone()): DiaryDay[] {
  const days = new Map<string, DiaryDay>();
  const day = (date: string) => {
    if (!days.has(date)) days.set(date, { date, meals: [] });
    return days.get(date)!;
  };
  for (const c of data.checkins) day(c.date).checkin = c;
  for (const meal of data.meals) {
    const time = new Date(meal.datetime);
    if (!Number.isNaN(time.getTime())) day(diaryDayKey(time, timeZone)).meals.push(meal);
  }
  return [...days.values()].sort((a, b) => b.date.localeCompare(a.date));
}
export async function loadDiaryHistory(): Promise<DiaryDay[]> {
  return groupDiary(await apiFetch<{ checkins: DiaryCheckin[]; meals: FoodLogRow[] }>('/diary', { cache: 'no-store' }));
}
export const diaryDate = (date: string) => new Date(date + 'T12:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
export const mealTime = (iso: string, timeZone = deviceTimezone()) => new Date(iso).toLocaleTimeString('ru-RU', { timeZone, hour: '2-digit', minute: '2-digit' });
export const diaryValue = (value: string | number | null | undefined, suffix = '') => value == null ? '—' : `${value}${suffix}`;
export const stoolValue = (value: boolean | null | undefined) => value === true ? 'Да' : value === false ? 'Нет' : '—';
const escapeHtml = (value: unknown) => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
// Only static trusted icons are embedded; user-controlled values still pass through escapeHtml.
const printIcon = (name: keyof typeof diaryPrintIcons) => `<img class="print-icon" data-icon="${name}" src="${diaryPrintIcons[name]}" width="20" height="20" alt="" aria-hidden="true">`;
const printDownloadIcon = '<svg class="print-download" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6M12 11v7m-3-3 3 3 3-3"/></svg>';
const printIconStyles = `.print-icon{width:20px;height:20px;object-fit:contain;vertical-align:middle;margin-right:4px}.print-download{vertical-align:middle;margin-right:5px}.print-metric{display:inline-block;white-space:nowrap}`;
export function diaryPrintHtml(name: string | undefined, days: DiaryDay[]): string {
  const esc = escapeHtml;
  return `<!doctype html><html lang="ru"><head><meta charset="UTF-8"><title>Дневник питания</title>
<style>body{font:14px Arial,sans-serif;color:#2C1A0E;max-width:750px;margin:auto;padding:20px}h1,h2{color:#FF6200}section{border:1px solid #EDE5DF;border-radius:12px;padding:12px;margin:12px 0;break-inside:avoid}p{white-space:pre-wrap}.meta{font-size:12px}button{padding:12px;background:#FF6200;color:white;border:0;border-radius:12px}${printIconStyles}@media print{button{display:none}}</style></head><body>
<button onclick="window.print()">${printDownloadIcon} Сохранить как PDF</button><h1>Дневник питания — ${esc(name || 'Пользователь')}</h1>
${days.map(day => `<section><h2>${esc(diaryDate(day.date))}</h2><p class="meta"><span class="print-metric">${printIcon('scale')}${esc(diaryValue(day.checkin?.weight_kg, ' кг'))}</span> · <span class="print-metric">${printIcon('sleep')}${esc(diaryValue(day.checkin?.sleep_hours, ' ч'))}</span> · <span class="print-metric">${printIcon('steps')}${esc(diaryValue(day.checkin?.steps_yesterday))}</span> · <span class="print-metric">${printIcon('stool')}Стул: ${esc(stoolValue(day.checkin?.stool_yesterday))}</span></p>
${day.meals.map(meal => `<p>${esc(mealTime(meal.datetime))} · ${esc(meal.raw_text)}</p>`).join('') || '<p>Приёмы пищи не записаны</p>'}</section>`).join('')}
</body></html>`;
}
export function printDiary(name: string | undefined, days: DiaryDay[]) {
  const popup = window.open('', '_blank');
  if (popup) { popup.opener = null; popup.document.write(diaryPrintHtml(name, days)); popup.document.close(); }
}

// The profile export keeps its existing 14-day presentation, using server data.
export function diaryFortnight(days: DiaryDay[], today = new Date(), timeZone = deviceTimezone()): DiaryDay[] {
  const end = new Date(diaryDayKey(today, timeZone) + 'T12:00:00Z');
  const byDate = new Map(days.map(day => [day.date, day]));
  return Array.from({ length: 14 }, (_, i) => {
    const date = new Date(end);
    date.setUTCDate(date.getUTCDate() - 13 + i);
    const key = date.toISOString().slice(0, 10);
    return byDate.get(key) ?? { date: key, meals: [] };
  });
}
export function diaryFortnightHtml(name: string | undefined, days: DiaryDay[], today = new Date()): string {
  const rows = diaryFortnight(days, today).map(day => ({
    date: day.date,
    weight: day.checkin?.weight_kg != null ? { weight: Number(day.checkin.weight_kg) } : undefined,
    report: day.checkin || day.meals.length ? {
      sleepHours: day.checkin?.sleep_hours,
      stepsYesterday: day.checkin?.steps_yesterday,
      stoolYesterday: day.checkin?.stool_yesterday,
      meals: day.meals,
    } : undefined,
  }));
    // Generate HTML and open print dialog → user saves as PDF
    const formatDate = (dateStr: string) => {
      const d = new Date(dateStr + 'T12:00:00');
      return d.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
    };

    const weights = rows.filter(r => r.weight).map(r => r.weight!.weight);
    const avgWeight = weights.length ? (weights.reduce((a, b) => a + b, 0) / weights.length).toFixed(1) : '—';
    const minWeight = weights.length ? Math.min(...weights).toFixed(1) : '—';
    const maxWeight = weights.length ? Math.max(...weights).toFixed(1) : '—';
    const daysWithData = rows.filter(r => r.weight || r.report).length;

    return `<!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8">
<title>Дневник питания</title>
<style>
@media print { body { margin: 0; } .no-print { display: none; } }
body { font-family: Arial, sans-serif; font-size: 12px; color: #2C1A0E; max-width: 750px; margin: 0 auto; padding: 20px; }
h1 { font-size: 18px; color: #FF6200; margin-bottom: 2px; }
.sub { color: #888; font-size: 11px; margin-bottom: 16px; }
.summary { background: #FAF5F0; border-radius: 8px; padding: 12px; margin-bottom: 16px; display: flex; gap: 20px; flex-wrap: wrap; }
.summary span { font-size: 11px; }
.day { border: 1px solid #EDE5DF; border-radius: 8px; padding: 12px; margin-bottom: 10px; page-break-inside: avoid; }
.day-title { font-weight: bold; color: #FF6200; font-size: 13px; margin-bottom: 6px; }
.meta { display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 6px; }
.meta span { font-size: 11px; background: #F5F0EB; padding: 2px 7px; border-radius: 5px; }
.meal { font-size: 11px; padding: 2px 0; border-bottom: 1px solid #F0EAE4; }
.meal:last-child { border-bottom: none; }
.empty { color: #bbb; font-style: italic; font-size: 11px; }
.print-btn { display: block; margin: 16px auto; padding: 10px 30px; background: #FF6200; color: white; border: none; border-radius: 20px; font-size: 14px; cursor: pointer; }
${printIconStyles}
</style></head><body>
<button class="print-btn no-print" onclick="window.print()">${printDownloadIcon} Сохранить как PDF</button>
<h1>Дневник питания — ${escapeHtml(name ?? 'Пользователь')}</h1>
<div class="sub">Отчёт за последние 14 дней · ${today.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
<div class="summary">
  <span>Дней с данными: <b>${daysWithData} из 14</b></span>
  <span>${printIcon('scale')}Средний вес: <b>${avgWeight} кг</b></span>
  <span>Мин: <b>${minWeight} кг</b></span>
  <span>Макс: <b>${maxWeight} кг</b></span>
</div>
${rows.map(({ date, weight, report }) => `
<div class="day">
  <div class="day-title">${formatDate(date)}</div>
  <div class="meta">
    <span>${printIcon('scale')}${escapeHtml(weight ? weight.weight + ' кг' : '—')}</span>
    <span>${printIcon('sleep')}${escapeHtml(report?.sleepHours != null ? report.sleepHours + ' ч' : '—')}</span>
    <span>${printIcon('steps')}${escapeHtml(report?.stepsYesterday != null ? report.stepsYesterday.toLocaleString('ru-RU') : '—')}</span>
    <span>${printIcon('stool')}Стул: ${report?.stoolYesterday === true ? 'Да' : report?.stoolYesterday === false ? 'Нет' : '—'}</span>
  </div>
  ${report?.meals?.length
    ? report.meals.map(m => `<div class="meal">• ${escapeHtml(m.raw_text)}</div>`).join('')
    : '<div class="empty">Приёмы пищи не записаны</div>'
  }
</div>`).join('')}
<button class="print-btn no-print" onclick="window.print()">${printDownloadIcon} Сохранить как PDF</button>
</body></html>`;

}

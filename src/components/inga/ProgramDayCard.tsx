// Карточка дня программы «Месяц 1» + логика продвижения.
// Правила (согласованы Ингой):
// - день засчитывается открытым по тапу (раскрыла карточку);
// - следующий день открывается на следующий календарный день после открытия текущего;
// - пропуски не наказываются: программа ждёт на текущем дне;
// - максимум один новый урок в день.

import { useState } from 'react';
import type { ProgramDay, ProgramLink } from '@/lib/program-month1';
import type { ProgramProgress } from '@/lib/db';

// Локальная дата YYYY-MM-DD (не UTC — день пользователя)
export function localDateStr(d = new Date()): string {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

// Текущий доступный день по прогрессу
export function currentProgramDay(progress: ProgramProgress | null, totalDays = 30): number {
  if (!progress || progress.last_day === 0) return 1;
  const openedDate = progress.last_opened_at ? localDateStr(new Date(progress.last_opened_at)) : null;
  if (openedDate && localDateStr() > openedDate) {
    return Math.min(progress.last_day + 1, totalDays);
  }
  return progress.last_day;
}

interface ProgramDayCardProps {
  data: ProgramDay;
  expanded: boolean;
  taskDone: boolean;
  onToggleExpand: () => void;
  onTaskToggle: (done: boolean) => void;
  onJump: (link: ProgramLink) => void;
  badge?: string; // например «Новое» на Утре
}

export function ProgramDayCard({ data, expanded, taskDone, onToggleExpand, onTaskToggle, onJump, badge }: ProgramDayCardProps) {
  const paragraphs = data.lesson.split('\n\n');
  return (
    <div className="bg-white" style={{ borderRadius: 14, border: '1px solid #EDE5DF', overflow: 'hidden' }}>
      <button onClick={onToggleExpand} className="w-full text-left" style={{ padding: 14 }}>
        <div className="flex items-center justify-between mb-0.5">
          <p className="text-xs font-bold tracking-wide" style={{ color: '#FF6200' }}>
            ДЕНЬ {data.day} ИЗ 30
          </p>
          {badge && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: '#FFF1E8', color: '#FF6200' }}>{badge}</span>
          )}
        </div>
        <p className="text-base font-semibold" style={{ color: '#2C1A0E' }}>{data.theme}</p>
        {!expanded && (
          <p className="text-xs mt-1" style={{ color: '#8A7A70', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {paragraphs[0]}
          </p>
        )}
      </button>

      {expanded && (
        <div style={{ padding: '0 14px 14px' }} className="animate-fade-in-up">
          <div className="space-y-2.5">
            {paragraphs.map((p, i) => (
              <p key={i} className="text-sm leading-relaxed whitespace-pre-line" style={{ color: '#2C1A0E' }}>{p}</p>
            ))}
          </div>

          {data.task && (
            <div className="mt-4" style={{ background: '#FFF7F0', borderRadius: 12, border: '1px solid #FFD9C2', padding: 12 }}>
              <p className="text-[11px] font-bold tracking-wide mb-1.5" style={{ color: '#FF6200' }}>ЗАДАНИЕ ДНЯ</p>
              <button onClick={() => onTaskToggle(!taskDone)} className="w-full text-left flex gap-2.5 items-start">
                <span
                  className="shrink-0 mt-0.5 flex items-center justify-center text-[11px] font-bold"
                  style={{
                    width: 20, height: 20, borderRadius: 6,
                    border: taskDone ? 'none' : '2px solid #FFB68A',
                    background: taskDone ? '#FF6200' : '#fff',
                    color: '#fff',
                  }}
                >
                  {taskDone ? '✓' : ''}
                </span>
                <span className="text-sm leading-relaxed" style={{ color: '#2C1A0E', textDecoration: taskDone ? 'line-through' : 'none', opacity: taskDone ? 0.6 : 1 }}>
                  {data.task}
                </span>
              </button>
            </div>
          )}

          <div className="mt-3" style={{ background: '#F4F8F2', borderRadius: 12, border: '1px solid #DCE8D6', padding: 12 }}>
            <p className="text-[11px] font-bold tracking-wide mb-1" style={{ color: '#4A7A45' }}>ПРИВЫЧКА ДНЯ</p>
            <p className="text-sm leading-relaxed" style={{ color: '#2C1A0E' }}>{data.habit}</p>
          </div>

          {data.links.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {data.links.map((l, i) => (
                <button
                  key={i}
                  onClick={() => onJump(l)}
                  className="text-xs font-medium px-3 py-1.5 rounded-full"
                  style={{ background: '#fff', border: '1px solid #EDE5DF', color: '#FF6200' }}
                >
                  {l.label} →
                </button>
              ))}
            </div>
          )}

          <button onClick={onToggleExpand} className="text-xs mt-3" style={{ color: '#8A7A70', background: 'transparent', border: 'none', padding: 0 }}>
            Свернуть ▲
          </button>
        </div>
      )}
    </div>
  );
}

import type { MealMeta, ProteinPortion } from '@/lib/nutrition/use-meal-diary';
import { Pencil, Trash2 } from 'lucide-react';

type MealCardProps = {
  m: MealMeta & { i: number; desc: string };
  hideCarbs?: boolean;
  pending: boolean;
  editingTimeIdx: number | null;
  setEditingTimeIdx: (index: number | null) => void;
  updateMealTime: (index: number, time: string) => void;
  editingProteinIdx: number | null;
  setEditingProteinIdx: (index: number | null) => void;
  editingProteinValue: string;
  setEditingProteinValue: (value: string) => void;
  saveManualProtein: (index: number, value: string) => void;
  onEditMeal: (id: string, description: string) => void;
  onDeleteMeal: (index: number) => void;
  toggleMealFlag: (index: number, key: 'protein' | 'carbs' | 'fiber' | 'sweet') => void;
  setMealPortion: (index: number, portion: ProteinPortion) => void;
};

export const mealPillStyle = (active: boolean | null, kind: 'protein' | 'carbs' | 'fiber') => {
  if (!active) return { background: 'var(--legche-chip, #F7F2EE)', color: 'var(--legche-muted, #6A5A50)', border: '1px solid var(--legche-line, #E5DDD8)' };
  if (kind === 'protein') return { background: 'var(--legche-protein-bg, #F9EDEA)', color: 'var(--legche-protein, #994B30)', border: '1px solid #994B30' };
  if (kind === 'carbs') return { background: 'var(--legche-carbs-bg, #FAF4E5)', color: 'var(--legche-carbs, #80621D)', border: '1px solid #80621D' };
  return { background: 'var(--legche-fiber-bg, #EDF5F0)', color: 'var(--legche-fiber, #376745)', border: '1px solid #376745' };
};

// The diary card is deliberately read-only except for its two actions.
export function MealCard({ m, pending, onEditMeal, onDeleteMeal }: MealCardProps) {
  return (
    <div className="legche-meal legche-meal-compact bg-white">
      <div className="legche-meal-head">
        <div className="legche-meal-title"><strong>{m.name}</strong><span className="legche-meal-time"> · {m.time}</span></div>
        <div className="legche-meal-actions">
          <button type="button" disabled={pending} aria-label="Редактировать" onClick={() => onEditMeal(m.id, m.desc)}><Pencil size={18} aria-hidden="true" /></button>
          <button type="button" disabled={pending} aria-label="Удалить" className="legche-meal-delete" onClick={() => onDeleteMeal(m.i)}><Trash2 size={20} aria-hidden="true" /></button>
        </div>
      </div>
      <p className="legche-meal-description">{m.desc}</p>
    </div>
  );
}

// Existing manual correction handlers, mounted only in the editor.
export function MealCorrections({
  m, hideCarbs = false, pending,
  editingTimeIdx, setEditingTimeIdx, updateMealTime,
  editingProteinIdx, setEditingProteinIdx, editingProteinValue, setEditingProteinValue,
  saveManualProtein, toggleMealFlag, setMealPortion,
}: MealCardProps) {
  return (
    <div className="legche-meal-corrections">
      <div className="flex items-center gap-2 mb-2"><span className="text-sm">Время</span>
            {editingTimeIdx === m.i ? (
              <input
                type="time"
                aria-label="Изменить время"
                autoFocus
                value={m.time}
                onChange={e => updateMealTime(m.i, e.target.value)}
                onBlur={() => setEditingTimeIdx(null)}
                onKeyDown={e => { if (e.key === 'Enter') setEditingTimeIdx(null); }}
                className="meal-time-input min-h-[44px] max-w-full"
                style={{
                  color: 'var(--legche-muted, #6A5A50)',
                  background: 'transparent',
                  border: '1px solid #FF6200',
                  borderRadius: 6,
                  padding: '1px 4px',
                  fontSize: 16,
                  fontWeight: 600,
                }}
              />
            ) : (
              <button
                type="button"
                disabled={pending} onClick={() => setEditingTimeIdx(m.i)}
                style={{
                  color: 'var(--legche-muted, #6A5A50)',
                  background: 'transparent',
                  border: 'none',
                  padding: '1px 4px',
                  fontSize: 16,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
                aria-label="Изменить время"
                className="min-w-[44px] min-h-[44px] rounded-md"
              >
                {m.time}
              </button>
            )}
      </div>
        <div className="flex items-center gap-1.5 mb-3 text-[14px]" style={{ color: 'var(--legche-muted, #6A5A50)' }}>
          {editingProteinIdx === m.i ? (
            <>
              <input
                type="number"
                aria-label="Скорректировать белок"
                min={0}
                max={300}
                autoFocus
                value={editingProteinValue}
                onChange={e => setEditingProteinValue(e.target.value)}
                onBlur={() => saveManualProtein(m.i, editingProteinValue)}
                onKeyDown={e => { if (e.key === 'Enter') saveManualProtein(m.i, editingProteinValue); }}
                style={{
                  width: 76, minHeight: 44, color: 'var(--legche-muted, #6A5A50)', background: 'transparent',
                  border: '1px solid #994B30', borderRadius: 6, padding: '1px 4px',
                  fontSize: 16,
                }}
              />
              <span>г белка</span>
            </>
          ) : m.proteinLoading ? (
            <span>... оценка состава</span>
          ) : m.proteinAi !== null ? (
            <>
              <span>~{m.proteinAi}г белка{m.proteinManual ? '' : ''}</span>
              <button
                type="button"
                disabled={pending} onClick={() => {
                  setEditingProteinIdx(m.i);
                  setEditingProteinValue(String(m.proteinAi ?? ''));
                }}
                aria-label="Скорректировать белок"
                className="min-w-[44px] min-h-[44px] rounded-md"
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, fontSize: 14 }}
              >
                ✏️
              </button>
            </>
          ) : (
            <button
              type="button"
              disabled={pending} onClick={() => { setEditingProteinIdx(m.i); setEditingProteinValue(''); }}
              className="min-h-[44px] rounded-md"
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, fontSize: 14, color: 'var(--legche-muted, #6A5A50)' }}
            >
              + указать белок ✏️
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5 mb-2 items-center">
          <button disabled={pending} onClick={() => toggleMealFlag(m.i, 'protein')} className="text-[14px] min-h-[44px] px-2 py-1 rounded-full font-medium" style={mealPillStyle(m.protein, 'protein')}>
            {m.protein === null ? '?' : m.protein ? '✓' : '+'} Белок
          </button>
          {!hideCarbs && (
            <button disabled={pending} onClick={() => toggleMealFlag(m.i, 'carbs')} className="text-[14px] min-h-[44px] px-2 py-1 rounded-full font-medium" style={mealPillStyle(m.carbs, 'carbs')}>
              {m.carbs === null ? '?' : m.carbs ? '✓' : '+'} Углеводы
            </button>
          )}
          <button disabled={pending} onClick={() => toggleMealFlag(m.i, 'fiber')} className="text-[14px] min-h-[44px] px-2 py-1 rounded-full font-medium" style={mealPillStyle(m.fiber, 'fiber')}>
            {m.fiber === null ? '?' : m.fiber ? '✓' : '+'} Клетчатка
          </button>
          {!m.isEvening && (
            <button
              disabled={pending} onClick={() => toggleMealFlag(m.i, 'sweet')}
              className="text-[14px] min-h-[44px] rounded-md font-medium"
              style={{ color: m.sweet ? 'var(--legche-protein, #994B30)' : 'var(--legche-muted, #6A5A50)', background: 'transparent', border: 'none', padding: 0 }}
            >
              🍰 {m.sweet ? 'Сладкая точка ✓' : '+ Сладкая точка'}
            </button>
          )}
        </div>
        {m.protein && (
          <div className="mb-2 pl-1">
            <p className="text-[14px] mb-1" style={{ color: 'var(--legche-muted, #6A5A50)' }}>Сколько белка?</p>
            <div className="flex flex-wrap gap-1.5">
              {([
                { key: 'small' as ProteinPortion, label: '🤏 Меньше ладони' },
                { key: 'palm' as ProteinPortion, label: '🤚 Ладонь' },
                { key: 'large' as ProteinPortion, label: '👐 Больше ладони' },
              ]).map(opt => {
                const active = m.proteinPortion === opt.key;
                return (
                  <button
                    key={opt.key}
                    disabled={pending} onClick={() => setMealPortion(m.i, opt.key)}
                    className="text-[14px] min-h-[44px] px-2.5 py-1 rounded-full font-medium"
                    style={{
                      background: active ? 'var(--legche-protein-bg, #F9EDEA)' : 'var(--legche-chip, #F7F2EE)',
                      color: active ? 'var(--legche-protein, #994B30)' : 'var(--legche-muted, #6A5A50)',
                      border: active ? '1px solid var(--legche-protein, #994B30)' : '1px solid var(--legche-line, #E5DDD8)',
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}
    </div>
  );
}

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
  if (!active) return { background: '#F7F2EE', color: '#6A5A50', border: '1px solid #E5DDD8' };
  if (kind === 'protein') return { background: '#F9EDEA', color: '#994B30', border: '1px solid #994B30' };
  if (kind === 'carbs') return { background: '#FAF4E5', color: '#80621D', border: '1px solid #80621D' };
  return { background: '#EDF5F0', color: '#376745', border: '1px solid #376745' };
};

// Module-level identity keeps the same input mounted during parent updates.
export function MealCard({
  m, hideCarbs = false, pending,
  editingTimeIdx, setEditingTimeIdx, updateMealTime,
  editingProteinIdx, setEditingProteinIdx, editingProteinValue, setEditingProteinValue,
  saveManualProtein, onEditMeal, onDeleteMeal, toggleMealFlag, setMealPortion,
}: MealCardProps) {
  return (
      <div className="bg-white" style={{ borderRadius: 14, border: '1px solid #EDE5DF', padding: 14 }}>
        <div className="flex items-start justify-between gap-2 mb-1">
          <span className="font-semibold text-sm flex flex-wrap items-center gap-1 min-w-0">
            <span>{m.name}</span>
            <span style={{ color: '#6A5A50' }}>·</span>
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
                  color: '#6A5A50',
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
                  color: '#6A5A50',
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
          </span>
          <div className="flex items-center gap-1 shrink-0">
          <button type="button" disabled={pending} aria-label="Редактировать"
            className="flex items-center justify-center min-w-[44px] min-h-[44px]"
            onClick={() => onEditMeal(m.id, m.desc)}>
            <Pencil size={18} />
          </button>
          <button
            disabled={pending} onClick={() => onDeleteMeal(m.i)}
            className="flex items-center justify-center min-w-[44px] min-h-[44px]"
            style={{ color: '#E53935' }}
            aria-label="Удалить"
          >
            <Trash2 size={20} />
          </button>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mb-1">{m.desc}</p>
        <div className="flex items-center gap-1.5 mb-3 text-[14px]" style={{ color: '#6A5A50' }}>
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
                  width: 76, minHeight: 44, color: '#6A5A50', background: 'transparent',
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
                onClick={() => {
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
              onClick={() => { setEditingProteinIdx(m.i); setEditingProteinValue(''); }}
              className="min-h-[44px] rounded-md"
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, fontSize: 14, color: '#6A5A50' }}
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
              style={{ color: m.sweet ? '#994B30' : '#6A5A50', background: 'transparent', border: 'none', padding: 0 }}
            >
              🍰 {m.sweet ? 'Сладкая точка ✓' : '+ Сладкая точка'}
            </button>
          )}
        </div>
        {m.protein && (
          <div className="mb-2 pl-1">
            <p className="text-[14px] mb-1" style={{ color: '#6A5A50' }}>Сколько белка?</p>
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
                      background: active ? '#F9EDEA' : '#F7F2EE',
                      color: active ? '#994B30' : '#6A5A50',
                      border: active ? '1px solid #994B30' : '1px solid #E5DDD8',
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

import { useSaveAction, SAVE_ERROR } from '@/hooks/use-save-action';
import { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { AppStep } from '@/lib/types';

const reasons = [
  { id: 'sweet', label: '🍬 Сладкое' },
  { id: 'evening', label: '🌙 Вечерний жор' },
  { id: 'stress', label: '😰 Стресс' },
  { id: 'noSchedule', label: '⏰ Нет режима' },
  { id: 'lowProtein', label: '🥩 Мало белка' },
  { id: 'highFat', label: '🧈 Много жирного' },
  { id: 'sedentary', label: '🪑 Малоподвижность' },
];

export function SurveyReasonsScreen() {
  const { updateProfile, setStep } = useApp();
  const { save, saving, saveError } = useSaveAction();
  const [selected, setSelected] = useState<string[]>([]);

  const toggle = (id: string) => {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleNext = async () => {
    if (!(await save(() => updateProfile({ weightGainReasons: selected })))) return;
    setStep('survey-emotions' as AppStep);
  };

  return (
    <div className="flex flex-col items-center min-h-screen px-6 py-10 animate-fade-in-up">
      {saveError && <p role="alert" className="inga-bubble w-full mb-3">{SAVE_ERROR}</p>}
      <h2 className="text-2xl font-bold mb-2">Причины набора веса</h2>
      <p className="text-muted-foreground mb-6 text-center">Выберите всё, что подходит</p>

      <div className="w-full max-w-sm flex flex-wrap gap-3 justify-center mb-8">
        {reasons.map(r => (
          <button disabled={saving}
            key={r.id}
            onClick={() => toggle(r.id)}
            className={selected.includes(r.id) ? 'inga-chip-active' : 'inga-chip-inactive'}
          >
            {r.label}
          </button>
        ))}
      </div>

      <button disabled={saving || (selected.length === 0)}
        onClick={handleNext}

        className="inga-btn-primary w-full max-w-sm disabled:opacity-40"
      >
        Далее →
      </button>
    </div>
  );
}

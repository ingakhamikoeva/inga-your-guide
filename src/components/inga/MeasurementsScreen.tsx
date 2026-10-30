import { useSaveAction, SAVE_ERROR } from '@/hooks/use-save-action';
import { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { AppStep } from '@/lib/types';

export function MeasurementsScreen() {
  const { updateProfile, setStep } = useApp();
  const { save, saving, saveError } = useSaveAction();
  const [waist, setWaist] = useState('');
  const [hips, setHips] = useState('');

  const handleNext = async () => {
    if (!(await save(() => updateProfile({ waist: parseInt(waist), hips: parseInt(hips) })))) return;
    setStep('pace-choice' as AppStep);
  };

  return (
    <div className="flex flex-col items-center min-h-screen px-6 py-10 animate-fade-in-up">
      {saveError && <p role="alert" className="inga-bubble w-full mb-3">{SAVE_ERROR}</p>}
      <h2 className="text-2xl font-bold mb-2">Зафиксируем объёмы</h2>
      <div className="inga-bubble mb-6 text-center">
        <p>Вес — не единственный показатель стройности.</p>
        <p className="text-muted-foreground mt-1">Давайте зафиксируем ваши объёмы, чтобы видеть динамику.</p>
      </div>

      <div className="w-full max-w-sm space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Охват талии (см)</label>
          <input disabled={saving} type="number" value={waist} onChange={e => setWaist(e.target.value)} className="inga-input" placeholder="75" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Охват бёдер (см)</label>
          <input disabled={saving} type="number" value={hips} onChange={e => setHips(e.target.value)} className="inga-input" placeholder="100" />
        </div>

        <button disabled={saving || (!waist || !hips)}
          onClick={handleNext}

          className="inga-btn-primary w-full disabled:opacity-40"
        >
          Далее →
        </button>
      </div>
    </div>
  );
}

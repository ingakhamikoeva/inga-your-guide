import { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { AppStep } from '@/lib/types';

export function MeasurementsScreen() {
  const { updateProfile, setStep } = useApp();
  const [waist, setWaist] = useState('');
  const [hips, setHips] = useState('');

  const handleNext = () => {
    updateProfile({ waist: parseInt(waist), hips: parseInt(hips) });
    setStep('pace-choice');
  };

  return (
    <div className="flex flex-col items-center min-h-screen px-6 py-10 animate-fade-in-up">
      <h2 className="text-2xl font-bold mb-2">Зафиксируем объёмы</h2>
      <div className="inga-bubble mb-6 text-center">
        <p>Вес — не единственный показатель стройности.</p>
        <p className="text-muted-foreground mt-1">Давай зафиксируем твои объёмы, чтобы видеть динамику.</p>
      </div>

      <div className="w-full max-w-sm space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Охват талии (см)</label>
          <input type="number" value={waist} onChange={e => setWaist(e.target.value)} className="inga-input" placeholder="75" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Охват бёдер (см)</label>
          <input type="number" value={hips} onChange={e => setHips(e.target.value)} className="inga-input" placeholder="100" />
        </div>

        <button
          onClick={handleNext}
          disabled={!waist || !hips}
          className="inga-btn-primary w-full disabled:opacity-40"
        >
          Далее →
        </button>
      </div>
    </div>
  );
}

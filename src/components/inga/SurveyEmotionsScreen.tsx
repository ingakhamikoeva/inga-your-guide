import { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { AppStep } from '@/lib/types';

const emotions = [
  { id: 'anxiety', label: '😟 Тревога' },
  { id: 'fatigue', label: '😴 Усталость' },
  { id: 'boredom', label: '😐 Скука' },
  { id: 'anger', label: '😠 Злость' },
  { id: 'sadness', label: '😢 Грусть' },
  { id: 'offense', label: '😤 Обида' },
  { id: 'selfpity', label: '🥺 Жалость к себе' },
];

export function SurveyEmotionsScreen() {
  const { updateProfile, setStep } = useApp();
  const [selected, setSelected] = useState<string[]>([]);

  const toggle = (id: string) => {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleNext = () => {
    updateProfile({ emotionalTrigger: selected.join(',') });
    setStep('calculations');
  };

  return (
    <div className="flex flex-col items-center min-h-screen px-6 py-10 animate-fade-in-up">
      <h2 className="text-2xl font-bold mb-2">Эмоция-триггер</h2>
      <p className="text-muted-foreground mb-6 text-center max-w-sm">
        После какой эмоции тебя тянет на калорийную пищу?
      </p>

      <div className="w-full max-w-sm flex flex-wrap gap-3 justify-center mb-8">
        {emotions.map(e => (
          <button
            key={e.id}
            onClick={() => toggle(e.id)}
            className={selected.includes(e.id) ? 'inga-chip-active' : 'inga-chip-inactive'}
          >
            {e.label}
          </button>
        ))}
      </div>

      <button
        onClick={handleNext}
        disabled={selected.length === 0}
        className="inga-btn-primary w-full max-w-sm disabled:opacity-40"
      >
        Далее →
      </button>
    </div>
  );
}

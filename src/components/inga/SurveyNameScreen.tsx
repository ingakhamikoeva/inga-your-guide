import { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { cleanName } from '@/lib/user-name';

export function SurveyNameScreen() {
  const { profile, updateProfile, setStep } = useApp();
  const [name, setName] = useState(profile.name ?? '');

  const trimmed = cleanName(name);
  const canProceed = trimmed.length > 0;

  const handleNext = () => {
    updateProfile({ name: trimmed });
    setStep('survey-data');
  };

  return (
    <div className="flex flex-col items-center min-h-screen px-6 py-10 animate-fade-in-up">
      <h2 className="text-2xl font-bold mb-2">Как тебя зовут?</h2>
      <p className="text-muted-foreground mb-8 text-center max-w-sm">
        Я буду обращаться к тебе по имени — так теплее.
      </p>

      <div className="w-full max-w-sm space-y-4">
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          maxLength={40}
          autoFocus
          className="inga-input"
          placeholder="Твоё имя"
          onKeyDown={e => e.key === 'Enter' && canProceed && handleNext()}
        />

        <button
          onClick={handleNext}
          disabled={!canProceed}
          className="inga-btn-primary w-full disabled:opacity-40"
        >
          Продолжить →
        </button>
      </div>
    </div>
  );
}

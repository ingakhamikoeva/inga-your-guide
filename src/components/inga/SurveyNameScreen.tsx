import { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { cleanName } from '@/lib/user-name';
import ingaPhoto from '@/assets/inga-photo.jpg';

export function SurveyNameScreen() {
  const { profile, updateProfile, setStep } = useApp();
  const [name, setName] = useState(profile.name ?? '');
  const [gender, setGender] = useState<'female' | 'male'>(
    (profile.gender as 'female' | 'male') ?? 'female'
  );

  const trimmed = cleanName(name);
  const canProceed = trimmed.length > 0;

  const handleNext = () => {
    updateProfile({ name: trimmed, gender });
    setStep('goal');
  };

  return (
    <div className="flex flex-col items-center min-h-screen px-6 py-10 animate-fade-in-up">
      {/* Progress bar: 7 dashes */}
      <div className="w-full max-w-sm flex gap-1.5 mb-8">
        {Array.from({ length: 7 }).map((_, i) => (
          <div
            key={i}
            className="flex-1 h-1 rounded-full"
            style={{ backgroundColor: i === 0 ? '#FF6200' : '#E8E2DC' }}
          />
        ))}
      </div>

      {/* Inga greeting */}
      <div className="w-full max-w-sm flex items-start gap-3 mb-8">
        <img
          src={ingaPhoto}
          alt="Инга"
          className="w-12 h-12 rounded-full object-cover flex-shrink-0"
          style={{ border: '2px solid #FF6200' }}
        />
        <div
          className="px-4 py-3 text-sm leading-relaxed"
          style={{
            backgroundColor: '#F4EEE8',
            borderRadius: '12px',
            borderBottomLeftRadius: '3px',
          }}
        >
          <span className="font-semibold">Привет! Я Инга</span> — твой персональный нутрициолог. Пара вопросов — и мы начнём!
        </div>
      </div>

      <div className="w-full max-w-sm space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Пол</label>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setGender('female')}
              className={gender === 'female' ? 'inga-chip-active flex-1' : 'inga-chip-inactive flex-1'}
            >
              Женщина
            </button>
            <button
              type="button"
              onClick={() => setGender('male')}
              className={gender === 'male' ? 'inga-chip-active flex-1' : 'inga-chip-inactive flex-1'}
            >
              Мужчина
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Твоё имя</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            maxLength={40}
            autoFocus
            className="inga-input"
            placeholder="Например, Мария"
            onKeyDown={e => e.key === 'Enter' && canProceed && handleNext()}
          />
        </div>

        <button
          onClick={handleNext}
          disabled={!canProceed}
          className="inga-btn-primary w-full disabled:opacity-40"
        >
          Приятно познакомиться →
        </button>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { useApp } from '@/context/AppContext';
import ingaPhoto from '@/assets/inga-photo.jpg';

const OPTIONS = [
  { emoji: '🌸', text: 'Хочу чувствовать лёгкость в теле и больше энергии' },
  { emoji: '👗', text: 'Хочу снова носить одежду, которую люблю' },
  { emoji: '❤️', text: 'Хочу позаботиться о здоровье' },
  { emoji: '✨', text: 'Хочу нравиться себе в зеркале' },
  { emoji: '👨‍👩‍👧', text: 'Хочу быть активной для семьи' },
];

export function WhyScreen() {
  const { profile, updateProfile, setStep } = useApp();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [customOpen, setCustomOpen] = useState(false);
  const [customText, setCustomText] = useState('');

  const name = profile.name?.trim();
  const bubbleText = name
    ? `${name}, что для тебя изменится, когда достигнешь цели?`
    : 'Что для тебя изменится, когда достигнешь цели?';

  const toggleOption = (index: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const hasSelection = selected.size > 0 || customText.trim().length > 0;

  const handleNext = () => {
    const result: string[] = [];
    selected.forEach(idx => result.push(OPTIONS[idx].text));
    const trimmedCustom = customText.trim();
    if (trimmedCustom) {
      result.push(trimmedCustom);
    }
    updateProfile({ motivation: result });
    setStep('survey-data');
  };

  return (
    <div
      className="flex flex-col items-center min-h-screen px-6 py-6 animate-fade-in-up"
      style={{ backgroundColor: '#FAF5F0', maxWidth: '480px', margin: '0 auto', width: '100%' }}
    >
      {/* Progress + back button */}
      <div className="w-full max-w-sm flex items-center gap-3 mb-8">
        <button
          type="button"
          onClick={() => setStep('goal')}
          className="flex items-center justify-center w-10 h-10 rounded-full flex-shrink-0"
          style={{ backgroundColor: '#F4EEE8', color: '#5C4A3D' }}
          aria-label="Назад"
        >
          ←
        </button>
        <div className="flex-1 flex gap-1.5">
          {Array.from({ length: 7 }).map((_, i) => (
            <div
              key={i}
              className="flex-1 h-1 rounded-full"
              style={{ backgroundColor: i < 3 ? '#FF6200' : '#E8E2DC' }}
            />
          ))}
        </div>
      </div>

      {/* Inga greeting */}
      <div className="w-full max-w-sm flex items-start gap-3 mb-6">
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
            color: '#5C4A3D',
          }}
        >
          <div className="font-medium">{bubbleText}</div>
          <div className="mt-1 text-xs italic" style={{ color: '#9E9E9E' }}>
            Выбери всё что откликается — я запомню.
          </div>
        </div>
      </div>

      {/* Options */}
      <div className="w-full max-w-sm space-y-3 mb-2">
        {OPTIONS.map((opt, i) => {
          const isSelected = selected.has(i);
          return (
            <button
              key={i}
              type="button"
              onClick={() => toggleOption(i)}
              className="w-full flex items-center gap-3 px-4 py-4 text-left transition-colors duration-200"
              style={{
                backgroundColor: isSelected ? '#FFF0E6' : '#FFFFFF',
                borderRadius: '12px',
                border: isSelected ? '2px solid #FF6200' : '1px solid #E8E2DC',
              }}
            >
              <span className="text-xl flex-shrink-0">{opt.emoji}</span>
              <span
                className="text-sm leading-snug"
                style={{ color: '#5C4A3D' }}
              >
                {opt.text}
              </span>
            </button>
          );
        })}
      </div>

      {/* Custom reason */}
      <div className="w-full max-w-sm mb-4">
        {!customOpen ? (
          <button
            type="button"
            onClick={() => setCustomOpen(true)}
            className="text-sm font-medium"
            style={{ color: '#FF6200' }}
          >
            + Своя причина...
          </button>
        ) : (
          <input
            type="text"
            value={customText}
            onChange={e => setCustomText(e.target.value)}
            placeholder="Напиши свою причину"
            className="inga-input"
            autoFocus
          />
        )}
      </div>

      {/* CTA */}
      <div className="w-full max-w-sm mt-auto pt-6">
        <button
          onClick={handleNext}
          disabled={!hasSelection}
          className="w-full py-3.5 rounded-xl font-semibold text-base transition-all duration-200 active:scale-[0.97] disabled:opacity-40"
          style={{
            backgroundColor: hasSelection ? '#FF6200' : '#E8E2DC',
            color: hasSelection ? '#FFFFFF' : '#9E9E9E',
          }}
        >
          Готово →
        </button>
      </div>
    </div>
  );
}

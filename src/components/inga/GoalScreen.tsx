import { useState } from 'react';
import { useApp } from '@/context/AppContext';
import ingaPhoto from '@/assets/inga-photo.jpg';
import { Slider } from '@/components/ui/slider';

const roundHalf = (n: number) => Math.round(n * 2) / 2;

const fmt = (n: number) =>
  n % 1 === 0 ? String(n) : n.toFixed(1).replace('.', ',');

function monthWordForY(y: number): string {
  if (y === 1) return 'месяц';
  if (y < 5) return 'месяца';
  return 'месяцев';
}

export function GoalScreen() {
  const { profile, updateProfile, setStep } = useApp();
  const [value, setValue] = useState<number[]>([10]);

  const sliderValue = value[0];

  const rawX = roundHalf(sliderValue / 3.5);
  const rawY = roundHalf(sliderValue / 2.5);

  const X = Math.max(rawX, 0.5);
  const Y = Math.max(rawY, 1);

  const estimateText =
    X === Y
      ? `около ${fmt(X)} ${monthWordForY(Y)}`
      : `${fmt(X)}–${fmt(Y)} ${monthWordForY(Y)}`;

  const name = profile.name?.trim();
  const bubbleText = name
    ? `${name}, на сколько кг ты хочешь похудеть?`
    : 'На сколько кг ты хочешь похудеть?';

  const handleNext = () => {
    const goalKg = sliderValue;
    const currentWeight = profile.weight ?? 70;
    const goalWeight = currentWeight - goalKg;
    updateProfile({ goalWeight Loss: Math.max(goalWeight, 45) });
    setStep('why');
  };

  return (
    <div
      className="flex flex-col items-center min-h-screen px-6 py-6 animate-fade-in-up"
      style={{ backgroundColor: '#FAF5F0' }}
    >
      {/* Progress + back button */}
      <div className="w-full max-w-sm flex items-center gap-3 mb-8">
        <button
          type="button"
          onClick={() => setStep('survey-name')}
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
              style={{ backgroundColor: i < 2 ? '#FF6200' : '#E8E2DC' }}
            />
          ))}
        </div>
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
            color: '#5C4A3D',
          }}
        >
          {bubbleText}
        </div>
      </div>

      {/* Big number */}
      <div className="flex flex-col items-center mb-2">
        <span
          className="font-extrabold leading-none"
          style={{ fontSize: '52px', color: '#FF6200' }}
        >
          {sliderValue}
        </span>
        <span className="text-sm" style={{ color: '#9E9E9E' }}>
          кг
        </span>
      </div>

      {/* Slider */}
      <div className="w-full max-w-sm mt-4 mb-1">
        <Slider
          value={value}
          onValueChange={setValue}
          min={3}
          max={40}
          step={1}
        />
        <div className="flex justify-between mt-2 text-sm" style={{ color: '#9E9E9E' }}>
          <span>3 кг</span>
          <span>40 кг</span>
        </div>
      </div>

      {/* Estimate card */}
      <div
        className="w-full max-w-sm px-5 py-4 mt-4 text-sm leading-relaxed"
        style={{
          backgroundColor: '#FAEEDA',
          borderRadius: '12px',
          color: '#5C4A3D',
        }}
      >
        Это примерно {estimateText} с методом «Лёгкая замена». Мягко и без срывов.
      </div>

      {/* CTA */}
      <div className="w-full max-w-sm mt-auto pt-6">
        <button
          onClick={handleNext}
          className="inga-btn-primary w-full"
        >
          Это моя цель →
        </button>
      </div>
    </div>
  );
}

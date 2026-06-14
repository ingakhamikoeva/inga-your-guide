import { useState } from 'react';
import { useApp } from '@/context/AppContext';
import ingaPhoto from '@/assets/inga-photo.jpg';
import palmMethod from '@/assets/palm-method.png';

type Method = 'plate' | 'palm';

export function TrackingMethodScreen() {
  const { profile, updateProfile, setStep } = useApp();
  const [selected, setSelected] = useState<Method | null>(
    (profile.trackingMethod as Method) || null
  );

  const handleNext = () => {
    if (!selected) return;
    updateProfile({ trackingMethod: selected });
    setStep('how-it-works');
  };

  const cardStyle = (active: boolean) => ({
    background: '#FFFFFF',
    border: active ? '2px solid #FF6200' : '1px solid #F0E6DC',
    borderRadius: '16px',
  });

  return (
    <div className="flex flex-col min-h-screen px-6 py-6 animate-fade-in-up" style={{ background: '#FAF5F0' }}>
      {/* Progress bar */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => setStep('survey-data')}
          className="w-9 h-9 rounded-full flex items-center justify-center text-lg"
          style={{ background: '#F4EEE8', color: '#3B2A20' }}
          aria-label="Назад"
        >
          ←
        </button>
        <div className="flex gap-1.5 flex-1">
          {Array.from({ length: 7 }).map((_, i) => (
            <div
              key={i}
              className="h-1 flex-1 rounded-full"
              style={{ background: i < 5 ? '#FF6200' : '#E8E2DC' }}
            />
          ))}
        </div>
      </div>

      {/* Inga greeting */}
      <div className="flex items-start gap-3 mb-6">
        <img
          src={ingaPhoto}
          alt="Инга"
          className="w-12 h-12 rounded-full object-cover flex-shrink-0"
          style={{ border: '2px solid #FF6200' }}
        />
        <div
          className="px-4 py-3 text-sm"
          style={{
            background: '#F4EEE8',
            color: '#3B2A20',
            borderRadius: '12px',
            borderBottomLeftRadius: '3px',
          }}
        >
          {profile.name ? `${profile.name}, ` : ''}последний шаг! Как тебе удобнее ориентироваться в порциях?
        </div>
      </div>

      <div className="space-y-3">
        {/* Plate method */}
        <button
          onClick={() => setSelected('plate')}
          className="w-full text-left p-4 transition-all"
          style={cardStyle(selected === 'plate')}
        >
          <div className="flex items-center gap-2 mb-1">
            <span
              className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
              style={{
                border: `2px solid ${selected === 'plate' ? '#FF6200' : '#C9BEB2'}`,
                background: selected === 'plate' ? '#FF6200' : 'transparent',
              }}
            >
              {selected === 'plate' && <span className="w-2 h-2 rounded-full bg-white" />}
            </span>
            <span className="font-bold" style={{ color: '#3B2A20' }}>Метод тарелки</span>
          </div>
          <p className="text-sm mb-3" style={{ color: '#6B5B4E' }}>
            Делишь тарелку на части на глаз — без взвешивания
          </p>
          <div className="flex items-center gap-4">
            <svg width="72" height="72" viewBox="0 0 72 72">
              {/* Half green (vegetables) */}
              <path d="M 36 36 L 36 4 A 32 32 0 0 0 36 68 Z" fill="#7AB872" />
              {/* Quarter coral (protein) - top right */}
              <path d="M 36 36 L 36 4 A 32 32 0 0 1 68 36 Z" fill="#FF6B5A" />
              {/* Quarter yellow (carbs) - bottom right */}
              <path d="M 36 36 L 68 36 A 32 32 0 0 1 36 68 Z" fill="#F4C24D" />
              <circle cx="36" cy="36" r="32" fill="none" stroke="#FFFFFF" strokeWidth="2" />
            </svg>
            <div className="space-y-1 text-xs" style={{ color: '#3B2A20' }}>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ background: '#7AB872' }} />
                ½ овощи
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ background: '#FF6B5A' }} />
                ¼ белок
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ background: '#F4C24D' }} />
                ¼ углеводы
              </div>
            </div>
          </div>
          <p className="text-xs italic mt-3" style={{ color: '#9B8B7E' }}>
            Подходит, если любишь видеть структуру
          </p>
        </button>

        {/* Palm method */}
        <button
          onClick={() => setSelected('palm')}
          className="w-full text-left p-4 transition-all"
          style={cardStyle(selected === 'palm')}
        >
          <div className="flex items-center gap-2 mb-1">
            <span
              className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
              style={{
                border: `2px solid ${selected === 'palm' ? '#FF6200' : '#C9BEB2'}`,
                background: selected === 'palm' ? '#FF6200' : 'transparent',
              }}
            >
              {selected === 'palm' && <span className="w-2 h-2 rounded-full bg-white" />}
            </span>
            <span className="font-bold" style={{ color: '#3B2A20' }}>Метод ладони</span>
          </div>
          <p className="text-sm mb-3" style={{ color: '#6B5B4E' }}>
            Измеряешь порции руками — ориентир всегда с тобой
          </p>
          <img src={palmMethod} alt="Метод ладони" className="w-full rounded-lg" />
          <p className="text-xs italic mt-3" style={{ color: '#9B8B7E' }}>
            Подходит, если часто ешь вне дома
          </p>
        </button>

        <button
          onClick={handleNext}
          disabled={!selected}
          className="inga-btn-primary w-full mt-6 disabled:opacity-40"
        >
          Мой метод →
        </button>
      </div>
    </div>
  );
}

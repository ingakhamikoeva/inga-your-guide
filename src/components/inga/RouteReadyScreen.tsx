import { useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import ingaPhoto from '@/assets/inga-photo.jpg';




export function RouteReadyScreen() {
  const { profile, setStep } = useApp();

  const name = profile.name?.trim() || '';

  const goalKg = profile.kgToLose ??
    Math.max(Math.abs(Math.round(
      (profile.weight || (profile as any).current_weight_kg || 70) -
      ((profile as any).goal_weight_kg || profile.goalWeight || 65)
    )), 1);

  const roundHalf = (n: number) => Math.round(n * 2) / 2;
  const X = Math.max(roundHalf(goalKg / 3.5), 0.5);
  const Y = Math.max(roundHalf(goalKg / 2.5), 1);

  const fmt = (n: number) =>
    n % 1 === 0 ? String(n) : n.toFixed(1).replace('.', ',');

  const monthWord = Y >= 5 ? 'месяцев' : Y === 1 ? 'месяц' : 'месяца';
  const monthsText = X === Y
    ? `~${fmt(X)} ${monthWord}`
    : `~${fmt(X)}–${fmt(Y)} ${monthWord}`;

  const calorieTarget = (profile as any).calorie_target as number | undefined;

  const methodLabel =
    profile.trackingMethod === 'plate'
      ? 'Тарелка'
      : profile.trackingMethod === 'palm'
        ? 'Ладонь'
        : 'Тарелка';

  const proteinText =
    profile.trackingMethod === 'plate'
      ? 'Сегодня постарайтесь добавлять нежирный белок размером с 1/4 части тарелки в каждый приём пищи.'
      : 'Сегодня постарайтесь добавлять нежирный белок размером с вашу ладонь без пальцев в каждый приём пищи.';

  useEffect(() => { window.scrollTo(0, 0); }, []);

  return (
    <div
      className="flex flex-col items-center min-h-screen px-6 py-6 animate-fade-in-up"
      style={{ backgroundColor: '#FAF5F0', maxWidth: '480px', margin: '0 auto', width: '100%' }}
    >
      {/* Inga greeting */}
      <div className="w-full max-w-sm flex items-start gap-3 mb-6">
        <img
          src={ingaPhoto}
          alt="Инга"
          className="w-14 h-14 rounded-full object-cover flex-shrink-0"
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
          <div className="font-medium">
            {name ? `${name}, всё готово. ` : 'Всё готово. '}
            Я знаю вашу цель, ваш темп и ваш метод.
          </div>
          <div className="mt-2">
            Теперь моя задача — быть рядом каждый день и помогать вам двигаться вперёд.
          </div>
          <div className="mt-2">
            У вас всё получится 🧡
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="w-full max-w-sm space-y-3 mb-6">
        {/* Goal card */}
        <div
          className="flex items-center gap-3 px-4 py-4"
          style={{ backgroundColor: '#F7F2EE', borderRadius: '12px' }}
        >
          <span className="text-2xl flex-shrink-0">🎯</span>
          <div>
            <div
              className="text-xs uppercase tracking-wide"
              style={{ color: '#9E9E9E' }}
            >
              Цель
            </div>
            <div className="text-sm font-semibold" style={{ color: '#5C4A3D' }}>
              −{goalKg} кг · {monthsText}
            </div>
          </div>
        </div>

        {/* Method card */}
        <div
          className="flex items-center gap-3 px-4 py-4"
          style={{ backgroundColor: '#F7F2EE', borderRadius: '12px' }}
        >
          <span className="text-2xl flex-shrink-0">🍽️</span>
          <div>
            <div
              className="text-xs uppercase tracking-wide"
              style={{ color: '#9E9E9E' }}
            >
              Метод
            </div>
            <div className="text-sm font-semibold" style={{ color: '#5C4A3D' }}>
              {methodLabel}
              {calorieTarget ? ` · норма ${calorieTarget.toLocaleString('ru-RU').replace(/,/g, ' ')} ккал` : ''}
            </div>
          </div>
        </div>
      </div>

      {/* Today block */}
      <div
        className="w-full max-w-sm px-4 py-4 mb-6"
        style={{
          backgroundColor: '#FFF8F3',
          border: '1px solid #FAC775',
          borderRadius: '12px',
        }}
      >
        <div
          className="text-xs font-bold uppercase tracking-wide mb-3"
          style={{ color: '#FF6200' }}
        >
          Что делать сегодня
        </div>

        <div className="space-y-4">
          {/* Item 1 */}
          <div className="flex items-start gap-3">
            <span
              className="flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold flex-shrink-0"
              style={{ backgroundColor: '#FF6200', color: '#FFFFFF' }}
            >
              1
            </span>
            <div className="text-sm font-medium" style={{ color: '#5C4A3D' }}>
              Постарайтесь выпить 6 стаканов воды
            </div>
          </div>

          {/* Item 2 */}
          <div className="flex items-start gap-3">
            <span
              className="flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold flex-shrink-0"
              style={{ backgroundColor: '#FF6200', color: '#FFFFFF' }}
            >
              2
            </span>
            <div>
              <div className="text-sm font-medium" style={{ color: '#5C4A3D' }}>
                {proteinText}
              </div>
              <div
                className="text-xs italic mt-1"
                style={{ color: '#9E9E9E' }}
              >
                Дальше я расскажу, как выбирать белок.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="w-full max-w-sm mt-auto pt-2 pb-safe">
        <button
          onClick={() => setStep('daily')}
          className="w-full py-3.5 rounded-xl font-semibold text-base transition-all duration-200 active:scale-[0.97]"
          style={{
            backgroundColor: '#FF6200',
            color: '#FFFFFF',
          }}
        >
          {name ? `Начнём, ${name} →` : 'Начнём →'}
        </button>
      </div>
    </div>
  );
}

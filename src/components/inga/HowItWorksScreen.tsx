import { useApp } from '@/context/AppContext';
import ingaPhoto from '@/assets/inga-photo.jpg';

interface RoutineItem {
  emoji: string;
  title: string;
  hint: string;
}

interface RoutineBlock {
  title: string;
  emoji: string;
  bg: string;
  border: string;
  items: RoutineItem[];
}

const ROUTINES: RoutineBlock[] = [
  {
    title: 'КАЖДОЕ УТРО',
    emoji: '☀️',
    bg: '#FFF8F3',
    border: '#FAC775',
    items: [
      { emoji: '⚖️', title: 'Записывай вес', hint: 'Натощак, после туалета — самый точный момент' },
      { emoji: '💤', title: 'Сон — сколько часов', hint: 'Сон влияет на вес сильнее, чем кажется' },
      { emoji: '👟', title: 'Шаги за вчера', hint: 'Смотри в телефоне или фитнес-браслете' },
    ],
  },
  {
    title: 'В ТЕЧЕНИЕ ДНЯ',
    emoji: '🍽️',
    bg: '#F0F9F4',
    border: '#9FE1CB',
    items: [
      { emoji: '📝', title: 'Записывай приёмы пищи', hint: 'Я проанализирую и предложу лёгкие замены' },
      { emoji: '🥛', title: 'Следи за водой — 6 стаканов', hint: 'Выпила стакан — нажми иконку вверху экрана' },
    ],
  },
  {
    title: 'ВЕЧЕРОМ — 2 МИНУТЫ',
    emoji: '🌙',
    bg: '#F4F0F9',
    border: '#C9B8E8',
    items: [
      { emoji: '💬', title: 'Расскажи как прошёл день', hint: 'Как себя чувствовала — я рядом' },
    ],
  },
];

export function HowItWorksScreen() {
  const { setStep } = useApp();

  return (
    <div
      className="flex flex-col items-center min-h-screen px-6 py-6 animate-fade-in-up"
      style={{ backgroundColor: '#FAF5F0' }}
    >
      {/* Progress + back button */}
      <div className="w-full max-w-sm flex items-center gap-3 mb-8">
        <button
          type="button"
          onClick={() => setStep('tracking-method')}
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
              style={{ backgroundColor: '#FF6200' }}
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
          <div className="font-medium">
            Вот как мы будем работать вместе. Всего 5–10 минут в день — и это станет привычкой.
          </div>
        </div>
      </div>

      {/* Routine blocks */}
      <div className="w-full max-w-sm space-y-4 mb-6">
        {ROUTINES.map((block) => (
          <div
            key={block.title}
            className="px-4 py-4"
            style={{
              backgroundColor: block.bg,
              border: `1px solid ${block.border}`,
              borderRadius: '12px',
            }}
          >
            <div
              className="text-xs font-bold uppercase tracking-wide mb-3"
              style={{ color: '#5C4A3D' }}
            >
              {block.emoji} {block.title}
            </div>
            <div className="space-y-3">
              {block.items.map((item) => (
                <div key={item.title} className="flex items-start gap-2">
                  <span className="text-base flex-shrink-0 leading-5">{item.emoji}</span>
                  <div>
                    <div
                      className="text-sm font-medium leading-snug"
                      style={{ color: '#5C4A3D' }}
                    >
                      {item.title}
                    </div>
                    <div
                      className="text-xs leading-snug mt-0.5"
                      style={{ color: '#9E9E9E' }}
                    >
                      {item.hint}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Quote block */}
      <div
        className="w-full max-w-sm px-4 py-4 mb-8"
        style={{
          backgroundColor: '#F7F2EE',
          borderRadius: '10px',
          borderLeft: '3px solid #FF6200',
        }}
      >
        <p
          className="text-sm leading-relaxed italic"
          style={{ color: '#5C4A3D' }}
        >
          Наша цель — похудеть навсегда, не отказываясь от любимых блюд. Просто научиться делать их легче.
        </p>
      </div>

      {/* CTA */}
      <div className="w-full max-w-sm mt-auto pt-2 pb-safe">
        <button
          onClick={() => setStep('route-ready')}
          className="w-full py-3.5 rounded-xl font-semibold text-base transition-all duration-200 active:scale-[0.97]"
          style={{
            backgroundColor: '#FF6200',
            color: '#FFFFFF',
          }}
        >
          К первому дню →
        </button>
      </div>
    </div>
  );
}

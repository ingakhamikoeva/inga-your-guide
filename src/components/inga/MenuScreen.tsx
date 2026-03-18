import { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

type MenuSection = 'main' | 'food' | 'recipes' | 'sos' | 'audio' | 'education' | 'progress' | 'consultation';

const sosOptions = [
  { id: 'overate', label: '🍽 Съела лишнее', response: { support: 'Это нормально. Один приём пищи не определяет весь путь.', explain: 'Чаще всего переедание — результат недоедания ранее в течение дня или накопленной усталости.', action: 'Выпей стакан воды и просто продолжи день. Без наказаний.', food: 'Если голодна — лёгкий перекус с белком: йогурт, яйцо, горсть орехов.' } },
  { id: 'sweet', label: '🍬 Хочу сладкое', response: { support: 'Тяга к сладкому — это не слабость, это сигнал тела.', explain: 'Часто это говорит о нехватке энергии, белка или просто усталости.', action: 'Попробуй сначала съесть что-то с белком. Если через 15 минут всё ещё хочется — позволь себе маленькую порцию.', food: 'Творог с ягодами, банан с арахисовой пастой, тёмный шоколад (2–3 дольки).' } },
  { id: 'evening', label: '🌙 Вечерний жор', response: { support: 'Вечерний голод — это не про дисциплину. Это про то, как прошёл твой день.', explain: 'Если днём было мало еды или много стресса — вечером тело компенсирует.', action: 'Запланируй сытный ужин с белком и овощами. Это не срыв, а забота о себе.', food: 'Куриное филе + овощной салат, омлет с зеленью, рыба с гарниром.' } },
  { id: 'stress', label: '😰 Стресс / тревога', response: { support: 'Ты не должна быть сильной 24/7. Иногда нужно просто остановиться.', explain: 'Стресс повышает кортизол, который усиливает тягу к быстрым углеводам.', action: 'Сделай 5 глубоких вдохов. Налей тёплый чай. Дай себе 10 минут тишины.', food: '' } },
  { id: 'tired', label: '😴 Устала, нет сил', response: { support: 'Усталость — это не лень. Это сигнал, что ресурс на нуле.', explain: 'Когда тело устало, мозг ищет быстрый источник энергии — еду.', action: 'Если есть возможность — отдохни 15 минут. Если нет — простой перекус без готовки.', food: 'Хлебец с авокадо, банан, горсть орехов.' } },
];

const educationTopics = [
  { title: 'Белок и сытость', content: 'Белок дольше всего задерживается в желудке. Если в каждом приёме пищи есть белок, ты дольше чувствуешь сытость и меньше тянет на перекусы.' },
  { title: 'Жиры и калорийность', content: '1 грамм жира = 9 ккал (а белок и углеводы = 4 ккал). Это не значит, что жиры вредны — просто важно понимать их калорийность и не злоупотреблять.' },
  { title: 'Углеводы и энергия', content: 'Углеводы — основной источник энергии для мозга и мышц. Сложные углеводы (крупы, овощи) дают стабильную энергию, простые (сахар) — быстрый скачок и спад.' },
  { title: 'Клетчатка', content: 'Клетчатка замедляет пищеварение, даёт объём еде и поддерживает микрофлору кишечника. Овощи, зелень, бобовые — твои лучшие друзья.' },
  { title: 'Вечерний голод', content: 'Если к вечеру тебя тянет на еду — скорее всего, днём было мало белка или общей калорийности. Вечерний голод — это следствие, а не причина.' },
];

export function MenuScreen() {
  const { setStep, weeklyData, profile, calculations, dailyReports } = useApp();
  const [section, setSection] = useState<MenuSection>('main');
  const [selectedSos, setSelectedSos] = useState<string | null>(null);

  if (section === 'main') {
    return (
      <div className="flex flex-col items-center min-h-screen px-6 py-10 animate-fade-in-up">
        <h2 className="text-2xl font-bold mb-6">Меню</h2>
        <div className="w-full max-w-sm space-y-3">
          {[
            { id: 'food' as const, icon: '🍽', label: 'Питание' },
            { id: 'recipes' as const, icon: '🍰', label: 'Рецепты' },
            { id: 'sos' as const, icon: '🚨', label: 'SOS' },
            { id: 'audio' as const, icon: '🎧', label: 'Аудио-поддержка' },
            { id: 'education' as const, icon: '📚', label: 'Обучение' },
            { id: 'progress' as const, icon: '📊', label: 'Мой прогресс' },
            { id: 'consultation' as const, icon: '👩‍⚕️', label: 'Консультация с Ингой' },
          ].map(item => (
            <button
              key={item.id}
              onClick={() => setSection(item.id)}
              className="inga-card w-full text-left hover:border-primary transition-colors cursor-pointer flex items-center gap-3"
            >
              <span className="text-2xl">{item.icon}</span>
              <span className="font-semibold">{item.label}</span>
            </button>
          ))}
        </div>
        <button onClick={() => setStep('daily')} className="mt-6 text-sm text-muted-foreground underline">
          ← Вернуться к отчёту
        </button>
      </div>
    );
  }

  const BackButton = () => (
    <button onClick={() => setSection('main')} className="text-sm text-muted-foreground underline mb-6">
      ← Назад в меню
    </button>
  );

  if (section === 'food') {
    return (
      <div className="flex flex-col items-center min-h-screen px-6 py-10 animate-fade-in-up">
        <BackButton />
        <h2 className="text-2xl font-bold mb-4">🍽 Питание</h2>
        <div className="inga-bubble mb-6">
          <p>Не знаешь, что съесть? Я подскажу!</p>
          <p className="text-muted-foreground text-sm mt-1">Учитываю твой профиль, время суток и цели.</p>
        </div>
        <div className="w-full max-w-sm space-y-3">
          {['Не знаю, что съесть', 'Хочу сладкое', 'Нет сил готовить'].map(q => (
            <div key={q} className="inga-card">
              <p className="font-medium mb-2">{q}</p>
              <p className="text-sm text-muted-foreground">
                {q === 'Не знаю, что съесть' && 'Попробуй: куриная грудка с овощами на пару, творог с ягодами или омлет с зеленью.'}
                {q === 'Хочу сладкое' && 'Альтернативы: йогурт с мёдом, запечённое яблоко с корицей, тёмный шоколад 2–3 дольки.'}
                {q === 'Нет сил готовить' && 'Быстро: хлебец + авокадо, банан + горсть орехов, готовый творожок.'}
              </p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (section === 'recipes') {
    return (
      <div className="flex flex-col items-center min-h-screen px-6 py-10 animate-fade-in-up">
        <BackButton />
        <h2 className="text-2xl font-bold mb-4">🍰 Рецепты</h2>
        <div className="w-full max-w-sm space-y-3">
          {[
            { cat: '🌅 Быстрые завтраки', items: ['Овсянка с бананом и орехами', 'Омлет с помидорами', 'Творог с ягодами и мёдом'] },
            { cat: '🥗 Сытные обеды', items: ['Куриная грудка с гречкой и салатом', 'Рыба с овощами на пару', 'Суп-пюре из брокколи с сухариками'] },
            { cat: '🌙 Лёгкие ужины', items: ['Салат с тунцом и яйцом', 'Запечённые овощи с сыром', 'Творожная запеканка'] },
            { cat: '🍫 Десерты без срывов', items: ['Запечённое яблоко с корицей', 'Банановое мороженое', 'Шоколадный мусс из авокадо'] },
          ].map(cat => (
            <div key={cat.cat} className="inga-card">
              <div className="font-bold mb-2">{cat.cat}</div>
              <ul className="text-sm text-muted-foreground space-y-1">
                {cat.items.map(item => <li key={item}>• {item}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (section === 'sos') {
    const selected = sosOptions.find(s => s.id === selectedSos);
    return (
      <div className="flex flex-col items-center min-h-screen px-6 py-10 animate-fade-in-up">
        <BackButton />
        <h2 className="text-2xl font-bold mb-4">🚨 SOS</h2>
        {!selected ? (
          <div className="w-full max-w-sm space-y-3">
            {sosOptions.map(s => (
              <button key={s.id} onClick={() => setSelectedSos(s.id)} className="inga-card w-full text-left hover:border-primary transition-colors cursor-pointer">
                {s.label}
              </button>
            ))}
          </div>
        ) : (
          <div className="w-full max-w-sm space-y-4 animate-scale-in">
            <div className="inga-card border-primary">
              <p className="font-semibold mb-2">💛 {selected.response.support}</p>
              <p className="text-sm text-muted-foreground mb-2">{selected.response.explain}</p>
              <p className="text-sm font-medium mb-1">Что сделать:</p>
              <p className="text-sm text-muted-foreground">{selected.response.action}</p>
              {selected.response.food && (
                <>
                  <p className="text-sm font-medium mt-2 mb-1">Что поесть:</p>
                  <p className="text-sm text-muted-foreground">{selected.response.food}</p>
                </>
              )}
            </div>
            <button onClick={() => setSelectedSos(null)} className="inga-btn-secondary w-full">
              ← Назад
            </button>
          </div>
        )}
      </div>
    );
  }

  if (section === 'audio') {
    return (
      <div className="flex flex-col items-center min-h-screen px-6 py-10 animate-fade-in-up">
        <BackButton />
        <h2 className="text-2xl font-bold mb-4">🎧 Аудио-поддержка</h2>
        <div className="w-full max-w-sm space-y-3">
          {['🌟 Мотивация (3 мин)', '😌 Снятие стресса (5 мин)', '😴 Расслабление перед сном (4 мин)', '💪 Возвращение после срыва (3 мин)', '🌸 Принятие себя (4 мин)'].map(item => (
            <div key={item} className="inga-card flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">▶</div>
              <span className="font-medium text-sm">{item}</span>
            </div>
          ))}
          <p className="text-xs text-muted-foreground text-center mt-4">Аудио-практики будут доступны в полной версии</p>
        </div>
      </div>
    );
  }

  if (section === 'education') {
    return (
      <div className="flex flex-col items-center min-h-screen px-6 py-10 animate-fade-in-up">
        <BackButton />
        <h2 className="text-2xl font-bold mb-4">📚 Обучение</h2>
        <div className="w-full max-w-sm space-y-3">
          {educationTopics.map(topic => (
            <details key={topic.title} className="inga-card">
              <summary className="font-bold cursor-pointer">{topic.title}</summary>
              <p className="text-sm text-muted-foreground mt-2">{topic.content}</p>
            </details>
          ))}
        </div>
      </div>
    );
  }

  if (section === 'progress') {
    return (
      <div className="flex flex-col items-center min-h-screen px-6 py-10 animate-fade-in-up">
        <BackButton />
        <h2 className="text-2xl font-bold mb-4">📊 Мой прогресс</h2>
        <div className="w-full max-w-sm space-y-4">
          {weeklyData.length > 1 ? (
            <div className="inga-card">
              <div className="font-bold mb-3">Динамика веса</div>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={weeklyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis domain={['dataMin - 1', 'dataMax + 1']} tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip />
                  <Line type="monotone" dataKey="weight" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ fill: 'hsl(var(--primary))' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="inga-bubble text-center">
              <p className="text-muted-foreground">Данные о весе появятся после нескольких утренних отчётов.</p>
            </div>
          )}

          <div className="inga-card">
            <div className="font-bold mb-2">Объёмы</div>
            <div className="text-sm space-y-1">
              <p>Талия: <span className="font-semibold">{profile.waist || '—'} см</span></p>
              <p>Бёдра: <span className="font-semibold">{profile.hips || '—'} см</span></p>
            </div>
          </div>

          <div className="inga-card">
            <div className="font-bold mb-2">Отчётов отправлено</div>
            <div className="text-3xl font-bold text-primary">{dailyReports.length}</div>
          </div>
        </div>
      </div>
    );
  }

  if (section === 'consultation') {
    return (
      <div className="flex flex-col items-center min-h-screen px-6 py-10 animate-fade-in-up">
        <BackButton />
        <h2 className="text-2xl font-bold mb-4">👩‍⚕️ Консультация с Ингой</h2>
        <div className="inga-bubble mb-6 text-center">
          <p>Иногда полезно разобрать ситуацию глубже — лично, голосом, с живым человеком.</p>
          <p className="text-muted-foreground mt-2">Здесь ты можешь записаться на индивидуальную консультацию со мной.</p>
        </div>
        <div className="w-full max-w-sm space-y-3">
          <button className="inga-btn-primary w-full">Записаться на консультацию</button>
          <button onClick={() => setSection('main')} className="inga-btn-secondary w-full">Пока не нужно</button>
        </div>
      </div>
    );
  }

  return null;
}

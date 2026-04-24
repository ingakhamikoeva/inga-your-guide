import { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { getText, UserSex } from '@/lib/gender-text';
import { buildGamificationSummary, getMedalStyle } from '@/lib/gamification';
import {
  SOFT_SWAPS, LIGHT_SNACKS, METABOLIC_PLATE_TEXT, SWEET_SPOT_TEXT,
  METABOLIC_NIGHT_TEXT, DRINKS_TEXT, FAT_LEVER_TEXT, describeStage, detectStage,
} from '@/lib/soft-swap';

type MenuSection = 'main' | 'food' | 'recipes' | 'sos' | 'audio' | 'education' | 'progress' | 'consultation';

const getSosOptions = (sex: UserSex) => [
  { id: 'overate', label: getText('🍽 Съела лишнее', '🍽 Съел лишнее', sex), response: { support: 'Это нормально. Один приём пищи не определяет весь путь.', explain: 'Чаще всего переедание — результат недоедания ранее в течение дня или накопленной усталости.', action: 'Выпей стакан воды и просто продолжи день. Без наказаний.', food: getText('Если голодна — выбери что-то лёгкое и сытное: творог 0%, йогурт без сахара, кефир 1% или овощи. Это поможет не перегрузить день по калориям.', 'Если голоден — выбери что-то лёгкое и сытное: творог 0%, йогурт без сахара, кефир 1% или овощи. Это поможет не перегрузить день по калориям.', sex) } },
  { id: 'sweet', label: '🍬 Хочу сладкое', response: { support: 'Тяга к сладкому — это не слабость, это сигнал тела.', explain: 'Часто это говорит о нехватке энергии, белка или просто усталости. Сладкое не запрещено — важно, как и когда его съесть.', action: 'Сначала съешь нормальный приём пищи с белком. Если сладкого всё ещё хочется — добавь его сразу после, порцией до 100 г. Это "сладкая точка".', food: 'Ягоды, яблоко с творогом 0%, йогурт без сахара с ягодами или 1–2 квадратика тёмного шоколада после обеда.' } },
  { id: 'evening', label: '🌙 Вечерний жор', response: { support: 'Вечерний голод — это не про дисциплину. Это про то, как прошёл твой день.', explain: 'Если днём было мало белка или общей еды — вечером тело компенсирует. Резко урезать ужин не нужно.', action: 'Собери "метаболическую точку": нежирный белок + овощи, без жира. Это насытит и не перегрузит день.', food: 'Куриная грудка с болгарским перцем, белковый омлет с шампиньонами, нежирная рыба с овощами или творог 0% небольшой порцией.' } },
  { id: 'stress', label: '😰 Стресс / тревога', response: { support: getText('Ты не должна быть сильной 24/7. Иногда нужно просто остановиться.', 'Ты не должен быть сильным 24/7. Иногда нужно просто остановиться.', sex), explain: 'Стресс повышает кортизол, который усиливает тягу к быстрым углеводам.', action: 'Сделай 5 глубоких вдохов. Налей тёплый чай без сахара. Дай себе 10 минут тишины — еда подождёт.', food: '' } },
  { id: 'tired', label: getText('😴 Устала, нет сил', '😴 Устал, нет сил', sex), response: { support: 'Усталость — это не лень. Это сигнал, что ресурс на нуле.', explain: 'Когда тело устало, мозг ищет быстрый источник энергии — еду. Лучше выбрать вариант, который реально насытит.', action: 'Если есть возможность — отдохни 15 минут. Если нет — простой лёгкий перекус без готовки.', food: 'Кефир 1%, йогурт без сахара, творог 0% с ягодами или нарезанные овощи с куриной грудкой.' } },
];

const educationTopics = [
  { title: 'Метод "Мягкая замена"', content: 'Не запрещаем любимое — заменяем более калорийный вариант на более лёгкий. Сметана → греческий йогурт 2%, сливочное масло → масло через распылитель, сыр на перекус → творог 0%. Та же еда, меньше калорий.' },
  { title: 'Жиры — главный рычаг', content: FAT_LEVER_TEXT },
  { title: 'Метаболическая тарелка', content: METABOLIC_PLATE_TEXT },
  { title: 'Сладкая точка', content: SWEET_SPOT_TEXT },
  { title: 'Метаболическая точка перед сном', content: METABOLIC_NIGHT_TEXT },
  { title: 'Напитки на активном этапе', content: DRINKS_TEXT },
  { title: 'Режим питания', content: 'Ешь каждые 3–4 часа, 4–6 приёмов пищи в день. Завтрак — не позднее 2 часов после пробуждения. Не оставляй весь голод на вечер — иначе сложно удержать калорийность.' },
  { title: 'Объём порции', content: 'Один приём пищи вместе с напитком — до 500 г. Например: 300 г еды + 200 мл напитка без калорий.' },
];

export function MenuScreen() {
  const { setStep, weeklyData, profile, calculations, dailyReports, medals } = useApp();
  const [section, setSection] = useState<MenuSection>('main');
  const [selectedSos, setSelectedSos] = useState<string | null>(null);
  const sosOptions = getSosOptions(profile.gender);
  const today = new Date().toISOString().slice(0, 10);
  const gamification = buildGamificationSummary(today, weeklyData, dailyReports, medals);
  const formatDelta = (value: number | null) => value === null ? 'пока мало данных' : value > 0 ? `+${value} кг` : `${value} кг`;
  const stage = detectStage(profile.weight, profile.goalWeight);

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
        <div className="inga-bubble mb-4">
          <p className="font-semibold mb-1">Метод "Мягкая замена"</p>
          <p className="text-sm text-muted-foreground">Не убираем любимое — заменяем более калорийный вариант на более лёгкий. Так снижаем вес без жёстких ограничений и срывов.</p>
          <p className="text-xs text-muted-foreground mt-2 italic">{describeStage(stage)}</p>
        </div>

        <div className="w-full max-w-sm space-y-3 mb-4">
          {['Не знаю, что съесть', 'Хочу сладкое', 'Что съесть на перекус', 'Нет сил готовить', 'Хочется есть вечером'].map(q => (
            <div key={q} className="inga-card">
              <p className="font-medium mb-2">{q}</p>
              <p className="text-sm text-muted-foreground">
                {q === 'Не знаю, что съесть' && `${METABOLIC_PLATE_TEXT} Например: куриная грудка + гречка + овощи или нежирная рыба + картофель + салат.`}
                {q === 'Хочу сладкое' && SWEET_SPOT_TEXT + ' Подойдут ягоды, яблоко с творогом 0% или 1–2 квадратика тёмного шоколада после обеда.'}
                {q === 'Что съесть на перекус' && `Для перекуса лучше выбрать что-то лёгкое и сытное: ${LIGHT_SNACKS.slice(0, 6).join(', ')}. Так не перегрузишь день по калориям.`}
                {q === 'Нет сил готовить' && 'Быстро и без готовки: кефир 1%, йогурт без сахара, творог 0% с ягодами или нарезанные овощи с куриной грудкой из магазина.'}
                {q === 'Хочется есть вечером' && METABOLIC_NIGHT_TEXT}
              </p>
            </div>
          ))}
        </div>

        <div className="w-full max-w-sm">
          <h3 className="font-bold mb-2">Примеры мягких замен</h3>
          <div className="inga-card space-y-2">
            {SOFT_SWAPS.slice(0, 8).map(s => (
              <div key={s.from} className="text-sm border-b border-border last:border-0 pb-2 last:pb-0">
                <div><span className="font-medium">{s.from}</span> → <span className="text-primary">{s.to}</span></div>
                <div className="text-xs text-muted-foreground">{s.why}</div>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-3 italic">{FAT_LEVER_TEXT}</p>
        </div>
      </div>
    );
  }

  if (section === 'recipes') {
    return (
      <div className="flex flex-col items-center min-h-screen px-6 py-10 animate-fade-in-up">
        <BackButton />
        <h2 className="text-2xl font-bold mb-4">🍰 Рецепты</h2>
        <p className="text-sm text-muted-foreground mb-3 max-w-sm text-center">Рецепты собраны по принципу мягкой замены: меньше жира, больше белка и сытости.</p>
        <div className="w-full max-w-sm space-y-3">
          {[
            { cat: '🌅 Быстрые завтраки', items: ['Овсянка на воде с ягодами и яичным белком', 'Омлет из белков с помидорами и зеленью', 'Творог 0% с ягодами и корицей'] },
            { cat: '🥗 Сытные обеды', items: ['Куриная грудка с гречкой и салатом', 'Треска или хек на пару с овощами', 'Суп-пюре из брокколи с куриной грудкой'] },
            { cat: '🌙 Лёгкие ужины', items: ['Салат с тунцом в собственном соку и яичным белком', 'Запечённые овощи с куриной грудкой', 'Творожная запеканка без масла и сахара'] },
            { cat: '🍫 Сладкая точка (после еды)', items: ['Запечённое яблоко с корицей', 'Творог 0% с ягодами и каплей мёда', 'Йогурт без сахара с ягодами'] },
            { cat: '🌃 Метаболическая точка перед сном', items: ['Куриная грудка с болгарским перцем', 'Белковый омлет с шампиньонами', 'Нежирная рыба с овощами'] },
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

          <div className="inga-card space-y-3">
            <div className="font-bold">Серия</div>
            <div className="flex items-end gap-2">
              <span className="text-3xl font-bold text-primary">{gamification.streakDays}</span>
              <span className="text-sm text-muted-foreground pb-1">дней в ритме</span>
            </div>
            <div className="inga-progress">
              <div className="inga-progress-bar" style={{ width: `${Math.min(100, (gamification.streakDays / 14) * 100)}%` }} />
            </div>
            <p className="text-sm text-muted-foreground">{gamification.streakMessage}</p>
          </div>

          <div className="inga-card space-y-2">
            <div className="font-bold">Недельный прогресс</div>
            <p className="text-sm text-muted-foreground">Изменение веса: <span className="font-semibold text-foreground">{formatDelta(gamification.weekChange)}</span></p>
            <p className="text-sm text-muted-foreground">{gamification.weeklyInsight}</p>
          </div>

          <div className="inga-card">
            <div className="font-bold mb-3">Медали</div>
            {medals.length > 0 ? (
              <div className="space-y-3">
                {[...medals].reverse().slice(0, 6).map(medal => (
                  <div key={medal.id} className="flex items-start gap-3 rounded-xl bg-background/60 p-3">
                    <span className={`text-2xl ${getMedalStyle(medal.type).tone}`}>{getMedalStyle(medal.type).icon}</span>
                    <div>
                      <p className="text-sm font-semibold">{medal.title}</p>
                      <p className="text-xs text-muted-foreground">{medal.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Медали появятся здесь, когда накопится недельный ритм.</p>
            )}
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

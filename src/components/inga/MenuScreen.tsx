import { useEffect, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { BookOpen, UtensilsCrossed, Headphones, TrendingUp, User, CalendarCheck, ChevronRight, Play } from 'lucide-react';
import { buildGamificationSummary, getMedalStyle } from '@/lib/gamification';
import { describeStage, detectStage, stageLabel, corridorStatus } from '@/lib/soft-swap';
import { hasName, cleanName } from '@/lib/user-name';
import { getSetting } from '@/lib/app-settings';
import palmMethodImage from '@/assets/palm-method.png';

const palmMethodCards = [
  {
    title: 'Белок — ладонь без пальцев',
    body: 'Ориентир для белковых продуктов — часть ладони от основания пальцев до запястья, без пальцев.',
    list: ['мясо', 'птица', 'рыба', 'морепродукты', 'яйца', 'творог'],
    extra: 'На этапе активного снижения веса выбирай нежирный белок калорийностью примерно 100–150 ккал на 100 г.',
    examplesLabel: 'Примеры:',
    examples: ['куриная грудка', 'индейка', 'нежирная рыба', 'морепродукты', 'творог 0–2%', 'яичные белки'],
    note: 'Жирный белок тоже может быть полезным, но на этапе снижения веса он быстро повышает калорийность рациона.',
  },
  {
    title: 'Углеводы — кулак',
    body: 'Ориентир для углеводов — порция размером с твой кулак.',
    list: ['крупы', 'картофель', 'макароны', 'хлеб', 'лаваш', 'фрукты', 'ягоды'],
    extra: 'Лучше чаще выбирать сложные углеводы:',
    examples: ['гречку', 'рис', 'овсянку', 'картофель', 'цельнозерновой хлеб', 'макароны из твёрдых сортов'],
    note: 'Фрукты и ягоды тоже относятся к углеводам, поэтому их лучше учитывать как часть порции и есть в конце приёма пищи как десерт.',
  },
  {
    title: 'Овощи — две ладони лодочкой',
    body: 'Ориентир для овощей — две ладони, сложенные вместе лодочкой. Это порция овощей и зелени, которая помогает добавить объём, клетчатку и сытость.',
    list: ['огурцы', 'помидоры', 'капуста', 'салатные листья', 'зелень', 'брокколи', 'кабачки', 'перец', 'цветная капуста'],
    note: 'Овощи помогают сделать приём пищи более сытным без сильного увеличения калорийности.',
  },
  {
    title: 'Жиры — верхняя фаланга большого пальца',
    body: 'Ориентир для жиров — верхняя фаланга большого пальца.',
    list: ['масло', 'орехи', 'сыр', 'авокадо', 'семечки', 'жирные соусы', 'ореховая паста, урбеч и др.'],
    note: 'Жиры нужны организму, но они очень калорийные: 1 г жира даёт 9 ккал. Поэтому на этапе активного снижения веса жиры лучше контролировать особенно внимательно.',
  },
];

type MenuSection = 'main' | 'how-to' | 'recipes' | 'audio' | 'progress' | 'profile' | 'consultation';

const howToTopics = [
  {
    title: 'Метод "Мягкая замена"',
    content: 'Не запрещаем любимое — заменяем более калорийный вариант на более лёгкий. Сметана → греческий йогурт 2%, сливочное масло → масло через распылитель, сыр на перекус → творог 0%. Та же еда, меньше калорий, без срывов.',
  },
  {
    title: 'Как учитывать питание',
    content: 'Есть три способа учёта: по калориям, по методу ладони и по метаболической тарелке. Любой из них работает — главное выбрать тот, с которым тебе комфортно держаться долго.',
  },
  {
    title: 'Метод ладони',
    content: 'Простой способ определить размер порции без весов и подсчёта калорий.',
    isPalmMethod: true,
  },
  {
    title: 'Метаболическая тарелка',
    content: 'Половина тарелки — овощи, четверть — белок, четверть — сложные углеводы. Жиры дозируем отдельно. Такая тарелка даёт сытость и удерживает калорийность естественно.',
  },
  {
    title: 'Считать калории',
    content: 'Если выбрала учёт по калориям, ориентируйся на свой коридор. Не стремись к минимуму — устойчивый дефицит важнее быстрого результата.',
  },
  {
    title: 'Сладкая точка',
    content: 'Сладкое не запрещено. Лучше съесть его сразу после основного приёма пищи — порцией до 100 г. Так тяга закрывается, а скачка сахара почти нет.',
  },
  {
    title: 'Как планировать питание',
    content: 'Планирование еды накануне сильно снижает риск срывов. Вечером прикинь, что съешь завтра — даже примерно. Это снимает напряжение и помогает не доводить себя до сильного голода.',
  },
  {
    title: 'Как удержать результат',
    content: 'После снижения веса важна фаза фиксации. Постепенно добавляем калории, продолжаем держать структуру тарелки и наблюдаем за весом в безопасном коридоре. Резкие возвраты к старому питанию — главная причина откатов.',
  },
];

const recipeCategories = [
  { cat: 'Быстрые завтраки', items: ['Овсянка на воде с ягодами и яичным белком', 'Омлет из белков с помидорами и зеленью', 'Творог 0% с ягодами и корицей'] },
  { cat: 'Сытные обеды', items: ['Куриная грудка с гречкой и салатом', 'Треска или хек на пару с овощами', 'Суп-пюре из брокколи с куриной грудкой'] },
  { cat: 'Лёгкие ужины', items: ['Салат с тунцом в собственном соку и яичным белком', 'Запечённые овощи с куриной грудкой', 'Творожная запеканка без масла и сахара'] },
  { cat: 'Сладкая точка (после еды)', items: ['Запечённое яблоко с корицей', 'Творог 0% с ягодами и каплей мёда', 'Йогурт без сахара с ягодами'] },
  { cat: 'Метаболическая точка перед сном', items: ['Куриная грудка с болгарским перцем', 'Белковый омлет с шампиньонами', 'Нежирная рыба с овощами'] },
];

const audioItems = [
  { title: 'Мотивация', duration: '3 мин' },
  { title: 'Снятие стресса', duration: '5 мин' },
  { title: 'Расслабление перед сном', duration: '4 мин' },
  { title: 'Возвращение после срыва', duration: '3 мин' },
  { title: 'Вечерний голод', duration: '4 мин' },
  { title: 'Принятие себя', duration: '4 мин' },
];

const trackingMethodLabels: Record<string, string> = {
  calories: 'Калории',
  palm: 'Метод ладони',
  plate: 'Метаболическая тарелка',
};

const paceLabels: Record<string, string> = {
  fast: 'Активный',
  slow: 'Мягкий',
};

export function MenuScreen() {
  const { setStep, weeklyData, profile, dailyReports, medals, updateProfile } = useApp();
  const [section, setSection] = useState<MenuSection>('main');

  const today = new Date().toISOString().slice(0, 10);
  const gamification = buildGamificationSummary(today, weeklyData, dailyReports, medals);
  const formatDelta = (value: number | null) => value === null ? 'пока мало данных' : value > 0 ? `+${value} кг` : `${value} кг`;
  const stage = detectStage(profile.weight, profile.goalWeight, profile.currentStage);

  if (section === 'main') {
    const items = [
      { id: 'how-to' as const, icon: BookOpen, label: 'Как похудеть', hint: 'Метод и принципы' },
      { id: 'recipes' as const, icon: UtensilsCrossed, label: 'Рецепты', hint: 'Подборки по методу' },
      { id: 'audio' as const, icon: Headphones, label: 'Аудио-поддержка', hint: 'Короткие практики' },
      { id: 'progress' as const, icon: TrendingUp, label: 'Мой прогресс', hint: 'Вес, объёмы, медали' },
      { id: 'profile' as const, icon: User, label: 'Профиль', hint: 'Данные и настройки' },
      { id: 'consultation' as const, icon: CalendarCheck, label: 'Консультация', hint: 'С Ингой', badge: 'платно' },
    ];

    return (
      <div className="flex flex-col items-center min-h-screen px-5 py-8 animate-fade-in-up">
        <h2 className="text-2xl font-bold mb-6">Меню</h2>
        <div className="w-full max-w-md space-y-2.5">
          {items.map(item => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setSection(item.id)}
                className="w-full text-left bg-card border border-border rounded-2xl px-4 py-3.5 flex items-center gap-3.5 hover:border-primary/60 hover:bg-primary/[0.03] active:scale-[0.99] transition-all"
              >
                <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Icon size={22} strokeWidth={1.75} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{item.label}</span>
                    {item.badge && (
                      <span className="text-[10px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-accent text-accent-foreground">
                        {item.badge}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">{item.hint}</div>
                </div>
                <ChevronRight size={18} className="text-muted-foreground shrink-0" />
              </button>
            );
          })}
        </div>
        <button onClick={() => setStep('daily')} className="mt-6 text-sm text-muted-foreground underline">
          ← Вернуться к отчёту
        </button>
      </div>
    );
  }

  const BackButton = () => (
    <button onClick={() => setSection('main')} className="text-sm text-muted-foreground underline mb-6 self-start">
      ← Назад в меню
    </button>
  );

  if (section === 'how-to') {
    return (
      <div className="flex flex-col items-center min-h-screen px-5 py-8 animate-fade-in-up">
        <div className="w-full max-w-md">
          <BackButton />
          <h2 className="text-2xl font-bold mb-2">Как похудеть</h2>
          <p className="text-sm text-muted-foreground mb-4">Метод и принципы — без жёстких ограничений и срывов.</p>
          <p className="text-xs text-muted-foreground italic mb-4">{describeStage(stage)}</p>
          <div className="space-y-2.5">
            {howToTopics.map(topic => (
              <details key={topic.title} className="inga-card group">
                <summary className="font-semibold cursor-pointer flex items-center justify-between list-none">
                  <span>{topic.title}</span>
                  <ChevronRight size={18} className="text-muted-foreground transition-transform group-open:rotate-90" />
                </summary>
                {(topic as any).isPalmMethod ? (
                  <div className="mt-3 space-y-3">
                    <p className="text-sm text-muted-foreground leading-relaxed">{topic.content}</p>
                    <img
                      src={palmMethodImage}
                      alt="Метод ладони: ладонь — белок, кулак — углеводы, две ладони лодочкой — овощи, верхняя фаланга большого пальца — жиры"
                      className="w-full rounded-xl"
                      loading="lazy"
                    />
                    <div className="text-sm text-muted-foreground leading-relaxed space-y-2">
                      <p>Метод ладони помогает быстро понять, сколько еды положить на тарелку.</p>
                      <p>Размер руки у каждого свой, поэтому порция получается индивидуальной: человеку с маленькой рукой — меньше, человеку с большой рукой — больше.</p>
                      <p>Это не строгая формула, а удобный ориентир, когда не хочется всё взвешивать.</p>
                    </div>
                    <div className="space-y-2.5">
                      {palmMethodCards.map(card => (
                        <div key={card.title} className="rounded-xl border border-border bg-background/50 p-3.5">
                          <div className="font-semibold text-sm mb-1.5">{card.title}</div>
                          <p className="text-sm text-muted-foreground leading-relaxed">{card.body}</p>
                          {card.list && (
                            <ul className="text-sm text-muted-foreground mt-2 space-y-0.5">
                              {card.list.map(it => <li key={it}>• {it}</li>)}
                            </ul>
                          )}
                          {card.extra && <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{card.extra}</p>}
                          {card.examples && (
                            <ul className="text-sm text-muted-foreground mt-1.5 space-y-0.5">
                              {card.examples.map(ex => <li key={ex}>• {ex}</li>)}
                            </ul>
                          )}
                          {card.note && <p className="text-xs text-muted-foreground mt-2 leading-relaxed italic">{card.note}</p>}
                        </div>
                      ))}
                    </div>
                    <div className="rounded-xl bg-primary/5 border border-primary/20 p-3.5">
                      <div className="font-semibold text-sm mb-2">Как собрать приём пищи</div>
                      <ul className="text-sm text-muted-foreground space-y-1">
                        <li>• белок — ладонь без пальцев</li>
                        <li>• углеводы — кулак</li>
                        <li>• овощи — две ладони лодочкой</li>
                        <li>• жиры — верхняя фаланга большого пальца</li>
                      </ul>
                      <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                        Пример: куриная грудка + гречка + овощной салат + немного масла.
                      </p>
                    </div>
                    <div className="rounded-xl border border-border p-3.5 space-y-2">
                      <div className="font-semibold text-sm">Важное уточнение</div>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        Метод ладони — это ориентир, а не строгий закон. Если ты снижаешь вес, лучше соблюдать принцип:
                      </p>
                      <ul className="text-sm text-muted-foreground space-y-0.5">
                        <li>• белок — в каждый основной приём пищи</li>
                        <li>• овощи — как можно чаще</li>
                        <li>• углеводы — по порции, а не бесконтрольно</li>
                        <li>• жиры — небольшими порциями</li>
                      </ul>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Метод ладони помогает не усложнять питание. Тебе не нужно каждый раз считать всё до грамма. Достаточно собрать тарелку так, чтобы в ней были: белок + углеводы + овощи + немного жиров. Так проще держать сытость, снижать вес и не жить в режиме вечных расчётов.
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground mt-3 leading-relaxed">{topic.content}</p>
                )}
              </details>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (section === 'recipes') {
    return (
      <div className="flex flex-col items-center min-h-screen px-5 py-8 animate-fade-in-up">
        <div className="w-full max-w-md">
          <BackButton />
          <h2 className="text-2xl font-bold mb-2">Рецепты</h2>
          <p className="text-sm text-muted-foreground mb-5">Подборки блюд и десертов по методу «Мягкая замена».</p>
          <div className="space-y-3">
            {recipeCategories.map(cat => (
              <div key={cat.cat} className="inga-card">
                <div className="font-semibold mb-2">{cat.cat}</div>
                <ul className="text-sm text-muted-foreground space-y-1.5">
                  {cat.items.map(item => <li key={item}>• {item}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (section === 'audio') {
    return (
      <div className="flex flex-col items-center min-h-screen px-5 py-8 animate-fade-in-up">
        <div className="w-full max-w-md">
          <BackButton />
          <h2 className="text-2xl font-bold mb-2">Аудио-поддержка</h2>
          <p className="text-sm text-muted-foreground mb-5">Короткие аудио для поддержки, мотивации и возвращения в ритм.</p>
          <div className="space-y-2.5">
            {audioItems.map(item => (
              <div key={item.title} className="inga-card flex items-center gap-3">
                <button className="w-11 h-11 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0">
                  <Play size={18} fill="currentColor" />
                </button>
                <div className="flex-1">
                  <div className="font-medium text-sm">{item.title}</div>
                  <div className="text-xs text-muted-foreground">{item.duration}</div>
                </div>
              </div>
            ))}
            <p className="text-xs text-muted-foreground text-center mt-4">Аудио-практики будут доступны в полной версии</p>
          </div>
        </div>
      </div>
    );
  }

  if (section === 'progress') {
    const goalReached =
      profile.goalWeight !== undefined &&
      weeklyData.length > 0 &&
      weeklyData[weeklyData.length - 1].weight <= profile.goalWeight;

    return (
      <div className="flex flex-col items-center min-h-screen px-5 py-8 animate-fade-in-up">
        <div className="w-full max-w-md">
          <BackButton />
          <h2 className="text-2xl font-bold mb-5">Мой прогресс</h2>
          <div className="space-y-4">
            <div className="inga-card">
              <div className="font-semibold mb-1">Текущий этап</div>
              <p className="text-sm text-foreground mb-1">{stageLabel(stage)}</p>
              <p className="text-sm text-muted-foreground">{describeStage(stage)}</p>
            </div>

            {weeklyData.length > 1 ? (
              <div className="inga-card">
                <div className="font-semibold mb-3">Динамика веса</div>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={weeklyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis domain={['dataMin - 1', 'dataMax + 1']} tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip
                      formatter={(value: number) => [`${value} кг`, 'Вес']}
                      labelFormatter={(label) => `Дата: ${label}`}
                    />
                    <Line type="monotone" dataKey="weight" name="Вес" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ fill: 'hsl(var(--primary))' }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="inga-bubble text-center">
                <p className="text-muted-foreground">Данные о весе появятся после нескольких утренних отчётов.</p>
              </div>
            )}

            <div className="inga-card">
              <div className="font-semibold mb-2">Объёмы</div>
              <div className="text-sm space-y-1">
                <p>Талия: <span className="font-semibold">{profile.waist || '—'} см</span></p>
                <p>Бёдра: <span className="font-semibold">{profile.hips || '—'} см</span></p>
              </div>
            </div>

            {(stage === 'fixation' || stage === 'maintenance') && profile.goalWeight && (() => {
              const low = profile.goalWeight - 1;
              const high = profile.goalWeight + 1;
              const status = profile.weight ? corridorStatus(profile.weight, profile.goalWeight) : null;
              const statusText =
                status === 'in_range' ? 'Вес в безопасном коридоре. Продолжаем в обычном ритме.' :
                status === 'above' ? 'Вес вышел выше коридора. На этой неделе немного сократим калорийность и вернёмся в диапазон.' :
                status === 'below' ? 'Вес ниже коридора. Сейчас важно стабилизироваться и не продолжать снижаться.' :
                null;
              return (
                <div className="inga-card">
                  <div className="font-semibold mb-2">Безопасный коридор веса</div>
                  <p className="text-sm text-muted-foreground">
                    {stage === 'fixation' ? 'Твой ориентир: ' : 'Твой рабочий диапазон: '}
                    от <span className="font-semibold text-foreground">{low} кг</span> до <span className="font-semibold text-foreground">{high} кг</span>.
                    {stage === 'fixation'
                      ? ' Колебания веса внутри этого диапазона — нормальны.'
                      : ' Каждое утро смотрим, остаётся ли вес в коридоре.'}
                  </p>
                  {statusText && stage === 'maintenance' && (
                    <p className="text-sm text-foreground mt-2">{statusText}</p>
                  )}
                </div>
              );
            })()}

            {stage === 'fixation' && profile.currentFixationCalories && (
              <div className="inga-card">
                <div className="font-semibold mb-1">Фиксация: калорийность</div>
                <p className="text-sm text-muted-foreground">
                  Сейчас твой ориентир — <span className="font-semibold text-foreground">{profile.currentFixationCalories} ккал в день</span>
                  {profile.fixationWeekNumber ? ` (неделя ${profile.fixationWeekNumber})` : ''}.
                  {' '}Каждую неделю аккуратно прибавляем ~200 ккал — за счёт половинки авокадо, целого яйца, 40–50 г сыра, орехов в порции или ложки масла в салат.
                </p>
              </div>
            )}

            <div className="inga-card space-y-2">
              <div className="font-semibold">Серия</div>
              <div className="flex items-end gap-2">
                <span className="text-3xl font-bold text-primary">{gamification.streakDays}</span>
                <span className="text-sm text-muted-foreground pb-1">дней в ритме</span>
              </div>
              <div className="inga-progress">
                <div className="inga-progress-bar" style={{ width: `${Math.min(100, (gamification.streakDays / 14) * 100)}%` }} />
              </div>
              <p className="text-sm text-muted-foreground">{gamification.streakMessage}</p>
            </div>

            {goalReached && stage === 'loss' && (
              <div className="inga-card border-primary/40 bg-primary/5">
                <div className="font-semibold mb-1">🎉 Цель достигнута</div>
                <p className="text-sm text-muted-foreground">
                  Открой утренний экран — там можно перейти к фиксации результата.
                </p>
              </div>
            )}

            <div className="inga-card space-y-2">
              <div className="font-semibold">Недельный прогресс</div>
              <p className="text-sm text-muted-foreground">Изменение веса: <span className="font-semibold text-foreground">{formatDelta(gamification.weekChange)}</span></p>
              <p className="text-sm text-muted-foreground">{gamification.weeklyInsight}</p>
            </div>

            <div className="inga-card">
              <div className="font-semibold mb-3">Медали</div>
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
      </div>
    );
  }

  if (section === 'consultation') {
    return (
      <div className="flex flex-col items-center min-h-screen px-5 py-8 animate-fade-in-up">
        <div className="w-full max-w-md">
          <BackButton />
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-2xl font-bold">Консультация</h2>
            <span className="text-[10px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-accent text-accent-foreground">платно</span>
          </div>
          <h3 className="text-base font-semibold mb-3">Индивидуальная консультация с Ингой</h3>
          <div className="inga-bubble mb-6">
            <p>Иногда полезно разобрать ситуацию глубже — лично, голосом, с живым человеком.</p>
            <p className="text-muted-foreground mt-2">Здесь ты можешь записаться на индивидуальную консультацию со мной.</p>
          </div>
          <div className="space-y-3">
            <button className="inga-btn-primary w-full">Записаться на консультацию</button>
            <button onClick={() => setSection('main')} className="inga-btn-secondary w-full">Пока не нужно</button>
          </div>
        </div>
      </div>
    );
  }

  if (section === 'profile') {
    return (
      <ProfileSection
        onBack={() => setSection('main')}
        profile={profile}
        onSave={(name) => updateProfile({ name })}
      />
    );
  }

  return null;
}

function ProfileSection({
  onBack,
  profile,
  onSave,
}: {
  onBack: () => void;
  profile: ReturnType<typeof useApp>['profile'];
  onSave: (name: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(profile.name ?? '');
  const [savedFlash, setSavedFlash] = useState(false);

  const handleSave = () => {
    onSave(cleanName(name));
    setEditing(false);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1500);
  };

  const rows: Array<{ label: string; value: string }> = [
    { label: 'Пол', value: profile.gender === 'female' ? 'Женский' : profile.gender === 'male' ? 'Мужской' : '—' },
    { label: 'Возраст', value: profile.age ? `${profile.age} лет` : '—' },
    { label: 'Рост', value: profile.height ? `${profile.height} см` : '—' },
    { label: 'Текущий вес', value: profile.weight ? `${profile.weight} кг` : '—' },
    { label: 'Цель', value: profile.goalWeight ? `${profile.goalWeight} кг` : '—' },
    { label: 'Метод учёта', value: trackingMethodLabels[profile.trackingMethod] ?? '—' },
    { label: 'Темп снижения', value: paceLabels[profile.paceChoice] ?? '—' },
    { label: 'Пищевой профиль', value: profile.foodProfile?.pattern ?? '—' },
  ];

  return (
    <div className="flex flex-col items-center min-h-screen px-5 py-8 animate-fade-in-up">
      <div className="w-full max-w-md">
        <button onClick={onBack} className="text-sm text-muted-foreground underline mb-6 self-start">← Назад в меню</button>
        <h2 className="text-2xl font-bold mb-5">Профиль</h2>

        <div className="inga-card space-y-3 mb-3">
          <div className="text-sm text-muted-foreground">Имя</div>
          {!editing ? (
            <div className="flex items-center justify-between gap-3">
              <div className="text-xl font-semibold">{cleanName(profile.name) || 'Не указано'}</div>
              <button onClick={() => { setName(profile.name ?? ''); setEditing(true); }} className="inga-btn-secondary">
                Изменить
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                maxLength={40}
                autoFocus
                className="inga-input"
                placeholder="Твоё имя"
              />
              <div className="flex gap-2">
                <button onClick={handleSave} className="inga-btn-primary flex-1">Сохранить</button>
                <button onClick={() => setEditing(false)} className="inga-btn-secondary flex-1">Отмена</button>
              </div>
            </div>
          )}
          {savedFlash && <p className="text-xs text-primary">Сохранено</p>}
        </div>

        <div className="inga-card divide-y divide-border">
          {rows.map(row => (
            <div key={row.label} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
              <span className="text-sm text-muted-foreground">{row.label}</span>
              <span className="text-sm font-medium">{row.value}</span>
            </div>
          ))}
        </div>

        <p className="text-xs text-muted-foreground text-center mt-4">
          Изменение основных данных будет доступно в настройках профиля.
        </p>
      </div>
    </div>
  );
}

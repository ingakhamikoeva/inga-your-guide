import React, { useEffect, useState } from 'react';
import { useApp } from '@/context/AppContext';
import type { UserProfile } from '@/lib/types';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { BookOpen, UtensilsCrossed, Headphones, TrendingUp, User, CalendarCheck, ChevronRight, Play } from 'lucide-react';
import { buildGamificationSummary, getMedalStyle } from '@/lib/gamification';
import { describeStage, detectStage, stageLabel, corridorStatus } from '@/lib/soft-swap';
import { hasName, cleanName } from '@/lib/user-name';
import { getSetting } from '@/lib/app-settings';
import palmMethodImage from '@/assets/palm-method.png';
import { FoodCheatsheet } from '@/components/inga/FoodCheatsheet';
import recipeOatmeal from '@/assets/breakfast_oatmeal.jpg';
import recipePate from '@/assets/breakfast_pate.jpg';
import recipeZucchini from '@/assets/breakfast_zucchini.jpg';
import recipeBliny from '@/assets/breakfast_bliny.jpg';
import recipeVarenie from '@/assets/breakfast_varenie.jpg';
import recipeShaurma from '@/assets/breakfast_shaurma.jpg';
import recipeTaco from '@/assets/breakfast_taco.jpg';
import recipePirozhki from '@/assets/breakfast_pirozhki.jpg';

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

type MenuSection = 'main' | 'how-to' | 'recipes' | 'audio' | 'progress' | 'profile' | 'consultation' | 'materials';

const howToTopics = [
  {
    title: 'Метод "Лёгкая замена"',
    content: 'Не запрещаем любимое — заменяем более калорийный вариант на более лёгкий. Сметана → греческий йогурт 2%, сливочное масло → масло через распылитель, сыр на перекус → творог 0%. Та же еда, меньше калорий, без срывов.',
    isMethodLesson: true,
  },
  {
    title: 'Питательные вещества',
    content: '',
    isNutrientsLesson: true,
  },
  {
    title: 'Объём еды',
    content: 'Голод — твой главный враг. Не допускай чувства голода. Ешь каждые 3–4 часа, 4–6 раз в день. Объём каждого приёма пищи — до 500 г вместе с напитком.',
    isVolumeLesson: true,
  },
  {
    title: 'Как считать порции',
    content: '',
    isCountingGroup: true,
  },
  {
    title: 'Сладкая точка',
    content: 'Сладкое не запрещено — оно запланировано. Когда каждый день ешь что-то сладкое, спокойно проходишь мимо конфет. Фрукты, ягоды или лёгкий десерт из раздела Рецепты — Десерты. До 100 г и 100 ккал.',
    isSweetLesson: true,
  },
  {
    title: 'Вечерний перекус',
    content: 'Единственный приём, который отличается от остальных. Только нежирный белок 60–100 г + клетчатка 60–100 г. Без углеводов и жира. Можно есть даже на ночь. Например: куриная грудка + болгарский перец, или белковый омлет с грибами.',
    isEveningLesson: true,
  },
  {
    title: 'Как планировать питание',
    content: 'Планирование еды накануне сильно снижает риск срывов. Вечером прикинь, что съешь завтра — даже примерно. Это снимает напряжение и помогает не доводить себя до сильного голода.',
    isPlanningLesson: true,
  },
  {
    title: 'Фиксация результата',
    content: 'Постепенно выйти из дефицита калорий. В течение 2–4 недель плавно увеличиваем калорийность — по 100–200 ккал в неделю. Продолжаем держать структуру тарелки и следим за весом. Цель — дать телу привыкнуть к новому весу без отката.',
    isFixation: true,
  },
  {
    title: 'Сохранение результата',
    content: 'Удержать вес на всю жизнь. Колебания ±1–2 кг — это норма, не катастрофа. Возвращаемся к принципам метода при первых признаках набора. Главное — не возвращаться к старым привычкам резко.',
    isMaintenance: true,
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
  const [section, setSection] = useState<MenuSection>("main");
  const [nutrientSection, setNutrientSection] = useState<string | null>(null);
  const [recipeSection, setRecipeSection] = useState<string | null>(null);
  const [showCheatsheet, setShowCheatsheet] = useState(false);
  const [activeRecipe, setActiveRecipe] = useState<string | null>(null);
  const [lessonOverrides, setLessonOverrides] = useState<Record<string, { title?: string; content?: string }>>({});

  useEffect(() => {
    getSetting<Record<string, { title?: string; content?: string }>>('lesson_overrides').then((v) => {
      if (v) setLessonOverrides(v);
    });
  }, []);

  const effectiveTopics = howToTopics.map((t) => {
    const ov = lessonOverrides[t.title];
    if (!ov) return t;
    return { ...t, title: ov.title || t.title, content: ov.content || t.content };
  });

  const today = new Date().toISOString().slice(0, 10);
  const gamification = buildGamificationSummary(today, weeklyData, dailyReports, medals);
  const formatDelta = (value: number | null) => value === null ? 'пока мало данных' : value > 0 ? `+${value} кг` : `${value} кг`;
  const stage = detectStage(profile.weight, profile.goalWeight, profile.currentStage);

  if (section === 'main') {
    const items = [
      { id: 'how-to' as const, icon: BookOpen, label: 'Как похудеть', hint: 'Метод и принципы' },
      { id: 'recipes' as const, icon: UtensilsCrossed, label: 'Рецепты', hint: 'Подборки по методу' },
      { id: 'audio' as const, icon: Headphones, label: 'Аудио-поддержка', hint: 'Короткие практики' },
      { id: 'materials' as const, icon: BookOpen, label: 'Полезные материалы', hint: 'Таблицы, гайды, шпаргалки' },
      { id: 'progress' as const, icon: TrendingUp, label: 'Мой прогресс', hint: 'Вес, объёмы, медали' },
      { id: 'profile' as const, icon: User, label: 'Профиль', hint: 'Данные и настройки' },
      { id: 'consultation' as const, icon: CalendarCheck, label: 'Консультация с нутрициологом', hint: 'Индивидуальный разбор', badge: 'платно' },
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

  // ── Nutrient detail screen ─────────────────────────────────────────────




  if (section === 'how-to' && nutrientSection === 'Тарелка') {
    return (
      <div className="flex flex-col items-center min-h-screen px-5 py-8 animate-fade-in-up">
        <div className="w-full max-w-md">
          <button onClick={() => setNutrientSection(null)} className="text-base text-muted-foreground mb-6 block">← Назад</button>
          <h2 className="text-2xl font-bold mb-5">Метод тарелки</h2>

          <div className="inga-card mb-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Делите тарелку на части на глаз — без взвешивания. Подходит, если любите видеть структуру тарелки.
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed mt-2">
              Оптимальный диаметр тарелки — 20–22 см.
            </p>
          </div>

          <div className="inga-card mb-4">
            <div className="flex items-center gap-6 mb-4">
              <svg width="80" height="80" viewBox="0 0 72 72">
                <path d="M 36 36 L 36 4 A 32 32 0 0 0 36 68 Z" fill="#5E9E72" />
                <path d="M 36 36 L 36 4 A 32 32 0 0 1 68 36 Z" fill="#C0614A" />
                <path d="M 36 36 L 68 36 A 32 32 0 0 1 36 68 Z" fill="#B5A030" />
                <circle cx="36" cy="36" r="32" fill="none" stroke="#FFFFFF" strokeWidth="2" />
              </svg>
              <div className="space-y-2">
                {[
                  { color: '#5E9E72', label: '½ тарелки — клетчатка', sub: 'свежие овощи, зелень, грибы' },
                  { color: '#C0614A', label: '¼ тарелки — белок', sub: 'грудка, рыба, творог' },
                  { color: '#B5A030', label: '¼ тарелки — углеводы', sub: 'крупы, картофель, бобовые' },
                ].map(item => (
                  <div key={item.label} className="flex items-start gap-2">
                    <span className="shrink-0 w-2 h-2 rounded-full mt-1" style={{ background: item.color }} />
                    <div>
                      <p className="text-xs font-medium">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{item.sub}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="inga-card mb-4">
            <p className="text-sm font-semibold mb-2">Как собрать тарелку</p>
            <div className="space-y-2">
              {[
                'Половину тарелки заполните клетчаткой — салаты из свежих овощей и зелени, грибы, квашеная капуста',
                'Четверть — нежирным белком: грудка курицы или индейки, рыба, морепродукты, творог 0%',
                'Четверть — сложными углеводами: крупы, макароны из твёрдых сортов, тушёные овощи, картофель, бобовые',
              ].map((s, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-primary mt-1.5" />
                  <span className="text-xs text-muted-foreground leading-relaxed">{s}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="inga-card mb-8">
            <p className="text-sm text-muted-foreground leading-relaxed">
              В качестве заправки для салата — пшик масла или греческий йогурт 2% с горчицей и специями. После основного приёма пищи — сладкая точка: до 100 г фруктов или ягод.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (section === 'how-to' && nutrientSection === 'Ладонь') {
    return (
      <div className="flex flex-col items-center min-h-screen px-5 py-8 animate-fade-in-up">
        <div className="w-full max-w-md">
          <button onClick={() => setNutrientSection(null)} className="text-base text-muted-foreground mb-6 block">← Назад</button>
          <h2 className="text-2xl font-bold mb-5">Метод ладони</h2>

          <div className="inga-card mb-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Измеряете порции руками — ориентир всегда с вами. Подходит, если часто едите вне дома.
            </p>
          </div>

          <img
            src={palmMethodImage}
            alt="Метод ладони"
            className="w-full rounded-xl mb-4"
            loading="lazy"
          />

          <div className="space-y-3 mb-8">
            {palmMethodCards.map(card => (
              <div key={card.title} className="inga-card">
                <p className="text-sm font-semibold mb-1">{card.title}</p>
                <p className="text-xs text-muted-foreground leading-relaxed mb-2">{card.body}</p>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {card.list.map(item => (
                    <span key={item} className="text-xs px-2 py-0.5 rounded-full border border-border bg-background">{item}</span>
                  ))}
                </div>
                {card.note && (
                  <p className="text-xs text-muted-foreground italic leading-relaxed">{card.note}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (section === 'how-to' && nutrientSection === 'Планирование') {
    return (
      <div className="flex flex-col items-center min-h-screen px-5 py-8 animate-fade-in-up">
        <div className="w-full max-w-md">
          <button onClick={() => setNutrientSection(null)} className="text-base text-muted-foreground mb-6 block">← Назад</button>
          <h2 className="text-2xl font-bold mb-5">Планирование питания</h2>

          <div className="inga-card mb-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Знаете, что сильно помогает не срываться? Планирование еды накануне.
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed mt-2">
              Постарайтесь вечером заранее подумать, что вы будете есть завтра: на завтрак, обед, ужин и перекусы. Так вы не останетесь один на один с голодом и случайной едой.
            </p>
          </div>

          <div className="inga-card mb-4">
            <p className="text-sm font-semibold mb-2">Как планировать</p>
            <p className="text-sm text-muted-foreground leading-relaxed mb-2">
              Запланируйте, что у вас будет источником:
            </p>
            <div className="space-y-1 mb-3">
              {['нежирного белка', 'клетчатки', 'сложных углеводов'].map(s => (
                <div key={s} className="flex gap-2 items-center">
                  <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-primary" />
                  <span className="text-xs text-muted-foreground">{s}</span>
                </div>
              ))}
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              И что вы будете есть на сладкую точку.
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed mt-2">
              Не нужно расписывать детально. Достаточно набросать основу — так завтра будет проще держать ритм.
            </p>
          </div>

          <div className="inga-card mb-4">
            <p className="text-sm font-semibold mb-2">Идеальный холодильник</p>
            <p className="text-sm text-muted-foreground leading-relaxed mb-2">
              Идеально, если в вашем холодильнике всегда будут под рукой продукты, из которых вы сможете быстро собрать тарелку:
            </p>
            <div className="space-y-1">
              {[
                'Замороженое филе рыбы',
                'Замаринованная грудка курицы или индейки',
                'Творог или греческий йогурт 0–2%',
                'Консервированный тунец',
                'Листья салата и овощи',
                'Консервированный горошек, кукуруза, фасоль — в качестве углеводов',
              ].map(s => (
                <div key={s} className="flex gap-2 items-start">
                  <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-primary mt-1.5" />
                  <span className="text-xs text-muted-foreground leading-relaxed">{s}</span>
                </div>
              ))}
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed mt-3 italic">
              Если вы любите сладкое, можете сварить пектиновое варенье на 2–3 дня вперёд.
            </p>
          </div>

          <div className="rounded-xl bg-primary/5 border border-primary/20 p-4 mb-8">
            <p className="text-xs font-medium">Цель планирования: всегда иметь возможность поесть сытно и не довести себя до голода, если приготовленная еда внезапно закончилась.</p>
          </div>
        </div>
      </div>
    );
  }

  if (section === 'how-to' && nutrientSection === 'Сладкая') {
    return (
      <div className="flex flex-col items-center min-h-screen px-5 py-8 animate-fade-in-up">
        <div className="w-full max-w-md">
          <button onClick={() => setNutrientSection(null)} className="text-base text-muted-foreground mb-6 block">← Назад</button>
          <h2 className="text-2xl font-bold mb-5">Сладкая точка</h2>

          <div className="inga-card mb-4" style={{ background: '#FFF4EE', border: '1px solid #FF6200' }}>
            <p className="text-sm font-semibold" style={{ color: '#FF6200' }}>Сладкое не запрещено — оно запланировано.</p>
            <p className="text-sm mt-1" style={{ color: '#7A3A00' }}>Это один из главных принципов метода.</p>
          </div>

          <div className="inga-card mb-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              После каждого приёма пищи, кроме последнего — сладкая точка, если вы любите сладкое.
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed mt-2">
              До 100 г фруктов или ягод, или низкокалорийный десерт из базы рецептов (до 100 ккал на 100 г).
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed mt-2">
              Когда сладкое есть в рационе каждый день, вы спокойно проходите мимо тортов и конфет. Нет запрета — нет срыва.
            </p>
          </div>

          <div className="inga-card mb-4">
            <p className="text-sm font-semibold mb-2">Важно</p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Сладкая точка — до 100 г, и только после полноценного приёма пищи.
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed mt-2">
              Если у вас перекус, вместе с десертом съешьте 60–100 г белкового продукта — например, творог или греческий йогурт 0–2%. А в качестве клетчатки можно добавить чайную ложку яблочной клетчатки в творог.
            </p>
          </div>

          <div className="inga-card mb-8">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Рецепты низкокалорийных десертов вы найдёте в разделе «Рецепты».
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (section === 'how-to' && nutrientSection === 'Вечерний') {
    return (
      <div className="flex flex-col items-center min-h-screen px-5 py-8 animate-fade-in-up">
        <div className="w-full max-w-md">
          <button onClick={() => setNutrientSection(null)} className="text-base text-muted-foreground mb-6 block">← Назад</button>
          <h2 className="text-2xl font-bold mb-5">Вечерний перекус</h2>

          <div className="inga-card mb-4" style={{ background: '#F4F0F9', border: '1px solid #C9B8E8' }}>
            <p className="text-sm font-semibold" style={{ color: '#4A3570' }}>Самое большое заблуждение: хочешь похудеть — не ешь после шести вечера.</p>
            <p className="text-sm mt-2" style={{ color: '#4A3570' }}>Но ведь после шести большинство возвращается с работы — неужели голодать до утра? Мы договорились не падать в голодные ямы, и вечер — не исключение.</p>
          </div>

          <div className="inga-card mb-4">
            <p className="text-sm font-semibold mb-2">Ужин — такой же приём пищи, как и остальные</p>
            <div className="space-y-1">
              {['60–100 г нежирного белка', '60–100 г сложных углеводов', '100–150 г клетчатки'].map(s => (
                <div key={s} className="flex gap-2 items-center">
                  <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-primary" />
                  <span className="text-xs text-muted-foreground">{s}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="inga-card mb-4">
            <p className="text-sm font-semibold mb-2">Метаболическая точка — особенный последний приём</p>
            <p className="text-sm text-muted-foreground leading-relaxed mb-3">
              Делается в течение 2 часов перед сном. Хоть за 5 минут до сна.
            </p>
            <p className="text-sm font-medium mb-1">Что есть:</p>
            <p className="text-sm text-muted-foreground leading-relaxed mb-3">
              60–100 г нежирного белка (куриная грудка или белковый омлет) + 60–100 г клетчатки (свежие овощи). Без масла, без углеводов, без жира.
            </p>
            <p className="text-sm font-medium mb-2">Зачем это нужно:</p>
            <div className="space-y-1 mb-3">
              {[
                'Подавляет вечерний аппетит и убирает «ночной дожор»',
                'Запускает метаболизм во время сна',
                'Снижает вечерние инсулиновые пики',
                'Улучшает сон',
              ].map(s => (
                <div key={s} className="flex gap-2 items-center">
                  <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-primary" />
                  <span className="text-xs text-muted-foreground">{s}</span>
                </div>
              ))}
            </div>
            <p className="text-sm font-medium mb-1">Примеры:</p>
            <div className="space-y-1">
              {[
                'Куриная грудка + болгарский перец или сырая морковь',
                'Белковый омлет + грибы',
                'Грудка индейки + листья салата',
              ].map(s => (
                <div key={s} className="flex gap-2 items-center">
                  <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-primary" />
                  <span className="text-xs text-muted-foreground">{s}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="inga-card mb-4">
            <p className="text-sm text-muted-foreground leading-relaxed italic">
              Желательно не есть перед сном творог, рыбу, морепродукты, квашеную капусту и солёные продукты — возможны отёки.
            </p>
          </div>

          <div className="rounded-xl bg-primary/5 border border-primary/20 p-4 mb-8">
            <p className="text-sm font-semibold" style={{ color: '#FF6200' }}>После 18:00 есть можно и нужно — главное, правильно выбирать продукты.</p>
          </div>
        </div>
      </div>
    );
  }

  if (section === 'how-to' && nutrientSection === 'Метод') {
    return (
      <div className="flex flex-col items-center min-h-screen px-5 py-8 animate-fade-in-up">
        <div className="w-full max-w-md">
          <button onClick={() => setNutrientSection(null)} className="text-base text-muted-foreground mb-6 block">← Назад</button>
          <h2 className="text-2xl font-bold mb-5">Метод «Лёгкая замена»</h2>

          <div className="inga-card mb-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Лишний вес — это всегда перебор с калориями. У каждого человека есть основной обмен веществ — количество энергии, которая нужна организму для жизни. Эта энергия измеряется в калориях.
            </p>
            <div className="mt-3 space-y-1">
              {[
                'Поступает больше калорий, чем нужно → избыток откладывается в жир',
                'Поступает ровно столько, сколько нужно → вес стоит',
                'Поступает меньше, чем тратите → вес уходит',
              ].map(s => (
                <div key={s} className="flex gap-2 items-center">
                  <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-primary" />
                  <span className="text-xs text-muted-foreground">{s}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="inga-card mb-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Как создать дефицит калорий так, чтобы через неделю не сорваться? Если лишить себя всего вкусного и ходить с постоянным чувством голода, малейший стресс — и срыв неизбежен.
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed mt-2">
              Весь секрет в том, чтобы не голодать и не лишать себя любимых блюд. Вы любите сладкое? Выбирайте 2–3 любимых низкокалорийных десерта и ешьте каждый день. Фрукты — можно. Каши — можно. Есть лайфхаки, как снизить калорийность каш в 2–3 раза. Вы едите 4–6 раз в день и всегда чувствуете сытость.
            </p>
          </div>

          <div className="inga-card mb-4">
            <p className="text-sm font-semibold mb-3">Суть метода</p>
            <p className="text-sm text-muted-foreground leading-relaxed mb-3">
              Вы не отказываетесь от любимых блюд, а делаете их легче по калориям. Придерживаться такой системы легко.
            </p>
            <div className="space-y-2">
              {[
                'Сметану или жирный соус заменяем на греческий йогурт 2% с горчицей, кетчупом и любимыми специями',
                'Голени и бёдра птицы — на грудку',
                'Жареная картошка остаётся в рационе: выбираем молодой картофель (в нём в 2 раза меньше калорий), добавляем побольше грибов и жарим на пшиках масла',
                'Вместо бутылки масла — распылитель',
                'В классической шарлотке 300 ккал, в лёгкой — 120',
              ].map(s => (
                <div key={s} className="flex gap-2 items-start">
                  <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-primary mt-1.5" />
                  <span className="text-xs text-muted-foreground leading-relaxed">{s}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 rounded-xl bg-primary/5 border border-primary/20 p-3">
              <p className="text-xs font-medium">Та же еда, но в 2–3 раза меньше калорий. Нет запретов — нет срывов.</p>
            </div>
          </div>

          <p className="text-sm font-semibold mb-3">Работа с весом — 3 этапа</p>

          <div className="inga-card mb-3">
            <p className="text-sm font-semibold mb-2">1. Активное снижение веса</p>
            <p className="text-sm text-muted-foreground leading-relaxed mb-2">
              Создаём дефицит калорий 25–30% от основного обмена. Можно ничего не считать, главное — соблюдать принцип в каждый приём пищи:
            </p>
            <div className="space-y-1 mb-3">
              {[
                '60–100 г белковых продуктов',
                '60–100 г сложных углеводов',
                '100–150 г клетчатки',
                'до 100 г — Сладкая точка (десерт до 100 ккал/100 г)',
                'объём всей пищи с напитком — не более 500 г',
              ].map(s => (
                <div key={s} className="flex gap-2 items-center">
                  <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-primary" />
                  <span className="text-xs text-muted-foreground">{s}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Едим 4–6 раз в день, каждые 3–4 часа. Не допускаем чувства голода, едим на опережение.
            </p>
            <div className="mt-2 rounded-xl bg-muted/50 p-3">
              <p className="text-xs text-muted-foreground">На этом этапе уходят 3–6 кг в месяц. Может и больше, если есть отёки.</p>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed mt-2">
              Если к вечеру разгорается аппетит — ешьте на ночь: 60–100 г белкового продукта + 60–100 г клетчатки, без жира и углеводов.
            </p>
          </div>

          <div className="inga-card mb-3">
            <p className="text-sm font-semibold mb-2">2. Фиксация веса</p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Когда вы достигли целевого веса, нельзя резко выходить из дефицита. Постепенно увеличиваем калорийность на 200 ккал в неделю, пока не дойдём до равновесной калорийности — того количества калорий, при котором ваш вес стоит на месте. Продолжаем взвешиваться и следить за весом.
            </p>
          </div>

          <div className="inga-card mb-8">
            <p className="text-sm font-semibold mb-2">3. Сохранение веса</p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Главная привычка на всю жизнь: каждое утро вставать на весы. Если вес приближается к верхней границе — сразу возвращаемся к «Лёгкой замене». Один-два дня, и вес в норме.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (section === 'how-to' && nutrientSection === 'Объём') {
    return (
      <div className="flex flex-col items-center min-h-screen px-5 py-8 animate-fade-in-up">
        <div className="w-full max-w-md">
          <button onClick={() => setNutrientSection(null)} className="text-base text-muted-foreground mb-6 block">← Назад</button>
          <h2 className="text-2xl font-bold mb-5">Объём еды</h2>

          <div className="inga-card mb-4" style={{ background: '#FFF4EE', border: '1px solid #FF6200' }}>
            <p className="text-sm font-semibold" style={{ color: '#FF6200' }}>Голод — главный враг похудения. Именно он приводит к срывам.</p>
            <p className="text-sm mt-1" style={{ color: '#7A3A00' }}>Ваша задача — не падать в голодные ямы.</p>
          </div>

          <div className="inga-card mb-4">
            <p className="text-sm font-semibold mb-2">Режим питания</p>
            <div className="space-y-2">
              {[
                'Ешьте 4–6 раз в день, каждые 3–4 часа',
                'Даже если через 4 часа есть не хочется — сделайте небольшой перекус',
                'Пропускать приёмы пищи нельзя',
                'Завтракать обязательно — в течение 2 часов после пробуждения',
              ].map(s => (
                <div key={s} className="flex gap-2 items-start">
                  <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-primary mt-1.5" />
                  <span className="text-xs text-muted-foreground leading-relaxed">{s}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="inga-card mb-4">
            <p className="text-sm font-semibold mb-2">Объём одного приёма пищи — до 500 г вместе с напитком</p>
            <div className="space-y-1 mb-2">
              {[
                '300 г еды + 200 мл чая или кофе',
                '400 г еды + 100 мл напитка',
              ].map(s => (
                <div key={s} className="flex gap-2 items-center">
                  <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-primary" />
                  <span className="text-xs text-muted-foreground">{s}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed italic">
              Это помогает контролировать переедание и постепенно уменьшает растянутый желудок.
            </p>
          </div>

          <div className="inga-card mb-4">
            <p className="text-sm font-semibold mb-3">Как собрать тарелку без подсчёта калорий</p>
            <p className="text-sm font-medium mb-1">Метод тарелки</p>
            <p className="text-xs text-muted-foreground leading-relaxed mb-3">
              Половину тарелки заполняем клетчаткой (салаты из свежих овощей и зелени с пшиком масла или греческим йогуртом в качестве заправки, грибы, квашеная капуста), четверть — нежирным белковым продуктом, четверть — сложными углеводами (крупы, макароны, тушёные овощи, картофель, бобовые).
            </p>
            <p className="text-sm font-medium mb-1">Метод ладони</p>
            <div className="space-y-1">
              {[
                'Белок — с ладонь без пальцев',
                'Углеводы — горсть (ладонь лодочкой)',
                'Клетчатка — два кулачка',
              ].map(s => (
                <div key={s} className="flex gap-2 items-center">
                  <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-primary" />
                  <span className="text-xs text-muted-foreground">{s}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="inga-card mb-8">
            <p className="text-sm font-semibold mb-2">Если предпочитаете взвешивать</p>
            <div className="space-y-1">
              {[
                '60–100 г белка',
                '60–100 г сложных углеводов',
                '100–150 г клетчатки',
              ].map(s => (
                <div key={s} className="flex gap-2 items-center">
                  <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-primary" />
                  <span className="text-xs text-muted-foreground">{s}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 rounded-xl bg-primary/5 border border-primary/20 p-3">
              <p className="text-xs font-medium">Вы едите много по объёму, но мало по калориям — именно в этом секрет метода.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (section === 'how-to' && nutrientSection === 'Белок') {
    return (
      <div className="flex flex-col items-center min-h-screen px-5 py-8 animate-fade-in-up">
        <div className="w-full max-w-md">
          <button onClick={() => setNutrientSection(null)} className="text-base text-muted-foreground mb-6 block">← Назад</button>
          <div className="flex items-center gap-3 mb-5">
            <span style={{ fontSize: 28 }}>🥩</span>
            <h2 className="text-2xl font-bold">Белок</h2>
          </div>

          {/* Hook */}
          <div className="inga-card mb-4" style={{ background: '#FFF4EE', border: '1px solid #FF6200' }}>
            <p className="text-sm leading-relaxed" style={{ color: '#7A3A00' }}>
              Лене и Даше по 40. Вес одинаковый, телосложение похоже. Но Лена выглядит молодо и подтянуто, а у Даши — дряблый живот и усталый вид.
            </p>
            <p className="text-sm font-semibold mt-2" style={{ color: '#FF6200' }}>В чём разница? В белке.</p>
          </div>

          {/* Why protein matters */}
          <div className="inga-card mb-4">
            <p className="text-sm font-semibold mb-2">Зачем нужен белок</p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Слово «протеин» с греческого — «первый», «важнейший». Белок — это основной строительный материал для мышц, кожи, волос, ногтей, ферментов, гормонов, иммунных клеток.
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed mt-2">
              В организме нет запасов белка — он должен поступать с едой каждый день. Если белка не хватает, тело берёт его из мышц. Вес уходит, но уходит не жир.
            </p>
          </div>

          {/* How much */}
          <div className="inga-card mb-4">
            <p className="text-sm font-semibold mb-2">Сколько нужно</p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Для снижения веса — минимум 1,2–1,5 г белка на 1 кг желаемого веса. Если хотите весить 60 кг: 60 × 1,5 = <span className="font-medium text-foreground">90 г белка в день</span>.
            </p>
            <div className="mt-3 rounded-xl bg-primary/5 border border-primary/20 p-3">
              <p className="text-xs text-muted-foreground">Не нужно считать граммы. Просто ешьте богатую белком еду 4–6 раз в день, по 60–100 г за раз — и норма наберётся сама. Если на глаз — это ¼ тарелки диаметром 20–22 см или ваша ладонь без пальцев.</p>
            </div>
          </div>

          {/* Daily plan */}
          <div className="inga-card mb-4">
            <p className="text-sm font-semibold mb-1">Спрашивайте себя перед каждым приёмом пищи: «Где мой протеин?»</p>
            <p className="text-xs text-muted-foreground mb-3">Вот подсказки, как обогатить свой рацион белком:</p>
            <div className="space-y-2">
              {[
                { time: 'Завтрак', examples: 'Омлет из белков, творог, греческий йогурт' },
                { time: 'Обед', examples: 'Курица, рыба, нежирное мясо' },
                { time: 'Перекус', examples: 'Высокобелковый творожок' },
                { time: 'Ужин', examples: 'Грудка, рыба, субпродукты' },
              ].map(item => (
                <div key={item.time} className="flex gap-3 items-start">
                  <span className="text-xs font-medium text-primary shrink-0 mt-0.5 w-16">{item.time}</span>
                  <span className="text-xs text-muted-foreground">{item.examples}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Sources */}
          <div className="inga-card mb-4">
            <p className="text-sm font-semibold mb-2">Лучшие источники во время похудения</p>
            <p className="text-xs text-muted-foreground mb-2">Выбирайте нежирный белок — примерно до 130–150 ккал на 100 г:</p>
            <div className="flex flex-wrap gap-1.5">
              {['Грудка курицы/индейки','Нежирная телятина','Нежирные сорта рыбы: минтай, треска, тунец, окунь','Морепродукты','Яичный белок','Творог 0%','Субпродукты'].map(s => (
                <span key={s} className="text-xs px-2.5 py-1 rounded-full border border-border bg-background">{s}</span>
              ))}
            </div>
            <div className="mt-3 rounded-xl bg-muted/50 p-3 space-y-1">
              <p className="text-xs font-medium">Важно помнить:</p>
              <p className="text-xs text-muted-foreground leading-relaxed">Крупы и бобовые относим к углеводам — в них 9 г белка и 20 г углеводов.</p>
              <p className="text-xs text-muted-foreground leading-relaxed">Сыр — к жирам, на этапе снижения веса лучше заменить на творог.</p>
            </div>
          </div>

          {/* Deficit signs */}
          <div className="inga-card mb-4">
            <p className="text-sm font-semibold mb-2">Признаки дефицита белка</p>
            <div className="space-y-1">
              {['Сухость и дряблость кожи','Выпадение волос и ломкость ногтей','Отёчность','Синяки под глазами','Медленное заживление ран','Усталость и снижение иммунитета'].map(s => (
                <div key={s} className="flex gap-2 items-center">
                  <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-primary" />
                  <span className="text-xs text-muted-foreground">{s}</span>
                </div>
              ))}
            </div>
          </div>

          {/* CTA */}
          <div className="rounded-xl bg-primary/5 border border-primary/20 p-4 mb-4">
            <p className="text-sm font-semibold mb-1" style={{ color: '#FF6200' }}>Куриная грудка не отложится в жир, даже если съесть её ночью.</p>
            <p className="text-xs text-muted-foreground leading-relaxed">На переваривание белка организм тратит больше энергии, чем на переваривание углеводов и жиров. Белок даёт сытость, сохраняет мышцы и помогает терять именно жир.</p>
          </div>

          <div className="inga-card mb-8">
            <p className="text-sm text-muted-foreground leading-relaxed">
              И главное — белок можно получать не только из обычных продуктов, но и из ПП-сладостей! Меренговый рулет, ПП-зефир и ПП-мармелад — отличные варианты. Загляните в раздел с рецептами!
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed mt-2">
              Так вы худеете без голода, с удовольствием и при этом не теряете мышцы.
            </p>
          </div>
        </div>
      </div>
    );
  }


  if (section === 'how-to' && nutrientSection === 'Углеводы') {
    return (
      <div className="flex flex-col items-center min-h-screen px-5 py-8 animate-fade-in-up">
        <div className="w-full max-w-md">
          <button onClick={() => setNutrientSection(null)} className="text-base text-muted-foreground mb-6 block">← Назад</button>
          <div className="flex items-center gap-3 mb-5">
            <span style={{ fontSize: 28 }}>🌾</span>
            <h2 className="text-2xl font-bold">Углеводы</h2>
          </div>

          <div className="inga-card mb-4" style={{ background: '#FAF4E5', border: '1px solid #C49A3E' }}>
            <p className="text-sm leading-relaxed" style={{ color: '#7A5A00' }}>
              Марина ест «правильно»: каша на завтрак, суп с лапшой и хлебом в обед, макароны на ужин. Но не может понять, почему у неё постоянно отёки и растёт вес.
            </p>
            <p className="text-sm font-semibold mt-2" style={{ color: '#C49A3E' }}>В чём проблема? Углеводов слишком много — и все они быстрые.</p>
          </div>

          <div className="inga-card mb-4">
            <p className="text-sm font-semibold mb-2">Углеводы — это энергия, а не враг</p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Мы не отказываемся от углеводов — они дают организму энергию. Но углеводы бывают разные, и это меняет всё.
            </p>
          </div>

          <div className="inga-card mb-4">
            <p className="text-sm font-semibold mb-2">Простые углеводы</p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Быстро всасываются в кровь — никакой химической обработки не нужно. Сахар, мёд, выпечка из белой муки. После них глюкоза в крови резко скачет вверх.
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed mt-2">
              Поджелудочная железа выбрасывает инсулин — «ключик», который открывает клетку и пускает глюкозу внутрь. Но если клетка перестаёт реагировать на инсулин — глюкоза не попадает в клетку и превращается в жир. Это называется инсулинорезистентность.
            </p>
          </div>

          <div className="inga-card mb-4">
            <p className="text-sm font-semibold mb-2">Сложные углеводы</p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Крупы, овощи, бобовые. Организм расщепляет их медленно — глюкоза поступает плавно, инсулин в норме, сытость держится долго.
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed mt-2">
              Важный нюанс: приготовленные овощи — это уже углевод. Условное правило: сырые овощи и те, что были в кипятке до 1 минуты — клетчатка. Более 1 минуты — углевод.
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed mt-2">
              Фрукты тоже относим к углеводам — в них больше сахара, чем клетчатки.
            </p>
          </div>

          <div className="inga-card mb-4">
            <p className="text-sm font-semibold mb-2">Выбирайте цельные продукты</p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              В цельнозерновых крупах — витамины группы Б, магний, селен, фосфор, клетчатка. В шлифованном зерне (например, белый рис) всё ценное теряется при обработке.
            </p>
          </div>

          <div className="inga-card mb-8">
            <p className="text-sm font-semibold mb-2">Сколько нужно</p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              60–100 г сложных углеводов в каждый приём пищи — но не на ночь.
            </p>
            <div className="mt-3 rounded-xl bg-primary/5 border border-primary/20 p-3">
              <p className="text-xs text-muted-foreground">Если на глаз — это ¼ тарелки диаметром 20–22 см или горсть вашей ладони.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (section === 'how-to' && nutrientSection === 'Клетчатка') {
    return (
      <div className="flex flex-col items-center min-h-screen px-5 py-8 animate-fade-in-up">
        <div className="w-full max-w-md">
          <button onClick={() => setNutrientSection(null)} className="text-base text-muted-foreground mb-6 block">← Назад</button>
          <div className="flex items-center gap-3 mb-5">
            <span style={{ fontSize: 28 }}>🥦</span>
            <h2 className="text-2xl font-bold">Клетчатка</h2>
          </div>

          <div className="inga-card mb-4" style={{ background: '#EDF5F0', border: '1px solid #5E9E72' }}>
            <p className="text-sm leading-relaxed" style={{ color: '#1E5A30' }}>
              Клетчатка — это щётка для кишечника и еда для ваших полезных бактерий одновременно. Чем больше её в рационе, тем лучше работает всё остальное.
            </p>
            <p className="text-sm font-semibold mt-2" style={{ color: '#5E9E72' }}>
              Большинство людей едят 10–15 г клетчатки в день при норме 30–50 г. Это вдвое меньше минимума. И именно поэтому мы часто голодны, у нас отёки и запоры.
            </p>
          </div>

          <div className="inga-card mb-4">
            <p className="text-sm font-semibold mb-2">Что такое клетчатка</p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Все свежие овощи, грибы в любом виде, бобовые, цельнозерновые крупы, квашеная капуста, свекла.
            </p>
            <div className="mt-3 rounded-xl bg-muted/50 p-3">
              <p className="text-xs text-muted-foreground leading-relaxed">
                <span className="font-medium">Нюанс со свеклой:</span> до 18:00 относим её к клетчатке, после 18:00 — к углеводам. В свекле много пектина (растворимой клетчатки), но она содержит и углеводы.
              </p>
            </div>
          </div>

          <div className="inga-card mb-4">
            <p className="text-sm font-semibold mb-3">Что делает клетчатка</p>
            <div className="space-y-2">
              {[
                'Замедляет усвоение еды — глюкоза не скачет',
                'Снижает уровень холестерина',
                'Выводит токсины, желчные кислоты, продукты обмена',
                'Предотвращает запоры — удерживает влагу и улучшает моторику',
                'Даёт чувство сытости — увеличивает объём пищи',
                'Выводит лишнюю воду и натрий из организма',
                'Снижает риск онкологических заболеваний кишечника',
              ].map(s => (
                <div key={s} className="flex gap-2 items-center">
                  <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-[#5E9E72]" />
                  <span className="text-xs text-muted-foreground">{s}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="inga-card mb-4">
            <p className="text-sm font-semibold mb-2">Сколько нужно</p>
            <p className="text-sm text-muted-foreground">30–50 г клетчатки в день.</p>
          </div>

          <div className="inga-card mb-8">
            <p className="text-sm font-semibold mb-2">Как набрать норму</p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              В каждый приём пищи добавляйте 100–150 г продуктов, богатых клетчаткой. На десерт — 100 г фруктов. Клетчатку можно добавлять в выпечку, отруби — в котлеты, отрубные шарики есть с супом вместо сухарей.
            </p>
            <div className="mt-3 rounded-xl bg-muted/50 p-3">
              <p className="text-xs text-muted-foreground leading-relaxed italic">
                Если раньше вы ели мало клетчатки — увеличивайте количество постепенно. Иначе организм может отреагировать вздутием и запорами.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (section === 'how-to' && nutrientSection === 'Жиры') {
    return (
      <div className="flex flex-col items-center min-h-screen px-5 py-8 animate-fade-in-up">
        <div className="w-full max-w-md">
          <button onClick={() => setNutrientSection(null)} className="text-base text-muted-foreground mb-6 block">← Назад</button>
          <div className="flex items-center gap-3 mb-5">
            <span style={{ fontSize: 28 }}>🫒</span>
            <h2 className="text-2xl font-bold">Жиры</h2>
          </div>

          <div className="inga-card mb-4" style={{ background: '#EEF2FF', border: '1px solid #6B7FCC' }}>
            <p className="text-sm leading-relaxed" style={{ color: '#2A3A7A' }}>
              Масло, орехи, авокадо, сыр — всё это полезно. Но 1 г жира = 9 ккал, тогда как 1 г белка или углеводов = 4 ккал.
            </p>
            <p className="text-sm font-semibold mt-2" style={{ color: '#6B7FCC' }}>Жиры не враги — просто на этапе похудения они главный рычаг экономии калорий.</p>
          </div>

          <div className="inga-card mb-4">
            <p className="text-sm font-semibold mb-3">Почему жиры — главный фокус при похудении</p>
            <div className="space-y-1 mb-3">
              {[
                { label: '1 г белка', val: '4 ккал' },
                { label: '1 г углеводов', val: '4 ккал' },
                { label: '1 г жира', val: '9 ккал' },
              ].map(row => (
                <div key={row.label} className="flex gap-3 text-xs">
                  <span className="text-muted-foreground">{row.label}</span>
                  <span className="font-medium">{row.val}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Снижая жиры, вы экономите калории в 2,25 раза эффективнее, чем сокращая белки или углеводы. Это главный рычаг на этапе активного жиросжигания.
            </p>
          </div>

          <div className="inga-card mb-4">
            <p className="text-sm font-semibold mb-3">Но исключать жиры полностью — опасно</p>
            <div className="space-y-2 mb-3">
              {[
                'Строят клеточные мембраны',
                'Участвуют в синтезе гормонов, включая половые',
                'Помогают усваивать витамины A, D, E, K',
                'Поддерживают здоровый желчеотток',
              ].map(s => (
                <div key={s} className="flex gap-2 items-center">
                  <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-[#6B7FCC]" />
                  <span className="text-xs text-muted-foreground">{s}</span>
                </div>
              ))}
            </div>
            <div className="rounded-xl bg-primary/5 border border-primary/20 p-3">
              <p className="text-xs text-muted-foreground">Наш компромисс: оставляем минимум 10–20 г жира в день и поддерживаем организм Омега-3 и мультивитаминами.</p>
            </div>
          </div>

          <div className="inga-card mb-4">
            <p className="text-sm font-semibold mb-3">3 простых шага, чтобы сократить жиры</p>
            <div className="space-y-3">
              <div>
                <p className="text-xs font-medium mb-0.5">1. Распылитель вместо бутылки</p>
                <p className="text-xs text-muted-foreground leading-relaxed">Пшикайте масло на сковороду и в салаты. Эффект тот же, калорий минимум.</p>
              </div>
              <div>
                <p className="text-xs font-medium mb-0.5">2. Нежирные альтернативы</p>
                <p className="text-xs text-muted-foreground leading-relaxed">Куриную ножку заменяем на грудку, жирную рыбу на треску/хек/минтай/горбушу, сметану на греческий йогурт 2%, творог выбираем 0%.</p>
              </div>
              <div>
                <p className="text-xs font-medium mb-0.5">3. Временное табу на калорийные бомбы</p>
                <p className="text-xs text-muted-foreground leading-relaxed">На период активного снижения веса убираем: авокадо, жирные сыры, сало, орехи, яичные желтки. Это не навсегда — на этапе фиксации вы вернёте их в рацион.</p>
              </div>
            </div>
          </div>

          <div className="inga-card mb-8">
            <p className="text-sm font-semibold mb-2">Подумайте прямо сейчас</p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Как снизить калорийность ваших любимых блюд? Использовать распылитель для масла, подобрать альтернативу жирным ингредиентам, добавить больше овощей.
            </p>
            <div className="mt-3 rounded-xl bg-muted/50 p-3">
              <p className="text-xs text-muted-foreground leading-relaxed italic">
                На этапе активного снижения веса мы сознательно сводим жиры к минимуму. Их время придёт на этапе фиксации, когда будем плавно увеличивать калорийность рациона.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (section === 'how-to') {
    return (
      <div className="flex flex-col items-center min-h-screen px-5 py-8 animate-fade-in-up">
        <div className="w-full max-w-md">
          <BackButton />
          <h2 className="text-2xl font-bold mb-6">Как похудеть</h2>
          <div className="space-y-2.5">
            {effectiveTopics.map((topic, idx) => (
              <React.Fragment key={topic.title}>
                {((topic as any).isFixation) && (
                  <div className="border-t border-border my-1" />
                )}
              {((topic as any).isMethodLesson || (topic as any).isVolumeLesson || (topic as any).isSweetLesson || (topic as any).isEveningLesson || (topic as any).isPlanningLesson) ? (
                <div
                  className="inga-card cursor-pointer flex items-center justify-between"
                  onClick={() => {
                    if ((topic as any).isMethodLesson) setNutrientSection('Метод');
                    else if ((topic as any).isVolumeLesson) setNutrientSection('Объём');
                    else if ((topic as any).isSweetLesson) setNutrientSection('Сладкая');
                    else if ((topic as any).isEveningLesson) setNutrientSection('Вечерний');
                    else if ((topic as any).isPlanningLesson) setNutrientSection('Планирование');
                  }}
                >
                  <span className="font-semibold">{topic.title}</span>
                  <ChevronRight size={18} className="text-muted-foreground" />
                </div>
              ) : (
              <details className="inga-card group">
                <summary className="font-semibold cursor-pointer flex items-center justify-between list-none">
                  <div>
                    <span>{topic.title}</span>
                    {((topic as any).isFixation || (topic as any).isMaintenance) && (
                      <p className="text-xs text-muted-foreground font-normal mt-0.5">
                        {(topic as any).isFixation ? 'Постепенно выйти из дефицита калорий 🎯' : 'Удержать вес на всю жизнь 🎯'}
                      </p>
                    )}
                  </div>
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
                ) : (topic as any).isNutrientsLesson ? (
                  <div className="mt-3 space-y-2">
                    {[
                      { color: '#FFF4EE', border: '#FF6200', icon: '🥩', title: 'Белок', textColor: '#7A3A00' },
                      { color: '#FAF4E5', border: '#C49A3E', icon: '🌾', title: 'Углеводы', textColor: '#7A5A00' },
                      { color: '#EDF5F0', border: '#5E9E72', icon: '🥦', title: 'Клетчатка', textColor: '#1E5A30' },
                      { color: '#EEF2FF', border: '#6B7FCC', icon: '🫒', title: 'Жиры', textColor: '#2A3A7A' },
                    ].map(item => (
                      <button
                        key={item.title}
                        onClick={() => setNutrientSection(item.title)}
                        style={{ background: item.color, border: `0.5px solid ${item.border}`, borderRadius: 12, padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', cursor: 'pointer' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontSize: 18 }}>{item.icon}</span>
                          <span style={{ fontSize: 14, fontWeight: 500, color: item.textColor }}>{item.title}</span>
                        </div>
                        <ChevronRight size={15} style={{ color: item.border }} />
                      </button>
                    ))}
                  </div>
                ) : (topic as any).isCountingGroup ? (
                  <div className="mt-3 space-y-2">
                    <button className="w-full rounded-xl border border-border p-3.5 flex items-center justify-between" onClick={() => setNutrientSection('Тарелка')}>
                      <div className="flex items-center gap-3">
                        <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <circle cx="11" cy="11" r="9.5" stroke="#888" strokeWidth="1"/>
                          <line x1="11" y1="1.5" x2="11" y2="20.5" stroke="#888" strokeWidth="1"/>
                          <line x1="11" y1="11" x2="20.5" y2="11" stroke="#888" strokeWidth="1"/>
                          <path d="M11 1.5 A9.5 9.5 0 0 0 11 20.5 Z" fill="#EDF5F0"/>
                          <path d="M11 11 L20.5 11 A9.5 9.5 0 0 1 11 20.5 Z" fill="#FFF4EE"/>
                          <path d="M11 1.5 A9.5 9.5 0 0 1 20.5 11 L11 11 Z" fill="#FAF4E5"/>
                        </svg>
                        <span className="text-sm font-medium">Метод тарелки</span>
                      </div>
                      <ChevronRight size={15} className="text-muted-foreground" />
                    </button>
                    <button className="w-full rounded-xl border border-border p-3.5 flex items-center justify-between" onClick={() => setNutrientSection('Ладонь')}>
                      <div className="flex items-center gap-3">
                        <span style={{ fontSize: 20 }}>✋</span>
                        <span className="text-sm font-medium">Метод ладоней</span>
                      </div>
                      <ChevronRight size={15} className="text-muted-foreground" />
                    </button>
                  </div>
                ) : (topic as any).isFixation || (topic as any).isMaintenance ? (
                  <p className="text-sm text-muted-foreground mt-3 leading-relaxed">{topic.content}</p>
                ) : (
                  <p className="text-sm text-muted-foreground mt-3 leading-relaxed">{topic.content}</p>
                )}
              </details>
              )}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (section === 'recipes') {
    const breakfastRecipes = [
      {
        id: 'oatmeal',
        name: 'Нежное утро',
        subtitle: 'Овсянка по-новому',
        kbju: '50.8 / 4 / 0.5 / 7.2',
        image: recipeOatmeal,
        video: 'https://vkvideo.ru/clip-239899185_456239020',
        ingredients: [
          '20 г овсяной крупы долгой варки',
          '100 мл воды',
          '100 г мягкого творога 0%',
          '100 г яблока',
          '1 ч.л. пектина',
          'Щепотка корицы',
          'Сахарозаменитель по вкусу',
        ],
        steps: [
          'Запариваем овсянку на ночь: насыпать 20 г крупы, залить 100 мл воды, прокипятить 2–3 минуты, посолить, переложить в термос, оставить на ночь.',
          'Яблоки нарезать на тонкие дольки и тушить в кастрюле до мягкости. Добавить 1 ч.л. пектина, часто помешивая. Добавить корицу и сахарозаменитель по вкусу.',
          'Если любите сладкое — в творожок можно добавить подсластитель.',
          'Выкладываем слоями: нижний слой — мягкий творог, на творог — овсянку, сверху — яблоки.',
        ],
      },
      {
        id: 'pate',
        name: 'Железная леди',
        subtitle: 'Бутерброды с паштетом из печени',
        kbju: '109.7 / 6.4 / 4.3 / 11.2',
        image: recipePate,
        video: 'https://vkvideo.ru/clip-239899185_456239024',
        ingredients: [
          '100 г паштета из печени',
          '50 г бородинского хлеба',
          '100 г болгарского перца',
          'Для паштета: 500 г куриной печени, 200 мл молока для замачивания, 1 луковица, 1 морковь, 200 мл сливок 10%, 5 г растительного масла',
        ],
        steps: [
          'Промыть печень, залить молоком, убрать в холодильник на 30 мин. Слить молоко, промыть.',
          'Обжарить лук и морковь на пшиках масла.',
          'Добавить печень, тушить до готовности 15 минут.',
          'Добавить сливки, тушить 2–3 минуты.',
          'Переложить в блендер, перемолоть до однородности. Хранить в холодильнике.',
          'Для завтрака: 2 кусочка хлеба по 25 г, намазать паштетом. Есть с болгарским перцем — для усвоения железа нужен витамин С.',
        ],
      },
      {
        id: 'zucchini',
        name: 'Золотые зайчики',
        subtitle: 'Драники из кабачков',
        kbju: '83.2 / 5.9 / 2.2 / 9.6',
        image: recipeZucchini,
        video: 'https://vkvideo.ru/clip-239899185_456239035',
        ingredients: [
          '800 г кабачков',
          '1 яйцо',
          '60 г муки пшеничной цельнозерновой',
          '50 г муки из зелёной гречки',
          'Соль по вкусу',
          '5 г растительного высокоолеинового масла',
        ],
        steps: [
          'Кабачки почистить, натереть на крупной тёрке, отжать сок.',
          'Добавить яйцо, 2 вида муки, соль, перемешать.',
          'Обжарить на пшиках масла.',
          'Для сбалансированной тарелки: 100 г драников + 100 г греческого йогурта 2% или мягкого творога 0%.',
        ],
        note: 'КБЖУ указаны на драники с греческим йогуртом.',
      },
      {
        id: 'bliny',
        name: 'Солнце на тарелке',
        subtitle: 'Блины с мягким творогом и вареньем',
        kbju: '99 / 5.4 / 1.2 / 7.7',
        image: recipeBliny,
        video: 'https://vkvideo.ru/clip-239899185_456239034',
        ingredients: [
          '200 г кефира 1%',
          '1 яйцо',
          '1 яичный белок',
          '70 г пшеничной муки ц/з',
          '2 мерные ложки сахзама FitParad 7',
          'Соль по вкусу',
          '60 мл кипятка',
          '½ ч.л. соды',
          '5 г растительного масла',
        ],
        steps: [
          'Смешать кефир, яйцо, белок, муку, сахарозаменитель, соль.',
          'В 60 мл кипятка развести соду и влить в тесто. Перемешать венчиком.',
          'Выпекать на блинной сковороде на пшиках масла. Получается 5–6 блинчиков.',
          'Для сбалансированной тарелки: 100 г блинов + 100 г мягкого творога 0% + 100 г пектинового варенья.',
        ],
        note: 'КБЖУ указаны на блины с творогом и вареньем.',
      },
      {
        id: 'varenie',
        name: 'Пектиновое варенье',
        subtitle: 'Вкусное — из любых фруктов и ягод',
        kbju: '40 / 0.7 / 0.2 / 7.8',
        image: recipeVarenie,
        video: 'https://vkvideo.ru/clip-239899185_456239036',
        ingredients: [
          '400 г любых ягод или фруктов (можно замороженных)',
          '2 ст.л. пектина',
          '10 мерных ложек сахарозаменителя FitParad 7 или другого по вкусу',
        ],
        steps: [
          'Ягоды можно пробить блендером или сварить целиком.',
          'Положить в кастрюлю, нагреть, засыпать «дождиком» пектин, постоянно помешивая.',
          'Довести до кипения, кипятить на слабом огне 2–3 минуты, постоянно помешивать.',
          'Убрать с огня, добавить сахарозаменитель, размешать.',
          'Варенье станет гуще когда остынет. Идеально для сладкой точки после приёма пищи.',
        ],
        note: 'Пектин — растворимая клетчатка, имеет мягкий слабительный эффект. Очень вкусно получается из клубники, сливы, вишни.',
      },
      {
        id: 'shaurma',
        name: 'Заверните две',
        subtitle: 'ПП-шаурма',
        kbju: '104.2 / 8.7 / 2 / 12.8',
        image: recipeShaurma,
        video: 'https://vkvideo.ru/clip-239899185_456239017',
        ingredients: [
          '60 г лаваша',
          '100 г куриной грудки',
          '50 г капусты белокочанной',
          '50 г болгарского перца',
          '60 г помидора',
          '30 г красного лука',
          'Приправа «Копчёная паприка», соль',
          '5 г растительного масла',
          'Соус: 20 г кетчупа + 20 г греческого йогурта 2%',
        ],
        steps: [
          'Грудку нарезать слайсами, отбить, посыпать паприкой и солью. Обжарить на пшиках масла по 3 мин с каждой стороны.',
          'Отбивные и перец нарезать соломкой. Нашинковать капусту, помидор и лук нарезать.',
          'Смешать ингредиенты для соуса.',
          'Выложить на лаваш слоями: капуста, мясо, лук, соус, помидор, перец. Посолить по вкусу.',
          'Завернуть лаваш, готовить на гриле или на сухой сковороде до хрустящей корочки.',
        ],
      },
      {
        id: 'taco',
        name: 'Такого я не ожидала',
        subtitle: 'ПП-тако',
        kbju: '80 / 10 / 2 / 5.7',
        image: recipeTaco,
        video: 'https://vkvideo.ru/clip-239899185_456239023',
        ingredients: [
          '2 лепёшки (46 г)',
          '160 г копчёно-запечённого филе грудки',
          '250 г шампиньонов',
          '30 г красного лука',
          '120 г помидоров',
          '25 г листьев салата',
          '60 г мягкого творога 0%',
          '25 г кетчупа',
          '5 г растительного масла, соль',
        ],
        steps: [
          'Грибы нарезать, обжарить на пшиках масла до готовности.',
          'Куриное филе, лук, помидоры нарезать.',
          'Приготовить соус: смешать мягкий творог и кетчуп, посолить, добавить приправы.',
          'Смазать лепёшки соусом.',
          'На половину выложить слоями грибы, курицу, лук, помидоры.',
          'Свернуть пополам, запечь в гриле или на сухой сковороде.',
          'В готовые тако вложить листья салата.',
        ],
      },
      {
        id: 'pirozhki',
        name: 'Как настоящие',
        subtitle: 'ПП-пирожки с луком и яйцом',
        kbju: '113.2 / 13.9 / 2.7 / 8',
        image: recipePirozhki,
        video: 'https://vkvideo.ru/clip-239899185_456239018',
        ingredients: [
          '200 г творога высокобелкового 0%',
          '1 сырое яйцо',
          'Белок от 3 варёных яиц',
          '50 г зелёного лука',
          '40 г рисовой муки',
          'Соль по вкусу',
          '5 г растительного высокоолеинового масла',
        ],
        steps: [
          'Творог смешать с сырым яйцом.',
          'Добавить муку, перемешать.',
          'Мелко нарезать варёный яичный белок, добавить в тесто.',
          'Нарезать зелёный лук, добавить в тесто, перемешать. Посолить.',
          'Влажными руками сформировать плоские пирожки, обжарить на пшиках масла с двух сторон.',
        ],
        note: 'На этапе сохранения веса можно добавить яйцо целиком и 80 г сыра моцарелла или «Лёгкий». Но калорийность будет 166 ккал/100 г — только на этапе сохранения.',
      },
    ];

    // Recipe detail screen
    if (activeRecipe) {
      const recipe = breakfastRecipes.find(r => r.id === activeRecipe);
      if (!recipe) return null;
      return (
        <div className="flex flex-col items-center min-h-screen px-5 py-8 animate-fade-in-up">
          <div className="w-full max-w-md">
            <button onClick={() => setActiveRecipe(null)} className="text-base text-muted-foreground mb-4 block">← Назад</button>
            <img src={recipe.image} alt={recipe.name} className="w-full rounded-2xl mb-4 object-cover" style={{ maxHeight: 240 }} />
            <div className="mb-4">
              <h2 className="text-2xl font-bold">{recipe.name}</h2>
              <p className="text-sm text-muted-foreground">{recipe.subtitle}</p>
              <div className="mt-2 inline-block bg-primary/10 text-primary text-xs px-3 py-1 rounded-full font-medium">
                КБЖУ на 100 г: {recipe.kbju}
              </div>
            </div>
            <div className="inga-card mb-3">
              <p className="text-sm font-semibold mb-2">Ингредиенты</p>
              <div className="space-y-1">
                {recipe.ingredients.map(ing => (
                  <div key={ing} className="flex gap-2 items-start">
                    <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-primary mt-1.5" />
                    <span className="text-xs text-muted-foreground leading-relaxed">{ing}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="inga-card mb-3">
              <p className="text-sm font-semibold mb-2">Приготовление</p>
              <div className="space-y-2">
                {recipe.steps.map((step, i) => (
                  <div key={i} className="flex gap-3 items-start">
                    <span className="shrink-0 w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-medium mt-0.5">{i + 1}</span>
                    <span className="text-xs text-muted-foreground leading-relaxed">{step}</span>
                  </div>
                ))}
              </div>
            </div>
            {recipe.note && (
              <div className="inga-card mb-3">
                <p className="text-xs text-muted-foreground leading-relaxed italic">{recipe.note}</p>
              </div>
            )}
            <a
              href={recipe.video}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-2xl py-3.5 font-semibold text-sm mb-8"
            >
              <Play size={16} fill="currentColor" />
              Смотреть видеорецепт
            </a>
          </div>
        </div>
      );
    }

    // Category screen - Завтраки
    if (recipeSection === 'breakfasts') {
      return (
        <div className="flex flex-col items-center min-h-screen px-5 py-8 animate-fade-in-up">
          <div className="w-full max-w-md">
            <button onClick={() => setRecipeSection(null)} className="text-base text-muted-foreground mb-6 block">← Назад</button>
            <h2 className="text-2xl font-bold mb-5">Завтраки</h2>
            <div className="space-y-3">
              {breakfastRecipes.map(recipe => (
                <button
                  key={recipe.id}
                  onClick={() => setActiveRecipe(recipe.id)}
                  className="w-full inga-card flex gap-4 items-center text-left"
                >
                  <img src={recipe.image} alt={recipe.name} className="w-16 h-16 rounded-xl object-cover shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">{recipe.name}</p>
                    <p className="text-xs text-muted-foreground">{recipe.subtitle}</p>
                    <p className="text-xs text-primary mt-1">{recipe.kbju} ккал/б/ж/у</p>
                  </div>
                  <ChevronRight size={16} className="text-muted-foreground shrink-0" />
                </button>
              ))}
            </div>
          </div>
        </div>
      );
    }

    // Main recipes screen
    return (
      <div className="flex flex-col items-center min-h-screen px-5 py-8 animate-fade-in-up">
        <div className="w-full max-w-md">
          <BackButton />
          <h2 className="text-2xl font-bold mb-2">Рецепты</h2>
          <p className="text-sm text-muted-foreground mb-5">Подборки блюд по методу «Лёгкая замена».</p>
          <div className="space-y-2.5">
            {[
              { id: 'breakfasts', icon: '🌅', label: 'Завтраки', count: 8 },
              { id: 'lunches', icon: '🍽️', label: 'Обеды и ужины', count: null },
              { id: 'snacks', icon: '🥗', label: 'Перекусы', count: null },
              { id: 'baking', icon: '🥐', label: 'Несладкая выпечка', count: null },
              { id: 'sweet', icon: '🍓', label: 'Сладкая точка', count: null },
              { id: 'evening', icon: '🌙', label: 'Метаболическая точка', count: null },
            ].map(cat => (
              <button
                key={cat.id}
                onClick={() => cat.id === 'breakfasts' ? setRecipeSection('breakfasts') : undefined}
                className="w-full inga-card flex items-center justify-between"
                style={{ opacity: cat.count ? 1 : 0.5, cursor: cat.count ? 'pointer' : 'default' }}
              >
                <div className="flex items-center gap-3">
                  <span style={{ fontSize: 22 }}>{cat.icon}</span>
                  <div className="text-left">
                    <p className="text-sm font-semibold">{cat.label}</p>
                    {cat.count ? (
                      <p className="text-xs text-muted-foreground">{cat.count} рецепта</p>
                    ) : (
                      <p className="text-xs text-muted-foreground">Скоро появятся</p>
                    )}
                  </div>
                </div>
                <ChevronRight size={16} className="text-muted-foreground" />
              </button>
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


  if (section === 'materials') {
    if (showCheatsheet) {
      return (
        <div className="flex flex-col items-center min-h-screen px-5 py-8 animate-fade-in-up">
          <div className="w-full max-w-md">
            <FoodCheatsheet onBack={() => setShowCheatsheet(false)} />
          </div>
        </div>
      );
    }
    return (
      <div className="flex flex-col items-center min-h-screen px-5 py-8 animate-fade-in-up">
        <div className="w-full max-w-md">
          <BackButton />
          <h2 className="text-2xl font-bold mb-6">Полезные материалы</h2>
          <div className="space-y-2.5">

            <button onClick={() => setShowCheatsheet(true)} className="w-full inga-card text-left">
              <p className="text-sm font-semibold mb-1">📊 Шпаргалка по продуктам</p>
              <p className="text-xs text-muted-foreground leading-relaxed">Калорийность продуктов с цветными индикаторами и поиском. Белки, углеводы, клетчатка, жиры.</p>
            </button>
            <div className="inga-card opacity-60 pointer-events-none">
              <p className="text-sm font-semibold mb-1">📊 Упрощённая таблица калорийности (старая)</p>
              <p className="text-xs text-muted-foreground leading-relaxed mb-3">Калорийность основных продуктов на 100 г — для быстрой ориентации без подсчётов.</p>
              {[
                { cat: 'Белки (нежирные)', items: ['Куриная грудка — 110 ккал', 'Индейка грудка — 115 ккал', 'Треска — 75 ккал', 'Минтай — 70 ккал', 'Тунец (в собственном соку) — 95 ккал', 'Горбуша — 140 ккал', 'Творог 0% — 65 ккал', 'Греческий йогурт 2% — 60 ккал', 'Яичный белок — 45 ккал', 'Кальмар — 75 ккал', 'Креветки — 85 ккал'] },
                { cat: 'Сложные углеводы', items: ['Гречка варёная — 110 ккал', 'Овсянка варёная — 85 ккал', 'Рис бурый варёный — 110 ккал', 'Макароны варёные — 115 ккал', 'Картофель варёный — 75 ккал', 'Чечевица варёная — 110 ккал', 'Нут варёный — 120 ккал'] },
                { cat: 'Клетчатка (овощи)', items: ['Огурец — 15 ккал', 'Помидор — 20 ккал', 'Капуста белокочанная — 25 ккал', 'Перец болгарский — 30 ккал', 'Брокколи — 35 ккал', 'Кабачок — 25 ккал', 'Листья салата — 15 ккал', 'Грибы шампиньоны — 25 ккал', 'Квашеная капуста — 20 ккал'] },
                { cat: 'Фрукты и ягоды', items: ['Яблоко — 45 ккал', 'Клубника — 35 ккал', 'Черника — 45 ккал', 'Арбуз — 30 ккал', 'Апельсин — 45 ккал', 'Банан — 90 ккал', 'Виноград — 65 ккал'] },
              ].map(group => (
                <div key={group.cat} className="mb-3">
                  <p className="text-xs font-semibold text-primary mb-1">{group.cat}</p>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                    {group.items.map(item => (
                      <p key={item} className="text-xs text-muted-foreground">{item}</p>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="inga-card opacity-60">
              <p className="text-sm font-semibold mb-1">📎 Гайды</p>
              <p className="text-xs text-muted-foreground">Скоро появятся полезные материалы для скачивания.</p>
            </div>

          </div>
        </div>
      </div>
    );
  }

  if (section === 'how-to' && nutrientSection === 'Меню30') {
    return (
      <div className="flex flex-col items-center min-h-screen px-5 py-8 animate-fade-in-up">
        <div className="w-full max-w-md">
          <button onClick={() => setNutrientSection(null)} className="text-base text-muted-foreground mb-6 block">← Назад</button>
          <h2 className="text-2xl font-bold mb-2">Примеры меню на 30 дней</h2>
          <p className="text-sm text-muted-foreground mb-6">Примерный рацион по методу «Лёгкая замена». Порции — по методу тарелки или ладони.</p>

          <div className="space-y-3 mb-8">
            {[
              { day: 'День 1', meals: ['Завтрак: омлет из 3 белков + греческий йогурт 0% + яблоко', 'Перекус: творог 0% с ягодами', 'Обед: грудка курицы + гречка + салат из свежих овощей', 'Перекус: кефир 1%', 'Ужин: рыба (треска) + тушёные овощи', 'Метаболическая точка: грудка + огурец'] },
              { day: 'День 2', meals: ['Завтрак: творог 0% с ягодами + кофе', 'Перекус: греческий йогурт 2% + груша', 'Обед: индейка + бурый рис + капустный салат', 'Перекус: кефир + яблоко', 'Ужин: тунец + стручковая фасоль', 'Метаболическая точка: белковый омлет + помидор'] },
              { day: 'День 3', meals: ['Завтрак: белковый омлет с грибами + огурец', 'Перекус: творог 0% + персик', 'Обед: грудка + чечевица + салат с зеленью', 'Перекус: греческий йогурт', 'Ужин: кальмары + брокколи на пару', 'Метаболическая точка: грудка + листья салата'] },
              { day: 'День 4', meals: ['Завтрак: творог 0% с яблоком и корицей', 'Перекус: кефир 1%', 'Обед: говядина постная + гречка + свежий перец', 'Перекус: греческий йогурт + ягоды', 'Ужин: горбуша + огурцы', 'Метаболическая точка: белковый омлет + капуста'] },
              { day: 'День 5', meals: ['Завтрак: омлет из 2 яиц + 1 белок + помидор', 'Перекус: творог 0% + клубника', 'Обед: креветки + бурый рис + квашеная капуста', 'Перекус: кефир + яблоко', 'Ужин: треска + тушёный кабачок', 'Метаболическая точка: грудка индейки + зелень'] },
            ].map(item => (
              <div key={item.day} className="inga-card">
                <p className="text-sm font-semibold mb-2">{item.day}</p>
                <div className="space-y-1">
                  {item.meals.map(meal => (
                    <div key={meal} className="flex gap-2 items-start">
                      <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-primary mt-1.5" />
                      <span className="text-xs text-muted-foreground leading-relaxed">{meal}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <div className="inga-card opacity-60">
              <p className="text-xs text-muted-foreground text-center">Дни 6–30 скоро появятся здесь</p>
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
            <h2 className="text-2xl font-bold">Консультация с нутрициологом</h2>
            <span className="text-[10px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-accent text-accent-foreground">платно</span>
          </div>
          <h3 className="text-base font-semibold mb-3">Индивидуальная консультация</h3>
          <div className="inga-bubble mb-6">
            <p>Иногда полезно разобрать ситуацию глубже — лично, с профессиональным нутрициологом.</p>
            <p className="text-muted-foreground mt-2">Вы можете записаться на индивидуальную консультацию и получить персональный план питания с учётом ваших особенностей, анализов и образа жизни.</p>
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
    return <ProfileSection onBack={() => setSection('main')} />;
  }

  return null;
}

function ProfileSection({ onBack }: { onBack: () => void }) {
  const { profile, calculations, updateProfile, setStep } = useApp();

  // ---------- name ----------
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(profile.name ?? '');

  // ---------- edit field state ----------
  type EditField = null | 'age' | 'height' | 'weight' | 'goal' | 'waist' | 'hips';
  const [editField, setEditField] = useState<EditField>(null);
  const [draft, setDraft] = useState('');

  // ---------- photo & measurements-updated meta (client-side persistence) ----------
  const PHOTO_KEY = 'inga-profile-photo';
  const MEAS_KEY = 'inga-measurements-updated';
  const [photo, setPhoto] = useState<{ dataUrl: string; uploadedAt: string } | null>(() => {
    try { const raw = localStorage.getItem(PHOTO_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
  });
  const [measUpdated, setMeasUpdated] = useState<string | null>(() => {
    try { return localStorage.getItem(MEAS_KEY); } catch { return null; }
  });

  // ---------- sign-out ----------
  const [confirmSignOut, setConfirmSignOut] = useState(false);

  const handleSaveName = () => {
    updateProfile({ name: cleanName(name) });
    setEditingName(false);
  };

  const startEdit = (field: Exclude<EditField, null>, current: number | undefined) => {
    setDraft(current ? String(current) : '');
    setEditField(field);
  };

  const commitEdit = () => {
    if (!editField) return;
    const num = parseFloat(draft.replace(',', '.'));
    if (!Number.isFinite(num) || num <= 0) { setEditField(null); return; }
    const patch: Partial<UserProfile> = {};
    switch (editField) {
      case 'age': patch.age = Math.round(num); break;
      case 'height': patch.height = Math.round(num); break;
      case 'weight':
        patch.weight = num;
        (patch as any).current_weight_kg = num;
        break;
      case 'goal':
        patch.goalWeight = num;
        (patch as any).goal_weight_kg = num;
        break;
      case 'waist':
        patch.waist = num;
        try { const now = new Date().toISOString(); localStorage.setItem(MEAS_KEY, now); setMeasUpdated(now); } catch {}
        break;
      case 'hips':
        patch.hips = num;
        try { const now = new Date().toISOString(); localStorage.setItem(MEAS_KEY, now); setMeasUpdated(now); } catch {}
        break;
    }
    updateProfile(patch);
    setEditField(null);
  };

  const setGender = (g: 'female' | 'male') => {
    if (profile.gender !== g) updateProfile({ gender: g });
  };

  const onPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const data = { dataUrl: String(reader.result), uploadedAt: new Date().toISOString() };
      try { localStorage.setItem(PHOTO_KEY, JSON.stringify(data)); } catch {}
      setPhoto(data);
    };
    reader.readAsDataURL(file);
  };

  const doSignOut = async () => {
    try { const { auth } = await import('@/lib/auth'); await auth.signOut(); } catch {}
    setConfirmSignOut(false);
    setStep('auth');
  };

  // ---------- derived ----------
  const startWeight =
    (profile as any).start_weight_kg ??
    (profile as any).current_weight_kg ??
    profile.weight;
  const currentWeight = profile.weight;
  const goalWeight = profile.goalWeight ?? (profile as any).goal_weight_kg;

  let progressPct = 0;
  let lostKg = 0;
  let toLoseKg = 0;
  if (startWeight && currentWeight && goalWeight && startWeight > goalWeight) {
    lostKg = +(startWeight - currentWeight).toFixed(1);
    toLoseKg = +(startWeight - goalWeight).toFixed(1);
    progressPct = Math.max(0, Math.min(100, (lostKg / toLoseKg) * 100));
  }

  const methodLabel =
    profile.trackingMethod === 'palm' ? 'Ладонь' : 'Тарелка';
  const calorieTarget =
    (profile as any).calorie_target ?? calculations?.totalCalories ?? null;

  const fmtDate = (iso: string | null) => {
    if (!iso) return null;
    try {
      return new Date(iso).toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' });
    } catch { return null; }
  };

  // ---------- small reusable row ----------
  const EditableRow = ({
    label, value, suffix, field,
  }: { label: string; value: number | undefined; suffix: string; field: Exclude<EditField, null> }) => {
    const isEditing = editField === field;
    return (
      <div className="flex items-center justify-between gap-3 py-2.5">
        <span className="text-sm text-muted-foreground">{label}</span>
        {isEditing ? (
          <div className="flex items-center gap-2">
            <input
              type="number"
              inputMode="decimal"
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditField(null); }}
              className="w-20 text-right border border-border rounded-lg px-2 py-1 text-sm bg-background"
            />
            <span className="text-sm text-muted-foreground">{suffix}</span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{value ? `${value} ${suffix}` : 'не указано'}</span>
            <button onClick={() => startEdit(field, value)} className="text-xs text-primary underline">Изменить</button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col items-center min-h-screen px-5 py-8 animate-fade-in-up">
      <div className="w-full max-w-md">
        <button onClick={onBack} className="text-sm text-muted-foreground underline mb-6 self-start">← Назад в меню</button>
        <h2 className="text-2xl font-bold mb-5">Профиль</h2>

        {/* 1. Имя */}
        <div className="inga-card space-y-3 mb-3">
          <div className="text-sm text-muted-foreground">Имя</div>
          {!editingName ? (
            <div className="flex items-center justify-between gap-3">
              <div className="text-xl font-semibold">{cleanName(profile.name) || 'Не указано'}</div>
              <button onClick={() => { setName(profile.name ?? ''); setEditingName(true); }} className="inga-btn-secondary">
                Изменить
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={40}
                autoFocus
                className="inga-input"
                placeholder="Твоё имя"
              />
              <div className="flex gap-2">
                <button onClick={handleSaveName} className="inga-btn-primary flex-1">Сохранить</button>
                <button onClick={() => setEditingName(false)} className="inga-btn-secondary flex-1">Отмена</button>
              </div>
            </div>
          )}
        </div>

        {/* 2. Личные данные */}
        <div className="inga-card mb-3">
          <div className="text-sm text-muted-foreground mb-2">Личные данные</div>

          <div className="flex items-center justify-between gap-3 py-2.5">
            <span className="text-sm text-muted-foreground">Пол</span>
            <div className="inline-flex rounded-full border border-border overflow-hidden">
              <button
                onClick={() => setGender('female')}
                className={`px-3 py-1 text-xs ${profile.gender === 'female' ? 'bg-primary text-primary-foreground' : 'bg-transparent text-foreground'}`}
              >Женский</button>
              <button
                onClick={() => setGender('male')}
                className={`px-3 py-1 text-xs ${profile.gender === 'male' ? 'bg-primary text-primary-foreground' : 'bg-transparent text-foreground'}`}
              >Мужской</button>
            </div>
          </div>

          <div className="border-t border-border" />
          <EditableRow label="Возраст" value={profile.age} suffix="лет" field="age" />
          <div className="border-t border-border" />
          <EditableRow label="Рост" value={profile.height} suffix="см" field="height" />
        </div>

        {/* 3. Прогресс в весе */}
        <div className="inga-card mb-3">
          <div className="text-sm text-muted-foreground mb-2">Прогресс в весе</div>

          <div className="flex items-center justify-between gap-3 py-2.5">
            <span className="text-sm text-muted-foreground">Начальный вес</span>
            <span className="text-sm font-medium">{startWeight ? `${startWeight} кг` : 'не указано'}</span>
          </div>
          <div className="border-t border-border" />
          <EditableRow label="Текущий вес" value={currentWeight} suffix="кг" field="weight" />
          <div className="border-t border-border" />
          <EditableRow label="Цель" value={goalWeight} suffix="кг" field="goal" />

          {progressPct > 0 && (
            <div className="mt-3">
              <div className="h-2 w-full rounded-full bg-border overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${progressPct}%`, backgroundColor: '#FF6200' }}
                />
              </div>
              <div className="text-xs text-muted-foreground mt-1.5">
                Уже минус {lostKg} кг из {toLoseKg} кг · {Math.round(progressPct)}% пути
              </div>
            </div>
          )}
        </div>

        {/* 4. Замеры */}
        <div className="inga-card mb-3">
          <div className="text-sm text-muted-foreground mb-2">Замеры (обновляй раз в неделю)</div>
          <EditableRow label="Талия" value={profile.waist} suffix="см" field="waist" />
          <div className="border-t border-border" />
          <EditableRow label="Бёдра" value={profile.hips} suffix="см" field="hips" />
          {measUpdated && (
            <div className="text-[11px] text-muted-foreground mt-2">Обновлено: {fmtDate(measUpdated)}</div>
          )}
        </div>

        {/* 5. Метод */}
        <div className="inga-card mb-3">
          <div className="text-sm text-muted-foreground mb-2">Метод</div>
          <div className="flex items-center justify-between gap-3 py-2.5">
            <span className="text-sm text-muted-foreground">Метод</span>
            <span className="text-sm font-medium">{methodLabel}</span>
          </div>
          <div className="border-t border-border" />
          <div className="flex items-center justify-between gap-3 py-2.5">
            <span className="text-sm text-muted-foreground">Норма</span>
            <span className="text-sm font-medium">{calorieTarget ? `${calorieTarget} ккал/день` : '—'}</span>
          </div>
        </div>

        {/* 6. Фото */}
        <div className="inga-card mb-6">
          <div className="text-sm text-muted-foreground mb-2">Фото</div>
          <label className="flex items-center gap-3 cursor-pointer">
            {photo ? (
              <>
                <img src={photo.dataUrl} alt="Профиль" className="w-14 h-14 rounded-xl object-cover border border-border" />
                <span className="inga-btn-secondary">Обновить</span>
              </>
            ) : (
              <span className="inga-btn-secondary">📷 Добавить фото</span>
            )}
            <input type="file" accept="image/*" className="hidden" onChange={onPhotoChange} />
          </label>
          {photo?.uploadedAt && (
            <div className="text-[11px] text-muted-foreground mt-2">Загружено: {fmtDate(photo.uploadedAt)}</div>
          )}
        </div>

        {/* 8. Выйти из аккаунта */}
        {!confirmSignOut ? (
          <button
            onClick={() => setConfirmSignOut(true)}
            className="w-full rounded-2xl py-3 text-sm font-medium transition-colors"
            style={{ backgroundColor: 'transparent', border: '1px solid #E5DDD8', color: '#6A5A50' }}
          >
            Выйти из аккаунта
          </button>
        ) : (
          <div className="rounded-2xl p-4" style={{ border: '1px solid #E5DDD8' }}>
            <div className="text-sm font-medium mb-3 text-center" style={{ color: '#6A5A50' }}>Выйти из аккаунта?</div>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmSignOut(false)}
                className="flex-1 rounded-xl py-2 text-sm"
                style={{ backgroundColor: 'transparent', border: '1px solid #E5DDD8', color: '#6A5A50' }}
              >Отмена</button>
              <button
                onClick={doSignOut}
                className="flex-1 rounded-xl py-2 text-sm font-medium"
                style={{ backgroundColor: '#6A5A50', color: '#FFF5E6' }}
              >Выйти</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getSetting, saveSetting, isCurrentUserAdmin } from '@/lib/app-settings';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';
import { Loader2, LogOut, ShieldAlert } from 'lucide-react';

type Prompts = {
  tone: string;
  food_recommendation: string;
  support: string;
  safety: string;
  food_analysis: string;
  fixation: string;
  maintenance: string;
  general: string;
};

type ModelCfg = { provider: string; model: string; temperature: number; max_tokens: number };
type Limits = { max_message_length: number; max_user_context_bytes: number; max_day_context_bytes: number; max_payload_bytes: number };
type LessonOverrides = Record<string, { title?: string; content?: string }>;

const PROMPT_LABELS: Record<keyof Prompts, string> = {
  tone: 'TONE — базовый тон Инги',
  food_recommendation: 'food_recommendation — «что съесть / перекусить»',
  support: 'support — поддержка при срыве, усталости, тяге',
  safety: 'safety — тревожные симптомы (голодание, обмороки и т.п.)',
  food_analysis: 'food_analysis — разбор рациона за день',
  fixation: 'fixation — этап фиксации веса',
  maintenance: 'maintenance — этап удержания веса',
  general: 'general — общий режим (если ни один не подошёл)',
};

const PROMPT_HINTS: Record<keyof Prompts, string> = {
  tone: 'Используется как «личность» Инги. Подмешивается во все остальные промпты, если они пустые. Если переопределить отдельный режим, его текст заменяет промпт целиком (TONE туда уже не подмешивается — пиши его внутри).',
  food_recommendation: 'Включается, когда пользователь спрашивает «что съесть / что приготовить / чем перекусить».',
  support: 'Включается на словах «устала», «сорвалась», «стресс», «тянет на сладкое», «нет сил».',
  safety: 'Включается на тревожные сигналы: «обморок», «вызвать рвоту», «не есть совсем», «нет месячных».',
  food_analysis: 'Включается на «разбери рацион», «оцени мой день».',
  fixation: 'Включается, когда у пользователя этап = fixation.',
  maintenance: 'Включается, когда у пользователя этап = maintenance.',
  general: 'Запасной режим, когда ни один маршрут не подошёл.',
};

export default function Admin() {
  const [phase, setPhase] = useState<'loading' | 'login' | 'denied' | 'ok'>('loading');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [signingIn, setSigningIn] = useState(false);

  const [prompts, setPrompts] = useState<Prompts | null>(null);
  const [model, setModel] = useState<ModelCfg | null>(null);
  const [limits, setLimits] = useState<Limits | null>(null);
  const [lessons, setLessons] = useState<LessonOverrides>({});
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    const sub = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session) setPhase('login');
      else void verify();
    });
    void verify();
    return () => sub.data.subscription.unsubscribe();
  }, []);

  async function verify() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setPhase('login'); return; }
    const isAdmin = await isCurrentUserAdmin();
    if (!isAdmin) { setPhase('denied'); return; }
    await loadAll();
    setPhase('ok');
  }

  async function loadAll() {
    const [p, m, l, ls] = await Promise.all([
      getSetting<Prompts>('ai_prompts'),
      getSetting<ModelCfg>('ai_model'),
      getSetting<Limits>('ai_limits'),
      getSetting<LessonOverrides>('lesson_overrides'),
    ]);
    setPrompts(p ?? { tone: '', food_recommendation: '', support: '', safety: '', food_analysis: '', fixation: '', maintenance: '', general: '' });
    setModel(m ?? { provider: 'deepseek', model: 'deepseek-chat', temperature: 0.4, max_tokens: 700 });
    setLimits(l ?? { max_message_length: 3000, max_user_context_bytes: 10000, max_day_context_bytes: 15000, max_payload_bytes: 50000 });
    setLessons(ls ?? {});
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setSigningIn(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setSigningIn(false);
    if (error) {
      toast({ title: 'Не удалось войти', description: error.message, variant: 'destructive' });
      return;
    }
    void verify();
  }

  async function save<T>(key: 'ai_prompts' | 'ai_model' | 'ai_limits' | 'lesson_overrides', value: T, label: string) {
    setSaving(key);
    const { error } = await saveSetting(key, value);
    setSaving(null);
    if (error) toast({ title: 'Ошибка сохранения', description: error, variant: 'destructive' });
    else toast({ title: 'Сохранено', description: label });
  }

  if (phase === 'loading') {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>;
  }

  if (phase === 'login') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-background">
        <form onSubmit={handleLogin} className="w-full max-w-sm space-y-4 p-6 rounded-2xl border bg-card shadow-sm">
          <div>
            <h1 className="text-xl font-bold">Админ-панель</h1>
            <p className="text-sm text-muted-foreground mt-1">Войдите аккаунтом администратора.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Пароль</Label>
            <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <Button type="submit" disabled={signingIn} className="w-full">
            {signingIn ? 'Вход...' : 'Войти'}
          </Button>
        </form>
      </div>
    );
  }

  if (phase === 'denied') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-4">
          <ShieldAlert className="mx-auto text-destructive" size={40} />
          <h1 className="text-xl font-bold">Доступ запрещён</h1>
          <p className="text-sm text-muted-foreground">
            У этого аккаунта нет роли <code>admin</code>. Добавьте её в таблице <code>user_roles</code>:
            <br /><code className="text-xs">INSERT INTO user_roles (user_id, role) VALUES ('&lt;ваш auth uid&gt;', 'admin');</code>
          </p>
          <Button variant="outline" onClick={async () => { await supabase.auth.signOut(); setPhase('login'); }}>
            <LogOut size={16} className="mr-2" /> Выйти
          </Button>
        </div>
      </div>
    );
  }

  if (!prompts || !model || !limits) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b px-4 py-3 flex items-center justify-between sticky top-0 bg-background z-10">
        <h1 className="font-bold">Админ-панель</h1>
        <Button size="sm" variant="ghost" onClick={async () => { await supabase.auth.signOut(); setPhase('login'); }}>
          <LogOut size={16} className="mr-2" /> Выйти
        </Button>
      </header>

      <main className="max-w-3xl mx-auto p-4">
        <Tabs defaultValue="prompts">
          <TabsList className="grid grid-cols-5 w-full">
            <TabsTrigger value="prompts">Промпты</TabsTrigger>
            <TabsTrigger value="model">Модель</TabsTrigger>
            <TabsTrigger value="limits">Лимиты</TabsTrigger>
            <TabsTrigger value="lessons">Уроки</TabsTrigger>
            <TabsTrigger value="help">Справка</TabsTrigger>
          </TabsList>

          <TabsContent value="prompts" className="space-y-6 mt-4">
            <p className="text-sm text-muted-foreground">
              Системные промпты Инги. Если поле пустое — используется встроенный по умолчанию.
              Если поле заполнено — оно полностью заменяет встроенный промпт для этого режима.
              Изменения применяются сразу, без передеплоя.
            </p>
            {(Object.keys(PROMPT_LABELS) as Array<keyof Prompts>).map((k) => (
              <div key={k} className="space-y-2">
                <Label htmlFor={k}>{PROMPT_LABELS[k]}</Label>
                <p className="text-xs text-muted-foreground">{PROMPT_HINTS[k]}</p>
                <Textarea
                  id={k}
                  value={prompts[k] || ''}
                  onChange={(e) => setPrompts({ ...prompts, [k]: e.target.value })}
                  rows={k === 'tone' ? 5 : 8}
                  className="font-mono text-xs"
                />
              </div>
            ))}
            <Button disabled={saving === 'ai_prompts'} onClick={() => save('ai_prompts', prompts, 'Промпты обновлены')}>
              {saving === 'ai_prompts' ? 'Сохранение...' : 'Сохранить промпты'}
            </Button>
          </TabsContent>

          <TabsContent value="model" className="space-y-4 mt-4">
            <p className="text-sm text-muted-foreground">Параметры запроса к AI-провайдеру.</p>
            <div className="space-y-2">
              <Label>Провайдер</Label>
              <Input value={model.provider} onChange={(e) => setModel({ ...model, provider: e.target.value })} />
              <p className="text-xs text-muted-foreground">Сейчас поддерживается только <code>deepseek</code>. Поле зарезервировано на будущее.</p>
            </div>
            <div className="space-y-2">
              <Label>Имя модели</Label>
              <Input value={model.model} onChange={(e) => setModel({ ...model, model: e.target.value })} />
              <p className="text-xs text-muted-foreground">Например: <code>deepseek-chat</code>, <code>deepseek-reasoner</code>.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Temperature</Label>
                <Input type="number" step="0.05" min={0} max={2} value={model.temperature}
                  onChange={(e) => setModel({ ...model, temperature: Number(e.target.value) })} />
                <p className="text-xs text-muted-foreground">0 — строго, 1 — творчески. Рекомендую 0.3–0.6.</p>
              </div>
              <div className="space-y-2">
                <Label>max_tokens</Label>
                <Input type="number" min={50} max={4000} value={model.max_tokens}
                  onChange={(e) => setModel({ ...model, max_tokens: Number(e.target.value) })} />
                <p className="text-xs text-muted-foreground">Максимум токенов в ответе. 700 ≈ 500 слов.</p>
              </div>
            </div>
            <Button disabled={saving === 'ai_model'} onClick={() => save('ai_model', model, 'Параметры модели сохранены')}>
              {saving === 'ai_model' ? 'Сохранение...' : 'Сохранить параметры модели'}
            </Button>
          </TabsContent>

          <TabsContent value="limits" className="space-y-4 mt-4">
            <p className="text-sm text-muted-foreground">Защитные пороги входных данных в edge-функции <code>ask-inga</code>.</p>
            {([
              ['max_message_length', 'Макс. длина сообщения пользователя (символов)'],
              ['max_user_context_bytes', 'Макс. размер userContext (байт JSON)'],
              ['max_day_context_bytes', 'Макс. размер dayContext (байт JSON)'],
              ['max_payload_bytes', 'Макс. размер всего тела запроса (байт)'],
            ] as Array<[keyof Limits, string]>).map(([k, label]) => (
              <div key={k} className="space-y-2">
                <Label>{label}</Label>
                <Input type="number" value={limits[k]} onChange={(e) => setLimits({ ...limits, [k]: Number(e.target.value) })} />
              </div>
            ))}
            <Button disabled={saving === 'ai_limits'} onClick={() => save('ai_limits', limits, 'Лимиты сохранены')}>
              {saving === 'ai_limits' ? 'Сохранение...' : 'Сохранить лимиты'}
            </Button>
          </TabsContent>

          <TabsContent value="lessons" className="space-y-4 mt-4">
            <p className="text-sm text-muted-foreground">
              Переопределение уроков в разделе «Как похудеть». Введите <strong>ключ</strong> урока (точное название из приложения),
              затем новый заголовок и/или текст. Пустое поле → используется оригинал.
            </p>
            <LessonsEditor lessons={lessons} setLessons={setLessons} />
            <Button disabled={saving === 'lesson_overrides'} onClick={() => save('lesson_overrides', lessons, 'Уроки обновлены')}>
              {saving === 'lesson_overrides' ? 'Сохранение...' : 'Сохранить уроки'}
            </Button>
          </TabsContent>

          <TabsContent value="help" className="space-y-4 mt-4 text-sm leading-relaxed">
            <HelpDoc />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

const KNOWN_LESSON_KEYS = [
  'Метод "Мягкая замена"',
  'Как учитывать питание',
  'Метод ладони',
  'Метаболическая тарелка',
  'Считать калории',
  'Сладкая точка',
  'Как планировать питание',
  'Как удержать результат',
];

function LessonsEditor({ lessons, setLessons }: { lessons: LessonOverrides; setLessons: (l: LessonOverrides) => void }) {
  function update(key: string, field: 'title' | 'content', value: string) {
    const next = { ...lessons, [key]: { ...lessons[key], [field]: value } };
    if (!next[key].title && !next[key].content) delete next[key];
    setLessons(next);
  }
  return (
    <div className="space-y-5">
      {KNOWN_LESSON_KEYS.map((key) => (
        <div key={key} className="rounded-xl border p-3 space-y-2">
          <div className="text-xs text-muted-foreground">Оригинал: <code>{key}</code></div>
          <Input
            placeholder="Новый заголовок (необязательно)"
            value={lessons[key]?.title || ''}
            onChange={(e) => update(key, 'title', e.target.value)}
          />
          <Textarea
            placeholder="Новый текст урока (необязательно)"
            rows={4}
            value={lessons[key]?.content || ''}
            onChange={(e) => update(key, 'content', e.target.value)}
          />
        </div>
      ))}
    </div>
  );
}

function HelpDoc() {
  return (
    <div className="space-y-6">
      <section>
        <h2 className="font-bold text-base mb-2">Зачем нужна эта панель</h2>
        <p>
          Панель позволяет менять тексты системных промптов Инги, параметры AI-модели,
          защитные лимиты и тексты уроков <em>без передеплоя проекта</em>. Все настройки
          хранятся в таблице <code>app_settings</code> и читаются edge-функцией при каждом запросе.
        </p>
      </section>

      <section>
        <h2 className="font-bold text-base mb-2">Как добавить нового админа</h2>
        <ol className="list-decimal pl-5 space-y-1">
          <li>Пользователь должен зарегистрироваться в обычном приложении.</li>
          <li>В Lovable Cloud → таблица <code>users</code> найдите его <code>auth_id</code>.</li>
          <li>В таблице <code>user_roles</code> вставьте строку: <code>user_id = auth_id</code>, <code>role = 'admin'</code>.</li>
          <li>Пользователь может зайти на <code>/admin</code> с теми же email/паролем, что и в приложении.</li>
        </ol>
      </section>

      <section>
        <h2 className="font-bold text-base mb-2">Как работают промпты</h2>
        <p>Каждое сообщение пользователя классифицируется на один из 7 маршрутов:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><code>food_recommendation</code> — «что съесть / чем перекусить»</li>
          <li><code>support</code> — поддержка («устала», «сорвалась», «стресс»)</li>
          <li><code>safety</code> — тревожные симптомы (обмороки, голодание, рвота)</li>
          <li><code>food_analysis</code> — «разбери мой рацион»</li>
          <li><code>fixation</code> — этап фиксации веса (по профилю)</li>
          <li><code>maintenance</code> — этап удержания (по профилю)</li>
          <li><code>general</code> — всё остальное</li>
        </ul>
        <p className="mt-2">
          Если поле этого режима пустое — используется встроенный по умолчанию промпт.
          Если заполнено — он <strong>полностью заменяет</strong> встроенный (TONE туда уже не подмешивается,
          добавляйте «личность» прямо в текст). К любому промпту автоматически дописывается блок
          с данными пользователя и контекстом дня.
        </p>
      </section>

      <section>
        <h2 className="font-bold text-base mb-2">Параметры модели</h2>
        <p>
          Используется DeepSeek через REST. <code>temperature</code> 0.3–0.6 — оптимально для бережного тона.
          <code> max_tokens</code> ограничивает длину ответа Инги; 700 ≈ среднее по объёму сообщение.
          Имя модели можно сменить на <code>deepseek-reasoner</code>, если нужна более сложная логика
          (но дороже и медленнее).
        </p>
      </section>

      <section>
        <h2 className="font-bold text-base mb-2">Лимиты</h2>
        <p>
          Защищают edge-функцию от слишком больших запросов. Значения по умолчанию подобраны
          с запасом — снижайте, только если видите злоупотребления.
        </p>
      </section>

      <section>
        <h2 className="font-bold text-base mb-2">Редактирование уроков</h2>
        <p>
          В разделе «Уроки» можно переопределить заголовок и/или текст любого урока из «Как похудеть».
          Сложные блоки «Метода ладони» (картинка и карточки белок/углеводы/овощи/жиры) редактируются
          только во вступительном тексте — остальное остаётся встроенным в код.
        </p>
      </section>

      <section>
        <h2 className="font-bold text-base mb-2">Что НЕ редактируется здесь</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>Логика выбора маршрута (<code>detectRoute</code>) — это код в edge-функции.</li>
          <li>Дизайн и компоненты приложения.</li>
          <li>Расчёты калорий, вес, фиксация — это бизнес-логика в <code>src/lib/</code>.</li>
        </ul>
      </section>

      <section>
        <h2 className="font-bold text-base mb-2">Безопасность</h2>
        <p>
          Доступ к панели проверяется в два шага: вход через Supabase Auth + наличие роли <code>admin</code>
          в <code>user_roles</code>. Сами настройки защищены RLS: читать может любой авторизованный,
          писать — только админы. Edge-функция <code>ask-inga</code> читает их service-role-клиентом
          и применяет на каждый запрос.
        </p>
      </section>
    </div>
  );
}

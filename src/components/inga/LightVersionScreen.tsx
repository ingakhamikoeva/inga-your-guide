import { useState } from 'react';
import { Search, ArrowRight, Play } from 'lucide-react';
import { askInga } from '@/lib/ai-provider';
import { apiFetch } from '@/lib/api-client';
import {
  searchLightVersion,
  timesLighter,
  SUGGESTED_QUERIES,
  LightRecipeEntry,
  LightSearchResult,
} from '@/lib/light-version';

interface Props {
  onBack: () => void;
  onOpenRecipe: (section: 'breakfasts' | 'sweet', recipeId: string) => void;
}

// Логируем каждый поиск: список «искали, но не нашли» — план будущих рецептов Инги.
function logSearch(query: string, resultKind: string) {
  apiFetch('/events', {
    method: 'POST',
    body: { type: 'light_version_search', payload: { query, result: resultKind } },
  }).catch(() => { /* лог не должен ломать поиск */ });
}

export function LightVersionScreen({ onBack, onOpenRecipe }: Props) {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<LightSearchResult | null>(null);
  const [aiAnswer, setAiAnswer] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const runSearch = async (raw: string) => {
    const q = raw.trim();
    if (q.length < 2) return;
    setQuery(q);
    setAiAnswer(null);
    const res = searchLightVersion(q);
    setResult(res);
    logSearch(q, res.kind);

    if (res.kind === 'known' || res.kind === 'unknown') {
      setAiLoading(true);
      const dishLabel = res.kind === 'known' ? res.entry.label : q;
      const { answer } = await askInga({
        message: `Пользователь любит блюдо «${dishLabel}» и хочет его облегчённую версию. Подскажи в 2-4 предложениях, как приготовить это блюдо заметно легче по калориям, сохранив вкус: какие ингредиенты заменить и как готовить. По методу лёгкой замены, без запретов.`,
        routeType: 'food_recommendation',
      });
      setAiAnswer(answer);
      setAiLoading(false);
    }
  };

  const renderComparisonCard = (entry: LightRecipeEntry, primary: boolean) => {
    if (!primary) {
      return (
        <button
          key={entry.recipeId}
          onClick={() => onOpenRecipe(entry.recipeSection, entry.recipeId)}
          className="text-left bg-card border border-border rounded-2xl px-3.5 py-3 hover:border-primary/60 active:scale-[0.99] transition-all"
        >
          <p className="font-semibold text-sm">«{entry.name}»</p>
          <p className="text-xs text-muted-foreground mt-0.5">{entry.lightKcal} ккал/100г</p>
        </button>
      );
    }
    return (
      <div key={entry.recipeId} className="bg-card border border-border rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="font-semibold">«{entry.name}»</p>
          {entry.hasVideo && (
            <span className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-accent text-accent-foreground">
              <Play size={10} /> видео
            </span>
          )}
        </div>
        <div className="flex items-center gap-2.5 mb-3">
          <div className="flex-1 text-center bg-muted rounded-xl py-2 px-1">
            <p className="text-xs text-muted-foreground">{entry.classicLabel}</p>
            <p className="text-lg text-muted-foreground line-through">~{entry.classicKcal} ккал</p>
          </div>
          <ArrowRight size={18} className="text-primary shrink-0" />
          <div className="flex-1 text-center bg-primary/10 rounded-xl py-2 px-1">
            <p className="text-xs text-primary">ваша версия</p>
            <p className="text-lg font-bold text-primary">{entry.lightKcal} ккал</p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mb-3">
          {timesLighter(entry.classicKcal, entry.lightKcal).replace(/^в/, 'В')}{entry.tagline ? ` — ${entry.tagline}` : ''}
        </p>
        <button
          onClick={() => onOpenRecipe(entry.recipeSection, entry.recipeId)}
          className="inga-btn-primary w-full"
        >
          Открыть рецепт
        </button>
      </div>
    );
  };

  return (
    <div className="flex flex-col items-center min-h-screen px-5 py-8 animate-fade-in-up">
      <div className="w-full max-w-md">
        <button onClick={onBack} className="text-base text-muted-foreground mb-6 block">← Назад</button>

        <h2 className="text-2xl font-bold mb-1">Лёгкая версия</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Назовите, что любите — найдём, как это есть и худеть
        </p>

        <div className="flex items-center gap-2 bg-card border border-border rounded-xl px-3 py-2.5 mb-4 focus-within:border-primary/60 transition-colors">
          <Search size={16} className="text-muted-foreground shrink-0" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') runSearch(query); }}
            placeholder="Например: шарлотка, котлеты, блины…"
            className="flex-1 bg-transparent outline-none text-base"
          />
          {query.trim().length >= 2 && (
            <button onClick={() => runSearch(query)} className="text-sm font-medium text-primary shrink-0">
              Найти
            </button>
          )}
        </div>

        {!result && (
          <div className="flex flex-wrap gap-2">
            {SUGGESTED_QUERIES.map(s => (
              <button
                key={s}
                onClick={() => runSearch(s)}
                className="px-3.5 py-1.5 rounded-full bg-card border border-border text-sm hover:border-primary/60 active:scale-[0.98] transition-all"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {result?.kind === 'recipes' && (
          <div className="space-y-3">
            {renderComparisonCard(result.entries[0], true)}
            {result.entries.length > 1 && (
              <div className="grid grid-cols-2 gap-2.5">
                {result.entries.slice(1, 5).map(e => renderComparisonCard(e, false))}
              </div>
            )}
          </div>
        )}

        {result?.kind === 'hopeless' && (
          <div className="inga-bubble">
            <p>{result.entry.answer}</p>
          </div>
        )}

        {(result?.kind === 'known' || result?.kind === 'unknown') && (
          <div className="space-y-3">
            <div className="inga-bubble">
              <p>Такого рецепта у меня пока нет — но вот как облегчить ваше блюдо уже сегодня:</p>
              {aiLoading && <p className="text-muted-foreground mt-2 animate-pulse">Инга думает…</p>}
              {aiAnswer && <p className="mt-2">{aiAnswer}</p>}
              {result.kind === 'known' && (
                <p className="text-muted-foreground text-sm mt-2">
                  Для сравнения: классическая версия — примерно {result.entry.classicKcal} ккал/100г.
                </p>
              )}
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Записала ваш запрос — возможно, скоро сниму этот рецепт
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

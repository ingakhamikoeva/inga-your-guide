// Compact "Сводка дня" card. Light peach/coral style.
// Shows max 3 numbers + one short Inga comment. No progress bars, no macro grams.

import { useEffect, useRef, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { recomputeAndSaveSummary } from '@/lib/nutrition/summary-store';
import type { DailySummary } from '@/lib/nutrition/types';

interface Props {
  meals: string[];
  date: string;
  calorieTarget?: number | null;
  goalWeightKg?: number;
}

export function DailySummaryCard({ meals, date, calorieTarget, goalWeightKg }: Props) {
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [loading, setLoading] = useState(false);
  const lastKey = useRef<string>('');

  useEffect(() => {
    const key = `${date}|${meals.join('||')}`;
    if (key === lastKey.current) return;
    lastKey.current = key;

    if (meals.length === 0) {
      setSummary(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    recomputeAndSaveSummary({ meals, date, calorieTarget, goalWeightKg })
      .then(s => { if (!cancelled && s) setSummary(s); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [meals, date, calorieTarget, goalWeightKg]);

  // Empty state
  if (meals.length === 0) {
    return (
      <Card className="bg-card/80 border-primary/15 rounded-2xl">
        <CardContent className="p-4 space-y-1">
          <h4 className="text-base font-bold text-foreground">Сводка дня</h4>
          <p className="text-sm text-muted-foreground leading-snug">
            Пока нет записей по питанию. Добавьте первый приём пищи — и я соберу сводку дня.
          </p>
        </CardContent>
      </Card>
    );
  }

  const eaten = summary?.calories_eaten_estimated ?? 0;
  const left = summary?.calories_left;
  const protein = summary?.protein_estimated_g ?? 0;
  const isEstimate = summary?.is_estimate ?? true;

  // If protein is too small to show meaningfully, fall back to a label
  const proteinDisplay = protein < 5 && summary?.protein_status === 'low'
    ? 'мало'
    : `${protein} г`;

  const eatenPrefix = isEstimate ? 'примерно ' : '';

  return (
    <Card className="bg-card/80 border-primary/15 rounded-2xl shadow-sm">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-base font-bold text-foreground">Сводка дня</h4>
          {loading && <span className="text-xs text-muted-foreground">обновляю…</span>}
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <div className="text-xs text-muted-foreground">Съедено</div>
            <div className="text-lg font-bold text-foreground leading-tight">
              {eatenPrefix}{eaten}
            </div>
            <div className="text-[11px] text-muted-foreground">ккал</div>
          </div>
          <div className="border-l border-r border-border/40">
            <div className="text-xs text-muted-foreground">Осталось</div>
            <div className="text-lg font-bold text-primary leading-tight">
              {left != null ? left : '—'}
            </div>
            <div className="text-[11px] text-muted-foreground">ккал</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Белок</div>
            <div className="text-lg font-bold text-foreground leading-tight">
              {proteinDisplay}
            </div>
            <div className="text-[11px] text-muted-foreground">&nbsp;</div>
          </div>
        </div>

        {summary?.summary_comment && (
          <p className="text-sm text-foreground/90 leading-snug">
            {summary.summary_comment}
          </p>
        )}

        {summary?.is_estimate && meals.length < 2 && (
          <p className="text-[11px] text-muted-foreground italic">
            Пока оценка примерная. Чем подробнее вы описываете еду, тем точнее будет сводка.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

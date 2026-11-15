import { useWaterTracker } from '@/hooks/use-water-tracker';
import { LOAD_ERROR, SAVE_ERROR } from '@/hooks/use-save-action';

export function WaterTracker({ date }: { date: string }) {
  const water = useWaterTracker(date);
  const disabled = !water.ready || water.busy;
  return (
    <div className="bg-white flex flex-wrap items-center gap-2" style={{ borderRadius: 14, border: '1px solid #EDE5DF', padding: '10px 14px' }} aria-busy={water.busy}>
      <span className="text-sm font-medium">💧 Вода</span>
      <div className="flex flex-wrap gap-1 justify-center">
        {Array.from({ length: 6 }).map((_, i) => (
          <button key={i} type="button" disabled={disabled} onClick={() => water.change(n => i + 1 === n ? i : i + 1)} className="min-w-[44px] min-h-[44px] rounded-md flex items-center justify-center disabled:opacity-60" aria-label={`Стакан ${i + 1}`} aria-pressed={water.ready && i < water.count}>
            <svg width="28" height="32" viewBox="0 0 28 32" fill="none" aria-hidden="true" focusable="false">
              <path d="M5 4H23L20.5 28H7.5L5 4Z" fill="#EFFAFF" />
              <path d="M6 13C9 11 12 15 15 13C18 11 20 12 22 13L20.5 28H7.5L6 13Z" fill={water.ready && i < water.count ? '#38BDF8' : '#CDEFFC'} />
              <path d="M5 4H23L20.5 28H7.5L5 4Z" stroke="#0284C7" strokeWidth="1.8" strokeLinejoin="round" />
              <path d="M9 7L10 17" stroke="white" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        ))}
      </div>
      <button type="button" disabled={disabled || water.count >= 1000} onClick={() => water.change(n => n + 1)} className="min-w-[44px] min-h-[44px] rounded-full bg-primary text-primary-foreground text-sm leading-none flex items-center justify-center disabled:opacity-60" aria-label="Добавить">+</button>
      <span className="text-sm font-semibold tabular-nums" aria-live="polite">{water.ready ? water.count : '—'}/6</span>
      {water.error && (
        <div className="w-full text-sm" role="alert">
          <p>{water.error === 'save' ? SAVE_ERROR : LOAD_ERROR}</p>
          <button type="button" onClick={water.reload} disabled={water.busy} className="min-h-[44px] underline">Повторить</button>
        </div>
      )}
    </div>
  );
}

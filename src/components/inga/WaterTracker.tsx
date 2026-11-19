import { useId } from 'react';
import { Minus, Plus } from 'lucide-react';
import { useWaterTracker } from '@/hooks/use-water-tracker';
import { LOAD_ERROR, SAVE_ERROR } from '@/hooks/use-save-action';

// Decorative glass, with no network/image dependency; useId prevents duplicate SVG IDs.
function GlassIcon() {
  const id = useId();
  const fill = (name: string) => `url(#${id}-${name})`;
  return <svg className="legche-water-glass" viewBox="0 0 40 52" fill="none" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id={`${id}-glass`}><stop stopColor="#B9DDEF" stopOpacity=".45"/><stop offset=".25" stopColor="#fff" stopOpacity=".75"/><stop offset=".55" stopColor="#fff" stopOpacity=".08"/><stop offset="1" stopColor="#9AC1D8" stopOpacity=".6"/></linearGradient>
      <linearGradient id={`${id}-water`} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#DDF7FF" stopOpacity=".9"/><stop offset="1" stopColor="#51B6E4" stopOpacity=".8"/></linearGradient>
    </defs>
    <ellipse cx="20" cy="47" rx="12" ry="2" fill="#5C95AC" opacity=".15"/>
    <path d="M5 6H35L30.6 43Q20 48 9.4 43Z" fill={fill('glass')} stroke="#8CB3C9" strokeWidth="1.1"/>
    <path d="M7.5 20Q20 24 32.5 20L29.8 41.8Q20 45.4 10.2 41.8Z" fill={fill('water')}/>
    <ellipse cx="20" cy="20" rx="12.5" ry="2.2" fill="#D5F1FA" stroke="#7FB5D0" strokeWidth=".8"/>
    <ellipse cx="20" cy="6" rx="15" ry="3" fill={fill('glass')} stroke="#A0C2D5" strokeWidth="1.1"/>
    <path d="M9 10L12 40M31 11L28 39" stroke="white" strokeWidth="1.7" strokeLinecap="round" opacity=".88"/>
    <path d="M10 43Q20 46.5 30 43" stroke="#C7E3F1" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>;
}

export function WaterTracker({ date }: { date: string }) {
  const water = useWaterTracker(date);
  const disabled = !water.ready || water.busy;
  return (
    <div className="legche-water legche-water-compact bg-white" aria-busy={water.busy}>
      <GlassIcon />
      <div className="legche-water-copy"><span>Вода</span><strong aria-live="polite">{water.ready ? water.count : '—'} из 6</strong></div>
      <div className="legche-water-actions">
        <button type="button" disabled={disabled || water.count === 0} onClick={() => water.change(n => Math.max(0, n - 1))} aria-label="Убавить"><Minus size={18} aria-hidden="true"/></button>
        <button type="button" disabled={disabled || water.count >= 1000} onClick={() => water.change(n => n + 1)} className="legche-water-plus" aria-label="Добавить"><Plus size={18} aria-hidden="true"/></button>
      </div>
      {water.error && (
        <div className="legche-water-error text-sm" role="alert">
          <p>{water.error === 'save' ? SAVE_ERROR : LOAD_ERROR}</p>
          <button type="button" onClick={water.reload} disabled={water.busy} className="min-h-[44px] underline">Повторить</button>
        </div>
      )}
    </div>
  );
}

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import './legche-redesign.css';

type Appearance = 'system' | 'light' | 'dark';
const KEY = 'legche-ui-appearance-v1';
function readAppearance(): Appearance {
  try { const v = localStorage.getItem(KEY); if (v === 'light' || v === 'dark') return v; } catch { /* optional UI preference */ }
  return 'system';
}
function systemDark() { return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches; }
const AppearanceContext = createContext<{appearance: Appearance; change: (v: Appearance) => void} | null>(null);
export function LegcheAppearance({ children }: { children: ReactNode }) {
  const [appearance, setAppearance] = useState<Appearance>(readAppearance);
  const [prefersDark, setPrefersDark] = useState(systemDark);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setPrefersDark(media.matches);
    onChange();
    if (typeof media.addEventListener === 'function') { media.addEventListener('change', onChange); return () => media.removeEventListener('change', onChange); }
    media.addListener(onChange); return () => media.removeListener(onChange);
  }, []);
  const dark = appearance === 'dark' || (appearance === 'system' && prefersDark);
  const change = (v: Appearance) => { setAppearance(v); try { localStorage.setItem(KEY, v); } catch { /* optional */ } };
  return <AppearanceContext.Provider value={{appearance, change}}><div className={`legche-shell${dark ? ' dark' : ''}`} data-legche-theme={dark ? 'dark' : 'light'}>{children}</div></AppearanceContext.Provider>;
}
export function AppearanceControl() {
  const ctx = useContext(AppearanceContext);
  if (!ctx) return null;
  return <label className="legche-appearance inga-card"><span>Оформление</span><select aria-label="Оформление" className="inga-input" value={ctx.appearance} onChange={e=>ctx.change(e.target.value as Appearance)}><option value="system">Как в системе</option><option value="light">Светлая тема</option><option value="dark">Тёмная тема</option></select></label>;
}

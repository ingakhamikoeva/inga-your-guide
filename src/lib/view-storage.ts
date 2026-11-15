import { isSessionCurrent, sessionSnapshot, type SessionSnapshot } from './auth-storage';

// Only navigation, never form drafts. Each tab and login has its own view.
const KEY = 'legche-view-v1';
export const MENU_SECTIONS = ['main', 'how-to', 'recipes', 'light-version', 'audio',
  'progress', 'profile', 'consultation', 'materials'] as const;
export type MenuSection = typeof MENU_SECTIONS[number];
type ViewStep = 'daily' | 'menu' | 'chat';
type View = { step: ViewStep; section?: MenuSection };

export function readView(session: SessionSnapshot = sessionSnapshot()): View | null {
  if (!session.owner || !isSessionCurrent(session)) return null;
  try {
    const saved = JSON.parse(sessionStorage.getItem(KEY) || 'null');
    if (!saved || saved.owner !== session.owner || saved.generation !== session.generation
      || !['daily', 'menu', 'chat'].includes(saved.step)) return null;
    return { step: saved.step,
      ...(MENU_SECTIONS.includes(saved.section) ? { section: saved.section } : {}) };
  } catch { return null; }
}

export function saveView(step: string, section?: MenuSection, session: SessionSnapshot = sessionSnapshot()) {
  if (!session.owner || !isSessionCurrent(session)) return;
  try {
    if (!['daily', 'menu', 'chat'].includes(step)) {
      sessionStorage.removeItem(KEY);
      return;
    }
    const previous = readView(session);
    sessionStorage.setItem(KEY, JSON.stringify({ ...session, step,
      ...(step === 'menu' ? { section: section ?? (previous?.step === 'menu' ? previous.section : 'main') } : {}) }));
  } catch { /* Storage restrictions must not block navigation. */ }
}

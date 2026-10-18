import { useEffect, useState, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { apiFetch } from './api-client';
import { currentSession, subscribe } from './auth-storage';
import type { Medal } from './types';

export function deviceTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Moscow';
}
export function localDay(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
const owner = () => currentSession()?.user.id || currentSession()?.user.user_id || null;
interface Snapshot { medals: Medal[]; streakDays: number; newIds: string[]; uniqueRecipes: number }

export function useAchievements() {
  const [medals, setMedals] = useState<Medal[]>([]);
  const [streakDays, setStreakDays] = useState<number | null>(null);
  const [uniqueRecipes, setUniqueRecipes] = useState<number | null>(null);
  const generation = useRef(0);
  const reset = useCallback(() => {
    generation.current++;
    setMedals([]);
    setStreakDays(null);
    setUniqueRecipes(null);
  }, []);
  useEffect(() => {
    let alive = true, running = false, pending = false;
    let activeOwner = owner(), lastDay = localDay();
    const refresh = async () => {
      pending = true;
      if (running) return;
      running = true;
      try {
        while (pending && alive) {
          pending = false;
          const user = owner(), version = generation.current;
          if (!user) continue;
          try {
            const result = await apiFetch<Snapshot>('/achievements/sync', {
              method: 'POST', body: { timezone: deviceTimezone() },
            });
            if (!alive || owner() !== user || generation.current !== version) continue;
            setMedals(result.medals);
            setStreakDays(result.streakDays);
            setUniqueRecipes(result.uniqueRecipes ?? 0);
            for (const medal of result.medals.filter(m => result.newIds.includes(m.id))) {
              toast(`${medal.icon || '🏅'} ${medal.title}`, { description: medal.description, duration: 7000 });
            }
          } catch {
            if (alive && owner() === user && generation.current === version) setStreakDays(null);
          }
        }
      } finally { running = false; }
    };
    const unsubscribe = subscribe(() => {
      if (activeOwner !== owner()) { activeOwner = owner(); reset(); }
      void refresh();
    });
    const saved = (event: Event) => {
      if ((event as CustomEvent).detail?.userId === owner()) void refresh();
    };
    const focus = () => { void refresh(); };
    const clock = window.setInterval(() => {
      const day = localDay();
      if (day !== lastDay) { lastDay = day; void refresh(); }
    }, 60000);
    window.addEventListener('legche:diary-saved', saved);
    window.addEventListener('focus', focus);
    void refresh();
    return () => {
      alive = false;
      unsubscribe();
      clearInterval(clock);
      window.removeEventListener('legche:diary-saved', saved);
      window.removeEventListener('focus', focus);
    };
  }, [reset]);
  return { medals, streakDays, uniqueRecipes, reset };
}

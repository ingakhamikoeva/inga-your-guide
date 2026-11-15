import { useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import { isSessionCurrent, sessionSnapshot, subscribe } from '@/lib/auth-storage';
import { localDay } from '@/lib/achievement-client';

type Water = { glasses: number; revision: number };
type State = Water & { scope: string; ready: boolean; busy: boolean; error: 'load' | 'save' | null };
type Actions = { scope: string; reload: () => void; change: (update: (n: number) => number) => void };

function checked(value: Water): Water {
  if (!value || !Number.isInteger(value.glasses) || value.glasses < 0 || value.glasses > 1000
      || !Number.isInteger(value.revision) || value.revision < 0) throw new Error('invalid_water_response');
  return value;
}

export function useWaterTracker(date: string) {
  const [session, setSession] = useState(sessionSnapshot);
  useEffect(() => {
    const sync = () => setSession(previous => isSessionCurrent(previous) ? previous : sessionSnapshot());
    const unsubscribe = subscribe(sync);
    sync();
    return unsubscribe;
  }, []);
  const scope = JSON.stringify([session.generation, session.owner, date]);
  const [state, setState] = useState<State>({ scope: '', glasses: 0, revision: 0, ready: false, busy: true, error: null });
  const actions = useRef<Actions | null>(null);

  useEffect(() => {
    let active = true;
    let running = false;
    let ready = false;
    let record: Water = { glasses: 0, revision: 0 };
    let controller: AbortController | undefined;
    const current = () => active && isSessionCurrent(session) && date === localDay();
    const publish = (busy: boolean, error: State['error'] = null) => {
      if (current()) setState({ ...record, scope, ready, busy, error });
    };

    async function run(update?: (n: number) => number) {
      if (running || !session.owner || !current() || (update && !ready)) return;
      const glasses = update ? update(record.glasses) : undefined;
      if (glasses !== undefined && (!Number.isInteger(glasses) || glasses < 0 || glasses > 1000 || glasses === record.glasses)) return;
      running = true;
      controller = new AbortController();
      publish(true);
      try {
        const result = checked(await apiFetch<Water>(`/water/${date}`, {
          method: update ? 'PUT' : 'GET',
          ...(update ? { body: { glasses, revision: record.revision } } : {}),
          signal: controller.signal,
          cache: 'no-store',
        }));
        if (!current()) return;
        record = result;
        ready = true;
        publish(false);
      } catch {
        // A lost response may follow a successful commit. Reload before
        // accepting another edit, never blindly retry the old write.
        ready = false;
        publish(false, update ? 'save' : 'load');
      } finally {
        running = false;
      }
    }

    actions.current = { scope, reload: () => { void run(); }, change: update => { void run(update); } };
    publish(true);
    void run();
    const onFocus = () => { if (document.visibilityState !== 'hidden') void run(); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      active = false;
      controller?.abort();
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [scope, date, session]);

  const matches = state.scope === scope && isSessionCurrent(session) && date === localDay();
  return {
    count: matches ? state.glasses : 0,
    ready: matches && state.ready,
    busy: !matches || state.busy,
    error: matches ? state.error : null,
    change: (update: (n: number) => number) => { if (actions.current?.scope === scope) actions.current.change(update); },
    reload: () => { if (actions.current?.scope === scope) actions.current.reload(); },
  };
}

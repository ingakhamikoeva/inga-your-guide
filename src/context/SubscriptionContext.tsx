import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { currentSession, subscribe } from '@/lib/auth-storage';
import { loadSubscriptionAccess, type SubscriptionAccess } from '@/lib/subscription';

interface SubscriptionState {
  access: SubscriptionAccess | null;
  checking: boolean;
  error: boolean;
  refresh: () => Promise<SubscriptionAccess | null>;
}
const SubscriptionContext = createContext<SubscriptionState | null>(null);
export function useSubscription() {
  const value = useContext(SubscriptionContext);
  if (!value) throw new Error('useSubscription must be inside SubscriptionProvider');
  return value;
}
const sessionOwner = () => currentSession()?.user?.id || currentSession()?.user?.user_id || null;

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const [owner, setOwner] = useState(sessionOwner);
  const [state, setState] = useState<{ owner: string | null; access: SubscriptionAccess | null; checking: boolean; error: boolean }>({ owner, access: null, checking: !!owner, error: false });
  const requestNumber = useRef(0);
  const deadline = useRef<number | null>(null);
  const busy = useRef(false);

  const accept = useCallback((user: string, access: SubscriptionAccess) => {
    const remaining = access.active && access.accessEndsAt
      ? Date.parse(access.accessEndsAt) - Date.parse(access.serverNow) : 0;
    deadline.current = access.active ? performance.now() + Math.max(0, remaining) : null;
    setState({ owner: user, access, checking: false, error: false });
  }, []);

  const refresh = useCallback(async () => {
    const user = sessionOwner();
    const request = ++requestNumber.current;
    if (!user) {
      deadline.current = null;
      setState({ owner: null, access: null, checking: false, error: false });
      return null;
    }
    busy.current = true;
    setState(prev => ({ owner: user, access: prev.owner === user ? prev.access : null, checking: true, error: false }));
    try {
      const access = await loadSubscriptionAccess();
      if (request === requestNumber.current && user === sessionOwner()) accept(user, access);
      return request === requestNumber.current && user === sessionOwner() ? access : null;
    } catch {
      if (request === requestNumber.current && user === sessionOwner()) {
        deadline.current = null;
        setState({ owner: user, access: null, checking: false, error: true });
      }
      return null;
    } finally {
      if (request === requestNumber.current) busy.current = false;
    }
  }, [accept]);

  useEffect(() => subscribe((_event, session) => {
    const user = session?.user?.id || session?.user?.user_id || null;
    setOwner(user);
    if (!user) {
      ++requestNumber.current;
      busy.current = false;
      deadline.current = null;
      setState({ owner: null, access: null, checking: false, error: false });
    }
  }), []);
  useEffect(() => {
    void refresh();
    return () => { ++requestNumber.current; busy.current = false; };
  }, [owner, refresh]);

  useEffect(() => {
    const onDenial = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (!detail?.userId || detail.userId !== sessionOwner()) return;
      ++requestNumber.current;
      busy.current = false;
      deadline.current = null;
      if (detail.access) accept(detail.userId, detail.access);
      else setState({ owner: detail.userId, access: null, checking: false, error: true });
    };
    const onChange = () => { if (sessionOwner()) void refresh(); };
    const onVisible = () => { if (!document.hidden && sessionOwner() && !busy.current) void refresh(); };
    window.addEventListener('legche:access-denied', onDenial);
    window.addEventListener('legche:access-changed', onChange);
    window.addEventListener('focus', onVisible);
    document.addEventListener('visibilitychange', onVisible);
    const interval = window.setInterval(() => {
      if (deadline.current !== null && performance.now() >= deadline.current) {
        deadline.current = null;
        setState(prev => ({ ...prev, access: prev.access ? { ...prev.access, active: false, status: 'expired' } : null, checking: true }));
        if (!busy.current) void refresh();
      }
    }, 1000);
    return () => {
      window.removeEventListener('legche:access-denied', onDenial);
      window.removeEventListener('legche:access-changed', onChange);
      window.removeEventListener('focus', onVisible);
      document.removeEventListener('visibilitychange', onVisible);
      window.clearInterval(interval);
    };
  }, [accept, refresh]);

  // A response belonging to a previous account is never exposed to the next.
  const sameOwner = state.owner === owner;
  return <SubscriptionContext.Provider value={{
    access: sameOwner ? state.access : null,
    checking: sameOwner ? state.checking : !!owner,
    error: sameOwner && state.error,
    refresh,
  }}>{children}</SubscriptionContext.Provider>;
}

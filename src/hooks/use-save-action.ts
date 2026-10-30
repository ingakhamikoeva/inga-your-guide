import { useCallback, useEffect, useRef, useState } from 'react';
import { isSessionCurrent, sessionSnapshot } from '@/lib/auth-storage';

export const SAVE_ERROR = 'Не удалось сохранить изменения. Попробуйте ещё раз.';
export const LOAD_ERROR = 'Не удалось загрузить ваши данные. Попробуйте ещё раз.';

// Keep a failed form mounted with its draft; only the caller's success path may navigate.
export function useSaveAction() {
  const busy = useRef(false);
  const mounted = useRef(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  const save = useCallback(async (action: () => Promise<unknown>): Promise<boolean> => {
    if (busy.current || !mounted.current) return false;
    const session = sessionSnapshot();
    busy.current = true;
    setSaving(true);
    setSaveError(false);
    try {
      await action();
      return mounted.current && isSessionCurrent(session);
    } catch {
      if (mounted.current && isSessionCurrent(session)) setSaveError(true);
      return false;
    } finally {
      busy.current = false;
      if (mounted.current) setSaving(false);
    }
  }, []);
  return { save, saving, saveError, isSaving: () => busy.current };
}

import { useState } from 'react';
import { useSubscription } from '@/context/SubscriptionContext';
import { beginTrial } from '@/lib/subscription';
import { DiaryHistoryScreen } from './DiaryHistoryScreen';

export function AccessScreen({ onProfile }: { onProfile: (promo?: boolean) => void }) {
  const { access, checking, error, refresh } = useSubscription();
  const [history, setHistory] = useState(false);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState(false);
  const start = async () => {
    if (starting) return;
    setStarting(true); setStartError(false);
    try { await beginTrial(); await refresh(); }
    catch { setStartError(true); }
    finally { setStarting(false); }
  };
  if (history) return <DiaryHistoryScreen onBack={() => setHistory(false)} />;
  return (
    <div className="min-h-screen px-5 py-8 flex justify-center">
      <div className="w-full max-w-md space-y-4">
        {checking ? <div className="inga-bubble" role="status">Загрузка…</div> : error ? (
          <div className="inga-bubble" role="alert">
            <p>Не удалось проверить доступ. Попробуйте ещё раз.</p>
            <button onClick={() => void refresh()} className="inga-btn-primary w-full mt-4">Повторить</button>
          </div>
        ) : access?.status === 'not_started' ? (
          <div className="inga-bubble">
            {startError && <p role="alert" className="mb-3">Не удалось запустить пробный период. Попробуйте ещё раз.</p>}
            <button onClick={start} disabled={starting} className="inga-btn-primary w-full">
              {starting ? 'Секунду…' : startError ? 'Повторить' : 'Начать 7 бесплатных дней'}
            </button>
          </div>
        ) : (
          <div className="inga-bubble" role="status">
            Период доступа завершён. Ваш дневник сохранён: записи можно просматривать и скачивать. Для новых записей, общения в чате и продолжения программы нужен действующий доступ.
          </div>
        )}
        <button onClick={() => setHistory(true)} className="inga-btn-secondary w-full">Посмотреть дневник</button>
        <button onClick={() => onProfile(true)} className="inga-btn-primary w-full">Ввести промокод</button>
        <button onClick={() => onProfile()} className="w-full text-sm text-muted-foreground underline">Профиль</button>
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { auth } from '@/lib/auth';

type State = 'checking' | 'ok' | 'expired' | 'invalid';

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [state, setState] = useState<State>('checking');

  useEffect(() => {
    const token = params.get('token');
    if (!token) {
      setState('invalid');
      return;
    }
    auth.verifyEmail(token).then(({ error }) => {
      if (!error) {
        setState('ok');
        return;
      }
      const msg = String(error.message || '');
      setState(msg.includes('expired') ? 'expired' : 'invalid');
    });
  }, [params]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 animate-fade-in-up">
      <div className="w-full max-w-sm text-center">
        {state === 'checking' && (
          <p className="text-sm text-muted-foreground">Проверяю ссылку…</p>
        )}

        {state === 'ok' && (
          <>
            <div className="text-5xl mb-3">💛</div>
            <h1 className="text-2xl font-bold mb-2">Почта подтверждена</h1>
            <p className="text-sm text-muted-foreground mb-6">
              Спасибо! Теперь вы точно не потеряете доступ к своему дневнику.
            </p>
            <button onClick={() => navigate('/')} className="inga-btn-primary w-full">
              Вернуться в приложение →
            </button>
          </>
        )}

        {state === 'expired' && (
          <>
            <h1 className="text-2xl font-bold mb-2">Ссылка устарела</h1>
            <p className="text-sm text-muted-foreground mb-6">
              Такое бывает: ссылка действует неделю. Откройте приложение и отправьте письмо заново — в «Профиле».
            </p>
            <button onClick={() => navigate('/')} className="inga-btn-primary w-full">
              Открыть приложение →
            </button>
          </>
        )}

        {state === 'invalid' && (
          <>
            <h1 className="text-2xl font-bold mb-2">Ссылка не подошла</h1>
            <p className="text-sm text-muted-foreground mb-6">
              Возможно, она открыта не полностью или почта уже подтверждена. Загляните в «Профиль» — там видно статус.
            </p>
            <button onClick={() => navigate('/')} className="inga-btn-primary w-full">
              Открыть приложение →
            </button>
          </>
        )}
      </div>
    </div>
  );
}

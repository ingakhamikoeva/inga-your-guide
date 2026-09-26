import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { auth } from '@/lib/auth';

type State = 'checking' | 'ok' | 'expired' | 'invalid' | 'error';

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [state, setState] = useState<State>('checking');
  const [token] = useState(() => params.get('token'));
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    // Remove the bearer secret from the address bar/history before navigation.
    const url = new URL(window.location.href);
    url.searchParams.delete('token');
    window.history.replaceState(window.history.state, '', url.toString());
    if (!token) {
      setState('invalid');
      return;
    }
    setState('checking');
    auth.verifyEmail(token).then(({ error }) => {
      if (!active) return;
      if (!error) {
        setState('ok');
        return;
      }
      const msg = String(error.message || '');
      setState(msg === 'token_expired' ? 'expired'
        : ['invalid_token', 'token_used'].includes(msg) ? 'invalid' : 'error');
    });
    return () => { active = false; };
  }, [token, attempt]);

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
        {state === 'error' && (
          <div role="alert">
            <p className="text-sm text-muted-foreground mb-6">Не удалось проверить ссылку. Попробуйте ещё раз.</p>
            <button onClick={() => setAttempt(n => n + 1)} className="inga-btn-primary w-full">Повторить</button>
          </div>
        )}
      </div>
    </div>
  );
}

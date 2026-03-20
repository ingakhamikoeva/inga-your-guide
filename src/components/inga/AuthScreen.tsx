import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/context/AppContext';

type AuthMode = 'login' | 'signup';

export function AuthScreen() {
  const { setStep } = useApp();
  const [mode, setMode] = useState<AuthMode>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [confirmSent, setConfirmSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'signup') {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (signUpError) throw signUpError;
        setConfirmSent(true);
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
        setStep('welcome');
      }
    } catch (err: any) {
      setError(err.message || 'Произошла ошибка');
    } finally {
      setLoading(false);
    }
  };

  if (confirmSent) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-6 py-10 animate-fade-in-up">
        <div className="inga-bubble text-center max-w-sm">
          <p className="text-lg font-semibold mb-2">📬 Проверь почту!</p>
          <p className="text-muted-foreground">
            Мы отправили ссылку для подтверждения на <strong>{email}</strong>.
            После подтверждения вернись сюда и войди.
          </p>
        </div>
        <button
          onClick={() => { setConfirmSent(false); setMode('login'); }}
          className="inga-btn-primary mt-6 w-full max-w-sm"
        >
          Войти
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 py-10 animate-fade-in-up">
      <h2 className="text-2xl font-bold mb-2">
        {mode === 'signup' ? 'Создай аккаунт' : 'Вход'}
      </h2>
      <p className="text-muted-foreground mb-6 text-center max-w-xs">
        {mode === 'signup'
          ? 'Чтобы я могла сохранять твой прогресс'
          : 'С возвращением! 💛'}
      </p>

      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="inga-input"
            placeholder="email@example.com"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Пароль</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="inga-input"
            placeholder="Минимум 6 символов"
            minLength={6}
            required
          />
        </div>

        {error && (
          <div className="text-sm text-red-500 bg-red-50 rounded-xl px-4 py-2">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="inga-btn-primary w-full"
        >
          {loading ? '...' : mode === 'signup' ? 'Зарегистрироваться' : 'Войти'}
        </button>
      </form>

      <button
        onClick={() => { setMode(mode === 'signup' ? 'login' : 'signup'); setError(''); }}
        className="mt-4 text-sm text-muted-foreground underline"
      >
        {mode === 'signup' ? 'Уже есть аккаунт? Войти' : 'Нет аккаунта? Создать'}
      </button>
    </div>
  );
}

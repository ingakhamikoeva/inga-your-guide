import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { auth } from '@/lib/auth';
import { useApp } from '@/context/AppContext';

type AuthMode = 'login' | 'signup';

export function AuthScreen() {
  const { setStep } = useApp();
  const [mode, setMode] = useState<AuthMode>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setError('');
    setGoogleLoading(true);
    try {
      const result = await auth.signInWithOAuth('google', {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        setError(result.error.message || 'Ошибка входа через Google');
      }
    } catch (err: any) {
      setError(err.message || 'Ошибка входа через Google');
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    setError('');
    setAppleLoading(true);
    try {
      const result = await auth.signInWithOAuth('apple', {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        setError(result.error.message || 'Ошибка входа через Apple');
      }
    } catch (err: any) {
      setError(err.message || 'Ошибка входа через Apple');
    } finally {
      setAppleLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    setError('');
    setInfo('');
    if (!email) {
      setError('Введи email, на который придёт ссылка для восстановления');
      return;
    }
    setLoading(true);
    try {
      const { error: resetErr } = await auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (resetErr) throw resetErr;
      setInfo('Письмо с ссылкой для восстановления отправлено на ' + email);
    } catch (err: any) {
      setError(err.message || 'Не удалось отправить письмо');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);

    try {
      if (mode === 'signup') {
        const { data, error: signUpError } = await auth.signUp({
          email,
          password,
        });
        if (signUpError) throw signUpError;
        if (data.session) {
          setStep('welcome');
        } else {
          setInfo('Мы отправили письмо для подтверждения на ' + email + '. Перейди по ссылке из письма, затем войди.');
          setMode('login');
        }
      } else {
        const { error: signInError } = await auth.signInWithPassword({
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
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="inga-input pr-12"
              placeholder="Минимум 6 символов"
              minLength={6}
              required
            />
            <button
              type="button"
              onMouseDown={e => e.preventDefault()}
              onClick={() => setShowPassword(v => !v)}
              aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
              className="absolute right-1 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center text-muted-foreground hover:text-foreground rounded-full"
            >
              {showPassword ? <EyeOff className="w-[18px] h-[18px]" strokeWidth={1.75} /> : <Eye className="w-[18px] h-[18px]" strokeWidth={1.75} />}
            </button>
          </div>
        </div>

        {error && (
          <div className="text-sm text-destructive bg-destructive/10 rounded-xl px-4 py-2">
            {error}
          </div>
        )}
        {info && (
          <div className="text-sm text-foreground bg-primary/10 rounded-xl px-4 py-3">
            {info}
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

      <div className="w-full max-w-sm mt-4 flex items-center gap-3">
        <div className="flex-1 h-px bg-border" />
        <span className="text-xs text-muted-foreground">или</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      <button
        onClick={handleGoogleSignIn}
        disabled={googleLoading}
        className="mt-4 w-full max-w-sm flex items-center justify-center gap-3 rounded-2xl border border-border bg-background px-4 py-3 text-sm font-medium shadow-sm transition hover:bg-accent"
      >
        <svg width="20" height="20" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59a14.5 14.5 0 0 1 0-9.18l-7.98-6.19a24.01 24.01 0 0 0 0 21.56l7.98-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
        {googleLoading ? '...' : 'Войти через Google'}
      </button>

      <button
        onClick={handleAppleSignIn}
        disabled={appleLoading}
        className="mt-2 w-full max-w-sm flex items-center justify-center gap-3 rounded-2xl border border-border bg-foreground text-background px-4 py-3 text-sm font-medium shadow-sm transition hover:opacity-90"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/></svg>
        {appleLoading ? '...' : 'Войти через Apple'}
      </button>

      <button
        onClick={() => { setMode(mode === 'signup' ? 'login' : 'signup'); setError(''); setInfo(''); }}
        className="mt-4 text-sm text-muted-foreground underline"
      >
        {mode === 'signup' ? 'Уже есть аккаунт? Войти' : 'Нет аккаунта? Создать'}
      </button>

      {mode === 'login' && (
        <button
          type="button"
          onClick={handleForgotPassword}
          disabled={loading}
          className="mt-2 text-sm text-muted-foreground underline"
        >
          Забыл пароль?
        </button>
      )}
    </div>
  );
}

import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { auth } from '@/lib/auth';
import { useApp } from '@/context/AppContext';
import { AppStep } from '@/lib/types';

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
          setStep('welcome' as AppStep);
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
        setStep('welcome' as AppStep);
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

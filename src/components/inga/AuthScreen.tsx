import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { auth } from '@/lib/auth';
import { useApp } from '@/context/AppContext';
import { AppStep } from '@/lib/types';
import girlImg from '@/assets/legche-girl.png';

type AuthMode = 'login' | 'signup';

export function AuthScreen() {
  const { setStep, hydrateFromDb } = useApp();
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
      setError('Введите email, на который придёт ссылка для восстановления');
      return;
    }
    setLoading(true);
    try {
      const { error: resetErr } = await auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (resetErr) throw resetErr;
      setInfo('Письмо со ссылкой для восстановления отправлено на ' + email);
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
          setStep('survey-name' as AppStep);
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
        await hydrateFromDb();
        // hydrateFromDb уже вызывает setStep внутри себя
      }
    } catch (err: any) {
      setError(err.message || 'Произошла ошибка');
    } finally {
      setLoading(false);
    }
  };

  const isSignup = mode === 'signup';

  return (
    <div className="flex flex-col items-center min-h-screen px-6 py-10 animate-fade-in-up">
      <div className="w-full max-w-sm">
        {isSignup ? (
          /* Заголовок повторяет лендинг: фигурка картинкой, текст — текстом,
             чтобы на маленьких экранах он оставался крупным и чётким. */
          <div className="flex items-center gap-3 mb-3" style={{ justifyContent: 'flex-start' }}>
            <img
              src={girlImg}
              alt=""
              aria-hidden="true"
              className="shrink-0"
              style={{ width: '28%', maxWidth: 104, height: 'auto' }}
            />
            {/* Замок как на лендинге: Golos Text, ЛЕГЧЕ бордовым (#601645),
                верхняя и нижняя строки растянуты ровно по ширине этого слова. */}
            <div style={{ fontFamily: "'Golos Text', system-ui, sans-serif", lineHeight: 1.05, display: 'inline-block' }}>
              <div
                style={{
                  color: '#7A6A5E',
                  fontSize: 'clamp(12px, 4vw, 16px)',
                  fontWeight: 500,
                  textAlign: 'justify',
                  textAlignLast: 'justify',
                }}
              >
                Снизить вес
              </div>
              <div
                style={{
                  color: '#601645',
                  fontSize: 'clamp(30px, 11vw, 44px)',
                  fontWeight: 700,
                  letterSpacing: '0.02em',
                  lineHeight: 1,
                }}
              >
                ЛЕГЧЕ
              </div>
              <div
                style={{
                  color: '#7A6A5E',
                  fontSize: 'clamp(12px, 4vw, 16px)',
                  fontWeight: 500,
                  textAlign: 'justify',
                  textAlignLast: 'justify',
                }}
              >
                чем кажется
              </div>
            </div>
          </div>
        ) : (
          <h2 className="text-2xl font-bold mb-2">Вход</h2>
        )}
        <p className="text-muted-foreground mb-6">
          {isSignup
            ? (<><span className="font-medium text-foreground">Метод «Лёгкая замена»:</span> не убирать любимое, а находить более лёгкую версию. Без запретов и срывов.</>)
            : 'С возвращением! 💛'}
        </p>

        {isSignup && (
          <p className="text-sm text-muted-foreground mb-4">
            Создайте профиль — и мы начнём прямо сейчас
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="inga-input"
              placeholder="Email"
              required
            />
          </div>
          <div>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="inga-input pr-12"
                placeholder={isSignup ? 'Пароль (минимум 6 символов)' : 'Пароль'}
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
            {loading ? '...' : isSignup ? 'Начать →' : 'Войти'}
          </button>
        </form>

        <div className="mt-4 text-center text-sm text-muted-foreground">
          {isSignup ? (
            <>
              Уже есть аккаунт?{' '}
              <button
                onClick={() => { setMode('login'); setError(''); setInfo(''); }}
                className="text-primary font-medium underline"
              >
                Войти
              </button>
            </>
          ) : (
            <button
              onClick={() => { setMode('signup'); setError(''); setInfo(''); }}
              className="underline"
            >
              Нет аккаунта? Создать
            </button>
          )}
        </div>

        {mode === 'login' && (
          <div className="mt-2 text-center">
            <button
              type="button"
              onClick={handleForgotPassword}
              disabled={loading}
              className="text-sm text-muted-foreground underline"
            >
              Забыли пароль?
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

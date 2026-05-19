import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  useEffect(() => {
    // Supabase auto-parses tokens from URL hash on load and fires PASSWORD_RECOVERY
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
        setReady(true);
      }
    });
    // If user already has a recovery session
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);
    try {
      const { error: updErr } = await supabase.auth.updateUser({ password });
      if (updErr) throw updErr;
      setInfo('Пароль обновлён. Перенаправляю...');
      setTimeout(() => navigate('/'), 1200);
    } catch (err: any) {
      setError(err.message || 'Не удалось обновить пароль');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 py-10 animate-fade-in-up">
      <h2 className="text-2xl font-bold mb-2">Новый пароль</h2>
      <p className="text-muted-foreground mb-6 text-center max-w-xs">
        Придумай новый пароль для входа
      </p>

      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
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
              disabled={!ready}
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

        {!ready && (
          <div className="text-sm text-muted-foreground bg-muted/50 rounded-xl px-4 py-2">
            Проверяю ссылку восстановления...
          </div>
        )}
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

        <button type="submit" disabled={loading || !ready} className="inga-btn-primary w-full">
          {loading ? '...' : 'Сохранить пароль'}
        </button>
      </form>
    </div>
  );
}

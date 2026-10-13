import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Link } from 'react-router-dom';
import { SubscriptionCheckout } from '@/components/inga/SubscriptionScreens';
import { currentSession, subscribe } from '@/lib/auth-storage';
import { ApiError } from '@/lib/api-client';
import { formatBillingDate, formatMoney } from '@/lib/subscription-preview';
import {
  createPayment, isTestPaymentPage, loadPaymentState, resumePayment, submitTestPayment,
  type PaymentOrder, type PaymentQuote, type PaymentState,
} from '@/lib/payments';

const sessionOwner = () => currentSession()?.user.id || null;
function subscribeOwner(onChange: () => void) {
  const unsubscribe = subscribe(onChange);
  window.addEventListener('storage', onChange);
  return () => { unsubscribe(); window.removeEventListener('storage', onChange); };
}
function paymentError(error: unknown): string {
  const code = error instanceof Error ? error.message : '';
  if (error instanceof ApiError && error.status === 401) return 'Войдите в тестовый аккаунт и откройте эту страницу снова.';
  if (code === 'email_not_verified') return 'Подтвердите электронную почту в профиле приложения, затем обновите эту страницу.';
  if (code === 'quote_expired' || code === 'price_changed') return 'Условия оплаты обновились. Проверьте сумму и подтвердите согласие ещё раз.';
  if (code === 'payment_pending') return 'У вас уже есть незавершённый заказ. Продолжите его оплату ниже.';
  if (code === 'payments_disabled') return 'Тестовая оплата сейчас выключена.';
  return 'Не удалось выполнить запрос. Нажмите «Проверить статус» перед повторной попыткой оплаты.';
}

export default function SubscriptionTest() {
  const owner = useSyncExternalStore(subscribeOwner, sessionOwner, () => null);
  return <div className="min-h-screen px-4 py-6 sm:py-10"><div className="mx-auto max-w-lg space-y-6">
    <aside className="rounded-2xl border border-dashed border-[#601645]/40 bg-white p-4 text-sm space-y-2">
      <p className="font-bold text-[#601645]">Тестовая оплата · реальные деньги не списываются</p>
      <p>Проверяем оформление заказа и сохранение согласия. После успешной тестовой оплаты доступ продлится только в тестовом аккаунте. Автопродление не включается.</p>
    </aside>
    <Link to="/" className="inline-block text-sm text-muted-foreground underline">← В приложение</Link>
    {!isTestPaymentPage() ? <p role="alert">Эта страница доступна только на тестовом сайте.</p>
      : !owner ? <p role="status">Войдите в тестовый аккаунт и откройте эту страницу снова.</p>
      : <TestCheckout key={owner} owner={owner} />}
    <footer className="pt-3 pb-6 text-sm text-muted-foreground"><a href="mailto:support@legche.online" className="underline">support@legche.online</a></footer>
  </div></div>;
}

function TestCheckout({ owner }: { owner: string }) {
  const [state, setState] = useState<PaymentState | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const alive = useRef(false);
  const locked = useRef(false);
  const navigationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const current = useCallback(() => alive.current && sessionOwner() === owner, [owner]);

  const refresh = useCallback(async () => {
    if (locked.current || !current()) return;
    locked.current = true; setBusy(true); setError(''); setState(null);
    try {
      const next = await loadPaymentState();
      if (current()) setState(next);
    } catch (e) { if (current()) setError(paymentError(e)); }
    finally { locked.current = false; if (current()) setBusy(false); }
  }, [current]);

  useEffect(() => {
    alive.current = true;
    void refresh();
    const restored = (event: PageTransitionEvent) => {
      if (event.persisted) {
        if (navigationTimer.current) clearTimeout(navigationTimer.current);
        locked.current = false; void refresh();
      }
    };
    window.addEventListener('pageshow', restored);
    return () => {
      alive.current = false;
      if (navigationTimer.current) clearTimeout(navigationTimer.current);
      window.removeEventListener('pageshow', restored);
    };
  }, [refresh]);

  const pay = async (selected: PaymentQuote | PaymentOrder) => {
    if (locked.current || !current()) return;
    locked.current = true; setBusy(true); setError('');
    let navigating = false;
    try {
      const result = 'token' in selected ? await createPayment(selected) : await resumePayment(selected);
      if (!current()) return;
      submitTestPayment(result, { amount: selected.amount, ...('invoice' in selected ? { invoice: selected.invoice } : {}) });
      if (result.status === 'paid') {
        const next = await loadPaymentState();
        if (current()) setState(next);
      } else {
        navigating = true;
        // If browser navigation is interrupted, unlock via a fresh status read.
        navigationTimer.current = setTimeout(() => {
          if (current()) { locked.current = false; void refresh(); }
        }, 10000);
      }
    } catch (e) {
      if (current()) {
        setError(paymentError(e));
        // A lost response can still mean that an order was committed. Discover
        // that invoice before offering a new quote. Never retry a POST blindly.
        setState(null);
        try { const next = await loadPaymentState(); if (current()) setState(next); }
        catch { /* Keep checkout hidden until a successful status check. */ }
      }
    } finally {
      if (!navigating) { locked.current = false; if (current()) setBusy(false); }
    }
  };

  const pending = state?.orders.find(order => order.status === 'pending');
  const paid = state?.orders.filter(order => order.status === 'paid') ?? [];
  return <main className="space-y-5" aria-busy={busy}>
    {error && <p role="alert" className="rounded-xl border border-destructive/40 bg-white p-4 text-sm">{error}</p>}
    {busy && <p role="status" className="text-sm text-muted-foreground">Загрузка…</p>}
    <button type="button" disabled={busy} onClick={() => void refresh()} className="inga-btn-outline w-full disabled:opacity-50">Проверить статус</button>
    {state && !state.available && <p role="status">Тестовая оплата сейчас выключена.</p>}
    {state?.available && !state.emailVerified && <p role="status">Подтвердите электронную почту в профиле приложения, затем обновите эту страницу.</p>}
    {pending && <section className="inga-card !bg-white space-y-3">
      <h1 className="text-xl font-bold">Незавершённый заказ</h1>
      <p>{pending.plan === 'month' ? 'Месяц' : 'Год'} · {formatMoney(pending.amount)}</p>
      <p className="break-all text-xs text-muted-foreground">№ {pending.invoice}</p>
      <p className="text-sm">Если вы уже оплатили заказ, нажмите «Проверить статус». Подтверждение может прийти не сразу.</p>
      <button type="button" disabled={busy || !state.emailVerified} onClick={() => void pay(pending)} className="inga-btn-primary w-full disabled:opacity-50">Продолжить тестовую оплату</button>
    </section>}
    {!!paid.length && <section className="inga-card !bg-white space-y-4">
      <h2 className="font-bold">Подтверждённые тестовые платежи</h2>
      {paid.map(order => <div key={order.invoice} className="text-sm space-y-1">
        <p>{order.plan === 'month' ? 'Месяц' : 'Год'} · {formatMoney(order.amount)}</p>
        <p className="break-all text-xs text-muted-foreground">№ {order.invoice}</p>
        <p>Доступ по этому заказу продлён до {formatBillingDate(order.accessUntil!)}</p>
      </div>)}
      <p className="text-sm">Автопродление: выключено</p>
    </section>}
    {!!state?.quotes.length && <SubscriptionCheckout quotes={state.quotes} busy={busy} testOnly onContinue={selected => {
      const quote = state.quotes.find(item => item.id === selected.id);
      if (quote) void pay(quote);
    }} />}
  </main>;
}

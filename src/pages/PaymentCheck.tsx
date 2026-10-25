import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Link } from 'react-router-dom';
import { currentSession, subscribe } from '@/lib/auth-storage';
import { ApiError } from '@/lib/api-client';
import { formatBillingDate } from '@/lib/subscription-preview';
import { checkoutPilot, isLivePilotPage, loadPilot, submitPilot, type PilotState } from '@/lib/live-payment-pilot';

const sessionOwner=()=>currentSession()?.user.id || null;
function subscribeOwner(change:()=>void) {
  const stop=subscribe(change); window.addEventListener('storage',change);
  return ()=>{stop();window.removeEventListener('storage',change);};
}
function message(e:unknown):string {
  if (e instanceof ApiError && e.status===401) return 'Войдите в приложение и откройте эту страницу снова.';
  const code=e instanceof Error ? e.message : '';
  if (['pilot_unavailable','pilot_used'].includes(code)) return 'Проверочная оплата недоступна для этого аккаунта или ещё не настроена.';
  if (code==='pilot_disabled') return 'Приём проверочной оплаты сейчас выключен.';
  if (code==='email_not_verified') return 'Сначала подтвердите электронную почту в приложении.';
  if (code==='email_changed') return 'Почта аккаунта изменилась после создания заказа. Перед оплатой обратитесь в поддержку.';
  if (code==='payment_pending') return 'В аккаунте уже есть незавершённый платёж или включённое автопродление. Сначала проверьте его состояние.';
  return 'Не удалось проверить оплату. Нажмите «Проверить статус». Если деньги списались, повторно платить не нужно.';
}
export default function PaymentCheck() {
  const owner=useSyncExternalStore(subscribeOwner,sessionOwner,()=>null);
  useEffect(()=>{
    // Browser return parameters are not evidence of payment. Do not retain them.
    if (window.location.search || window.location.hash) window.history.replaceState(null,'','/payment-check');
  },[]);
  return <div className="min-h-screen px-5 py-8"><div className="mx-auto max-w-lg space-y-5">
    <Link to="/" className="text-muted-foreground underline">← В приложение</Link>
    <h1 className="text-2xl font-bold">Проверка оплаты</h1>
    <p className="text-base">Это реальная оплата: с карты будут списаны 100 ₽.</p>
    {!isLivePilotPage() ? <p role="status">Эта страница доступна только в основном приложении.</p>
      : !owner ? <p role="status">Войдите в приложение и откройте эту страницу снова.</p>
      : <PilotCheckout key={owner} owner={owner} />}
    <a href="mailto:support@legche.online" className="block text-sm text-muted-foreground underline">support@legche.online</a>
  </div></div>;
}
function PilotCheckout({owner}:{owner:string}) {
  const [state,setState]=useState<PilotState|null>(null);
  const [busy,setBusy]=useState(true),[error,setError]=useState(''),[consent,setConsent]=useState(false);
  const alive=useRef(false),locked=useRef(false);
  const timer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const current=useCallback(()=>alive.current && sessionOwner()===owner,[owner]);
  const refresh=useCallback(async()=>{
    if (!current() || locked.current) return;
    locked.current=true;setBusy(true);setError('');setState(null);setConsent(false);
    try { const next=await loadPilot();if(current())setState(next); }
    catch(e){if(current())setError(message(e));}
    finally{locked.current=false;if(current())setBusy(false);}
  },[current]);
  useEffect(()=>{
    alive.current=true;void refresh();
    const restored=(e:PageTransitionEvent)=>{if(e.persisted){locked.current=false;void refresh();}};
    window.addEventListener('pageshow',restored);
    return()=>{alive.current=false;if(timer.current)clearTimeout(timer.current);window.removeEventListener('pageshow',restored);};
  },[refresh]);
  const pay=async()=>{
    if(!current() || locked.current || !state || !consent || !state.available || !state.emailVerified || state.order?.status==='paid')return;
    locked.current=true;setBusy(true);setError('');let navigating=false;
    try{
      const result=await checkoutPilot(state);
      if(!current())return;
      submitPilot(result,state.order?.invoice);
      if(result.status==='paid'){const next=await loadPilot();if(current())setState(next);}
      else{navigating=true;timer.current=setTimeout(()=>{if(current()){locked.current=false;void refresh();}},10000);}
    }catch(e){
      if(current()){
        setError(message(e));setState(null);setConsent(false);
        try{const next=await loadPilot();if(current())setState(next);}catch{/* Keep payment hidden until a successful read. */}
      }
    }finally{if(!navigating){locked.current=false;if(current())setBusy(false);}}
  };
  const paid=state?.order?.status==='paid';
  return <main className="space-y-5" aria-busy={busy}>
    {busy && <p role="status">Проверяем статус…</p>}
    {error && <p role="alert" className="inga-card border border-destructive/30">{error}</p>}
    <button type="button" disabled={busy} onClick={()=>void refresh()} className="inga-btn-outline w-full disabled:opacity-50">Проверить статус</button>
    {paid ? <section className="inga-card space-y-3" role="status">
      <h2 className="text-xl font-bold">Оплата подтверждена</h2>
      <p>Оплачено 100 ₽. Доступ продлён до {formatBillingDate(state!.order!.accessUntil!)}.</p>
      <p>Автопродление выключено. Следующего автоматического списания не будет.</p>
      <Link to="/" className="inga-btn-primary flex w-full items-center justify-center text-center">Вернуться в приложение</Link>
    </section> : state && <section className="inga-card space-y-4">
      <h2 className="text-xl font-bold">Месяц доступа · 100 ₽</h2>
      <p>Разовый платёж без автопродления. Месяц добавится к текущему периоду доступа, а если доступ уже завершён — начнётся после оплаты.</p>
      {state.order && <p role="status">Заказ создан, подтверждение оплаты ещё не получено. Если деньги уже списались, нажмите «Проверить статус». Повторно платить не нужно.</p>}
      {!state.available ? <p role="status">Проверочная оплата сейчас выключена.</p>
        : !state.emailVerified ? <p role="status">Сначала подтвердите электронную почту в приложении.</p>
        : <>
          <label className="flex items-start gap-3 text-base leading-relaxed">
            <input type="checkbox" checked={consent} disabled={busy} onChange={e=>setConsent(e.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-orange-500" />
            <span>Я принимаю <a href={state.offer.url} target="_blank" rel="noopener noreferrer" className="underline">условия оферты</a> и оплачиваю один месяц доступа за 100 ₽ без автопродления.</span>
          </label>
          <button type="button" onClick={()=>void pay()} disabled={busy || !consent} className="inga-btn-primary w-full disabled:opacity-50">{state.order ? 'Продолжить оплату 100 ₽' : 'Оплатить 100 ₽'}</button>
        </>}
    </section>}
  </main>;
}

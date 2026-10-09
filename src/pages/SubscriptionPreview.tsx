import { useState } from 'react';
import { Link } from 'react-router-dom';
import { SubscriptionCheckout, SubscriptionManagement } from '@/components/inga/SubscriptionScreens';
import { previewQuotes, type PreviewPlan, type PreviewPrice } from '@/lib/subscription-preview';

// Deliberately isolated from account state, storage, payment APIs and providers.
// This route is a review tool, not a real checkout or evidence of a paid plan.
export default function SubscriptionPreview() {
  const [startsAt] = useState(() => {
    const now = new Date(); now.setSeconds(0, 0); return now.toISOString();
  });
  const [screen, setScreen] = useState<'checkout' | 'manage'>('checkout');
  const [price, setPrice] = useState<PreviewPrice>('special');
  const [plan, setPlan] = useState<PreviewPlan>('month');
  const [autoRenew, setAutoRenew] = useState(true);
  const [message, setMessage] = useState('');
  const quotes = previewQuotes(startsAt, price);
  const quote = quotes.find(item => item.plan === plan)!;

  return <div className="min-h-screen px-4 py-6 sm:py-10">
    <div className="mx-auto max-w-lg space-y-6">
      <aside aria-label="Настройки предпросмотра" className="rounded-2xl border border-dashed border-[#601645]/40 bg-white p-4 text-sm space-y-3">
        <p className="font-bold text-[#601645]">Предпросмотр · оплата не подключена</p>
        <p className="text-muted-foreground">Все суммы, даты и статусы ниже — пример. Деньги не списываются, доступ и настройки аккаунта не меняются.</p>
        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1"><span className="block">Экран</span>
            <select className="w-full rounded-lg border border-border bg-background p-2" value={screen}
              onChange={e => { setScreen(e.target.value as 'checkout' | 'manage'); setMessage(''); }}>
              <option value="checkout">Оформление</option><option value="manage">Управление</option>
            </select>
          </label>
          <label className="space-y-1"><span className="block">Цена</span>
            <select className="w-full rounded-lg border border-border bg-background p-2" value={price}
              onChange={e => { setPrice(e.target.value as PreviewPrice); setMessage(''); }}>
              <option value="special">Спеццена</option><option value="standard">Обычная</option>
            </select>
          </label>
        </div>
        {screen === 'manage' && <div className="flex flex-wrap gap-3 items-center">
          <label>Период <select className="rounded-lg border border-border p-2 ml-1" value={plan}
            onChange={e => { setPlan(e.target.value as PreviewPlan); setMessage(''); }}>
            <option value="month">Месяц</option><option value="year">Год</option>
          </select></label>
          <button type="button" className="underline" onClick={() => { setAutoRenew(true); setMessage(''); }}>Сбросить пример отмены</button>
        </div>}
      </aside>
      <Link to="/" className="inline-block text-sm text-muted-foreground underline">← В приложение</Link>
      {message && <p role="status" className="rounded-xl border border-[#601645]/30 bg-white p-4 text-sm">{message}</p>}
      <main>
        {screen === 'checkout' ? <SubscriptionCheckout key={price} quotes={quotes} onContinue={selected => {
          setPlan(selected.plan);
          setMessage('В предпросмотре переход к оплате отключён. Заказ не создан, деньги не списаны.');
        }} /> : <SubscriptionManagement quote={quote} autoRenew={autoRenew} onCancel={() => {
          setAutoRenew(false);
          setMessage('Изменён только пример на этой странице. Настройки реального аккаунта не менялись.');
        }} />}
      </main>
      <footer className="pt-3 pb-6 text-sm text-muted-foreground">
        <a href="mailto:support@legche.online" className="underline">support@legche.online</a>
      </footer>
    </div>
  </div>;
}

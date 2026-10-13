import { useEffect, useState } from 'react';
import { Check, CreditCard, Bell, CalendarDays } from 'lucide-react';
import {
  AUTO_RENEW_CONSENT, SPECIAL_PRICE_TERMS, OFFER_URL, formatMoney, formatBillingDate,
  type PreviewPlan, type SubscriptionQuote,
} from '@/lib/subscription-preview';

const period = (plan: PreviewPlan) => plan === 'month' ? 'месяц' : 'год';
const heading = (plan: PreviewPlan) => plan === 'month' ? 'Месяц' : 'Год';
export type CheckoutQuote = SubscriptionQuote & {
  consentText?: string; consentVersion?: string;
  offer?: { url: string; version: string; sha256: string };
  specialPriceTerms?: string;
};
const termsKey = (q: CheckoutQuote) => JSON.stringify([q.id, q.plan, q.amount, q.special, q.startsAt, q.renewsAt,
  q.consentText ?? AUTO_RENEW_CONSENT, q.consentVersion, q.offer, q.specialPriceTerms ?? SPECIAL_PRICE_TERMS]);

export function SubscriptionCheckout({ quotes, onContinue, busy = false, testOnly = false }: {
  quotes: CheckoutQuote[];
  onContinue: (quote: CheckoutQuote) => void;
  busy?: boolean;
  testOnly?: boolean;
}) {
  const [plan, setPlan] = useState<PreviewPlan>('month');
  const [accepted, setAccepted] = useState<string | null>(null);
  const quote = quotes.find(item => item.plan === plan);
  const key = quote ? termsKey(quote) : '';
  const agreed = !!key && accepted === key;
  // Any update to the displayed conditions requires a fresh affirmative action.
  useEffect(() => { setAccepted(null); }, [key]);

  return <section aria-labelledby="checkout-heading" className="space-y-5">
    <div>
      <p className="text-sm font-bold tracking-widest text-primary mb-2">ЛЕГЧЕ</p>
      <h1 id="checkout-heading" className="text-3xl font-bold leading-tight">Снизить вес и сохранить результат</h1>
      <p className="mt-4 text-sm leading-relaxed text-muted-foreground">Осваивайте лёгкие замены, находите любимые рецепты и выстраивайте питание, которое подходит вашей жизни. Инга поможет разобраться с повседневными вопросами, а дневник — видеть изменения.</p>
    </div>
    <div className="inga-card !bg-white space-y-3">
      <p className="font-bold">В подписку входят</p>
      {[
        ['ИИ-помощник Инга', 'обсудить питание, подобрать замену привычному блюду и получить поддержку.'],
        ['Дневник питания и веса', 'отслеживать свой путь и возвращаться к записям.'],
        ['Рецепты лёгких блюд', 'находить идеи для завтраков, обедов, ужинов и десертов.'],
        ['Программа «Лёгкая замена»', 'короткие уроки и практические задания, которые помогают разбираться в питании и постепенно менять привычки.'],
        ['Гайды, таблицы и шпаргалки', 'держать полезные подсказки под рукой.'],
      ].map(([title, text]) =>
        <p key={title} className="flex items-start gap-2 text-sm leading-relaxed"><Check className="h-4 w-4 shrink-0 text-primary mt-1" aria-hidden="true" /><span><strong>{title}</strong> — {text}</span></p>)}
    </div>
    <fieldset disabled={busy}>
      <legend className="font-bold mb-3">Выберите срок доступа</legend>
      <div className="grid grid-cols-2 gap-3">
        {quotes.map(item => <label key={item.plan} className={`relative cursor-pointer rounded-2xl border-2 p-4 transition-colors ${plan === item.plan ? 'border-primary bg-primary/5' : 'border-border bg-white'}`}>
          <span className="flex items-center justify-between gap-2">
            <span className="font-bold">{heading(item.plan)}</span>
            <input type="radio" name="subscription-plan" value={item.plan} checked={plan === item.plan}
              onChange={() => { setAccepted(null); setPlan(item.plan); }} aria-label={heading(item.plan)} className="h-4 w-4 accent-[#FF6200]" />
          </span>
          <span className="block mt-3 text-2xl font-extrabold whitespace-nowrap">
            {formatMoney(item.plan === 'year' ? Math.round(item.amount / 12 / 100) * 100 : item.amount)}
          </span>
          <span className="block mt-1 text-xs text-muted-foreground">{item.plan === 'month' ? 'за календарный месяц' : 'в месяц'}</span>
          {item.plan === 'year' && <span className="block mt-2 text-sm leading-snug">
            при оплате <strong className="whitespace-nowrap">{formatMoney(item.amount)}</strong> за год
          </span>}
          <span className="block mt-3 text-xs leading-relaxed text-muted-foreground">{item.plan === 'year' ? 'Для снижения и поддержания веса.' : 'Чтобы начать и освоиться.'}</span>
        </label>)}
      </div>
    </fieldset>
    <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5 space-y-3">
      <h2 className="font-bold text-lg leading-snug">Зачем оставаться после достижения цели?</h2>
      <p className="text-sm leading-relaxed">После снижения веса наступают важные этапы: фиксация и сохранение результата. Впереди обычная жизнь: семейные ужины, праздники, поездки. На этапе фиксации вы учитесь постепенно расширять рацион, сохраняя привычки, которые помогли снизить вес.</p>
      <p className="text-sm leading-relaxed">С годовой подпиской рецепты, уроки, гайды, шпаргалки и разборы вашего рациона с ИИ-помощником Ингой доступны весь оплаченный период. Можно продолжать вести дневник, наблюдать за весом и обращаться к Инге по вопросам питания — в том числе после достижения цели.</p>
    </div>
    {quote && <>
      {quote.special && <div className="space-y-2">
        <p className="font-bold text-[#601645]">Спеццена для первых 100 участников</p>
        <p className="text-sm leading-relaxed text-muted-foreground">{quote.specialPriceTerms ?? SPECIAL_PRICE_TERMS}</p>
      </div>}
      <div className="inga-card !bg-white space-y-4">
        <div className="flex justify-between items-center gap-3">
          <span>К оплате сейчас</span><strong className="text-2xl text-primary whitespace-nowrap">{formatMoney(quote.amount)}</strong>
        </div>
        <div className="border-t border-border pt-4 text-sm space-y-3">
          <p className="flex gap-2"><CalendarDays className="h-4 w-4 shrink-0 mt-1" aria-hidden="true" /><span>Период доступа:<br />{formatBillingDate(quote.startsAt)} — {formatBillingDate(quote.renewsAt)}</span></p>
          {!testOnly && <>
            <p><strong>Следующее списание:</strong><br />{formatBillingDate(quote.renewsAt)} · {formatMoney(quote.amount)}</p>
            <p>Далее — {formatMoney(quote.amount)} каждый календарный {period(quote.plan)}, пока автопродление включено.</p>
          </>}
        </div>
      </div>
      {!testOnly && <div className="flex items-start gap-3 text-sm leading-relaxed">
        <Bell className="h-5 w-5 shrink-0 text-primary mt-0.5" aria-hidden="true" />
        <p>Напоминание придёт на электронную почту не позднее чем за 3 календарных дня. Отключить автопродление можно в личном кабинете.</p>
      </div>}
      <div className="rounded-2xl border border-border bg-white p-4">
        <label className="flex items-start gap-3 cursor-pointer">
          <input id="automatic-charge-consent" type="checkbox" checked={agreed} disabled={busy}
            onChange={event => setAccepted(event.target.checked ? key : null)} className="mt-1 h-5 w-5 shrink-0 accent-[#FF6200]" />
          <span className="text-sm leading-relaxed">{quote.consentText ?? AUTO_RENEW_CONSENT}</span>
        </label>
        <a href={quote.offer?.url ?? OFFER_URL} target="_blank" rel="noopener noreferrer" className="ml-8 mt-2 inline-block text-sm underline text-primary">Публичная оферта</a>
      </div>
      <button type="button" disabled={!agreed || busy} onClick={() => { if (agreed && !busy) onContinue(quote); }}
        className="inga-btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed">
        Оплатить {formatMoney(quote.amount)}
      </button>
      <p className="text-xs leading-relaxed text-muted-foreground flex items-start gap-2">
        <CreditCard className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
        Автоматические списания по иностранным картам недоступны.
      </p>
    </>}
  </section>;
}

export function SubscriptionManagement({ quote, autoRenew, onCancel }: {
  quote: SubscriptionQuote;
  autoRenew: boolean;
  onCancel: () => void;
}) {
  return <section aria-labelledby="management-heading" className="space-y-5">
    <div>
      <p className="text-sm font-bold tracking-widest text-primary mb-2">ЛЕГЧЕ</p>
      <h1 id="management-heading" className="text-3xl font-bold">Подписка</h1>
    </div>
    <div className="inga-card !bg-white space-y-4">
      <div className="flex justify-between items-center gap-3">
        <h2 className="text-xl font-bold">{heading(quote.plan)}</h2>
        <strong className="text-xl text-primary whitespace-nowrap">{formatMoney(quote.amount)}</strong>
      </div>
      {quote.special && <p className="text-sm text-[#601645]">Спеццена</p>}
      <p>Доступ оплачен до {formatBillingDate(quote.renewsAt)}</p>
      <div className="border-t border-border pt-4 space-y-2">
        <p className="font-bold">Автопродление: {autoRenew ? 'включено' : 'выключено'}</p>
        {autoRenew && <>
          <p className="text-sm">Следующее списание:<br />{formatBillingDate(quote.renewsAt)} · {formatMoney(quote.amount)}</p>
          <p className="text-sm text-muted-foreground">Каждый календарный {period(quote.plan)}. Напоминание придёт на электронную почту не позднее чем за 3 календарных дня.</p>
        </>}
      </div>
    </div>
    {autoRenew ? <>
      <button type="button" onClick={onCancel} className="inga-btn-outline w-full">Отключить автопродление</button>
      <p className="text-sm text-muted-foreground">После отключения доступ сохранится до окончания оплаченного периода.</p>
    </> : <p role="status" className="inga-card">Автопродление отключено. Оплаченный доступ сохранится до окончания периода.</p>}
    {quote.special && <p className="text-sm leading-relaxed text-muted-foreground">{SPECIAL_PRICE_TERMS}</p>}
    <a href={OFFER_URL} target="_blank" rel="noopener noreferrer" className="text-sm underline text-primary">Публичная оферта</a>
  </section>;
}

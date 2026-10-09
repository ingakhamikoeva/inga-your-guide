// Fixtures for /subscription-preview only. Never use these prices or dates
// to create a real payment: production checkout must receive a server quote.
export type PreviewPlan = 'month' | 'year';
export type PreviewPrice = 'special' | 'standard';
export interface SubscriptionQuote {
  id: string;
  plan: PreviewPlan;
  amount: number;
  special: boolean;
  startsAt: string;
  renewsAt: string;
}

export const AUTO_RENEW_CONSENT = 'Я согласен на автоматические списания согласно условиям оферты';
export const SPECIAL_PRICE_TERMS = 'Спеццена сохраняется при непрерывном продлении. Если оплата не прошла, у вас есть ещё 3 дня после окончания оплаченного периода, чтобы продлить подписку по прежней цене. До оплаты новые записи и платные функции будут недоступны. Дневник останется доступен для просмотра и скачивания.';
export const OFFER_URL = 'https://legche.online/oferta';

export const formatMoney = (kopeks: number) => `${new Intl.NumberFormat('ru-RU').format(kopeks / 100)} ₽`;
export const formatBillingDate = (iso: string) => new Intl.DateTimeFormat('ru-RU', {
  timeZone: 'Europe/Moscow', day: 'numeric', month: 'long', year: 'numeric',
  hour: '2-digit', minute: '2-digit',
}).format(new Date(iso)) + ' МСК';

export function nextPreviewPeriod(iso: string, plan: PreviewPlan): string {
  const offset = 3 * 60 * 60 * 1000;
  const local = new Date(Date.parse(iso) + offset);
  if (!Number.isFinite(local.getTime())) throw new Error('Invalid preview date');
  const day = local.getUTCDate();
  local.setUTCDate(1);
  local.setUTCMonth(local.getUTCMonth() + (plan === 'year' ? 12 : 1));
  const lastDay = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth() + 1, 0)).getUTCDate();
  local.setUTCDate(Math.min(day, lastDay));
  return new Date(local.getTime() - offset).toISOString();
}

export function previewQuotes(startsAt: string, price: PreviewPrice): SubscriptionQuote[] {
  return (['month', 'year'] as const).map(plan => ({
    id: `preview:${price}:${plan}:${startsAt}`,
    plan,
    amount: plan === 'month' ? (price === 'special' ? 99000 : 149000) : (price === 'special' ? 499000 : 699000),
    special: price === 'special',
    startsAt,
    renewsAt: nextPreviewPeriod(startsAt, plan),
  }));
}

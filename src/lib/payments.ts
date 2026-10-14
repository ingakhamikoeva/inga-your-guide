import { API_BASE, apiFetch } from './api-client';
import { AUTO_RENEW_CONSENT, OFFER_URL, type SubscriptionQuote } from './subscription-preview';

export interface PaymentQuote extends SubscriptionQuote {
  recurring: boolean;
  token: string;
  expiresAt: string;
  consentText: string;
  consentVersion: string;
  offer: { url: string; version: string; sha256: string };
  specialPriceTerms: string;
  reminderDays: number;
}
export interface PaymentOrder {
  invoice: string;
  plan: 'month' | 'year';
  amount: number;
  special: boolean;
  status: 'pending' | 'paid';
  recurring: boolean;
  canResume: boolean;
  createdAt: string;
  accessUntil: string | null;
}
export interface RenewalState {
  enabled: boolean;
  pendingActivation: boolean;
  paused: boolean;
  plan?: 'month' | 'year';
  amount?: number;
  special?: boolean;
  dueAt?: string | null;
  chargeAt?: string | null;
  noticeSentAt?: string | null;
  awaitingPayment?: boolean;
}
export interface PaymentState {
  available: boolean;
  testOnly: true;
  autoRenew?: boolean;
  recurringAvailable?: boolean;
  renewal?: RenewalState;
  emailVerified?: boolean;
  quotes: PaymentQuote[];
  orders: PaymentOrder[];
}
export interface PaymentRedirect {
  invoice: string;
  status: 'pending' | 'paid';
  recurring?: boolean;
  action?: string;
  fields?: Record<string, string>;
}

const TEST_ORIGIN = 'https://test.legche.online';
const PAYMENT_URL = 'https://auth.robokassa.ru/Merchant/Index.aspx';
const invalid = () => { throw new Error('invalid_payment_response'); };
const date = (value: unknown) => typeof value === 'string' && Number.isFinite(Date.parse(value));
const invoice = (value: unknown) => typeof value === 'string' && /^1\d{17}$/.test(value);
const amount = (value: unknown) => Number.isSafeInteger(value) && Number(value) > 0;
const plan = (value: unknown) => value === 'month' || value === 'year';

// A wrongly configured build must never send this page's requests to production.
export function isTestPaymentPage(): boolean {
  try {
    const api = new URL(API_BASE, window.location.origin);
    return window.location.origin === TEST_ORIGIN && !!API_BASE
      && api.origin === TEST_ORIGIN && api.pathname === '/api/v1'
      && !api.username && !api.password && !api.search && !api.hash;
  } catch { return false; }
}
function requireTestPage() { if (!isTestPaymentPage()) throw new Error('payments_test_only'); }

export async function loadPaymentState(): Promise<PaymentState> {
  requireTestPage();
  const state = await apiFetch<PaymentState>('/payments/', { cache: 'no-store' });
  if (!state || state.testOnly !== true || typeof state.available !== 'boolean'
      || !Array.isArray(state.quotes) || !Array.isArray(state.orders)) invalid();
  if (!state.available && state.quotes.length) invalid();
  if (!state.available && !state.renewal && !state.orders.length) return state;
  if (typeof state.autoRenew !== 'boolean' || typeof state.emailVerified !== 'boolean'
      || typeof state.recurringAvailable !== 'boolean' || !state.renewal) invalid();
  const r = state.renewal!;
  if (typeof r.enabled !== 'boolean' || typeof r.pendingActivation !== 'boolean'
      || typeof r.paused !== 'boolean' || r.enabled !== state.autoRenew
      || (r.enabled && (!plan(r.plan) || !amount(r.amount) || !date(r.dueAt)))
      || (r.chargeAt != null && !date(r.chargeAt))
      || (r.noticeSentAt != null && !date(r.noticeSentAt))) invalid();
  for (const q of state.quotes) {
    if (!q || typeof q.recurring !== 'boolean' || q.recurring !== state.recurringAvailable || typeof q.id !== 'string' || !q.id || !plan(q.plan) || !amount(q.amount)
        || typeof q.special !== 'boolean' || !date(q.startsAt) || !date(q.renewsAt)
        || Date.parse(q.renewsAt) <= Date.parse(q.startsAt) || !date(q.expiresAt)
        || typeof q.token !== 'string' || !q.token || q.consentText !== AUTO_RENEW_CONSENT
        || typeof q.consentVersion !== 'string' || !q.consentVersion
        || q.offer?.url !== OFFER_URL || !/^[a-f0-9]{64}$/.test(q.offer?.sha256 || '')
        || typeof q.offer?.version !== 'string' || typeof q.specialPriceTerms !== 'string'
        || q.reminderDays !== 3) invalid();
  }
  if (state.quotes.length && (state.quotes.length !== 2
      || new Set(state.quotes.map(q => q.plan)).size !== 2)) invalid();
  for (const o of state.orders) {
    if (!o || typeof o.recurring !== 'boolean' || typeof o.canResume !== 'boolean' || !invoice(o.invoice) || !plan(o.plan) || !amount(o.amount)
        || typeof o.special !== 'boolean' || !date(o.createdAt)
        || !['pending', 'paid'].includes(o.status)
        || (o.status === 'paid' && !date(o.accessUntil))) invalid();
  }
  const pending = state.orders.filter(o => o.status === 'pending');
  if (pending.length > 1 || (pending.length && state.quotes.length)
      || ((!state.emailVerified || state.autoRenew) && state.quotes.length)) invalid();
  return state;
}

export async function createPayment(quote: PaymentQuote): Promise<PaymentRedirect> {
  requireTestPage();
  return apiFetch('/payments/checkout', { method: 'POST', body: { quote: quote.token, consent: true } });
}
export async function resumePayment(order: PaymentOrder): Promise<PaymentRedirect> {
  requireTestPage();
  if (!invoice(order.invoice) || order.canResume === false) invalid();
  return apiFetch(`/payments/orders/${order.invoice}/resume`, { method: 'POST', body: {} });
}

export async function cancelAutoRenewal(): Promise<void> {
  requireTestPage();
  const result = await apiFetch<{ cancelled: boolean }>('/payments/renewal/cancel', { method: 'POST', body: {} });
  if (result?.cancelled !== true) invalid();
}

export function submitTestPayment(result: PaymentRedirect, expected: { amount: number; invoice?: string; recurring?: boolean }): void {
  requireTestPage();
  if (!result || !invoice(result.invoice) || (expected.invoice && expected.invoice !== result.invoice)) invalid();
  if (result.status === 'paid') return;
  if (result.status !== 'pending' || result.action !== PAYMENT_URL || !result.fields) invalid();
  if ((result.recurring === true) !== (expected.recurring === true)) invalid();
  const fields = result.fields;
  const keys = ['MerchantLogin', 'OutSum', 'InvId', 'Description', 'Receipt', 'Email',
    'IsTest', 'Culture', 'Shp_env', 'Shp_order', 'SignatureValue'];
  if (expected.recurring === true) {
    keys.push('Recurring', 'PaymentMethods');
    if (fields.Recurring !== 'true' || fields.PaymentMethods !== 'BankCard') invalid();
  }
  if (Object.keys(fields).sort().join(',') !== keys.sort().join(',')
      || Object.values(fields).some(value => typeof value !== 'string' || value.length > 16000)
      || fields.IsTest !== '1' || fields.Shp_env !== 'test' || fields.Culture !== 'ru'
      || fields.MerchantLogin !== 'legcheonline' || fields.InvId !== result.invoice
      || fields.OutSum !== (expected.amount / 100).toFixed(2)
      || !/^[a-f0-9]{48}$/.test(fields.Shp_order)
      || !/^(?:[a-f0-9]{32}|[a-f0-9]{64}|[a-f0-9]{128})$/i.test(fields.SignatureValue)) invalid();
  // Native inputs avoid HTML interpolation and never include application tokens.
  const form = document.createElement('form');
  form.method = 'POST'; form.action = PAYMENT_URL; form.target = '_self';
  form.acceptCharset = 'UTF-8'; form.hidden = true;
  for (const [name, value] of Object.entries(fields)) {
    const input = document.createElement('input');
    input.type = 'hidden'; input.name = name; input.value = value; form.appendChild(input);
  }
  document.body.appendChild(form);
  try { HTMLFormElement.prototype.submit.call(form); }
  finally { form.remove(); }
}

import crypto from 'node:crypto';
import { rubles, kopeks } from './rules.js';

export const PAYMENT_URL = 'https://auth.robokassa.ru/Merchant/Index.aspx';
export function assertTestEnvironment() {
  // Deliberate hard stop: this release can NEVER create a live payment.
  if (process.env.PAYMENTS_MODE !== 'test') throw new Error('payments_test_only');
  const app = new URL(process.env.APP_URL || '');
  if (app.origin !== 'https://test.legche.online' || app.username || app.password) throw new Error('payments_environment_mismatch');
}
export function config() {
  assertTestEnvironment();
  const merchant = process.env.ROBOKASSA_MERCHANT_LOGIN;
  const password1 = process.env.ROBOKASSA_TEST_PASSWORD1;
  const password2 = process.env.ROBOKASSA_TEST_PASSWORD2;
  const algorithm = (process.env.ROBOKASSA_TEST_HASH || '').toLowerCase();
  if (!merchant || !password1 || !password2 || password1 === password2 || !['md5','sha256','sha512'].includes(algorithm)) throw new Error('payments_not_configured');
  return { merchant, password1, password2, algorithm, enabled: process.env.PAYMENTS_ENABLED === 'true',
    recurringEnabled: process.env.PAYMENTS_RECURRING_ENABLED === 'true' };
}
export function available() { try { return config().enabled; } catch { return false; } }
const hash = (text, c) => crypto.createHash(c.algorithm).update(text, 'utf8').digest('hex');
const suffix = o => `Shp_env=test:Shp_order=${o.nonce}`;
export function form(o, c = config()) {
  if (o.environment !== 'test' || o.merchant_login !== c.merchant || !c.enabled) throw new Error('payments_disabled');
  const receipt = encodeURIComponent(JSON.stringify(o.receipt));
  const fields = {
    MerchantLogin: c.merchant, OutSum: rubles(o.amount), InvId: o.invoice,
    Description: o.receipt.items[0].name, Receipt: receipt, Email: o.email,
    IsTest: '1', Culture: 'ru', Shp_env: 'test', Shp_order: o.nonce,
  };
  fields.SignatureValue = hash(`${c.merchant}:${fields.OutSum}:${o.invoice}:${receipt}:${c.password1}:${suffix(o)}`, c);
  if (o.kind === 'renewal') throw new Error('recurring_order_cannot_use_browser');
  if (o.kind === 'initial') {
    if (!c.recurringEnabled) throw new Error('renewals_disabled');
    fields.Recurring = 'true';
    fields.PaymentMethods = '["BankCard"]';
  }
  return { action: PAYMENT_URL, fields };
}

export function recurringForm(o, parent, c = config()) {
  // This adapter has no live-key fallback, configurable destination or browser
  // redirect. Old one-off payments can never be used as recurring parents.
  if (!c.enabled || !c.recurringEnabled || o.kind !== 'renewal' || parent.kind !== 'initial'
      || parent.status !== 'paid' || o.parent_invoice !== parent.invoice
      || o.environment !== 'test' || parent.environment !== 'test'
      || o.merchant_login !== c.merchant || parent.merchant_login !== c.merchant
      || o.user_id !== parent.user_id) throw new Error('invalid_recurring_order');
  const receipt = encodeURIComponent(JSON.stringify(o.receipt));
  return {
    MerchantLogin: c.merchant, OutSum: rubles(o.amount), InvoiceID: o.invoice,
    PreviousInvoiceID: parent.invoice, Description: o.receipt.items[0].name,
    Receipt: receipt, Email: o.email, IsTest: '1', Culture: 'ru',
    Shp_env: 'test', Shp_order: o.nonce,
    SignatureValue: hash(`${c.merchant}:${rubles(o.amount)}:${o.invoice}:${receipt}:${c.password1}:${suffix(o)}`, c),
  };
}

export async function sendRecurring(o, parent) {
  const body = new URLSearchParams(recurringForm(o, parent));
  try {
    const response = await fetch('https://auth.robokassa.ru/Merchant/Recurring', {
      method: 'POST', body, redirect: 'error', signal: AbortSignal.timeout(15000),
    });
    // Even OK means only "operation created". Access is granted by ResultURL.
    const text = await response.text();
    return response.ok && text.trim() === `OK${o.invoice}` ? 'accepted' : 'unknown';
  } catch { return 'unknown'; }
}
export function verify(body, order, c = config()) {
  if (!body || typeof body !== 'object' || order.environment !== 'test' || order.merchant_login !== c.merchant) return false;
  if (Object.keys(body).filter(k => k.toLowerCase().startsWith('shp_')).sort().join(',') !== 'Shp_env,Shp_order') return false;
  if (body.InvId !== order.invoice || body.Shp_env !== 'test' || body.Shp_order !== order.nonce) return false;
  if (typeof body.SignatureValue !== 'string' || !/^[a-fA-F0-9]+$/.test(body.SignatureValue)) return false;
  try { if (kopeks(body.OutSum) !== order.amount) return false; } catch { return false; }
  const expected = hash(`${body.OutSum}:${body.InvId}:${c.password2}:${suffix(order)}`, c);
  const received = body.SignatureValue.toLowerCase();
  return expected.length === received.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(received));
}

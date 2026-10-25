import crypto from 'node:crypto';
import { kopeks, receiptFor, validEmail } from './rules.js';

export const PILOT_AMOUNT = 10000;
export const PILOT_VERSION = 'live-pilot-100-v1';
export const PILOT_CONSENT = 'Я принимаю условия оферты и оплачиваю один месяц доступа за 100 ₽ без автопродления.';
export const PILOT_RETURN = 'https://app.legche.online/payment-check';
export const PILOT_PAYMENT_URL = 'https://auth.robokassa.ru/Merchant/Index.aspx';
export const isPilotInvoice = value => typeof value === 'string' && /^2\d{17}$/.test(value);
const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value);

// Callback credentials deliberately remain usable after creation is disabled.
// No fallback to test keys and no general live checkout/recurring support.
export function pilotConfig() {
  const e = process.env;
  const app = new URL(e.APP_URL || '');
  if (e.PAYMENTS_MODE !== 'live' || app.origin !== 'https://app.legche.online'
      || app.username || app.password || app.search || app.hash || app.pathname !== '/') {
    throw new Error('pilot_wrong_environment');
  }
  const merchant = e.ROBOKASSA_MERCHANT_LOGIN;
  const password1 = e.ROBOKASSA_PASSWORD1, password2 = e.ROBOKASSA_PASSWORD2;
  const algorithm = (e.ROBOKASSA_HASH || '').toLowerCase();
  if (merchant !== 'legcheonline' || !password1 || !password2 || password1 === password2
      || [e.ROBOKASSA_TEST_PASSWORD1,e.ROBOKASSA_TEST_PASSWORD2].filter(Boolean)
        .some(key => key === password1 || key === password2)
      || algorithm !== 'sha256') throw new Error('pilot_not_configured');
  const user = uuid(e.PAYMENTS_LIVE_PILOT_USER_ID) ? e.PAYMENTS_LIVE_PILOT_USER_ID.toLowerCase() : null;
  const enabled = e.PAYMENTS_ENABLED === 'true' && e.PAYMENTS_LIVE_PILOT_ENABLED === 'true'
    && e.PAYMENTS_RECURRING_ENABLED === 'false' && !!user;
  return { merchant, password1, password2, algorithm, user, enabled };
}
const hash = (value, c) => crypto.createHash(c.algorithm).update(value, 'utf8').digest('hex');
const suffix = o => `Shp_env=live:Shp_order=${o.nonce}`;
export function validPilotOrder(o, c) {
  return !!o && isPilotInvoice(o.invoice) && o.environment === 'live'
    && o.merchant_login === c.merchant && o.amount === PILOT_AMOUNT
    && o.plan === 'month' && /^[a-f0-9]{48}$/.test(o.nonce)
    && ['pending','paid'].includes(o.status);
}
export function pilotForm(o, c = pilotConfig()) {
  if (!c.enabled || o?.user_id !== c.user || !validPilotOrder(o,c)
      || o.status !== 'pending' || !validEmail(o.email)
      || JSON.stringify(o.receipt) === undefined) throw new Error('pilot_disabled');
  // Use the immutable receipt stored with this order; validate its actual content.
  const item = o.receipt?.items?.[0];
  const expected = receiptFor('month', PILOT_AMOUNT).items[0];
  if (!Array.isArray(o.receipt?.items) || o.receipt.items.length !== 1 || !item || Object.keys(o.receipt).length !== 1
      || Object.keys(item).sort().join(',') !== Object.keys(expected).sort().join(',')
      || Object.keys(expected).some(key => item[key] !== expected[key])) throw new Error('invalid_pilot_receipt');
  const receipt = encodeURIComponent(JSON.stringify(o.receipt));
  const returnUrl = encodeURIComponent(PILOT_RETURN);
  const fields = {
    MerchantLogin:c.merchant, OutSum:'100.00', InvId:o.invoice,
    Description:item.name, Receipt:receipt, Email:o.email, Culture:'ru',
    SuccessUrl2:returnUrl, SuccessUrl2Method:'GET', FailUrl2:returnUrl, FailUrl2Method:'GET',
    Shp_env:'live', Shp_order:o.nonce,
  };
  fields.SignatureValue = hash(`${c.merchant}:100.00:${o.invoice}:${receipt}:${returnUrl}:GET:${returnUrl}:GET:${c.password1}:${suffix(o)}`,c);
  // No IsTest, Recurring, Token, or automatic charge request is ever emitted.
  return { invoice:o.invoice, status:o.status, action:PILOT_PAYMENT_URL, fields };
}
export function verifyPilotResult(body, o, c = pilotConfig()) {
  if (!validPilotOrder(o,c) || !body || typeof body !== 'object'
      || (body.IsTest !== undefined && body.IsTest !== '0')
      || Object.keys(body).filter(k => k.toLowerCase().startsWith('shp_')).sort().join(',') !== 'Shp_env,Shp_order'
      || body.InvId !== o.invoice || body.Shp_env !== 'live' || body.Shp_order !== o.nonce
      || typeof body.SignatureValue !== 'string' || !/^[a-f0-9]{64}$/i.test(body.SignatureValue)) return false;
  try { if (kopeks(body.OutSum) !== PILOT_AMOUNT) return false; } catch { return false; }
  const expected = hash(`${body.OutSum}:${body.InvId}:${c.password2}:${suffix(o)}`,c);
  return crypto.timingSafeEqual(Buffer.from(expected),Buffer.from(body.SignatureValue.toLowerCase()));
}

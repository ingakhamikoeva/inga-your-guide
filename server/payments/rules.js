import crypto from 'node:crypto';

export const HOUR = 3600000;
export const GRACE_MS = 72 * HOUR;
export const PRICES = Object.freeze({ month: { normal: 149000, founder: 99000 }, year: { normal: 699000, founder: 499000 } });
export const PERIOD = Object.freeze({ month: 'месяц', year: 'год' });

export function validEmail(value) {
  return typeof value === 'string' && value.length <= 254 && /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(value);
}
export function rubles(kopeks) {
  if (!Number.isSafeInteger(kopeks) || kopeks <= 0) throw new Error('invalid_amount');
  return `${Math.floor(kopeks / 100)}.${String(kopeks % 100).padStart(2, '0')}`;
}
// ResultURL uses six decimals in live mode. Reject fractions of a kopek.
export function kopeks(value) {
  if (typeof value !== 'string' || !/^(0|[1-9]\d{0,8})(?:\.\d{1,6})?$/.test(value)) throw new Error('invalid_amount');
  const [whole, fraction = ''] = value.split('.');
  if (/[1-9]/.test(fraction.slice(2))) throw new Error('invalid_amount');
  const amount = Number(whole) * 100 + Number(fraction.padEnd(2, '0').slice(0, 2));
  if (amount <= 0) throw new Error('invalid_amount');
  return amount;
}
export function displayDate(value) {
  return new Intl.DateTimeFormat('ru-RU', { timeZone: 'Europe/Moscow', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value)) + ' МСК';
}
// Explicit Moscow calendar, independent of container/browser time zones.
// Jan 31 -> Feb 28/29; Feb 29 + year -> Feb 28.
export function addPeriod(value, plan) {
  if (!PRICES[plan]) throw new Error('invalid_plan');
  const local = new Date(new Date(value).getTime() + 3 * HOUR);
  if (!Number.isFinite(local.getTime())) throw new Error('invalid_date');
  const day = local.getUTCDate();
  local.setUTCDate(1);
  local.setUTCMonth(local.getUTCMonth() + (plan === 'year' ? 12 : 1));
  const lastDay = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth() + 1, 0)).getUTCDate();
  local.setUTCDate(Math.min(day, lastDay));
  return new Date(local.getTime() - 3 * HOUR);
}
export function receiptFor(plan, amount) {
  // NPD regime comes from the merchant's active Robocheki SMZ settings.
  // Do not send an invented sno=npd value (not part of the Receipt API).
  return { items: [{ name: `Доступ к приложению Легче на 1 ${PERIOD[plan]}`, quantity: 1, sum: Number(rubles(amount)), tax: 'none', payment_object: 'service' }] };
}
export function newInvoice(environment) {
  // Disjoint test/live namespaces across independent databases, under int64.
  return (environment === 'test' ? '1' : '2') + BigInt('0x' + crypto.randomBytes(7).toString('hex')).toString().padStart(17, '0');
}

import { API_BASE, apiFetch } from './api-client';

export const PILOT_AMOUNT = 10000;
export const PILOT_VERSION = 'live-pilot-100-v1';
export const PILOT_CONSENT = 'Я принимаю условия оферты и оплачиваю один месяц доступа за 100 ₽ без автопродления.';
const RETURN_URL = 'https://app.legche.online/payment-check';
const PAYMENT_URL = 'https://auth.robokassa.ru/Merchant/Index.aspx';
export interface PilotState {
  available: boolean;
  amount: number;
  recurring: false;
  emailVerified: boolean;
  consentVersion: string;
  consentText: string;
  offer: { url: string; version: string; sha256: string };
  order: { invoice: string; status: 'pending' | 'paid'; amount: number; accessUntil: string | null } | null;
}
export interface PilotRedirect {
  invoice: string;
  status: 'pending' | 'paid';
  action?: string;
  fields?: Record<string,string>;
}
const invalid = () => { throw new Error('invalid_pilot_response'); };
const invoice = (value: unknown) => typeof value === 'string' && /^2\d{17}$/.test(value);
export function isLivePilotPage(): boolean {
  try {
    const api=new URL(API_BASE,window.location.origin);
    return window.location.origin === 'https://app.legche.online' && !!API_BASE
      && ['https://app.legche.online','https://api.legche.online'].includes(api.origin)
      && api.pathname === '/api/v1' && !api.username && !api.password && !api.search && !api.hash;
  } catch { return false; }
}
function requireLivePage() { if (!isLivePilotPage()) throw new Error('pilot_wrong_environment'); }
export function validatePilotState(s: PilotState): PilotState {
  if (!s || typeof s.available !== 'boolean' || s.amount !== PILOT_AMOUNT || s.recurring !== false
      || typeof s.emailVerified !== 'boolean' || s.consentVersion !== PILOT_VERSION || s.consentText !== PILOT_CONSENT
      || s.offer?.url !== 'https://legche.online/oferta' || typeof s.offer.version !== 'string'
      || !/^[a-f0-9]{64}$/.test(s.offer.sha256)) invalid();
  if (s.order !== null && (!s.order || !invoice(s.order.invoice) || s.order.amount !== PILOT_AMOUNT
      || !['pending','paid'].includes(s.order.status)
      || (s.order.status === 'pending' && s.order.accessUntil !== null)
      || (s.order.status === 'paid' && (typeof s.order.accessUntil !== 'string' || !Number.isFinite(Date.parse(s.order.accessUntil)))))) invalid();
  return s;
}
export async function loadPilot(): Promise<PilotState> {
  requireLivePage();
  return validatePilotState(await apiFetch<PilotState>('/payments/pilot',{cache:'no-store'}));
}
export async function checkoutPilot(state: PilotState): Promise<PilotRedirect> {
  requireLivePage(); validatePilotState(state);
  return apiFetch('/payments/pilot/checkout',{method:'POST',body:{consent:true,version:state.consentVersion,offerHash:state.offer.sha256}});
}
export function validatePilotRedirect(r: PilotRedirect, expectedInvoice?: string): PilotRedirect {
  if (!r || !invoice(r.invoice) || (expectedInvoice && r.invoice !== expectedInvoice)) invalid();
  if (r.status === 'paid') return r;
  if (r.status !== 'pending' || r.action !== PAYMENT_URL || !r.fields) invalid();
  const f=r.fields!;
  const keys=['MerchantLogin','OutSum','InvId','Description','Receipt','Email','Culture','SuccessUrl2','SuccessUrl2Method','FailUrl2','FailUrl2Method','Shp_env','Shp_order','SignatureValue'];
  if (Object.keys(f).sort().join(',') !== keys.sort().join(',')
      || Object.values(f).some(v=>typeof v !== 'string' || v.length > 16000)
      || f.OutSum !== '100.00' || f.MerchantLogin !== 'legcheonline' || f.InvId !== r.invoice
      || f.Shp_env !== 'live' || f.Culture !== 'ru' || !/^[a-f0-9]{48}$/.test(f.Shp_order)
      || !/^[a-f0-9]{64}$/i.test(f.SignatureValue)
      || f.SuccessUrl2 !== encodeURIComponent(RETURN_URL) || f.FailUrl2 !== encodeURIComponent(RETURN_URL)
      || f.SuccessUrl2Method !== 'GET' || f.FailUrl2Method !== 'GET') invalid();
  return r;
}
export function submitPilot(r: PilotRedirect, expectedInvoice?: string): void {
  requireLivePage(); validatePilotRedirect(r,expectedInvoice);
  if (r.status === 'paid') return;
  const form=document.createElement('form');
  form.method='POST'; form.action=PAYMENT_URL; form.target='_self'; form.acceptCharset='UTF-8'; form.hidden=true;
  for (const [name,value] of Object.entries(r.fields!)) {
    const input=document.createElement('input'); input.type='hidden'; input.name=name; input.value=value; form.appendChild(input);
  }
  document.body.appendChild(form);
  try { HTMLFormElement.prototype.submit.call(form); } finally { form.remove(); }
}

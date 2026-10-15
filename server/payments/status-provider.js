import crypto from 'node:crypto';
import { SaxesParser } from 'saxes';
import { kopeks } from './rules.js';

const STATUS_URL = 'https://auth.robokassa.ru/Merchant/WebService/Service.asmx/OpStateExt';
const NS = 'http://merchant.roboxchange.com/WebService/';
const LIMIT = 65536;
const unknown = () => ({ resultCode: null, stateCode: null, outcome: 'unknown' });

// Read-only live adapter. Never substitutes test passwords or queries test orders.
// This does not enable live checkout, callbacks, or recurring dispatch.
export function statusConfig() {
  const e = process.env;
  const app = new URL(e.APP_URL || '');
  if (e.PAYMENTS_STATUS_ENABLED !== 'true' || e.PAYMENTS_MODE !== 'live'
      || app.origin !== 'https://app.legche.online' || app.username || app.password) throw new Error('status_checks_disabled');
  const merchant = e.ROBOKASSA_MERCHANT_LOGIN;
  const password2 = e.ROBOKASSA_PASSWORD2;
  const algorithm = (e.ROBOKASSA_HASH || '').toLowerCase();
  if (!merchant || !password2 || password2 === e.ROBOKASSA_TEST_PASSWORD2
      || !['md5','sha256','sha512'].includes(algorithm)) throw new Error('status_checks_not_configured');
  return { merchant, password2, algorithm };
}
export function statusChecksEnabled() { try { statusConfig(); return true; } catch { return false; } }

function xmlTree(xml) {
  if (typeof xml !== 'string' || Buffer.byteLength(xml) > LIMIT) throw new Error('invalid_xml');
  const parser = new SaxesParser({ xmlns: true });
  let root;
  const stack = [];
  parser.on('doctype', () => { throw new Error('doctype_forbidden'); });
  parser.on('opentag', tag => {
    if (stack.length >= 12 || tag.uri !== NS) throw new Error('invalid_xml_namespace');
    const node = { name: tag.local, children: [], text: '' };
    if (stack.length) stack[stack.length-1].children.push(node);
    else { if (root) throw new Error('duplicate_root'); root = node; }
    stack.push(node);
  });
  const append = value => { if (stack.length) stack[stack.length-1].text += value; };
  parser.on('text', append); parser.on('cdata', append);
  parser.on('closetag', () => stack.pop());
  parser.write(xml).close();
  if (root?.name !== 'OperationStateResponse' || stack.length) throw new Error('invalid_xml_root');
  return root;
}
function one(parent, name) {
  const nodes = parent.children.filter(node => node.name === name);
  if (nodes.length !== 1) throw new Error('missing_or_duplicate_field');
  return nodes[0];
}
function text(parent, name) {
  const node = one(parent, name);
  if (node.children.length) throw new Error('nested_scalar');
  return node.text.trim();
}
const code = value => { if (!/^\d{1,4}$/.test(value)) throw new Error('invalid_code'); return Number(value); };

// Only a complete response bound to this immutable order can resolve a payment.
// Missing Shp fields, wrong amount, malformed XML, and service errors fail closed.
export function parseOperationState(xml, order) {
  try {
    const root = xmlTree(xml);
    const resultCode = code(text(one(root, 'Result'), 'Code'));
    if (resultCode !== 0) return { ...unknown(), resultCode };
    const stateCode = code(text(one(root, 'State'), 'Code'));
    const fields = one(root, 'UserFields').children;
    const pairs = new Map();
    for (const field of fields) {
      if (field.name !== 'Field') throw new Error('invalid_field');
      const name = text(field, 'Name');
      if (pairs.has(name)) throw new Error('duplicate_user_field');
      pairs.set(name, text(field, 'Value'));
    }
    if (pairs.get('Shp_order') !== order.nonce || pairs.get('Shp_env') !== order.environment) return unknown();
    // OutSum is the merchant settlement amount; never use a mismatch to fail
    // an order. Unknown must be investigated, not interpreted as non-payment.
    if (kopeks(text(one(root, 'Info'), 'OutSum')) !== order.amount) return unknown();
    const outcome = stateCode === 100 ? 'paid' : [10,60].includes(stateCode) ? 'terminal' : 'pending';
    return { resultCode, stateCode, outcome };
  } catch { return unknown(); }
}

export async function queryOperationState(order) {
  // Validate before any network request. No IsTest flag exists for this API.
  if (order.environment !== 'live' || !/^2\d{17}$/.test(order.invoice)) return unknown();
  let c; try { c = statusConfig(); } catch { return unknown(); }
  if (order.merchant_login !== c.merchant) return unknown();
  const Signature = crypto.createHash(c.algorithm)
    .update(`${c.merchant}:${order.invoice}:${c.password2}`, 'utf8').digest('hex');
  try {
    const response = await fetch(STATUS_URL, {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15000),
      body: new URLSearchParams({ MerchantLogin: c.merchant, InvoiceID: order.invoice, Signature }),
    });
    if (!response.ok || !response.body) return unknown();
    const chunks = []; let size = 0;
    const reader = response.body.getReader();
    try {
      for (;;) {
        const { done, value } = await reader.read(); if (done) break;
        size += value.byteLength;
        if (size > LIMIT) { await reader.cancel(); return unknown(); }
        chunks.push(Buffer.from(value));
      }
    } finally { reader.releaseLock(); }
    return parseOperationState(Buffer.concat(chunks).toString('utf8'), order);
  } catch { return unknown(); }
}

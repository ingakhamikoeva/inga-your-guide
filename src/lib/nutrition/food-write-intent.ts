import { type SessionSnapshot } from '@/lib/auth-storage';
import { type MealTag } from '@/lib/db';

type Payload = { description:string; mealTag:MealTag; datetime:string; meta:Record<string,unknown> };
type Intent = { requestId:string; payload:Payload };
const prefix = 'legche:food-create:';

function canonical(value:unknown):unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,canonical(v)]));
  return value;
}

export function foodWriteIntent(session:SessionSnapshot, date:string, payload:Payload) {
  const sessionPrefix = `${prefix}${session.generation}:${session.owner}:`;
  // Clear abandoned account/session drafts; never transfer an action to a new login.
  for (const key of Object.keys(sessionStorage)) if (key.startsWith(prefix) && !key.startsWith(sessionPrefix)) sessionStorage.removeItem(key);
  const key = `${sessionPrefix}${date}`;
  // An unconfirmed action keeps its original time/tag, including after reload.
  const signature = JSON.stringify(canonical({description:payload.description,meta:payload.meta}));
  const intents:Record<string,Intent> = JSON.parse(sessionStorage.getItem(key) || '{}');
  const intent = intents[signature] || { requestId:crypto.randomUUID(), payload };
  intents[signature] = intent;
  // Persist BEFORE sending. A reload/remount or lost reply reuses the same action.
  sessionStorage.setItem(key, JSON.stringify(intents));
  return { ...intent, confirm:() => {
    const current:Record<string,Intent> = JSON.parse(sessionStorage.getItem(key) || '{}');
    if (current[signature]?.requestId === intent.requestId) delete current[signature];
    if (Object.keys(current).length) sessionStorage.setItem(key,JSON.stringify(current));
    else sessionStorage.removeItem(key);
  } };
}

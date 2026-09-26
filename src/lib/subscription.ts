import { apiFetch } from './api-client';

export interface SubscriptionAccess {
  status: 'not_started' | 'trial' | 'paid' | 'expired';
  active: boolean;
  serverNow: string;
  accessEndsAt: string | null;
  trialStartedAt: string | null;
  trialEndsAt: string | null;
  paidUntil: string | null;
}

export function loadSubscriptionAccess(): Promise<SubscriptionAccess> {
  return apiFetch<SubscriptionAccess>('/subscription', { cache: 'no-store' });
}

export async function beginTrial(): Promise<SubscriptionAccess> {
  const result = await apiFetch<{ ok: true; access: SubscriptionAccess }>('/start-trial', {
    method: 'POST', body: {},
  });
  return result.access;
}

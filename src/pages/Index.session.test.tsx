import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { ReactNode } from 'react';
import { clearTokens, notifyAuthChange, setTokens } from '@/lib/auth-storage';

const { hydrate, mounted, unmounted } = vi.hoisted(() => ({ hydrate: vi.fn().mockResolvedValue('survey-name'), mounted: vi.fn(), unmounted: vi.fn() }));
vi.mock('@/context/AppContext', async () => {
  const { useEffect } = await import('react');
  return {
    AppProvider: ({ children }: { children: ReactNode }) => {
      useEffect(() => { mounted(); return () => { unmounted(); }; }, []);
      return children;
    },
    useApp: () => ({ step: 'survey-name', setStep: vi.fn(), hydrateFromDb: hydrate }),
  };
});
vi.mock('@/context/SubscriptionContext', () => ({
  SubscriptionProvider: ({ children }: { children: ReactNode }) => children,
  useSubscription: () => ({ access: { active: true } }),
}));
vi.mock('@/components/inga/SurveyNameScreen', async () => {
  const { useState } = await import('react');
  return { SurveyNameScreen: () => {
    const [value, setValue] = useState('');
    return <input aria-label="draft" value={value} onChange={event => setValue(event.target.value)} />;
  } };
});
vi.mock('@/components/inga/AuthScreen', () => ({ AuthScreen: () => <div>auth-test-screen</div> }));
vi.mock('@/components/inga/AccessScreen', () => ({ AccessScreen: () => null }));
vi.mock('@/components/inga/SurveyDataScreen', () => ({ SurveyDataScreen: () => null }));
vi.mock('@/components/inga/TrackingMethodScreen', () => ({ TrackingMethodScreen: () => null }));
vi.mock('@/components/inga/DailyScreen', () => ({ DailyScreen: () => null }));
vi.mock('@/components/inga/MenuScreen', () => ({ MenuScreen: () => null }));
vi.mock('@/components/inga/ChatScreen', () => ({ ChatScreen: () => null }));
vi.mock('@/components/inga/GoalScreen', () => ({ GoalScreen: () => null }));
vi.mock('@/components/inga/WhyScreen', () => ({ WhyScreen: () => null }));
vi.mock('@/components/inga/HowItWorksScreen', () => ({ HowItWorksScreen: () => null }));
vi.mock('@/components/inga/RouteReadyScreen', () => ({ RouteReadyScreen: () => null }));
import Index from './Index';
const person = (id: string) => ({ id, user_id: id, email: `${id}@example.invalid` });
beforeEach(() => {
  localStorage.clear(); vi.clearAllMocks(); setTokens('A', 'RA', person('A'));
});
afterEach(cleanup);

test('B1: other-tab login remounts account contexts, clears screen drafts and hydrates again', async () => {
  render(<Index />); const input = await screen.findByLabelText('draft');
  await waitFor(() => expect(hydrate).toHaveBeenCalledTimes(1));
  fireEvent.change(input, { target: { value: 'private A' } });
  const oldValue = localStorage.getItem('inga_session_v1');
  const newValue = JSON.stringify({ generation: 'external-B', session: { access_token: 'B', refresh_token: 'RB', user: person('B') } });
  act(() => {
    localStorage.setItem('inga_session_v1', newValue);
    window.dispatchEvent(new StorageEvent('storage', { key: 'inga_session_v1', oldValue, newValue, storageArea: localStorage }));
  });
  await waitFor(() => expect(hydrate).toHaveBeenCalledTimes(2));
  expect(screen.getByLabelText('draft')).toHaveValue('');
  expect(mounted).toHaveBeenCalledTimes(2); expect(unmounted).toHaveBeenCalledTimes(1);
});

test('B1: token and metadata updates preserve the open screen draft', async () => {
  render(<Index />); const input = await screen.findByLabelText('draft');
  await waitFor(() => expect(hydrate).toHaveBeenCalledTimes(1));
  fireEvent.change(input, { target: { value: 'keep A' } });
  act(() => { setTokens('A-new', 'RA'); notifyAuthChange('TOKEN_REFRESHED'); });
  act(() => { setTokens('A-new', 'RA', { ...person('A'), email_verified: true }, false); notifyAuthChange('USER_UPDATED'); });
  expect(screen.getByLabelText('draft')).toHaveValue('keep A');
  expect(mounted).toHaveBeenCalledTimes(1); expect(hydrate).toHaveBeenCalledTimes(1);
});

test('B1: logout removes the old screen and remounts contexts', async () => {
  render(<Index />); await screen.findByLabelText('draft');
  act(() => { clearTokens(); notifyAuthChange('SIGNED_OUT'); });
  expect(await screen.findByText('auth-test-screen')).toBeVisible();
  expect(screen.queryByLabelText('draft')).not.toBeInTheDocument();
  expect(unmounted).toHaveBeenCalledTimes(1);
});

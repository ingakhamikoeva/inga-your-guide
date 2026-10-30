import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
vi.hoisted(() => { vi.stubEnv('VITE_API_URL', 'http://b3.invalid/api/v1'); });
import { auth } from '@/lib/auth';
import { setTokens } from '@/lib/auth-storage';
import { askInga } from '@/lib/ai-provider';
import { useMealDiary } from '@/lib/nutrition/use-meal-diary';
import { DietAnalysis } from '@/components/inga/DietAnalysis';
import { DIARY_AI_LIMIT_MESSAGE, RESET_LIMIT_MESSAGE } from '@/lib/request-limits';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const blocked = () => json({ error: 'ai_limit', userMessage: DIARY_AI_LIMIT_MESSAGE }, 429);
const signIn = (id: string) => setTokens(id, `refresh-${id}`, { id, user_id: id, email: `${id}@b3.invalid` });
const row = (id: string, ready = false) => ({ log_id: id, raw_text: `Еда ${id}`, datetime: '2026-10-30T12:00:00Z', meta: ready ? { nutritionVersion: 3, proteinAi: 20 } : {} });
beforeEach(() => { localStorage.clear(); signIn('A'); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

test('B3: password reset shows the approved limit message and can be retried', async () => {
  const fetch = vi.fn().mockResolvedValueOnce(json({ error: 'password_reset_limit' }, 429)).mockResolvedValueOnce(json({ ok: true }));
  vi.stubGlobal('fetch', fetch);
  expect((await auth.resetPasswordForEmail('a@b3.invalid')).error?.message).toBe(RESET_LIMIT_MESSAGE);
  expect((await auth.resetPasswordForEmail('a@b3.invalid')).error).toBeNull();
  expect(fetch).toHaveBeenCalledTimes(2);
});

test('B3: chat presents the server limit message through the existing invocation layer', async () => {
  const message = 'Достигнут лимит запросов к ИИ. Попробуйте позже.';
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ error: 'ai_limit', userMessage: message }, 429)));
  expect((await askInga({ message: 'Что приготовить?' })).answer).toBe(message);
});

test('B3: day analysis retains diary summary, shows limit and succeeds on explicit retry', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(blocked()).mockResolvedValueOnce(json({ analysis: {
    present: ['Записан обед'], attention: [], next: [], recipeIds: [],
  } })));
  render(<DietAnalysis date="2026-10-30" revision="1" ready mealCount={2} protein={20} unknownProtein={1} proteinTarget={80} onRecipe={() => {}} onPlan={() => {}} />);
  expect(await screen.findByRole('alert')).toHaveTextContent(DIARY_AI_LIMIT_MESSAGE);
  expect(screen.getByText('Приёмов пищи в дневнике: 2')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Повторить' }));
  expect(await screen.findByText('Записан обед')).toBeVisible();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

test('B3: diary stops an automatic batch at the limit, keeps saving, and retries pending entries', async () => {
  let limited = true;
  const saved = [row('1'), row('2')];
  let analyses = 0;
  vi.stubGlobal('fetch', vi.fn(async (url: string, opts: RequestInit) => {
    if (url.includes('/analyze')) { analyses++; return limited ? blocked() : json(row(url.split('/').at(-2)!, true)); }
    if (opts.method === 'POST') { const added = row('3'); saved.push(added); return json(added); }
    return json(saved);
  }));
  const { result } = renderHook(() => useMealDiary('2026-10-30'));
  await waitFor(() => expect(result.current.analysisLimit).toBe(true));
  expect(result.current.meals).toEqual(['Еда 1', 'Еда 2']); expect(analyses).toBe(1);
  await act(async () => { expect(await result.current.add('Еда 3', 'lunch', '2026-10-30T13:00:00Z', {})).toBe(true); });
  expect(result.current.meals).toHaveLength(3); expect(analyses).toBe(1);
  limited = false; act(() => result.current.retry());
  await waitFor(() => expect(result.current.mealMeta.every(m => m.nutritionVersion === 3)).toBe(true));
  expect(result.current.mealMeta).toHaveLength(3);
  expect(result.current.analysisLimit).toBe(false); expect(analyses).toBe(4);
});

test('B3: an old account limit response cannot affect the next account diary', async () => {
  let release!: (response: Response) => void;
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url.includes('/analyze')) return new Promise<Response>(resolve => { release = resolve; });
    return json([row('1')]);
  }));
  const { result, rerender } = renderHook(() => useMealDiary('2026-10-30'));
  await waitFor(() => expect(release).toBeDefined());
  signIn('B');
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json([row('B', true)])));
  rerender();
  await waitFor(() => expect(result.current.meals).toEqual(['Еда B']));
  await act(async () => { release(blocked()); });
  expect(result.current.analysisLimit).toBe(false);
  expect(result.current.meals).toEqual(['Еда B']);
});

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { DailyScreen } from '@/components/inga/DailyScreen';
import { apiFetch } from '@/lib/api-client';
import { setTokens } from '@/lib/auth-storage';
import { localDay } from '@/lib/achievement-client';

vi.mock('@/lib/api-client', async original => ({ ...await original<typeof import('@/lib/api-client')>(), apiFetch: vi.fn() }));
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));
vi.mock('@/context/AppContext', () => ({ useApp: () => ({
  profile: { name: 'Тест', weight: 60, goalWeight: 55, trackingMethod: 'plate', food_preferences: ['Блины'], currentStage: 'loss' },
  calculations: null, weeklyData: [], dailyReports: [], setStep: vi.fn(), addWeightEntry: vi.fn(), updateProfile: vi.fn(), performFixationAction: vi.fn(),
}) }));
vi.mock('@/lib/db', async original => ({ ...await original<typeof import('@/lib/db')>(),
  loadProgramProgress: async () => null, loadTodayCheckin: async () => null, loadMealPlanForDate: async () => null,
  loadLightSavings: async () => ({ total_kcal: 0, swaps_count: 0 }),
}));
vi.mock('@/components/inga/VoiceInput', () => ({ VoiceInput: () => null }));

beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear(); sessionStorage.clear();
  setTokens('access', 'refresh', { id: 'i7', user_id: 'i7', email: 'i7@example.invalid' });
  localStorage.setItem('dailyActiveTabDate', localDay()); localStorage.setItem('dailyActiveTab', 'meals');
});
afterEach(cleanup);

for (const isEvening of [false, true]) {
  test(`I7: ${isEvening ? 'evening' : 'regular'} protein input keeps DOM, focus and full draft until blur`, async () => {
    let row = { log_id: 'meal-1', raw_text: 'Творог', datetime: `${localDay()}T12:00:00`, meal_tag: 'lunch',
      meta: { nutritionVersion: 3, proteinAi: 25, protein: true, isEvening } };
    const patches: unknown[] = [];
    vi.mocked(apiFetch).mockImplementation(async (_path, opts) => {
      if (opts?.method === 'PATCH') {
        patches.push(opts.body); row = { ...row, meta: { ...row.meta, ...(opts.body as {meta: object}).meta } }; return row;
      }
      return [row];
    });
    render(<DailyScreen />);
    fireEvent.click(await screen.findByRole('button', { name: 'Скорректировать белок' }));
    const field = screen.getByRole('spinbutton', { name: 'Скорректировать белок' });
    expect(field).toHaveFocus();
    for (const value of ['', '1', '12', '123']) {
      fireEvent.change(field, { target: { value } });
      expect(screen.getByRole('spinbutton', { name: 'Скорректировать белок' })).toBe(field);
      expect(field).toHaveFocus();
    }
    expect(patches).toHaveLength(0);
    fireEvent.blur(field);
    await waitFor(() => expect(screen.getByText('~123г белка')).toBeVisible());
    expect(patches).toEqual([{ meta: { proteinAi: 123, proteinManual: true } }]);
  });
}

test('I7: time input remains focused while saving and after a delayed reply; Enter finishes editing', async () => {
  let resolve!: (row: unknown) => void;
  const reply = new Promise(r => { resolve = r; });
  const row = { log_id: 'meal-1', raw_text: 'Творог', datetime: `${localDay()}T12:00:00`, meal_tag: 'lunch', meta: { nutritionVersion: 3, proteinAi: 25 } };
  vi.mocked(apiFetch).mockImplementation(async (_path, opts) => opts?.method === 'PATCH' ? reply : [row]);
  render(<DailyScreen />);
  fireEvent.click(await screen.findByRole('button', { name: 'Изменить время' }));
  const field = screen.getByLabelText('Изменить время');
  fireEvent.change(field, { target: { value: '13:45' } });
  expect(screen.getByLabelText('Изменить время')).toBe(field); expect(field).toHaveFocus();
  await act(async () => resolve({ ...row, datetime: `${localDay()}T13:45:00` }));
  expect(screen.getByLabelText('Изменить время')).toBe(field); expect(field).toHaveFocus();
  expect(field).toHaveValue('13:45');
  fireEvent.keyDown(field, { key: 'Enter' });
  expect(screen.getByRole('button', { name: 'Изменить время' })).toHaveTextContent('13:45');
});

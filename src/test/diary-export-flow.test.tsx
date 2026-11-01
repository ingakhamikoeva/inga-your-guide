import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { MenuScreen } from '@/components/inga/MenuScreen';
import { DiaryHistoryScreen } from '@/components/inga/DiaryHistoryScreen';
import { apiFetch } from '@/lib/api-client';
import { setTokens } from '@/lib/auth-storage';
import { localDay } from '@/lib/achievement-client';
vi.mock('@/lib/api-client', () => ({ apiFetch: vi.fn() }));
vi.mock('@/lib/auth', () => ({ auth: {
  getUser: async () => ({ data: { user: { email_verified: true } } }),
  onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
} }));
vi.mock('@/lib/app-settings', () => ({ getSetting: async () => null }));
vi.mock('@/lib/db', async importOriginal => ({ ...await importOriginal<typeof import('@/lib/db')>(), loadProgramProgress: async () => null }));
vi.mock('@/components/inga/ProgressPhotosSection', () => ({ ProgressPhotosSection: () => null }));
vi.mock('@/context/SubscriptionContext', () => ({ useSubscription: () => ({ access: { active: false }, refresh: async () => null }) }));
vi.mock('@/context/AppContext', () => ({ useApp: () => ({
  profile: { name: 'Мария', weight: 70, goalWeight: 60, trackingMethod: 'plate' }, calculations: null,
  weeklyData: [{ date: localDay(), weight: 99 }], dailyReports: [{ date: localDay(), meals: ['STALE LOCAL FOOD'] }],
  medals: [], achievementStreak: 0, uniqueRecipes: 0, setStep() {}, updateProfile: async () => {}, resetLocalState() {},
}) }));
let popup: Window;
const fixture = () => ({ checkins: [{ date: localDay(), weight_kg: '58.3', sleep_hours: '7', steps_yesterday: 0, stool_yesterday: false }],
  meals: [{ log_id: 'saved', datetime: new Date().toISOString(), raw_text: 'Сохранённый суп', meal_tag: 'lunch', meta: null }] });
function pending() { let resolve!: (data: ReturnType<typeof fixture>) => void; const promise = new Promise<ReturnType<typeof fixture>>(r => { resolve = r; }); return { promise, resolve }; }
async function profile() {
  localStorage.setItem('inga-menu-jump', JSON.stringify({ section: 'profile' }));
  const ui = render(<MenuScreen />);
  await screen.findByRole('button', { name: '📥 Скачать дневник питания' });
  return ui;
}
beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear(); sessionStorage.clear();
  setTokens('A', 'RA', { id: 'A', user_id: 'A', email: 'a@example.invalid', email_verified: true });
  popup = { closed: false, opener: window, close: vi.fn(), document: { write: vi.fn(), close: vi.fn() } } as unknown as Window;
  vi.spyOn(window, 'open').mockReturnValue(popup);
  vi.spyOn(window, 'alert').mockImplementation(() => {});
  vi.mocked(apiFetch).mockResolvedValue(fixture());
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
test('I1: profile export reads server data on a fresh device, including expired access', async () => {
  await profile(); fireEvent.click(screen.getByRole('button', { name: '📥 Скачать дневник питания' }));
  await waitFor(() => expect(popup.document.write).toHaveBeenCalledTimes(1));
  expect(apiFetch).toHaveBeenCalledWith('/diary', { cache: 'no-store' });
  const html = vi.mocked(popup.document.write).mock.calls[0][0];
  expect(html).toContain('Сохранённый суп'); expect(html).toContain('58.3 кг');
  expect(html).not.toContain('STALE LOCAL FOOD'); expect(html).not.toContain('99 кг');
  expect(popup.opener).toBeNull();
});
test('I1: archive and its export read the same server source', async () => {
  render(<DiaryHistoryScreen onBack={() => {}} />);
  expect(await screen.findByText('Сохранённый суп')).toBeVisible();
  expect(screen.getByText(/58.3 кг/)).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: '📥 Скачать дневник питания' }));
  expect(apiFetch).toHaveBeenCalledWith('/diary', { cache: 'no-store' });
  expect(vi.mocked(popup.document.write).mock.calls[0][0]).toContain('Сохранённый суп');
});
test('I1: opens popup during click, blocks duplicate requests while loading', async () => {
  const request = pending(); vi.mocked(apiFetch).mockReturnValue(request.promise);
  await profile(); const button = screen.getByRole('button', { name: '📥 Скачать дневник питания' });
  fireEvent.click(button); fireEvent.click(button);
  expect(window.open).toHaveBeenCalledTimes(1); expect(apiFetch).toHaveBeenCalledTimes(1);
  expect(button).toBeDisabled(); expect(popup.document.write).not.toHaveBeenCalled();
  await act(async () => { request.resolve(fixture()); });
  expect(button).toBeEnabled(); expect(popup.document.write).toHaveBeenCalledTimes(1);
});
test('I1: failed server read closes popup and allows retry, without exporting local cache', async () => {
  vi.mocked(apiFetch).mockRejectedValueOnce(new Error('503'));
  await profile(); fireEvent.click(screen.getByRole('button', { name: '📥 Скачать дневник питания' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Попробуйте ещё раз.');
  expect(popup.close).toHaveBeenCalled(); expect(popup.document.write).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Повторить' }));
  await waitFor(() => expect(popup.document.write).toHaveBeenCalledTimes(1));
});
test('I1: empty server diary closes popup and keeps the existing empty message', async () => {
  vi.mocked(apiFetch).mockResolvedValue({ checkins: [], meals: [] });
  await profile(); fireEvent.click(screen.getByRole('button', { name: '📥 Скачать дневник питания' }));
  await waitFor(() => expect(window.alert).toHaveBeenCalledWith('Пока нет данных для скачивания. Заполните дневник хотя бы за несколько дней.'));
  expect(popup.close).toHaveBeenCalled(); expect(popup.document.write).not.toHaveBeenCalled();
});
test('I1: account switch during download cannot write the previous account report', async () => {
  const request = pending(); vi.mocked(apiFetch).mockReturnValue(request.promise);
  await profile(); fireEvent.click(screen.getByRole('button', { name: '📥 Скачать дневник питания' }));
  setTokens('B', 'RB', { id: 'B', user_id: 'B', email: 'b@example.invalid' });
  await act(async () => { request.resolve(fixture()); });
  expect(popup.close).toHaveBeenCalled(); expect(popup.document.write).not.toHaveBeenCalled();
});
test('I1: leaving profile cancels pending report; blocked popup gives a retry', async () => {
  const request = pending(); vi.mocked(apiFetch).mockReturnValue(request.promise);
  const ui = await profile(); fireEvent.click(screen.getByRole('button', { name: '📥 Скачать дневник питания' }));
  ui.unmount(); await act(async () => { request.resolve(fixture()); });
  expect(popup.close).toHaveBeenCalled(); expect(popup.document.write).not.toHaveBeenCalled();
  vi.mocked(window.open).mockReturnValue(null); await profile();
  fireEvent.click(screen.getByRole('button', { name: '📥 Скачать дневник питания' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Попробуйте ещё раз.');
});

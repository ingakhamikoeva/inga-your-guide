import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, afterEach, expect, test, vi } from 'vitest';
import { ChatScreen } from '@/components/inga/ChatScreen';
import { invokeFunction } from '@/lib/api-invoke';
import { saveChatEvent } from '@/lib/db';
import { setTokens, clearTokens, notifyAuthChange, sessionSnapshot } from '@/lib/auth-storage';
import { conversationHistory, readConversation, saveConversation, type ChatMessage } from '@/lib/chat-conversation';

vi.mock('@/lib/api-invoke', () => ({ invokeFunction: vi.fn() }));
vi.mock('@/lib/db', () => ({ saveChatEvent: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/components/inga/VoiceInput', () => ({ VoiceInput: () => null }));
vi.mock('@/context/AppContext', () => ({ useApp: () => ({
  setStep: vi.fn(), profile: { name: 'Мария', weight: 70, goalWeight: 60, trackingMethod: 'plate' }, calculations: null,
  dailyReports: [{ date: new Date().toISOString().slice(0, 10), meals: [{ description: 'STALE LOCAL FOOD' }] }],
  weeklyData: [],
}) }));
const user = (id: string) => ({ id, user_id: id, email: `${id}@example.invalid` });
const send = (text: string) => {
  fireEvent.change(screen.getByPlaceholderText('Напишите сообщение...'), { target: { value: text } });
  fireEvent.click(screen.getByRole('button', { name: '↑' }));
};
const body = (index: number) => vi.mocked(invokeFunction).mock.calls[index][1] as {
  message: string; history: { role: string; content: string }[]; timezone: string; dayContext: unknown;
};
beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear(); sessionStorage.clear();
  setTokens('A', 'RA', user('A')); notifyAuthChange('SIGNED_IN');
  Object.defineProperty(HTMLElement.prototype, 'scrollTo', { configurable: true, value: vi.fn() });
  vi.mocked(invokeFunction).mockResolvedValue({ data: { answer: 'Добавьте овощи.' }, error: null });
  vi.mocked(saveChatEvent).mockResolvedValue(undefined);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

test('I2: second question sends the preceding turn, without stale meals or greeting', async () => {
  render(<ChatScreen />); send('Оцени питание сегодня');
  await screen.findByText('Добавьте овощи.');
  expect(body(0).history).toEqual([]);
  expect(body(0).timezone).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Moscow');
  expect(body(0).dayContext).toEqual({});
  send('Почему?');
  await waitFor(() => expect(invokeFunction).toHaveBeenCalledTimes(2));
  expect(body(1).history).toEqual([
    { role: 'user', content: 'Оцени питание сегодня' }, { role: 'assistant', content: 'Добавьте овощи.' },
  ]);
  expect(body(1).message).toBe('Почему?');
});

test('I2: navigation preserves conversation, refresh tokens retain it, signout clears it', async () => {
  const ui = render(<ChatScreen />); send('Оцени питание сегодня');
  await screen.findByText('Добавьте овощи.'); ui.unmount();
  setTokens('A2', 'RA2'); notifyAuthChange('TOKEN_REFRESHED');
  const again = render(<ChatScreen />);
  expect(screen.getByText('Оцени питание сегодня')).toBeVisible();
  expect(screen.getByText('Добавьте овощи.')).toBeVisible(); again.unmount();
  expect(sessionStorage.length).toBe(0);
  expect(localStorage.getItem('inga_session_v1')).not.toContain('овощи');
  clearTokens(); notifyAuthChange('SIGNED_OUT');
  setTokens('A3', 'RA3', user('A')); notifyAuthChange('SIGNED_IN');
  render(<ChatScreen />);
  expect(screen.queryByText('Добавьте овощи.')).toBeNull();
});

test('I2: provider errors stay visible but are never sent as conversation history', async () => {
  vi.mocked(invokeFunction).mockResolvedValueOnce({ data: { userMessage: 'Попробуйте позже.' }, error: new Error('503') });
  render(<ChatScreen />); send('Первый вопрос');
  await screen.findByText('Попробуйте позже.'); send('Повторяю вопрос');
  await waitFor(() => expect(invokeFunction).toHaveBeenCalledTimes(2));
  expect(body(1).history).toEqual([]);
});

test('I2: duplicate submit is blocked; late replies after account change do not appear or log events', async () => {
  let resolve!: (value: { data: { answer: string }; error: null }) => void;
  vi.mocked(invokeFunction).mockReturnValue(new Promise(r => { resolve = r; }));
  const ui = render(<ChatScreen />); send('Вопрос аккаунта А');
  fireEvent.submit(screen.getByRole('button', { name: '↑' }).closest('form')!);
  expect(invokeFunction).toHaveBeenCalledTimes(1);
  act(() => { setTokens('B', 'RB', user('B')); notifyAuthChange('SIGNED_IN'); });
  await act(async () => { resolve({ data: { answer: 'Ответ для А [CHAT_EVENT:safety|private]' }, error: null }); });
  expect(screen.queryByText('Ответ для А')).toBeNull(); expect(saveChatEvent).not.toHaveBeenCalled();
  ui.unmount(); render(<ChatScreen />);
  expect(screen.queryByText('Вопрос аккаунта А')).toBeNull();
});

test('I2: leaving chat while waiting discards the late result and incomplete turn', async () => {
  let resolve!: (value: { data: { answer: string }; error: null }) => void;
  vi.mocked(invokeFunction).mockReturnValue(new Promise(r => { resolve = r; }));
  const ui = render(<ChatScreen />); send('Незавершённый вопрос'); ui.unmount();
  await act(async () => { resolve({ data: { answer: 'Поздний ответ [CHAT_EVENT:support|private]' }, error: null }); });
  render(<ChatScreen />);
  expect(screen.queryByText('Поздний ответ')).toBeNull(); expect(saveChatEvent).not.toHaveBeenCalled();
  expect(screen.queryByText('Незавершённый вопрос')).toBeNull();
});

test('I2: long history is bounded in UTF-8, preserves complete recent turns and excludes markers', () => {
  const turns: ChatMessage[] = Array.from({ length: 30 }, (_, i) => [
    { role: 'user' as const, content: `Вопрос ${i} ` + 'я'.repeat(3000), history: true },
    { role: 'assistant' as const, content: `Ответ ${i} ` + '🥗'.repeat(3000), history: true },
  ]).flat();
  const history = conversationHistory(turns);
  expect(history.length).toBeLessThanOrEqual(12);
  expect(history.length % 2).toBe(0);
  expect(new TextEncoder().encode(history.map(m => m.content).join('')).length).toBeLessThanOrEqual(12000);
  expect(history.at(-1)?.content).toContain('Ответ 29');
  expect(history.every(m => m.content.length <= 3000)).toBe(true);
  saveConversation(sessionSnapshot(), turns);
  expect(readConversation(sessionSnapshot())).toHaveLength(40);
});

test('I2: service markers are not echoed to the model on the next turn', async () => {
  vi.mocked(invokeFunction).mockResolvedValueOnce({ data: { answer: 'Ответ. [CHAT_EVENT:support|test]' }, error: null });
  render(<ChatScreen />); send('Вопрос'); await screen.findByText('Ответ.');
  send('Почему?'); await waitFor(() => expect(invokeFunction).toHaveBeenCalledTimes(2));
  expect(body(1).history[1].content).toBe('Ответ.');
});

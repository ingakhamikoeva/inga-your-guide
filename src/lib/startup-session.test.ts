import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { currentSession, sessionSnapshot } from './auth-storage';

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

test.each(['null', '[]', '{}', '{"generation":"x","session":{}}',
  '{"generation":"x","session":{"access_token":"a","refresh_token":"r","user":null}}',
  '{"generation":"x","session":{"access_token":"a","refresh_token":"r","user":{}}}'])(
  'invalid stored session %s cannot crash application startup', raw => {
  localStorage.setItem('inga_session_v1', raw);
  expect(() => sessionSnapshot()).not.toThrow();
  expect(currentSession()).toBeNull();
  expect(sessionSnapshot().owner).toBeNull();
  // Reading invalid state must not rewrite credentials or diary data.
  expect(localStorage.getItem('inga_session_v1')).toBe(raw);
});

test('invalid authoritative record cannot resurrect old legacy credentials', () => {
  localStorage.setItem('inga_session_v1', 'null');
  localStorage.setItem('inga_access_token', 'old-access');
  localStorage.setItem('inga_refresh_token', 'old-refresh');
  localStorage.setItem('inga_user', JSON.stringify({ id: 'old-user' }));
  expect(currentSession()).toBeNull();
});

test('invalid legacy user cannot make an authenticated startup', () => {
  localStorage.setItem('inga_access_token', 'old-access');
  localStorage.setItem('inga_refresh_token', 'old-refresh');
  localStorage.setItem('inga_user', '[]');
  expect(currentSession()).toBeNull();
});

test('unavailable browser storage safely starts without a session', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new DOMException('Blocked', 'SecurityError'); });
  expect(currentSession()).toBeNull();
  expect(sessionSnapshot().owner).toBeNull();
});

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { AuthScreen } from '@/components/inga/AuthScreen';
import { auth } from '@/lib/auth';

const app = vi.hoisted(() => ({ setStep: vi.fn(), hydrateFromDb: vi.fn(), resetLocalState: vi.fn() }));
vi.mock('@/context/AppContext', () => ({ useApp: () => app }));
vi.mock('@/lib/auth', () => ({ auth: { signInWithPassword: vi.fn(), signUp: vi.fn(), resetPasswordForEmail: vi.fn() } }));
beforeEach(() => { vi.clearAllMocks(); app.hydrateFromDb.mockResolvedValue('daily'); });
afterEach(cleanup);

for (const initialMode of ['login', 'signup'] as const) {
  test(`I7: ${initialMode} labels remain visible after typing; password toggle preserves value`, () => {
    render(<AuthScreen initialMode={initialMode} />);
    const email = screen.getByLabelText('Email');
    const password = screen.getByLabelText(initialMode === 'signup' ? 'Пароль (минимум 6 символов)' : 'Пароль');
    fireEvent.change(email, { target: { value: 'i7@example.invalid' } });
    fireEvent.change(password, { target: { value: 'synthetic-password' } });
    expect(screen.getByText('Email', { selector: 'label' })).toBeVisible();
    expect(email).toHaveAttribute('autocomplete', 'username');
    expect(password).toHaveAttribute('autocomplete', initialMode === 'signup' ? 'new-password' : 'current-password');
    fireEvent.click(screen.getByRole('button', { name: 'Показать пароль' }));
    expect(password).toHaveAttribute('type', 'text'); expect(password).toHaveValue('synthetic-password');
    fireEvent.click(screen.getByRole('button', { name: 'Скрыть пароль' }));
    expect(password).toHaveAttribute('type', 'password'); expect(password).toHaveValue('synthetic-password');
    expect(auth.signInWithPassword).not.toHaveBeenCalled(); expect(auth.signUp).not.toHaveBeenCalled();
  });
}

test('I7: login submits unchanged credentials and leaves hydration to the session flow', async () => {
  vi.mocked(auth.signInWithPassword).mockResolvedValue({ data: { user: null, session: null }, error: null });
  render(<AuthScreen initialMode="login" />);
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'i7@example.invalid' } });
  fireEvent.change(screen.getByLabelText('Пароль'), { target: { value: 'synthetic-password' } });
  fireEvent.click(screen.getByRole('button', { name: 'Войти' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Войти' })).toBeEnabled());
  expect(app.hydrateFromDb).not.toHaveBeenCalled();
  expect(auth.signInWithPassword).toHaveBeenCalledWith({ email: 'i7@example.invalid', password: 'synthetic-password' });
});

test('I7: signup still requires separate consents and preserves optional marketing choice', async () => {
  vi.mocked(auth.signUp).mockResolvedValue({ data: { user: null, session: null }, error: null });
  render(<AuthScreen />);
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'i7@example.invalid' } });
  fireEvent.change(screen.getByLabelText('Пароль (минимум 6 символов)'), { target: { value: 'synthetic-password' } });
  const submit = screen.getByRole('button', { name: 'Начать →' });
  expect(submit).toBeDisabled();
  fireEvent.click(screen.getByRole('checkbox', { name: /Принимаю условия/ })); expect(submit).toBeDisabled();
  fireEvent.click(screen.getByRole('checkbox', { name: /согласие на обработку/ })); expect(submit).toBeEnabled();
  fireEvent.click(submit);
  await waitFor(() => expect(auth.signUp).toHaveBeenCalledOnce());
  expect(auth.signUp).toHaveBeenCalledWith({ email: 'i7@example.invalid', password: 'synthetic-password', termsConsent: true, pdConsent: true, marketingConsent: false });
  expect(await screen.findByRole('status')).toHaveTextContent('Мы отправили письмо для подтверждения');
});

test('I7: recovery status and errors are announced; entered email is retained', async () => {
  vi.mocked(auth.resetPasswordForEmail).mockResolvedValue({ error: null });
  render(<AuthScreen initialMode="login" />);
  fireEvent.click(screen.getByRole('button', { name: 'Забыли пароль?' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Введите email');
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'i7@example.invalid' } });
  fireEvent.click(screen.getByRole('button', { name: 'Забыли пароль?' }));
  expect(await screen.findByRole('status')).toHaveTextContent('i7@example.invalid');
  expect(screen.getByLabelText('Email')).toHaveValue('i7@example.invalid');
});

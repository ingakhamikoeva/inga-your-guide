import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import SubscriptionPreview from '@/pages/SubscriptionPreview';
import { SubscriptionCheckout, SubscriptionManagement } from '@/components/inga/SubscriptionScreens';
import { AUTO_RENEW_CONSENT, nextPreviewPeriod, previewQuotes } from '@/lib/subscription-preview';

const start = '2026-10-09T19:44:00.000Z';
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('subscription consent and terms', () => {
  it('requires an unchecked, explicit consent before continuing', () => {
    const next = vi.fn();
    render(<SubscriptionCheckout quotes={previewQuotes(start, 'special')} onContinue={next} />);
    const checkbox = screen.getByRole('checkbox', { name: AUTO_RENEW_CONSENT });
    const button = screen.getByRole('button', { name: 'Оплатить 990 ₽' });
    expect(checkbox).not.toBeChecked(); expect(button).toBeDisabled();
    fireEvent.click(button); expect(next).not.toHaveBeenCalled();
    fireEvent.click(checkbox); fireEvent.click(button);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ plan: 'month', amount: 99000 }));
  });

  it('clears consent when changing the period, including changing back', () => {
    render(<SubscriptionCheckout quotes={previewQuotes(start, 'special')} onContinue={vi.fn()} />);
    const checkbox = screen.getByRole('checkbox'); fireEvent.click(checkbox);
    fireEvent.click(screen.getByRole('radio', { name: 'Год' }));
    expect(checkbox).not.toBeChecked();
    expect(screen.getByRole('button', { name: /Оплатить 4\s990 ₽/ })).toBeDisabled();
    fireEvent.click(screen.getByRole('radio', { name: 'Месяц' }));
    expect(checkbox).not.toBeChecked();
  });

  it('requires new consent after updated amount or renewal date', () => {
    const initial = previewQuotes(start, 'special');
    const { rerender } = render(<SubscriptionCheckout quotes={initial} onContinue={vi.fn()} />);
    fireEvent.click(screen.getByRole('checkbox'));
    rerender(<SubscriptionCheckout quotes={initial.map(q => ({ ...q, amount: q.amount + 100 }))} onContinue={vi.fn()} />);
    expect(screen.getByRole('checkbox')).not.toBeChecked();
    fireEvent.click(screen.getByRole('checkbox'));
    rerender(<SubscriptionCheckout quotes={initial.map(q => ({ ...q, renewsAt: '2026-11-10T19:44:00.000Z' }))} onContinue={vi.fn()} />);
    expect(screen.getByRole('checkbox')).not.toBeChecked();
  });

  it('shows the full annual charge, Moscow renewal time and clickable offer', () => {
    render(<SubscriptionCheckout quotes={previewQuotes(start, 'standard')} onContinue={vi.fn()} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Год' }));
    expect(screen.getByRole('button', { name: /Оплатить 6\s990 ₽/ })).toBeDisabled();
    expect(screen.getByText(/2027.*22:44 МСК.*6\s990/)).toBeVisible();
    expect(screen.getByRole('link', { name: 'Публичная оферта' })).toHaveAttribute('href', 'https://legche.online/oferta');
    expect(screen.queryByText('Спеццена для первых 100 участников')).not.toBeInTheDocument();
    expect(screen.getByText(/иностранным картам/)).toBeVisible();
  });

  it('retains paid access information when renewal is cancelled', () => {
    const q = previewQuotes(start, 'special')[0]; const cancel = vi.fn();
    const { rerender } = render(<SubscriptionManagement quote={q} autoRenew onCancel={cancel} />);
    fireEvent.click(screen.getByRole('button', { name: 'Отключить автопродление' }));
    expect(cancel).toHaveBeenCalledOnce();
    rerender(<SubscriptionManagement quote={q} autoRenew={false} onCancel={cancel} />);
    expect(screen.getByText(/Доступ оплачен до/)).toBeVisible();
    expect(screen.getByText('Автопродление: выключено')).toBeVisible();
    expect(screen.queryByText(/Следующее списание/)).not.toBeInTheDocument();
  });
});

describe('isolated preview', () => {
  it('does not call a payment endpoint or change storage on pay or cancel', () => {
    const fetch = vi.spyOn(window, 'fetch').mockRejectedValue(new Error('No network in preview'));
    const store = vi.spyOn(Storage.prototype, 'setItem');
    render(<MemoryRouter><SubscriptionPreview /></MemoryRouter>);
    expect(screen.getByText('Предпросмотр · оплата не подключена')).toBeVisible();
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Оплатить 990 ₽' }));
    expect(screen.getByText(/Заказ не создан/)).toBeVisible();
    fireEvent.change(screen.getByRole('combobox', { name: 'Экран' }), { target: { value: 'manage' } });
    fireEvent.click(screen.getByRole('button', { name: 'Отключить автопродление' }));
    expect(screen.getByText(/Настройки реального аккаунта не менялись/)).toBeVisible();
    expect(fetch).not.toHaveBeenCalled(); expect(store).not.toHaveBeenCalled();
  });

  it('clears consent when switching price and back', () => {
    render(<MemoryRouter><SubscriptionPreview /></MemoryRouter>);
    fireEvent.click(screen.getByRole('checkbox'));
    const price = screen.getByRole('combobox', { name: 'Цена' });
    fireEvent.change(price, { target: { value: 'standard' } });
    expect(screen.getByRole('checkbox')).not.toBeChecked();
    expect(screen.getByRole('button', { name: /Оплатить 1\s490 ₽/ })).toBeDisabled();
    fireEvent.change(price, { target: { value: 'special' } });
    expect(screen.getByRole('checkbox')).not.toBeChecked();
  });
});

describe('calendar and prices used only in preview fixtures', () => {
  it.each([
    ['2026-01-31T09:00:00Z', 'month', '2026-02-28T09:00:00.000Z'],
    ['2024-02-29T09:00:00Z', 'year', '2025-02-28T09:00:00.000Z'],
    ['2026-01-30T22:30:00Z', 'month', '2026-02-27T22:30:00.000Z'],
  ] as const)('adds a calendar period to %s', (date, plan, expected) => {
    // Third case: Jan 31 01:30 Moscow -> Feb 28 01:30 Moscow, UTC Feb 27.
    const result = nextPreviewPeriod(date, plan);
    expect(result).toBe(expected);
  });
  it('matches all four approved tariff amounts', () => {
    expect(previewQuotes(start, 'special').map(q => q.amount)).toEqual([99000, 499000]);
    expect(previewQuotes(start, 'standard').map(q => q.amount)).toEqual([149000, 699000]);
  });
});

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { MenuScreen } from '@/components/inga/MenuScreen';
import { LIGHT_RECIPES } from '@/lib/light-version';
import { breakfastRecipes, sweetRecipes, soupRecipes, mainDishRecipes, bakingRecipes, drinksRecipes } from '@/lib/recipes-data';

vi.mock('@/context/AppContext', () => ({ useApp: () => ({
  setStep: vi.fn(), weeklyData: [], dailyReports: [], medals: [], achievementStreak: 0, uniqueRecipes: 0,
  profile: { name: 'Тест', weight: 70, goalWeight: 60, height: 165, currentStage: 'loss' }, updateProfile: vi.fn(),
}) }));
vi.mock('@/context/SubscriptionContext', () => ({ useSubscription: () => ({ access: { active: true } }) }));
vi.mock('@/lib/app-settings', () => ({ getSetting: async () => null }));
vi.mock('@/lib/db', async importOriginal => ({ ...await importOriginal<typeof import('@/lib/db')>(), loadProgramProgress: async () => null }));
vi.mock('@/lib/api-client', async importOriginal => ({ ...await importOriginal<typeof import('@/lib/api-client')>(), apiFetch: async () => ({}) }));
vi.mock('@/lib/ai-provider', () => ({ askInga: vi.fn() }));

beforeEach(() => {
  localStorage.clear(); sessionStorage.clear();
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const cards = [...breakfastRecipes, ...sweetRecipes, ...soupRecipes, ...mainDishRecipes, ...bakingRecipes, ...drinksRecipes];
const samples = ['shaurma', 'apple-roll', 'pumpkin-soup', 'kefir-chicken', 'cabbage-pie', 'cappuccino'];
test.each(samples)('search opens the actual %s recipe card and returns to its category', async id => {
  const recipe = LIGHT_RECIPES.find(recipe => recipe.recipeId === id)!;
  const card = cards.find(card => card.id === id)!;
  localStorage.setItem('inga-menu-jump', JSON.stringify({ section: 'light-version' }));
  render(<MenuScreen />);
  const input = await screen.findByPlaceholderText('Например: шарлотка, котлеты, блины…');
  fireEvent.change(input, { target: { value: recipe.aliases[0] } });
  fireEvent.click(screen.getByRole('button', { name: 'Найти' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Открыть рецепт' }));
  expect(await screen.findByRole('heading', { name: card.name })).toBeInTheDocument();
  expect(screen.getByText(`КБЖУ на 100 г: ${card.kbju}`)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '← Назад' }));
  expect(screen.queryByText(`КБЖУ на 100 г: ${card.kbju}`)).not.toBeInTheDocument();
  expect(screen.getByText(card.name)).toBeInTheDocument();
});

test('a specific how-to page opens before the general list and back returns to that list', async () => {
  localStorage.setItem('inga-menu-jump', JSON.stringify({ section: 'how-to', nutrientSection: 'Меню30' }));
  render(<MenuScreen />);
  expect(await screen.findByRole('heading', { name: 'Примеры меню на 30 дней' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '← Назад' }));
  expect(screen.getByRole('heading', { name: 'Как похудеть' })).toBeInTheDocument();
});

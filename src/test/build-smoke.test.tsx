import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { MenuScreen } from '@/components/inga/MenuScreen';
import { LIGHT_RECIPES } from '@/lib/light-version';
import { breakfastRecipes, sweetRecipes, soupRecipes, mainDishRecipes, bakingRecipes, drinksRecipes } from '@/lib/recipes-data';

const { setStep, logSearch } = vi.hoisted(() => ({ setStep: vi.fn(), logSearch: vi.fn() }));
vi.mock('@/context/AppContext', () => ({ useApp: () => ({
  setStep, weeklyData: [], dailyReports: [], medals: [], achievementStreak: 0, uniqueRecipes: 0,
  profile: { name: 'Тест', weight: 70, goalWeight: 60, height: 165, currentStage: 'loss' }, updateProfile: vi.fn(),
}) }));
vi.mock('@/context/SubscriptionContext', () => ({ useSubscription: () => ({ access: { active: true } }) }));
vi.mock('@/lib/app-settings', () => ({ getSetting: async () => null }));
vi.mock('@/lib/db', async importOriginal => ({ ...await importOriginal<typeof import('@/lib/db')>(), loadProgramProgress: async () => null }));
vi.mock('@/lib/api-client', async importOriginal => ({ ...await importOriginal<typeof import('@/lib/api-client')>(), apiFetch: async (...args: unknown[]) => { logSearch(...args); return {}; } }));
vi.mock('@/lib/ai-provider', () => ({ askInga: vi.fn() }));

beforeEach(() => {
  localStorage.clear(); sessionStorage.clear();
  setStep.mockClear(); logSearch.mockClear();
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const cards = [...breakfastRecipes, ...sweetRecipes, ...soupRecipes, ...mainDishRecipes, ...bakingRecipes, ...drinksRecipes];
const samples = ['shaurma', 'apple-roll', 'pumpkin-soup', 'kefir-chicken', 'cabbage-pie', 'cappuccino'];
test.each(samples)('search opens %s and back restores the same query and results without a new search', async id => {
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
  expect(screen.getByRole('heading', { name: 'Лёгкая версия' })).toBeInTheDocument();
  expect(screen.getByRole('textbox')).toHaveValue(recipe.aliases[0]);
  expect(screen.getByRole('button', { name: 'Открыть рецепт' })).toBeInTheDocument();
  expect(logSearch).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: 'Открыть рецепт' }));
  fireEvent.click(screen.getByRole('button', { name: '← Назад' }));
  expect(screen.getByRole('textbox')).toHaveValue(recipe.aliases[0]);
  expect(logSearch).toHaveBeenCalledTimes(1);
});

test.each(samples)('a direct catalog entry for %s still returns to its category', async id => {
  const recipe = LIGHT_RECIPES.find(recipe => recipe.recipeId === id)!;
  const card = cards.find(card => card.id === id)!;
  localStorage.setItem('inga-menu-jump', JSON.stringify({ section: 'recipes', recipeSection: recipe.recipeSection, activeRecipe: id }));
  render(<MenuScreen />);
  expect(await screen.findByRole('heading', { name: card.name })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '← Назад' }));
  expect(screen.queryByText(`КБЖУ на 100 г: ${card.kbju}`)).not.toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Лёгкая версия' })).not.toBeInTheDocument();
  expect(screen.getByText(card.name)).toBeInTheDocument();
});

test('a recipe opened directly from the diary returns to the diary', async () => {
  localStorage.setItem('inga-menu-jump', JSON.stringify({ section: 'recipes', recipeSection: 'soups', activeRecipe: 'pumpkin-soup', returnTo: 'daily' }));
  render(<MenuScreen />);
  await screen.findByRole('heading', { name: 'Тыквенный суп' });
  fireEvent.click(screen.getByRole('button', { name: '← Назад' }));
  expect(setStep).toHaveBeenCalledExactlyOnceWith('daily');
});

test('diary → search → recipe goes back through search before returning to diary', async () => {
  localStorage.setItem('inga-menu-jump', JSON.stringify({ section: 'light-version', returnTo: 'daily' }));
  render(<MenuScreen />);
  fireEvent.change(await screen.findByRole('textbox'), { target: { value: 'тыквенный суп' } });
  fireEvent.click(screen.getByRole('button', { name: 'Найти' }));
  fireEvent.click(screen.getByRole('button', { name: 'Открыть рецепт' }));
  fireEvent.click(screen.getByRole('button', { name: '← Назад' }));
  expect(screen.getByRole('textbox')).toHaveValue('тыквенный суп');
  expect(setStep).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '← Назад' }));
  expect(setStep).toHaveBeenCalledExactlyOnceWith('daily');
});

test('a secondary result also returns to the same search, and leaving search clears its origin', async () => {
  localStorage.setItem('inga-menu-jump', JSON.stringify({ section: 'light-version' }));
  render(<MenuScreen />);
  fireEvent.change(await screen.findByRole('textbox'), { target: { value: 'овсянка' } });
  fireEvent.click(screen.getByRole('button', { name: 'Найти' }));
  fireEvent.click(screen.getByRole('button', { name: /Нежное утро/ }));
  expect(screen.getByRole('heading', { name: 'Овсянка с творогом и яблоками' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '← Назад' }));
  expect(screen.getByRole('textbox')).toHaveValue('овсянка');
  expect(screen.getByRole('button', { name: /Нежное утро/ })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '← Назад' }));
  expect(screen.getByRole('heading', { name: 'Меню' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /Рецепты.*Подборки/ }));
  fireEvent.click(screen.getByRole('button', { name: /Супы/ }));
  fireEvent.click(screen.getByRole('button', { name: /Тыквенный суп/ }));
  fireEvent.click(screen.getByRole('button', { name: '← Назад' }));
  expect(screen.getByRole('heading', { name: /Супы/ })).toBeInTheDocument();
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
});

test('a specific how-to page opens before the general list and back returns to that list', async () => {
  localStorage.setItem('inga-menu-jump', JSON.stringify({ section: 'how-to', nutrientSection: 'Меню30' }));
  render(<MenuScreen />);
  expect(await screen.findByRole('heading', { name: 'Примеры меню на 30 дней' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '← Назад' }));
  expect(screen.getByRole('heading', { name: 'Как похудеть' })).toBeInTheDocument();
});

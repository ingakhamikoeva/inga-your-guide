import { describe, expect, it } from 'vitest';
import * as cardData from '@/lib/recipes-data';
import { LIGHT_RECIPES } from '@/lib/light-version';
import nutritionRecipes from '../../server/nutrition/recipes.json';

const sections = {
  breakfasts: cardData.breakfastRecipes,
  sweet: cardData.sweetRecipes,
  soups: cardData.soupRecipes,
  lunches: cardData.mainDishRecipes,
  baking: cardData.bakingRecipes,
  drinks: cardData.drinksRecipes,
};
const cards = Object.values(sections).flat();
const ids = (values: string[]) => [...new Set(values)].sort();
const kbju = (value: string) => value.split('/').map(part => Number(part.trim().replace(',', '.')));

describe('recipe publication integrity (also required before a build)', () => {
  it('covers every recipe array exported by the card catalog', () => {
    const exported = Object.entries(cardData).filter(([key]) => key.endsWith('Recipes')).map(([, value]) => value);
    expect(new Set(Object.values(sections))).toEqual(new Set(exported));
  });

  it('includes every card in analysis, savings and the server achievement catalog', () => {
    const cardIds = ids(cards.map(recipe => recipe.id));
    expect(cardIds.length).toBeGreaterThan(0);
    expect(ids(nutritionRecipes.map(recipe => recipe.id))).toEqual(cardIds);
    expect(ids(LIGHT_RECIPES.map(recipe => recipe.recipeId))).toEqual(cardIds);
    // Multiple card sections may share an ID, but savings must have one definition.
    expect(LIGHT_RECIPES.length).toBe(cardIds.length);
    for (const id of cardIds) expect(id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  });

  it('keeps nutrition and savings calories equal to every displayed card', () => {
    for (const card of cards) {
      const values = kbju(card.kbju);
      expect(values, card.id).toHaveLength(4);
      expect(values.every(value => Number.isFinite(value) && value >= 0), card.id).toBe(true);
      for (const recipe of nutritionRecipes.filter(recipe => recipe.id === card.id)) {
        expect(kbju(recipe.kbju), card.id).toEqual(values);
      }
      expect(LIGHT_RECIPES.find(recipe => recipe.recipeId === card.id)?.lightKcal, card.id).toBe(values[0]);
    }
  });

  it('opens savings links in an existing section and has a usable comparison and portion', () => {
    for (const recipe of LIGHT_RECIPES) {
      expect(sections[recipe.recipeSection]?.some(card => card.id === recipe.recipeId), recipe.recipeId).toBe(true);
      expect(recipe.classicLabel.trim().length, recipe.recipeId).toBeGreaterThan(0);
      expect(Number.isFinite(recipe.classicKcal) && recipe.classicKcal > 0, recipe.recipeId).toBe(true);
      expect(Number.isFinite(recipe.portionGrams) && recipe.portionGrams > 0, recipe.recipeId).toBe(true);
    }
  });

  it('keeps analysis recommendations linked to real recipe cards', () => {
    for (const link of cardData.analysisRecipeLinks) {
      expect(sections[link.recipeSection].some(card => card.id === link.recipeId), link.recipeId).toBe(true);
    }
  });
});

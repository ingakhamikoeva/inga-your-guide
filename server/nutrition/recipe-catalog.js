import { readFileSync } from 'node:fs';

// One server catalog for nutrition analysis and recipe achievements.
// Some recipes occur in multiple menu sections; an ID still counts only once.
export const recipes = JSON.parse(readFileSync(new URL('./recipes.json', import.meta.url), 'utf8'));
export const recipeIds = new Set(recipes.map(recipe => recipe.id));

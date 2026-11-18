import { breakfastRecipes, sweetRecipes, soupRecipes, mainDishRecipes, bakingRecipes, drinksRecipes } from '@/lib/recipes-data';
const catalog = [
  ...breakfastRecipes.map(r=>({recipeId:r.id,recipeSection:'breakfasts',name:r.name,subtitle:r.subtitle})),
  ...sweetRecipes.map(r=>({recipeId:r.id,recipeSection:'sweet',name:r.name,subtitle:r.subtitle})),
  ...soupRecipes.map(r=>({recipeId:r.id,recipeSection:'soups',name:r.name,subtitle:r.subtitle})),
  ...mainDishRecipes.map(r=>({recipeId:r.id,recipeSection:'lunches',name:r.name,subtitle:r.subtitle})),
  ...bakingRecipes.map(r=>({recipeId:r.id,recipeSection:'baking',name:r.name,subtitle:r.subtitle})),
  ...drinksRecipes.map(r=>({recipeId:r.id,recipeSection:'drinks',name:r.name,subtitle:r.subtitle})),
];
export function dailyRecipe(date: string) {
  const day = Math.floor(Date.parse(`${date}T00:00:00Z`)/86400000);
  return catalog[Number.isFinite(day) ? ((day % catalog.length)+catalog.length)%catalog.length : 0];
}

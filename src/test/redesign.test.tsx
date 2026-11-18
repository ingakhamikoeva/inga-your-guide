import { fireEvent, render, screen, cleanup } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { dailyInspiration } from '@/components/inga/daily-inspiration';
import { dailyRecipe } from '@/components/inga/daily-recipe';
import { lastSevenDays } from '@/components/inga/WeeklyDiary';
import { LegcheAppearance, AppearanceControl } from '@/components/inga/LegcheAppearance';
import { breakfastRecipes, sweetRecipes, soupRecipes, mainDishRecipes, bakingRecipes, drinksRecipes } from '@/lib/recipes-data';

afterEach(()=>{ cleanup(); localStorage.removeItem('legche-ui-appearance-v1'); });
const dateAt = (index:number)=>new Date(Date.UTC(2026,0,1+index)).toISOString().slice(0,10);
test('UI: all 60 approved messages rotate by diary date; gender and fallback are supported',()=>{
  const female=Array.from({length:60},(_,i)=>dailyInspiration(dateAt(i),'female'));
  expect(new Set(female).size).toBe(60);
  expect(female.every(phrase=>!phrase.endsWith('.'))).toBe(true);
  expect(dailyInspiration(dateAt(60),'female')).toBe(female[0]);
  const index=female.findIndex(text=>text==='Позвольте себе быть счастливой!');
  expect(index).toBeGreaterThanOrEqual(0);
  expect(dailyInspiration(dateAt(index),'male')).toBe('Позвольте себе быть счастливым!');
  expect(dailyInspiration(dateAt(index))).toBe('Позвольте себе быть счастливее!');
});
test('UI: recipe of the day only references an existing catalog entry in the correct section',()=>{
  const sections={breakfasts:breakfastRecipes,sweet:sweetRecipes,soups:soupRecipes,lunches:mainDishRecipes,baking:bakingRecipes,drinks:drinksRecipes};
  for(let i=0;i<120;i++) {
    const recipe=dailyRecipe(dateAt(i));
    expect(sections[recipe.recipeSection as keyof typeof sections].some(r=>r.id===recipe.recipeId && r.name===recipe.name)).toBe(true);
    expect(dailyRecipe(dateAt(i))).toEqual(recipe);
  }
});
test('UI: weekly history uses seven calendar dates across month boundary, does not invent data',()=>{
  const saved={date:'2026-11-01',meals:[],checkin:{date:'2026-11-01',weight_kg:'59',sleep_hours:null,steps_yesterday:null,stool_yesterday:null}};
  const rows=lastSevenDays('2026-11-03',[saved,{date:'2026-10-01',meals:[]}]);
  expect(rows.map(r=>r.date)).toEqual(['2026-10-28','2026-10-29','2026-10-30','2026-10-31','2026-11-01','2026-11-02','2026-11-03']);
  expect(rows[4]).toBe(saved);
  expect(rows[0].checkin).toBeUndefined();
  expect(rows[0].meals).toEqual([]);
});
test('UI: theme preference switches without touching business state',()=>{
  const view=render(<LegcheAppearance><AppearanceControl/></LegcheAppearance>);
  fireEvent.change(screen.getByLabelText('Оформление'),{target:{value:'dark'}});
  expect(view.container.querySelector('.legche-shell')).toHaveAttribute('data-legche-theme','dark');
  expect(localStorage.getItem('legche-ui-appearance-v1')).toBe('dark');
  fireEvent.change(screen.getByLabelText('Оформление'),{target:{value:'light'}});
  expect(view.container.querySelector('.legche-shell')).toHaveAttribute('data-legche-theme','light');
});

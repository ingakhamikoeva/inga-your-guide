// Shared by the diary and server analysis. A source count is never a daily norm.
export function mealFacts(metas, weight) {
  const portions = { small:15, palm:25, large:40 };
  let protein = 0, unknownProtein = 0;
  for (const m of metas) {
    if (typeof m.proteinAi === 'number' && Number.isFinite(m.proteinAi) && m.proteinAi >= 0) protein += m.proteinAi;
    else if (m.proteinManual && m.protein && portions[m.proteinPortion]) protein += portions[m.proteinPortion];
    else unknownProtein++;
  }
  const group = key => ({ count:metas.filter(m => m[key] === true).length, unknown:metas.filter(m => typeof m[key] !== 'boolean' || (!m.nutritionVersion && !m[`${key}FlagManual`] && m[key] !== true)).length });
  return { mealCount:metas.length, protein:Math.round(protein), unknownProtein,
    proteinTarget:Number(weight)>0 ? Math.round(Number(weight)*1.5) : null,
    carbs:group('carbs'), fiber:group('fiber') };
}

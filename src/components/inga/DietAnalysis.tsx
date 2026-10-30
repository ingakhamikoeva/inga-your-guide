import { isAiLimitError, DIARY_AI_LIMIT_MESSAGE } from '@/lib/request-limits';
import { useEffect, useState } from 'react';
import { apiFetch, ApiError } from '@/lib/api-client';
import { LIGHT_RECIPES, LightRecipeEntry } from '@/lib/light-version';
import { analysisRecipeLinks } from '@/lib/recipes-data';
import { currentSession } from '@/lib/auth-storage';

type Analysis = {present:string[];attention:string[];next:string[];recipeIds:string[]};
export function DietAnalysis({date,revision,ready,mealCount,protein,unknownProtein,proteinTarget,onRecipe,onPlan}: {
  date:string;revision:string;ready:boolean;mealCount:number;protein:number;unknownProtein:number;proteinTarget:number|null;
  onRecipe:(recipe:Pick<LightRecipeEntry,'recipeId'|'recipeSection'|'name'>)=>void;onPlan:()=>void;
}) {
  const owner=currentSession()?.user.id;
  const [result,setResult]=useState<Analysis|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const [retry,setRetry]=useState(0);
  useEffect(()=>{
    let cancelled=false;
    const controller=new AbortController();
    setResult(null);setError(null);
    if(!ready||!mealCount){setBusy(false);return;}
    setBusy(true);
    const timezone=Intl.DateTimeFormat().resolvedOptions().timeZone;
    const request=()=>apiFetch<{analysis:Analysis}>(`/nutrition/analysis/${date}`,{method:'POST',body:{timezone},signal:controller.signal});
    request().catch(e=>{if(e instanceof ApiError && e.status===409 && !cancelled)return request();throw e;}).then(data=>{
      if(!cancelled && currentSession()?.user.id===owner)setResult(data.analysis);
    }).catch(error=>{if(!cancelled)setError(isAiLimitError(error)?DIARY_AI_LIMIT_MESSAGE:'Не удалось загрузить разбор. Ваши записи сохранены.');}).finally(()=>{if(!cancelled)setBusy(false);});
    return ()=>{cancelled=true;controller.abort();};
  },[date,revision,ready,mealCount,retry,owner]);
  return <div className="space-y-4 animate-fade-in-up">
    <h3 className="text-xl font-bold">Питание сегодня</h3>
    <p className="text-sm text-muted-foreground">Разбор учитывает только записанные приёмы пищи. Чем подробнее описание и размер порций, тем точнее рекомендации.</p>
    {!mealCount && ready ? <div className="inga-bubble">Добавьте первый приём пищи — здесь появится разбор вашего питания.</div> : <>
      <div className="inga-card space-y-2 text-sm">
        <p>Приёмов пищи в дневнике: {mealCount}</p>
        <p>Белок: {unknownProtein===mealCount?'пока недостаточно данных':`примерно ${protein} г${unknownProtein?' в оценённых записях':''}`}{proteinTarget?` · цель ${proteinTarget} г`:''}</p>
        {unknownProtein>0 && unknownProtein<mealCount && <p className="text-muted-foreground">Не во всех записях удалось оценить белок.</p>}
      </div>
      {(!ready||busy) && <p role="status" className="text-sm text-muted-foreground">Готовим разбор…</p>}
      {error && <div className="inga-card"><p role="alert" className="text-sm">{error}</p><button className="inga-btn-secondary mt-3" onClick={()=>setRetry(n=>n+1)}>Повторить</button></div>}
      {result && <>
        {([['Что уже есть в рационе',result.present],['На что обратить внимание',result.attention],['Как дополнить следующий приём пищи',result.next]] as const).map(([title,lines])=>lines.length>0 && <section className="inga-card space-y-3" key={title}><h4 className="font-semibold">{title}</h4>{lines.map((line,i)=><p className="text-sm leading-relaxed" key={i}>{line}</p>)}</section>)}
        {result.recipeIds.map(id=>{const recipe=LIGHT_RECIPES.find(r=>r.recipeId===id) ?? analysisRecipeLinks.find(r=>r.recipeId===id);return recipe?<button key={id} onClick={()=>onRecipe(recipe)} className="inga-btn-secondary w-full text-left">{recipe.name} →</button>:null;})}
      </>}
    </>}
    <button onClick={onPlan} className="inga-btn-secondary w-full">Спланировать завтра →</button>
  </div>;
}

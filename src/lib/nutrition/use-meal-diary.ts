import { isAiLimitError } from '@/lib/request-limits';
import { useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import { currentSession, isSessionCurrent, sessionSnapshot } from '@/lib/auth-storage';
import { foodWriteIntent } from './food-write-intent';
import { FoodLogRow, MealTag } from '@/lib/db';
import { toast } from 'sonner';

export type ProteinPortion = 'small' | 'palm' | 'large';
export type LightSwapMeta = {recipeIds:string[];savedKcal:number};
export type MealMeta = {
  id:string; datetime:string; time:string; name:string; isEvening:boolean;
  protein:boolean|null; carbs:boolean|null; fiber:boolean|null; sweet:boolean;
  proteinPortion:ProteinPortion; proteinAi:number|null; proteinLoading:boolean; proteinManual:boolean;
  lightSwap?:LightSwapMeta|null; nutritionVersion?:number;
  [key:string]:unknown;
};
export function mealName(time:string) {
  const h=Number(time.split(':')[0]);
  return h>=6&&h<10?'Завтрак':h>=10&&h<12?'Перекус':h>=12&&h<15?'Обед':h>=15&&h<18?'Полдник':h>=18&&h<21?'Ужин':'Вечерний перекус';
}
export function rowMeta(row:FoodLogRow, loading=false):MealMeta {
  const m=row.meta||{};
  const time=new Date(row.datetime).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});
  const flag=(key:string) => typeof m[key]==='boolean' && (m.nutritionVersion || m[`${key}FlagManual`] || m[key]===true) ? m[key] as boolean : null;
  return {...m,id:row.log_id,datetime:row.datetime,time,name:m.isEvening?'Вечерний перекус':mealName(time),
    isEvening:!!m.isEvening,protein:flag('protein'),carbs:flag('carbs'),fiber:flag('fiber'),sweet:!!m.sweet,
    proteinPortion:(m.proteinPortion as ProteinPortion)||'palm',proteinAi:typeof m.proteinAi==='number'?m.proteinAi:null,
    proteinLoading:loading,proteinManual:!!m.proteinManual,lightSwap:m.lightSwap as LightSwapMeta|null};
}
export function useMealDiary(date:string) {
  const session=sessionSnapshot();
  const owner=currentSession()?.user.id;
  const [rows,setRows]=useState<FoodLogRow[]>([]);
  const [loading,setLoading]=useState(true);
  const [pending,setPending]=useState(0);
  const [estimating,setEstimating]=useState<string[]>([]);
  const [error,setError]=useState(false);
  const [reload,setReload]=useState(0);
  const [analysisLimit,setAnalysisLimit]=useState(false);
  const analysisLimited=useRef(false);
  const generation=useRef(0);
  const adding=useRef(false);
  const queues=useRef(new Map<string,Promise<unknown>>());
  const live=(g:number) => g===generation.current && isSessionCurrent(session);
  const apply=(row:FoodLogRow,g:number) => {if(live(g))setRows(prev=>prev.map(r=>r.log_id===row.log_id?row:r));};
  const runAnalysis=async(row:FoodLogRow,g:number) => {
    if(row.meta?.nutritionVersion===3 || !live(g) || analysisLimited.current)return;
    setPending(n=>n+1);setEstimating(ids=>[...ids,row.log_id]);
    const task=apiFetch<FoodLogRow>(`/food-logs/${row.log_id}/analyze`,{method:'POST'});
    try {apply(await task,g);} catch (error) {
      if(live(g) && isAiLimitError(error)) {
        analysisLimited.current=true;setAnalysisLimit(true);
      }
      // Other unknown composition remains unknown; retry is explicit.
    }
    finally {if(live(g)){setPending(n=>n-1);setEstimating(ids=>ids.filter(id=>id!==row.log_id));}}
  };
  const analyze=(row:FoodLogRow,g:number) => {
    const task=(queues.current.get(row.log_id)||Promise.resolve()).catch(()=>{}).then(()=>runAnalysis(row,g));
    queues.current.set(row.log_id,task);
    return task;
  };
  useEffect(()=>{
    const g=++generation.current;
    analysisLimited.current=false;setAnalysisLimit(false);
    setRows([]);setLoading(true);setPending(0);setEstimating([]);setError(false);adding.current=false;queues.current.clear();
    const timezone=Intl.DateTimeFormat().resolvedOptions().timeZone;
    apiFetch<FoodLogRow[]>(`/food-logs?date=${date}&timezone=${encodeURIComponent(timezone)}`).then(async data=>{
      if(!live(g))return;
      setRows(data);setLoading(false);
      // Sequential requests avoid flooding the provider for older entries.
      for(const row of data) {if(!live(g))break; await analyze(row,g);}
    }).catch(()=>{if(live(g)){setError(true);setLoading(false);}});
    return ()=>{generation.current++;};
  },[date,owner,session.generation,reload]);
  const add=async(description:string,mealTag:MealTag,datetime:string,meta:Record<string,unknown>)=>{
    if(adding.current||loading||error)return false;
    adding.current=true;const g=generation.current;setPending(n=>n+1);
    try {
      const intent=foodWriteIntent(session,date,{description,mealTag,datetime,meta});
      const row=await apiFetch<FoodLogRow>('/food-logs',{method:'POST',body:{...intent.payload,requestId:intent.requestId}});
      if(!live(g))return false;
      intent.confirm();
      setRows(prev=>prev.some(r=>r.log_id===row.log_id)?prev.map(r=>r.log_id===row.log_id?row:r):[...prev,row]);void analyze(row,g);return true;
    } catch {if(live(g))toast.error('Не удалось сохранить приём пищи. Повторите попытку.');return false;}
    finally {if(live(g)){adding.current=false;setPending(n=>n-1);}}
  };
  const mutate=(id:string,method:'PATCH'|'DELETE',body?:unknown):Promise<boolean>=>{
    const g=generation.current;setPending(n=>n+1);
    let confirm!:(saved:boolean)=>void;
    const confirmed=new Promise<boolean>(resolve=>{confirm=resolve;});
    const task=(queues.current.get(id)||Promise.resolve()).catch(()=>{}).then(async()=>{
      if(!live(g))return;
      const row=await apiFetch<FoodLogRow>(`/food-logs/${id}`,{method,body});
      if(!live(g))return;
      if(method==='DELETE')setRows(prev=>prev.filter(r=>r.log_id!==id));else apply(row,g);
      // Close the editor on saved data; provider latency is not a save failure.
      confirm(true);
      if(method==='PATCH'){
        const patch=body as {description?:string;meta?:{lightSwap?:unknown}};
        if(patch?.description != null || patch?.meta?.lightSwap !== undefined) await runAnalysis(row,g);
      }
    }).catch(()=>{if(live(g))toast.error('Не удалось сохранить изменения. Повторите попытку.');})
      .finally(()=>{if(live(g))setPending(n=>n-1);confirm(false);});
    queues.current.set(id,task);
    return confirmed.then(saved=>saved&&live(g));
  };
  return {meals:rows.map(r=>r.raw_text||''),mealMeta:rows.map(r=>rowMeta(r,estimating.includes(r.log_id))),
    loading,error,analysisLimit,pending,add,patch:(id:string,body:unknown)=>mutate(id,'PATCH',body),remove:(id:string)=>mutate(id,'DELETE'),
    retry:()=>setReload(n=>n+1)};
}

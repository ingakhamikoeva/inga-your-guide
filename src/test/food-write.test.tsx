import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { apiFetch } from '@/lib/api-client';
import { setTokens, clearTokens } from '@/lib/auth-storage';
import { useMealDiary } from '@/lib/nutrition/use-meal-diary';
import { DailyScreen } from '@/components/inga/DailyScreen';
import { localDay } from '@/lib/achievement-client';
import { toast } from 'sonner';

vi.mock('@/lib/api-client',async original=>({...await original<typeof import('@/lib/api-client')>(),apiFetch:vi.fn()}));
vi.mock('sonner',()=>({toast:{error:vi.fn()}}));
vi.mock('@/context/AppContext',()=>({useApp:()=>({
  profile:{name:'Тест',weight:60,goalWeight:55,trackingMethod:'plate',food_preferences:['Блины'],currentStage:'loss'},
  calculations:null,weeklyData:[],dailyReports:[],setStep:vi.fn(),addWeightEntry:vi.fn(),updateProfile:vi.fn(),performFixationAction:vi.fn(),
})}));
vi.mock('@/lib/db',async original=>({...await original<typeof import('@/lib/db')>(),
  loadProgramProgress:async()=>null,loadTodayCheckin:async()=>null,loadMealPlanForDate:async()=>null,loadLightSavings:async()=>({total_kcal:0,swaps_count:0}),
}));
vi.mock('@/components/inga/VoiceInput',()=>({VoiceInput:()=>null}));
const signIn=(id='A')=>setTokens(id,`refresh-${id}`,{id,user_id:id,email:`${id}@i4.invalid`});
const datetime='2026-11-06T12:00:00Z', date='2026-11-06';
const ready=(text='Шницель')=>({log_id:'meal-1',raw_text:text,datetime,meal_tag:'lunch',meta:{nutritionVersion:3,proteinAi:25,protein:true}});
function deferred<T>(){let resolve!:(value:T)=>void;const promise=new Promise<T>(r=>{resolve=r;});return{promise,resolve};}
beforeEach(()=>{vi.clearAllMocks();localStorage.clear();sessionStorage.clear();signIn();});
afterEach(()=>{cleanup();vi.restoreAllMocks();});

test('I4: lost create reply survives remount; retry uses same action and shows only one row',async()=>{
  let saved:ReturnType<typeof ready>|null=null, first=true;
  const posts:unknown[]=[];
  vi.mocked(apiFetch).mockImplementation(async(path,opts)=>{
    if(opts?.method==='POST'){
      posts.push(opts.body);saved=ready();
      if(first){first=false;throw new Error('reply lost');}return saved;
    }
    return saved?[saved]:[];
  });
  const a=renderHook(()=>useMealDiary(date));await waitFor(()=>expect(a.result.current.loading).toBe(false));
  await act(async()=>{expect(await a.result.current.add('Шницель','lunch',datetime,{})).toBe(false);});
  expect(a.result.current.meals).toEqual([]);a.unmount();
  const b=renderHook(()=>useMealDiary(date));await waitFor(()=>expect(b.result.current.meals).toEqual(['Шницель']));
  await act(async()=>{expect(await b.result.current.add('Шницель','lunch','2026-11-06T12:05:00Z',{})).toBe(true);});
  expect(posts[0]).toEqual(posts[1]);expect(b.result.current.meals).toHaveLength(1);
  expect(Object.keys(sessionStorage).filter(k=>k.startsWith('legche:food-create:'))).toHaveLength(0);
  await act(async()=>{await b.result.current.add('Шницель','lunch',datetime,{});});
  expect((posts[2] as {requestId:string}).requestId).not.toBe((posts[1] as {requestId:string}).requestId);
});

test('I4: evening retry keeps original time even when the clock changes',async()=>{
  const posts:unknown[]=[];let fail=true;
  vi.mocked(apiFetch).mockImplementation(async(_path,opts)=>{
    if(opts?.method==='POST'){posts.push(opts.body);if(fail){fail=false;throw new Error('lost');}return ready();}return[];
  });
  const {result}=renderHook(()=>useMealDiary(date));await waitFor(()=>expect(result.current.loading).toBe(false));
  await act(async()=>{await result.current.add('Шницель','snack',datetime,{isEvening:true});});
  await act(async()=>{await result.current.add('Шницель','snack','2026-11-06T12:01:00Z',{isEvening:true});});
  expect(posts[1]).toEqual(posts[0]);
});

test('I4: synchronous double submit is blocked and pending replies cannot leak to another login',async()=>{
  const slow=deferred<ReturnType<typeof ready>>();let posts=0;
  vi.mocked(apiFetch).mockImplementation(async(_path,opts)=>{if(opts?.method==='POST'){posts++;return slow.promise;}return[];});
  const {result,rerender}=renderHook(()=>useMealDiary(date));await waitFor(()=>expect(result.current.loading).toBe(false));
  let pending!:Promise<boolean>;
  act(()=>{pending=result.current.add('Шницель','lunch',datetime,{});});
  await act(async()=>{expect(await result.current.add('Шницель','lunch',datetime,{})).toBe(false);});
  expect(posts).toBe(1);
  clearTokens();signIn();rerender();await waitFor(()=>expect(result.current.loading).toBe(false));
  await act(async()=>{slow.resolve(ready());expect(await pending).toBe(false);});
  expect(result.current.meals).toEqual([]);expect(result.current.pending).toBe(0);
});

test('I4: without durable intent storage no uncertain create request is sent',async()=>{
  vi.mocked(apiFetch).mockResolvedValue([]);
  const {result}=renderHook(()=>useMealDiary(date));await waitFor(()=>expect(result.current.loading).toBe(false));
  vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new Error('storage unavailable');});
  await act(async()=>{expect(await result.current.add('Шницель','lunch',datetime,{})).toBe(false);});
  expect(vi.mocked(apiFetch).mock.calls.filter(([,opts])=>opts?.method==='POST')).toHaveLength(0);
  expect(toast.error).toHaveBeenCalled();
});

test('I4: failed edit retains existing row; successful retry recalculates and queues a manual correction',async()=>{
  let row:Record<string,unknown>=ready(), fail=true;
  const calls:string[]=[];
  vi.mocked(apiFetch).mockImplementation(async(path,opts)=>{
    if(opts?.method==='PATCH'){
      const body=opts.body as {description?:string;meta?:Record<string,unknown>};calls.push(body.description?'edit':'manual');
      if(fail){fail=false;throw new Error('offline');}
      row=body.description?{...row,raw_text:body.description,meta:{compositionRevision:1}}:{...row,meta:{...(row.meta as object),...body.meta}};
      return row;
    }
    if(path.endsWith('/analyze')){calls.push('analyze');row={...row,meta:{nutritionVersion:3,proteinAi:0,protein:false}};return row;}
    return[row];
  });
  const {result}=renderHook(()=>useMealDiary(date));await waitFor(()=>expect(result.current.loading).toBe(false));
  await act(async()=>{expect(await result.current.patch('meal-1',{description:'Чай',resetComposition:true})).toBe(false);});
  expect(result.current.meals).toEqual(['Шницель']);
  await act(async()=>{await Promise.all([
    result.current.patch('meal-1',{description:'Чай',resetComposition:true}),
    result.current.patch('meal-1',{meta:{proteinAi:7,proteinManual:true}}),
  ]);});
  expect(calls).toEqual(['edit','edit','analyze','manual']);
  expect(result.current.meals).toEqual(['Чай']);expect(result.current.mealMeta[0].proteinAi).toBe(7);expect(result.current.pending).toBe(0);
});

test('I4: provider failure retains saved edit with unknown protein; explicit retry analyzes it',async()=>{
  let row:Record<string,unknown>=ready(),fail=true;
  vi.mocked(apiFetch).mockImplementation(async(path,opts)=>{
    if(opts?.method==='PATCH'){row={...row,raw_text:'Чай',meta:{compositionRevision:1}};return row;}
    if(path.endsWith('/analyze')){if(fail){fail=false;throw new Error('provider');}row={...row,meta:{nutritionVersion:3,proteinAi:0}};return row;}
    return[row];
  });
  const {result}=renderHook(()=>useMealDiary(date));await waitFor(()=>expect(result.current.loading).toBe(false));
  await act(async()=>{expect(await result.current.patch('meal-1',{description:'Чай',resetComposition:true})).toBe(true);});
  expect(result.current.meals).toEqual(['Чай']);expect(result.current.mealMeta[0].proteinAi).toBeNull();
  act(()=>result.current.retry());await waitFor(()=>expect(result.current.mealMeta[0].proteinAi).toBe(0));
});

test('I4: confirmed edit returns before slow AI, while subsequent changes remain queued',async()=>{
  const slow=deferred<ReturnType<typeof ready>>();
  vi.mocked(apiFetch).mockImplementation(async(path,opts)=>{
    if(opts?.method==='PATCH')return {...ready('Чай'),meta:{compositionRevision:1}};
    if(path.endsWith('/analyze'))return slow.promise;
    return[ready()];
  });
  const {result}=renderHook(()=>useMealDiary(date));await waitFor(()=>expect(result.current.loading).toBe(false));
  await act(async()=>{expect(await result.current.patch('meal-1',{description:'Чай',resetComposition:true})).toBe(true);});
  expect(result.current.meals).toEqual(['Чай']);expect(result.current.mealMeta[0].proteinAi).toBeNull();
  expect(result.current.pending).toBeGreaterThan(0);
  await act(async()=>{slow.resolve({...ready('Чай'),meta:{nutritionVersion:3,proteinAi:0,protein:false}});});
  await waitFor(()=>expect(result.current.pending).toBe(0));
  expect(result.current.mealMeta[0].proteinAi).toBe(0);
});

test('I4: real diary editor keeps textarea stable, cancels safely and confirms reset before saving',async()=>{
  let row:Record<string,unknown>=ready(),fail=true;
  vi.mocked(apiFetch).mockImplementation(async(path,opts)=>{
    if(opts?.method==='PATCH'){
      if(fail){fail=false;throw new Error('save failed');}
      row={...row,raw_text:(opts.body as {description:string}).description,meta:{compositionRevision:1}};return row;
    }
    if(path.endsWith('/analyze')){row={...row,meta:{nutritionVersion:3,proteinAi:0}};return row;}
    return[row];
  });
  localStorage.setItem('dailyActiveTabDate',localDay());localStorage.setItem('dailyActiveTab','meals');
  render(<DailyScreen/>);
  await waitFor(()=>expect(screen.getByRole('button',{name:'Редактировать'})).toBeEnabled());
  fireEvent.click(screen.getByRole('button',{name:'Редактировать'}));
  const input=await screen.findByRole('textbox',{name:'Приём пищи'});
  fireEvent.change(input,{target:{value:'Зелёный'}});fireEvent.change(input,{target:{value:'Зелёный чай'}});
  expect(screen.getByRole('textbox',{name:'Приём пищи'})).toBe(input);
  expect(screen.getByText(/После изменения описания состав будет рассчитан заново/)).toBeVisible();
  fireEvent.click(screen.getByRole('button',{name:'Отмена'}));
  expect(vi.mocked(apiFetch).mock.calls.filter(([,o])=>o?.method==='PATCH')).toHaveLength(0);
  fireEvent.click(screen.getByRole('button',{name:'Редактировать'}));
  fireEvent.change(screen.getByRole('textbox',{name:'Приём пищи'}),{target:{value:'Зелёный чай'}});
  fireEvent.click(screen.getByRole('button',{name:'Сохранить →'}));
  await waitFor(()=>expect(toast.error).toHaveBeenCalled());
  expect(screen.getByRole('textbox',{name:'Приём пищи'})).toHaveValue('Зелёный чай');
  await waitFor(()=>expect(screen.getByRole('button',{name:'Сохранить →'})).toBeEnabled());
  fireEvent.click(screen.getByRole('button',{name:'Сохранить →'}));
  await waitFor(()=>expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(screen.getByText('Зелёный чай')).toBeVisible();
  expect(apiFetch).toHaveBeenCalledWith('/food-logs/meal-1',{method:'PATCH',body:{description:'Зелёный чай',resetComposition:true}});
});

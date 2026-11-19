import { useState } from 'react';
export type WeightPoint = {date:string; weight:number};
const periods = [{label:'Неделя',days:7},{label:'Месяц',days:30},{label:'2 мес.',days:60},{label:'3 мес.',days:90},{label:'Всё',days:0}] as const;
const DAY=86400000;
const dateMs=(d:string)=>Date.parse(`${d}T00:00:00Z`);
const dateLabel=(d:string)=>new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:'short',timeZone:'UTC'}).format(dateMs(d));
const num=(n:number)=>n.toLocaleString('ru-RU',{maximumFractionDigits:1});
export function weightPeriod(entries:WeightPoint[],today:string,days:number) {
  const until=dateMs(today), from=days ? until-(days-1)*DAY : -Infinity;
  return [...new Map(entries.filter(e=>Number.isFinite(dateMs(e.date))&&Number.isFinite(e.weight)&&e.weight>0&&dateMs(e.date)>=from&&dateMs(e.date)<=until).map(e=>[e.date,e])).values()].sort((a,b)=>a.date.localeCompare(b.date));
}
export function WeightTrend({entries,today}:{entries:WeightPoint[];today:string}) {
  const [period,setPeriod]=useState(30);
  const data=weightPeriod(entries,today,period), first=data[0], last=data.at(-1);
  const delta=first&&last&&data.length>1 ? Math.round((last.weight-first.weight)*10)/10 : null;
  const min=data.length?Math.min(...data.map(e=>e.weight)):0, max=data.length?Math.max(...data.map(e=>e.weight)):1;
  const lo=Math.floor((min-.25)*2)/2, hi=Math.ceil((max+.25)*2)/2;
  const from=first?dateMs(first.date):0, to=last?dateMs(last.date):0;
  const points=data.map(e=>({x:to===from?181:34+(dateMs(e.date)-from)/(to-from)*294,y:10+(hi-e.weight)/(hi-lo)*100}));
  return <section className="inga-card legche-weight-trend"><h3 className="font-semibold">Динамика веса</h3>
    <div className="legche-weight-periods" aria-label="Период динамики веса">{periods.map(p=><button type="button" key={p.days} aria-pressed={period===p.days} onClick={()=>setPeriod(p.days)}>{p.label}</button>)}</div>
    {!first||!last ? <p className="text-sm text-muted-foreground">Пока нет измерений за этот период</p> : <>
      <div className="legche-weight-summary"><div><span>Изменение за период</span><strong>{delta===null?'Пока мало данных':`${delta>0?'+':''}${num(delta)} кг`}</strong></div><div><span>Первый замер</span><strong>{num(first.weight)} кг</strong></div></div>
      {points.length>1 ? <svg className="legche-weight-svg" viewBox="0 0 340 140" role="img" aria-label="График фактических измерений веса">
        {[hi,(hi+lo)/2,lo].map((v,i)=><g key={i}><line x1="34" x2="328" y1={10+i*50} y2={10+i*50} stroke="var(--legche-line)" strokeDasharray="3 4"/><text x="28" y={14+i*50} textAnchor="end" fontSize="10" fill="var(--legche-muted)">{num(v)}</text></g>)}
        <polyline points={points.map(p=>`${p.x},${p.y}`).join(' ')} fill="none" stroke="var(--legche-cta,#FF6600)" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round"/>
        {points.map((p,i)=><circle key={data[i].date} cx={p.x} cy={p.y} r={i===points.length-1?3.7:2.2} fill="var(--legche-cta,#FF6600)"><title>{dateLabel(data[i].date)}: {num(data[i].weight)} кг</title></circle>)}
        <text x="34" y="132" fontSize="10" fill="var(--legche-muted)">{dateLabel(first.date)}</text><text x="328" y="132" textAnchor="end" fontSize="10" fill="var(--legche-muted)">{dateLabel(last.date)}</text>
      </svg>:<p className="text-sm text-muted-foreground">График появится после следующего измерения</p>}
      <p className="text-sm text-muted-foreground">Последний замер: {num(last.weight)} кг · {dateLabel(last.date)}</p>
    </>}
    <p className="text-xs text-muted-foreground">Вес может колебаться по разным причинам. Мы смотрим не на день, а на тенденцию.</p>
  </section>;
}

import { fireEvent, render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { WeightTrend, weightPeriod } from '@/components/inga/WeightTrend';
const rows=[{date:'2026-08-21',weight:69},{date:'2026-09-25',weight:66},{date:'2026-10-23',weight:63},{date:'2026-11-15',weight:61},{date:'2026-11-19',weight:60},{date:'2026-11-20',weight:59}];
test('uses only factual measurements inside the selected period, sorted by date',()=>{
  expect(weightPeriod([...rows].reverse(),'2026-11-19',7).map(e=>e.weight)).toEqual([61,60]);
  expect(weightPeriod(rows,'2026-11-19',30).map(e=>e.weight)).toEqual([63,61,60]);
  expect(weightPeriod(rows,'2026-11-19',60).map(e=>e.weight)).toEqual([66,63,61,60]);
  expect(weightPeriod(rows,'2026-11-19',90).map(e=>e.weight)).toEqual([66,63,61,60]);
  expect(weightPeriod(rows,'2026-11-19',0).map(e=>e.weight)).toEqual([69,66,63,61,60]);
});
test('switches history without inventing measurements',()=>{
  render(<WeightTrend entries={rows} today="2026-11-19"/>);
  expect(screen.getByText('-3 кг')).toBeVisible();
  fireEvent.click(screen.getByRole('button',{name:'Неделя'}));
  expect(screen.getByText('-1 кг')).toBeVisible();
  fireEvent.click(screen.getByRole('button',{name:'Всё'}));
  expect(screen.getByText('-9 кг')).toBeVisible();
});

import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { MedalIcon, medalIconName, SearchIcon } from '@/components/inga/GlassIcons';
const ids = ['swap-1','swap-5','swap-10','recipe-bliny','recipe-shaurma','favorite','streak-7','streak-14','streak-21','streak-30','streak-60','streak-90','loss-1','loss-5','loss-10','halfway','maintenance-1','maintenance-2','maintenance-3','maintenance-6'];
describe('Glass medal illustrations', () => {
  it('maps every non-goal server ID', () => {
    for (const id of ids) expect(medalIconName({id,title:id})).toBe(id);
  });
  it('selects both goal variants and tolerates future unknown IDs', () => {
    expect(medalIconName({id:'goal',title:'Цель достигнута. Вы — королева!',icon:'👑'})).toBe('goal-queen');
    expect(medalIconName({id:'goal',title:'Цель достигнута. Вы — мой герой!',icon:'🏆'})).toBe('goal-hero');
    expect(medalIconName({id:'unknown',title:'Новая награда'})).toBeUndefined();
  });
  it('renders the artwork as decorative, without duplicating the award title', () => {
    const {container} = render(<MedalIcon medal={{id:'loss-5',title:'Пятёрка'}} />);
    expect(container.querySelector('img')?.getAttribute('alt')).toBe('');
    expect(container.querySelector('img')?.getAttribute('src')).toContain('loss-5');
  });
  it('uses unique svg gradient IDs for multiple search icons', () => {
    const {container} = render(<><SearchIcon/><SearchIcon/></>);
    const gradients = Array.from(container.querySelectorAll('linearGradient')).map(x=>x.id);
    expect(gradients.length).toBe(4);
    expect(new Set(gradients).size).toBe(4);
  });
});

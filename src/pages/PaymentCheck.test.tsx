import React from 'react';
import { act,cleanup,fireEvent,render,screen,waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach,afterEach,describe,it,expect,vi } from 'vitest';
const mocks=vi.hoisted(()=>({load:vi.fn(),checkout:vi.fn(),submit:vi.fn(),owner:'owner',listener:null as null|(()=>void)}));
vi.mock('@/lib/auth-storage',()=>({currentSession:()=>mocks.owner ? {user:{id:mocks.owner}} : null,subscribe:(cb:()=>void)=>{mocks.listener=cb;return()=>{};}}));
vi.mock('@/lib/live-payment-pilot',()=>({isLivePilotPage:()=>true,loadPilot:mocks.load,checkoutPilot:mocks.checkout,submitPilot:mocks.submit}));
import PaymentCheck from './PaymentCheck';
const state={available:true,amount:10000,recurring:false,emailVerified:true,consentVersion:'v1',consentText:'text',offer:{url:'https://legche.online/oferta',sha256:'abc'},order:null};
beforeEach(()=>{mocks.owner='owner';mocks.load.mockReset();mocks.checkout.mockReset();mocks.submit.mockReset();mocks.load.mockResolvedValue(state);});
afterEach(()=>cleanup());
describe('one-off payment page',()=>{
  it('starts with unchecked consent and does not submit without a user action',async()=>{
    render(<MemoryRouter><PaymentCheck/></MemoryRouter>);
    const button=await screen.findByRole('button',{name:'Оплатить 100 ₽'});
    expect(screen.getByRole('checkbox')).not.toBeChecked();expect(button).toBeDisabled();expect(mocks.checkout).not.toHaveBeenCalled();
    let resolve!:(v:unknown)=>void;mocks.checkout.mockReturnValue(new Promise(r=>resolve=r));
    fireEvent.click(screen.getByRole('checkbox'));fireEvent.click(button);fireEvent.click(button);
    expect(mocks.checkout).toHaveBeenCalledTimes(1);
    await act(async()=>{resolve({invoice:'200000000000000001',status:'pending'});});
    expect(mocks.submit).toHaveBeenCalledTimes(1);
  });
  it('does not treat a browser success return as paid and hides payment after logout',async()=>{
    render(<MemoryRouter initialEntries={['/payment-check?InvId=200000000000000001&result=success']}><PaymentCheck/></MemoryRouter>);
    await screen.findByRole('button',{name:'Оплатить 100 ₽'});
    expect(screen.queryByText('Оплата подтверждена')).not.toBeInTheDocument();
    await act(async()=>{mocks.owner='';mocks.listener?.();});
    expect(screen.queryByRole('button',{name:'Оплатить 100 ₽'})).not.toBeInTheDocument();
  });
  it('shows paid state without a second payment button, including when creation is disabled',async()=>{
    mocks.load.mockResolvedValue({...state,available:false,order:{invoice:'200000000000000001',status:'paid',amount:10000,accessUntil:'2026-12-01T12:00:00Z'}});
    render(<MemoryRouter><PaymentCheck/></MemoryRouter>);
    await screen.findByText('Оплата подтверждена');
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(mocks.checkout).not.toHaveBeenCalled();
  });
});

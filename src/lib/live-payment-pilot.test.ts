import { describe,it,expect } from 'vitest';
import { validatePilotRedirect,validatePilotState,PILOT_CONSENT,PILOT_VERSION } from './live-payment-pilot';

const invoice='200000000000000001';
const url=encodeURIComponent('https://app.legche.online/payment-check');
const redirect={invoice,status:'pending' as const,action:'https://auth.robokassa.ru/Merchant/Index.aspx',fields:{
  MerchantLogin:'legcheonline',OutSum:'100.00',InvId:invoice,Description:'Доступ',Receipt:'%7B%7D',Email:'qa@example.com',Culture:'ru',
  SuccessUrl2:url,SuccessUrl2Method:'GET',FailUrl2:url,FailUrl2Method:'GET',Shp_env:'live',Shp_order:'a'.repeat(48),SignatureValue:'b'.repeat(64),
}};
const state={available:true,amount:10000,recurring:false as const,emailVerified:true,consentVersion:PILOT_VERSION,consentText:PILOT_CONSENT,
  offer:{url:'https://legche.online/oferta',version:'v1',sha256:'c'.repeat(64)},order:null};
describe('live pilot browser guard',()=>{
  it('permits exactly the fixed one-off form and immutable pending invoice',()=>{
    expect(validatePilotRedirect(redirect,invoice)).toEqual(redirect);
    expect(()=>validatePilotRedirect(redirect,'200000000000000002')).toThrow();
    expect(()=>validatePilotRedirect({...redirect,action:'https://evil.example'})).toThrow();
    for(const fields of [{OutSum:'990.00'},{IsTest:'1'},{Recurring:'true'},{Token:'x'},{Shp_env:'test'},
      {SuccessUrl2:'https://evil.example'},{FailUrl2Method:'POST'}]) {
      expect(()=>validatePilotRedirect({...redirect,fields:{...redirect.fields,...fields}})).toThrow();
    }
  });
  it('rejects wrong price and false paid states from API',()=>{
    expect(validatePilotState(state)).toEqual(state);
    expect(()=>validatePilotState({...state,amount:99000})).toThrow();
    expect(()=>validatePilotState({...state,order:{invoice,status:'paid',amount:10000,accessUntil:null}})).toThrow();
    expect(()=>validatePilotState({...state,order:{invoice:'100000000000000001',status:'pending',amount:10000,accessUntil:null}})).toThrow();
  });
});

import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { pilotConfig,pilotForm,verifyPilotResult } from './live-pilot-provider.js';
import { receiptFor } from './rules.js';
import { config as testConfig } from './provider.js';

const user='11111111-1111-4111-8111-111111111111';
const config={user,merchant:'legcheonline',password1:'synthetic-live-one',password2:'synthetic-live-two',algorithm:'sha256',enabled:true};
const order={invoice:'200000000000000001',user_id:user,environment:'live',merchant_login:'legcheonline',amount:10000,
  plan:'month',nonce:'a'.repeat(48),email:'qa@example.com',receipt:receiptFor('month',10000),status:'pending'};
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
const signed=(overrides={})=>{
  const b={OutSum:'100.000000',InvId:order.invoice,Shp_env:'live',Shp_order:order.nonce,...overrides};
  b.SignatureValue=hash(`${b.OutSum}:${b.InvId}:${config.password2}:Shp_env=${b.Shp_env}:Shp_order=${b.Shp_order}`);
  return b;
};
test('fixed live form with signed return addresses and no recurrence or test flags',()=>{
  const {fields:f}=pilotForm(order,config);
  assert.equal(f.OutSum,'100.00');assert.equal(f.IsTest,undefined);assert.equal(f.Recurring,undefined);assert.equal(f.Token,undefined);
  assert.equal(decodeURIComponent(f.SuccessUrl2),'https://app.legche.online/payment-check');
  assert.equal(f.FailUrl2,f.SuccessUrl2);
  const signature=hash(['legcheonline','100.00',order.invoice,f.Receipt,f.SuccessUrl2,'GET',f.FailUrl2,'GET',config.password1,
    'Shp_env=live','Shp_order='+order.nonce].join(':'));
  assert.equal(f.SignatureValue,signature);
  for(const altered of [{amount:1},{environment:'test'},{user_id:'other'},{status:'paid'},
    {receipt:{items:[{...order.receipt.items[0],sum:1}]}}]) assert.throws(()=>pilotForm({...order,...altered},config));
  assert.throws(()=>pilotForm(order,{...config,enabled:false}));
});
test('callback accepts live evidence and six decimals, including uppercase digest',()=>{
  const b=signed();assert.equal(verifyPilotResult(b,order,config),true);
  b.SignatureValue=b.SignatureValue.toUpperCase();assert.equal(verifyPilotResult(b,order,config),true);
  assert.equal(verifyPilotResult(b,order,{...config,enabled:false,user:null}),true);
});
test('callback rejects wrong amount, signature, order binding, test evidence and duplicate fields',()=>{
  for(const b of [signed({OutSum:'99.00'}),signed({OutSum:'100.000001'}),signed({Shp_env:'test'}),signed({InvId:'200000000000000002'}),
    signed({Shp_order:'b'.repeat(48)}),{...signed(),IsTest:'1'},{...signed(),SignatureValue:'0'.repeat(64)},
    {...signed(),OutSum:['100.00','100.00']},{...signed(),Shp_extra:'x'},{...signed(),shp_env:'live'},
    {...signed(),SignatureValue:hash(`100.000000:${order.invoice}:${config.password1}:Shp_env=live:Shp_order=${order.nonce}`)}]) {
    assert.equal(verifyPilotResult(b,order,config),false);
  }
  assert.equal(verifyPilotResult(signed(),{...order,environment:'test'},config),false);
});
test('live/test boundaries, allowlist and explicit switches fail closed',()=>{
  const before={...process.env};
  const env={APP_URL:'https://app.legche.online/',PAYMENTS_MODE:'live',PAYMENTS_ENABLED:'true',PAYMENTS_RECURRING_ENABLED:'false',
    PAYMENTS_LIVE_PILOT_ENABLED:'true',PAYMENTS_LIVE_PILOT_USER_ID:user,ROBOKASSA_MERCHANT_LOGIN:'legcheonline',
    ROBOKASSA_PASSWORD1:config.password1,ROBOKASSA_PASSWORD2:config.password2,ROBOKASSA_HASH:'SHA256'};
  try{
    Object.assign(process.env,env);
    assert.equal(pilotConfig().enabled,true);assert.throws(()=>testConfig());
    for(const [key,value] of [['PAYMENTS_ENABLED','false'],['PAYMENTS_LIVE_PILOT_ENABLED','false'],['PAYMENTS_RECURRING_ENABLED','true'],['PAYMENTS_LIVE_PILOT_USER_ID','']]) {
      process.env[key]=value;assert.equal(pilotConfig().enabled,false);process.env[key]=env[key];
    }
    for(const [key,value] of [['APP_URL','https://test.legche.online'],['APP_URL','https://evil.example'],['PAYMENTS_MODE','test'],
      ['ROBOKASSA_PASSWORD1',''],['ROBOKASSA_PASSWORD2',config.password1],['ROBOKASSA_HASH','MD5'],['ROBOKASSA_MERCHANT_LOGIN','other']]) {
      process.env[key]=value;assert.throws(()=>pilotConfig());process.env[key]=env[key];
    }
    process.env.ROBOKASSA_TEST_PASSWORD2=config.password2;assert.throws(()=>pilotConfig());
  }finally{
    for(const key of Object.keys(process.env))if(!(key in before))delete process.env[key];Object.assign(process.env,before);
  }
});

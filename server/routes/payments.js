import express, { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { available } from '../payments/provider.js';
import { PaymentError, state, checkout, result } from '../payments/core.js';

const r=Router();
r.use((_req,res,next)=>{res.set('Cache-Control','no-store');next();});
r.get('/availability',(_req,res)=>res.json({available:available(),testOnly:true}));
// No user auth/access gate: this is a signed machine notification.
r.post('/robokassa/result',express.urlencoded({extended:false,limit:'16kb',parameterLimit:20}),async(req,res)=>{
  try {res.type('text/plain').send(await result(req.body));}
  catch(e){
    if(e instanceof PaymentError)return res.status(e.status).type('text/plain').send(e.message);
    console.error('[payments] callback_failed');res.status(503).type('text/plain').send('retry');
  }
});
r.use(requireAuth);
const handle=run=>async(req,res)=>{
  try{res.json(await run(req));}
  catch(e){if(e instanceof PaymentError)return res.status(e.status).json({error:e.message});
    console.error('[payments] request_failed');res.status(503).json({error:'payments_unavailable'});}
};
r.get('/',handle(req=>state(req.userId)));
r.post('/checkout',handle(req=>checkout(req.userId,req.body)));
// No success redirect or browser endpoint grants access.
export default r;

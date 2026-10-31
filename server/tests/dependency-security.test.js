// B5 regression checks. All traffic stays on loopback; no real accounts or mail.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { gzipSync } from 'node:zlib';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { configureTrustedProxy } from '../resource-limits.js';
const require = createRequire(import.meta.url);
const app = express();
app.use(express.json({ limit: '2mb' }));
app.post('/json', (req,res) => res.json(req.body));
app.get('/healthz', (_req,res) => res.json({ok:true}));
app.get('/query', (req,res) => res.json(req.query));
app.get('/ip', (req,res) => res.json({ip:req.ip}));
app.use((err,_req,res,_next) => res.status(err.status || 500).json({error:err.type}));
let server, base;
before(async()=>{
 server=app.listen(0,'127.0.0.1'); await new Promise(r=>server.once('listening',r));
 base=`http://127.0.0.1:${server.address().port}`;
});
after(async()=>{ await new Promise(r=>server.close(r)); });
const send=body=>fetch(base+'/json',{method:'POST',headers:{'Content-Type':'application/json'},body});
test('B5: installed dependency versions match the checked lockfile',async()=>{
 const lock=JSON.parse(await readFile(new URL('../package-lock.json',import.meta.url)));
 for(const name of ['express','body-parser','proxy-addr','qs','nodemailer']){
  assert.equal(require(name+'/package.json').version,lock.packages['node_modules/'+name].version);
 }
});
test('B5: ordinary JSON is accepted; malformed JSON and oversized payloads are rejected',async()=>{
 const ok=await send(JSON.stringify({email:'qa+alias@example.invalid',value:'Русский текст'}));
 assert.equal(ok.status,200); assert.equal((await ok.json()).value,'Русский текст');
 assert.equal((await send('{')).status,400);
 assert.equal((await send(JSON.stringify({data:'x'.repeat(2*1024*1024)}))).status,413);
 assert.equal((await fetch(base+'/healthz')).status,200);
});
test('B5: valid gzip remains supported; trailing compressed-body bytes do not crash the process',async()=>{
 const encoded=gzipSync(Buffer.from('{"ok":true}'));
 const post=body=>fetch(base+'/json',{method:'POST',headers:{'Content-Type':'application/json','Content-Encoding':'gzip'},body});
 const valid=await post(encoded);assert.equal(valid.status,200);assert.deepEqual(await valid.json(),{ok:true});
 const malformed=await post(Buffer.concat([encoded,Buffer.from('invalid gzip trailer')]));
 assert.ok([200,400].includes(malformed.status)); await malformed.text();
 // Allow the decoder's asynchronous error to fire before checking liveness.
 await new Promise(r=>setTimeout(r,30));
 assert.equal((await fetch(base+'/healthz')).status,200);
});
test('B5: nested query parsing does not pollute object prototypes',async()=>{
 const response=await fetch(base+'/query?name=ok&a[b]=c&__proto__[polluted]=yes&constructor[prototype][polluted]=yes');
 assert.equal(response.status,200); const body=await response.json();
 assert.equal(body.name,'ok');assert.equal(body.a.b,'c');assert.equal({}.polluted,undefined);
});
test('B5: forwarded IP is ignored without trust and accepted only through the configured proxy',async()=>{
 configureTrustedProxy(app,'');
 let r=await fetch(base+'/ip',{headers:{'X-Forwarded-For':'198.51.100.10'}});
 assert.equal((await r.json()).ip,'127.0.0.1');
 configureTrustedProxy(app,'127.0.0.1/32');
 r=await fetch(base+'/ip',{headers:{'X-Forwarded-For':'198.51.100.10'}});
 assert.equal((await r.json()).ip,'198.51.100.10');
 configureTrustedProxy(app,'172.19.0.1/32');
 r=await fetch(base+'/ip',{headers:{'X-Forwarded-For':'198.51.100.10'}});
 assert.equal((await r.json()).ip,'127.0.0.1');
});
test('B5: quoted recipient comments cannot redirect the mail envelope',async()=>{
 const nodemailer=require('nodemailer');
 const transport=nodemailer.createTransport({jsonTransport:true});
 const info=await transport.sendMail({from:'support@example.invalid',to:'G: (a; <evil@example.invalid>) <victim@example.invalid>;',subject:'synthetic test',text:'test'});
 assert.deepEqual(info.envelope.to,['victim@example.invalid']);
});
test('B5: actual API entrypoint boots on the selected Node runtime and answers health/auth',async()=>{
 const {createServer}=await import('node:net');const {spawn}=await import('node:child_process');
 const probe=createServer();probe.listen(0,'127.0.0.1');await new Promise(r=>probe.once('listening',r));
 const port=probe.address().port;await new Promise(r=>probe.close(r));
 const child=spawn(process.execPath,['index.js'],{cwd:new URL('../',import.meta.url),env:{PATH:process.env.PATH,PORT:String(port),JWT_SECRET:'synthetic-boot-secret',DATABASE_URL:'',EMAIL_DRIP_ENABLED:'false',PAYMENTS_ENABLED:'false',PAYMENTS_RECURRING_ENABLED:'false',PAYMENTS_STATUS_CHECK_ENABLED:'false'},stdio:['ignore','pipe','pipe']});
 let output='';child.stderr.on('data',b=>{output+=b;});
 try{
  await new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>reject(new Error('API boot timeout: '+output)),5000);
   child.once('error',e=>{clearTimeout(timer);reject(e);});
   child.once('exit',code=>{clearTimeout(timer);reject(new Error(`API exited ${code}: ${output}`));});
   child.stdout.on('data',b=>{output+=b;if(output.includes('listening on')){clearTimeout(timer);resolve();}});
  });
  const health=await fetch(`http://127.0.0.1:${port}/healthz`);assert.equal(health.status,200);assert.deepEqual(await health.json(),{ok:true});
  assert.equal((await fetch(`http://127.0.0.1:${port}/api/v1/auth/me`)).status,401);
 }finally{
  if(child.exitCode===null){const stopped=new Promise(r=>child.once('exit',r));child.kill('SIGTERM');await stopped;}
 }
});

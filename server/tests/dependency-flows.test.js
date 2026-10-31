// B5: real auth/payment routes + PGlite + actual Nodemailer against loopback SMTP.
// Install PGlite separately and set B3_PGLITE_ROOT (same convention as B3 tests).
import { test,before,after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { createHash } from 'node:crypto';
import { readFile,readdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import express from 'express';
const root=process.env.B3_PGLITE_ROOT;
const {PGlite}=await import(root?pathToFileURL(`${root}/dist/index.js`).href:'@electric-sql/pglite');
const {pgcrypto}=await import(root?pathToFileURL(`${root}/dist/contrib/pgcrypto.js`).href:'@electric-sql/pglite/contrib/pgcrypto');
const mails=[];const sockets=new Set();
const smtp=createServer(socket=>{
 sockets.add(socket);socket.on('close',()=>sockets.delete(socket));
 socket.setEncoding('utf8');socket.write('220 localhost ESMTP test\r\n');
 let buffer='',dataMode=false,lines=[],recipients=[];
 socket.on('data',chunk=>{
  buffer+=chunk;let end;
  while((end=buffer.indexOf('\r\n'))>=0){
   const line=buffer.slice(0,end);buffer=buffer.slice(end+2);
   if(dataMode){
    if(line==='.') { mails.push({recipients:[...recipients],raw:lines.join('\r\n')});dataMode=false;socket.write('250 queued\r\n'); }
    else lines.push(line.replace(/^\.\./,'.'));
   } else if(/^EHLO|^HELO/.test(line))socket.write('250-localhost\r\n250 AUTH PLAIN\r\n');
   else if(/^AUTH PLAIN/.test(line))socket.write('235 authenticated\r\n');
   else if(/^MAIL FROM:/.test(line)){recipients=[];socket.write('250 sender ok\r\n');}
   else if(/^RCPT TO:/.test(line)){recipients.push(line.slice(8).trim().replace(/^<|>$/g,''));socket.write('250 recipient ok\r\n');}
   else if(line==='DATA'){dataMode=true;lines=[];socket.write('354 send data\r\n');}
   else if(line==='QUIT'){socket.end('221 bye\r\n');}
   else socket.write('250 ok\r\n');
  }
 });
});
smtp.listen(0,'127.0.0.1');await new Promise(r=>smtp.once('listening',r));
Object.assign(process.env,{
 JWT_SECRET:'synthetic-b5-test-secret',DATABASE_URL:'',APP_URL:'https://test.legche.online',
 SMTP_HOST:'127.0.0.1',SMTP_PORT:String(smtp.address().port),SMTP_SUPPORT_USER:'support@example.invalid',
 SMTP_SUPPORT_PASS:'synthetic',SMTP_INGA_USER:'inga@example.invalid',SMTP_INGA_PASS:'synthetic',
 PAYMENTS_ENABLED:'true',PAYMENTS_MODE:'test',PAYMENTS_RECURRING_ENABLED:'false',
 ROBOKASSA_MERCHANT_LOGIN:'synthetic-merchant',ROBOKASSA_TEST_PASSWORD1:'synthetic-one',
 ROBOKASSA_TEST_PASSWORD2:'synthetic-two',ROBOKASSA_TEST_HASH:'sha256',
});
const {pool}=await import('../db.js');const pg=new PGlite({extensions:{pgcrypto}});
let queue=Promise.resolve();
async function acquire(){const prev=queue;let release;queue=new Promise(r=>release=r);await prev;return release;}
async function query(sql,values){const r=await pg.query(sql,values);return {...r,rowCount:r.rows.length||r.affectedRows||0};}
pool.connect=async()=>{const release=await acquire();return {query,release};};
pool.query=async(sql,values)=>{const release=await acquire();try{return await query(sql,values);}finally{release();}};
const {registerAuthRoutes}=await import('../auth.js');
const {default:payments}=await import('../routes/payments.js');
const app=express();app.use(express.json({limit:'2mb'}));registerAuthRoutes(app);app.use('/payments',payments);
let server,base,account,access,refresh;
const email='qa+alias@example.invalid';const password='synthetic-password-123';
async function request(path,body,token){
 const response=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
 return {status:response.status,body:await response.json()};
}
async function until(check){for(let i=0;i<150;i++){if(check())return;await new Promise(r=>setTimeout(r,20));}assert.fail('expected local mail was not received');}
function decoded(mail){return mail.raw.replace(/=\r\n/g,'').replace(/=3D/g,'=');}
before(async()=>{
 const dir=new URL('../migrations/',import.meta.url);
 for(const file of (await readdir(dir)).filter(x=>x.endsWith('.sql')).sort())await pg.exec(await readFile(new URL(file,dir),'utf8'));
 server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));base=`http://127.0.0.1:${server.address().port}`;
});
after(async()=>{
 if(server)await new Promise(r=>server.close(r));
 // Drain background signup mail bookkeeping before closing the local database.
 await new Promise(r=>setTimeout(r,100));await queue;
 for(const socket of sockets)socket.destroy();await new Promise(r=>smtp.close(r));await pg.close();await pool.end();
});
test('B5: registration, SMTP verification and welcome mail keep the intended recipient',async()=>{
 const result=await request('/api/v1/auth/signup',{email,password,termsConsent:true,pdConsent:true,marketingConsent:false,registrationConsentVersion:'registration-2026-10-11-v1'});
 assert.equal(result.status,201);account=result.body.user.id||result.body.user.user_id;access=result.body.access_token;refresh=result.body.refresh_token;
 assert.ok(account&&access&&refresh);
 await until(()=>mails.length>=2);
 for(const mail of mails){assert.deepEqual(mail.recipients,[email]);assert.match(mail.raw,/MIME-Version: 1\.0/);}
 const verify=mails.find(m=>decoded(m).includes('/verify-email?'));assert.ok(verify);
 const token=decoded(verify).match(/\/verify-email\?token=([A-Za-z0-9_-]+)/)?.[1];assert.ok(token);
 const response=await request('/api/v1/auth/verify-email',{token});assert.equal(response.status,200);
 assert.equal((await pool.query('SELECT email_verified FROM app_credentials WHERE user_id=$1',[account])).rows[0].email_verified,true);
});
test('B5: login, authenticated profile, refresh and wrong-password rejection',async()=>{
 let r=await request('/api/v1/auth/login',{email,password});assert.equal(r.status,200);access=r.body.access_token;refresh=r.body.refresh_token;
 r=await request('/api/v1/auth/me',undefined,access);assert.equal(r.status,200);assert.equal(r.body.user.email,email);
 r=await request('/api/v1/auth/refresh',{refresh_token:refresh});assert.equal(r.status,200);access=r.body.access_token;refresh=r.body.refresh_token;
 assert.equal((await request('/api/v1/auth/login',{email,password:'incorrect'})).status,401);
});
test('B5: password-reset email, single-use link, old-session revocation and new login',async()=>{
 const oldAccess=access;const n=mails.length;
 assert.equal((await request('/api/v1/auth/forgot-password',{email})).status,200);
 await until(()=>mails.length>n);
 const mail=mails.find(m=>decoded(m).includes('/reset-password?'));assert.ok(mail);assert.deepEqual(mail.recipients,[email]);
 const token=decoded(mail).match(/token=([A-Za-z0-9_-]+)/)?.[1];assert.ok(token);
 const newPassword='synthetic-new-password-123';
 assert.equal((await request('/api/v1/auth/reset-password',{token,new_password:newPassword})).status,200);
 assert.equal((await request('/api/v1/auth/me',undefined,oldAccess)).status,401);
 assert.equal((await request('/api/v1/auth/reset-password',{token,new_password:newPassword})).status,400);
 assert.equal((await request('/api/v1/auth/login',{email,password})).status,401);
 const r=await request('/api/v1/auth/login',{email,password:newPassword});assert.equal(r.status,200);access=r.body.access_token;
});
test('B5: URL-encoded payment callback rejects tampering and duplicate fields, settles once',async()=>{
 const invoice='100000000000000001',nonce='a'.repeat(48);
 await pool.query(`INSERT INTO payment_orders(invoice,user_id,merchant_login,nonce,quote_digest,plan,amount,special,email,receipt,consent_snapshot) VALUES($1,$2,$3,$4,$5,'month',149000,false,$6,'{}','{}')`,[invoice,account,'synthetic-merchant',nonce,'b5-test-quote',email]);
 const body={OutSum:'1490.00',InvId:invoice,Shp_env:'test',Shp_order:nonce};
 body.SignatureValue=createHash('sha256').update(`${body.OutSum}:${invoice}:synthetic-two:Shp_env=test:Shp_order=${nonce}`).digest('hex');
 const callback=data=>fetch(base+'/payments/robokassa/result',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:data});
 assert.equal((await callback(new URLSearchParams({...body,SignatureValue:'0'.repeat(64)}))).status,400);
 const duplicate=new URLSearchParams(body);duplicate.append('OutSum','1490.00');assert.equal((await callback(duplicate)).status,400);
 let r=await callback(new URLSearchParams(body));assert.equal(r.status,200);assert.equal(await r.text(),'OK'+invoice);
 const end=(await pool.query('SELECT paid_until FROM subscriptions WHERE user_id=$1',[account])).rows[0].paid_until;
 r=await callback(new URLSearchParams(body));assert.equal(r.status,200);assert.equal(await r.text(),'OK'+invoice);
 assert.deepEqual((await pool.query('SELECT paid_until FROM subscriptions WHERE user_id=$1',[account])).rows[0].paid_until,end);
 assert.equal(Number((await pool.query("SELECT count(*) n FROM payment_events WHERE invoice=$1 AND type='paid'",[invoice])).rows[0].n),1);
});

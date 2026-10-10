const {test,after}=require('node:test');
const assert=require('node:assert/strict');
const express=require('express');
const {requestProtection}=require('../middleware/requestProtection');
const {createLoginLimiter}=require('../middleware/loginLimiter');
const {runtimeConfig}=require('../config/runtime');
const servers=[];
after(async()=>{for(const s of servers)await new Promise(resolve=>s.close(resolve));});
async function start(app){const s=app.listen(0,'127.0.0.1');servers.push(s);await new Promise(resolve=>s.on('listening',resolve));return 'http://127.0.0.1:'+s.address().port;}
test('unsafe API requests reject forged origins, cross-site metadata and simple form bodies',async()=>{
 const app=express();let writes=0;
 app.use(requestProtection({publicOrigin:'https://smartintern.example.test'}));
 app.use(express.json());app.post('/write',(_req,res)=>{writes++;res.json({ok:true});});
 app.get('/read',(_req,res)=>res.json({ok:true}));
 const base=await start(app);
 for(const headers of [{origin:'https://evil.example.test'},{origin:'null'},{referer:'https://evil.example.test/form'},{'sec-fetch-site':'cross-site'},{'sec-fetch-site':'same-site'},{origin:'https://smartintern.example.test.attacker.test'}]) {
  const r=await fetch(base+'/write',{method:'POST',headers:{'content-type':'application/json',...headers},body:'{}'});assert.equal(r.status,403);
 }
 for(const contentType of ['text/plain','application/x-www-form-urlencoded','multipart/form-data']) {
  assert.equal((await fetch(base+'/write',{method:'POST',headers:{origin:'https://smartintern.example.test','content-type':contentType},body:'x=y'})).status,415);
 }
 assert.equal(writes,0);
 for(const headers of [{origin:'https://smartintern.example.test','sec-fetch-site':'same-origin'},{referer:'https://smartintern.example.test/page'},{}]) {
  assert.equal((await fetch(base+'/write',{method:'POST',headers:{'content-type':'application/json',...headers},body:'{}'})).status,200);
 }
 assert.equal((await fetch(base+'/write',{method:'POST',headers:{origin:'https://smartintern.example.test','sec-fetch-site':'same-origin'}})).status,200);
 assert.equal((await fetch(base+'/read',{headers:{origin:'https://evil.example.test'}})).status,200);
 assert.equal(writes,4);
});
test('login limiter blocks repeated failures, returns Retry-After and resets after window',async()=>{
 const app=express();let attempts=0;
 app.post('/login',createLoginLimiter({production:false},{},{limit:2,windowMs:200}),(_req,res)=>{attempts++;res.status(401).json({error:'Invalid credentials'});});
 const base=await start(app);const send=()=>fetch(base+'/login',{method:'POST'});
 assert.equal((await send()).status,401);assert.equal((await send()).status,401);
 const blocked=await send();assert.equal(blocked.status,429);assert.ok(blocked.headers.get('retry-after'));assert.equal(attempts,2);
 await new Promise(resolve=>setTimeout(resolve,250));assert.equal((await send()).status,401);
});
test('successful logins do not consume failed-login quota',async()=>{
 const app=express();app.post('/login',createLoginLimiter({production:false},{},{limit:1}),(_req,res)=>res.json({ok:true}));const base=await start(app);
 for(let i=0;i<3;i++)assert.equal((await fetch(base+'/login',{method:'POST'})).status,200);
});
test('production origin validation requires exact HTTPS origin',()=>{
 const env={NODE_ENV:'production',DB_HOST:'db',DB_USER:'app',DB_PASSWORD:'test',DB_NAME:'db',REDIS_URL:'redis://localhost',SESSION_SECRET:'x'.repeat(40)};
 for(const value of [undefined,'http://example.test','https://example.test/path','https://example.test/','https://user:password@example.test'])assert.throws(()=>runtimeConfig({...env,PUBLIC_ORIGIN:value}));
 assert.equal(runtimeConfig({...env,PUBLIC_ORIGIN:'https://example.test'}).publicOrigin,'https://example.test');
 assert.throws(()=>createLoginLimiter({production:true},{ready:Promise.resolve()}));
});

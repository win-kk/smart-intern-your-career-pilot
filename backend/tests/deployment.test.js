const {test,after}=require('node:test');
const assert=require('node:assert/strict');
const {runtimeConfig}=require('../config/runtime');
const {createSessionRuntime}=require('../config/session');
const {logError}=require('../utils/logger');
const session=require('express-session');
const bcrypt=require('bcryptjs');
const productionEnv={NODE_ENV:'production',DB_HOST:'database',DB_USER:'app',DB_PASSWORD:'test-only-password',DB_NAME:'smartintern_db',SESSION_SECRET:'a'.repeat(48),REDIS_URL:'rediss://redis.example.test:6379',TRUST_PROXY_HOPS:'1',PUBLIC_ORIGIN:'https://smartintern.example.test'};
test('production configuration rejects missing/placeholder secrets and invalid ports/proxies',()=>{
 for(const name of ['DB_HOST','DB_USER','DB_PASSWORD','DB_NAME','SESSION_SECRET','REDIS_URL']) {
  assert.throws(()=>runtimeConfig({...productionEnv,[name]:''}));
 }
 assert.throws(()=>runtimeConfig({...productionEnv,SESSION_SECRET:'short'}));
 assert.throws(()=>runtimeConfig({...productionEnv,DB_PASSWORD:'replace_with_password'}));
 assert.throws(()=>runtimeConfig({...productionEnv,REDIS_URL:'https://redis.example.test'}));
 for(const invalid of [{PORT:'0'},{PORT:'abc'},{DB_PORT:'70000'},{TRUST_PROXY_HOPS:'true'}]) assert.throws(()=>runtimeConfig({...productionEnv,...invalid}));
 assert.equal(runtimeConfig({}).production,false);
});
test('Redis store configuration awaits connection and has no production MemoryStore fallback',async()=>{
 let settings,storeSettings,connected=false,closed=false;
 const client={isOpen:true,on(){},async connect(){connected=true},async quit(){closed=true}};
 class Store {constructor(options){storeSettings=options}}
 const runtime=createSessionRuntime(runtimeConfig(productionEnv),{createClient(options){settings=options;return client},RedisStore:Store});
 await runtime.ready;assert.equal(connected,true);
 assert.equal(settings.disableOfflineQueue,true);assert.equal(storeSettings.prefix,'smartintern:sessions:');
 assert.equal(runtime.options.cookie.secure,true);assert.equal(runtime.options.cookie.httpOnly,true);
 await runtime.close();assert.equal(closed,true);
 const fail=createSessionRuntime(runtimeConfig(productionEnv),{createClient:()=>({...client,connect:()=>Promise.reject(new Error('secret redis URL'))}),RedisStore:Store});
 await assert.rejects(fail.ready);
});
const dbPath=require.resolve('../models/database');
require.cache[dbPath]={id:dbPath,filename:dbPath,loaded:true,exports:{query:async sql=>{
 if(sql.includes('password_hash'))return [[{user_id:1,email:'test@example.test',role:'Student',password_hash:bcrypt.hashSync('password',4)}]];
 if(sql.includes('AS profile_id'))return [[{profile_id:11}]];
 throw new Error('DB_PASSWORD=private; SQL and session cookie');
}}};
const {createApp}=require('../app');
const servers=[];
after(async()=>{for(const server of servers)await new Promise(resolve=>server.close(resolve));});
test('secure cookies only issued over trusted HTTPS; local sessions persist and logout invalidates',async()=>{
 for(const production of [true,false]) {
  const config=production?runtimeConfig(productionEnv):runtimeConfig({SESSION_SECRET:'local-test-secret'});
  // Isolated store tests HTTPS policy. Real Redis adapter wiring is tested separately above.
  const runtime={options:{secret:config.secret,resave:false,saveUninitialized:false,store:new session.MemoryStore(),cookie:{secure:production,httpOnly:true,sameSite:'lax',maxAge:3600000}},ready:Promise.resolve(),close:async()=>{}};
  const app=createApp(config,runtime,{loginLimiter:(_req,_res,next)=>next()}),server=app.listen(0,'127.0.0.1');servers.push(server);
  await new Promise(resolve=>server.on('listening',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;
  const login=async https=>fetch(base+'/api/auth/login',{method:'POST',headers:{'content-type':'application/json',...(https?{'x-forwarded-proto':'https'}:{})},body:JSON.stringify({email:'test@example.test',role:'Student',password:'password'})});
  const http=await login(false);assert.equal(http.status,200);
  assert.equal(Boolean(http.headers.get('set-cookie')),!production);
  const response=await login(production);
  const cookie=response.headers.get('set-cookie');assert.ok(cookie);
  assert.match(cookie,/HttpOnly/);assert.match(cookie,/SameSite=Lax/);
  if(production)assert.match(cookie,/; Secure/);
  const headers={cookie:cookie.split(';')[0],...(production?{'x-forwarded-proto':'https'}:{})};
  assert.equal((await fetch(base+'/api/auth/me',{headers})).status,200);
  assert.equal((await fetch(base+'/api/auth/logout',{method:'POST',headers})).status,200);
  assert.equal((await fetch(base+'/api/auth/me',{headers})).status,401);
 }
});
test('error logs omit exception messages and request secrets',()=>{
 const original=console.error,logs=[];console.error=value=>logs.push(value);
 try {logError('test',Object.assign(new Error('password=secret'),{code:'ER_ACCESS_DENIED_ERROR'}),{requestId:'id',method:'POST',route:'/api/auth/login',status:500,body:'secret',cookie:'secret'});}finally{console.error=original}
 assert.equal(logs.length,1);assert.ok(!logs[0].includes('secret'));
 assert.equal(JSON.parse(logs[0]).code,'ER_ACCESS_DENIED_ERROR');
});

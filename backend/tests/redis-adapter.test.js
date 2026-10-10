const {test}=require('node:test');
const assert=require('node:assert/strict');
const {RedisStore}=require('connect-redis');
test('installed RedisStore adapter saves, reloads, expires and destroys sessions through client API',async()=>{
 const data=new Map();let ttl;
 const client={
  async get(key){return data.get(key)||null},
  async set(key,value,options){data.set(key,value);ttl=options?.expiration?.value||options?.EX},
  async expire(_key,value){ttl=value},
  async del(keys){for(const key of Array.isArray(keys)?keys:[keys])data.delete(key)}
 };
 const store=new RedisStore({client,prefix:'smartintern:sessions:'});
 const invoke=(method,...args)=>new Promise((resolve,reject)=>store[method](...args,(error,result)=>error?reject(error):resolve(result)));
 const value={user:{userId:1,profileId:11,role:'Student'},cookie:{expires:new Date(Date.now()+3600000),maxAge:3600000}};
 await invoke('set','demo',value);assert.ok(data.has('smartintern:sessions:demo'));assert.ok(ttl>0&&ttl<=3600);
 assert.deepEqual((await invoke('get','demo')).user,value.user);
 await invoke('touch','demo',value);assert.ok(ttl>0);
 await invoke('destroy','demo');assert.equal(await invoke('get','demo'),null);
});

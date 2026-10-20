const {test}=require('node:test');
const assert=require('node:assert/strict');
const {Readable}=require('node:stream');
const {randomUUID,createHmac}=require('node:crypto');
const {PGlite}=require('@electric-sql/pglite');
const vm=require('node:vm');
const fs=require('node:fs');
const {createVisitAlerts}=require('../visit-alerts');
const origin='https://aditya-kadam-resume.onrender.com';

async function request(alerts,{sessionId=randomUUID(),originValue=origin,method='POST',ua='Mozilla/5.0',body}={}){
 const req=Readable.from([Buffer.from(body??JSON.stringify({sessionId,to:'attacker@example.com'}))]);
 req.method=method;req.headers={origin:originValue,'user-agent':ua};
 const res={writeHead(code){this.status=code;},end(){}};
 await alerts.handle(req,res);return res.status;
}
test('disabled configuration and untrusted requests never access database or provider',async()=>{
 const pool={query(){throw new Error('Must not access DB');}};
 const alerts=createVisitAlerts(pool,{env:{},fetchImpl(){throw new Error('Must not send');}});
 assert.equal(await request(alerts),204);
 assert.equal(await request(alerts,{originValue:'https://other.example'}),403);
 assert.equal(await request(alerts,{method:'OPTIONS'}),204);
 assert.equal(await request(alerts,{method:'GET'}),405);
});
test('browser alerts suppress refreshes and hidden tabs without affecting page rendering',async()=>{
 const script=fs.readFileSync(require.resolve('../visit-alerts-client.js'),'utf8');
 let value=null,sends=0,listener;
 const context={location:{origin},document:{visibilityState:'visible',addEventListener(type,fn){listener=fn;},removeEventListener(){}},
   localStorage:{getItem(){return value;},setItem(key,v){value=v;}},crypto:{randomUUID},Date,
   fetch:async()=>{sends++;return {ok:true};}};
 vm.runInNewContext(script,context);await Promise.resolve();assert.equal(sends,1);
 vm.runInNewContext(script,context);await Promise.resolve();assert.equal(sends,1);
 value=JSON.stringify({created:Date.now()-31*60*1000});
 context.document.visibilityState='hidden';vm.runInNewContext(script,context);assert.equal(sends,1);
 context.document.visibilityState='visible';listener();await Promise.resolve();assert.equal(sends,2);
 context.localStorage.getItem=()=>{throw new Error('Blocked storage');};
 assert.doesNotThrow(()=>vm.runInNewContext(script,context));assert.equal(sends,2);
});
test('real PostgreSQL reservations deduplicate across handler instances, cap sends and fix recipient',async t=>{
 const db=new PGlite();t.after(()=>db.close());
 const pool={async query(sql,params){
   if(sql.includes('CREATE TABLE')){await db.exec(sql);return {};}
   const result=await db.query(sql,params);return {...result,rowCount:result.rows.length};
 },async connect(){return {...this,release(){}};}};
 const env={VISIT_ALERTS_ENABLED:'true',VISIT_ALERT_SCRIPT_URL:'https://script.google.com/macros/s/test-deployment/exec',VISIT_ALERT_SECRET:'a'.repeat(64)};
 let sends=0,fail=false;
 const fetchImpl=async(url,options)=>{
   sends++;assert.equal(url,env.VISIT_ALERT_SCRIPT_URL);
   const body=JSON.parse(options.body),payload=JSON.parse(body.payload);
   assert.deepEqual(Object.keys(payload),['eventId','timestamp']);
   assert.match(payload.eventId,/^[a-f0-9]{64}$/);
   assert.equal(body.signature,createHmac('sha256',env.VISIT_ALERT_SECRET).update(body.payload).digest('hex'));
   assert.ok(!options.body.includes(env.VISIT_ALERT_SECRET));
   return {ok:true,json:async()=>({ok:!fail})};
 };
 const opts={env,fetchImpl,now:()=>new Date('2026-10-20T07:00:00Z')};
 const alerts=createVisitAlerts(pool,opts),id=randomUUID();
 assert.equal(await request(alerts,{sessionId:'bad'}),400);
 assert.equal(await request(alerts,{body:'a'.repeat(1025)}),413);
 assert.equal(await request(alerts,{ua:'Googlebot'}),204);assert.equal(sends,0);
 assert.equal(await request(alerts,{sessionId:id}),204);assert.equal(sends,1);
 const restarted=createVisitAlerts(pool,opts);
 assert.equal(await request(restarted,{sessionId:id}),204);assert.equal(sends,1);
 fail=true;
 const failedId=randomUUID();
 assert.equal(await request(alerts,{sessionId:failedId}),503);
 assert.equal(await request(alerts,{sessionId:failedId}),204);assert.equal(sends,2);
 fail=false;
 for(let i=0;i<22;i++)await request(alerts);
 assert.equal(sends,20);
 const hashes=await db.query('SELECT session_hash FROM resume_visit_alerts');
 assert.equal(hashes.rows.length,20);assert.ok(hashes.rows.every(r=>/^[a-f0-9]{64}$/.test(r.session_hash)));
 const nextHour=createVisitAlerts(pool,{...opts,now:()=>new Date('2026-10-20T08:00:00Z')});
 await request(nextHour);assert.equal(sends,21);
 await db.query('UPDATE resume_visit_alert_limits SET attempts=90 WHERE bucket=$1',['2026-10-20']);
 await request(nextHour);assert.equal(sends,21);
});

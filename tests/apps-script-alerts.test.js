const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createHmac}=require('node:crypto');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../apps-script/Code.gs'),'utf8');
function harness(){
 const secret='test-only-'.repeat(6),props={VISIT_ALERT_SECRET:secret},sent=[];
 let quota=100,owner='adityakadam66@gmail.com',locked=false;
 const ctx={Date,JSON,Math,isFinite,console:{log(){},error(){}},
   PropertiesService:{getScriptProperties:()=>({getProperty:k=>props[k]??null,setProperty:(k,v)=>{props[k]=v;}})},
   ContentService:{MimeType:{JSON:'application/json'},createTextOutput:text=>({setMimeType:()=>JSON.parse(text)})},
   Session:{getEffectiveUser:()=>({getEmail:()=>owner})},
   Utilities:{Charset:{UTF_8:'utf8'},formatDate:()=> '20 October 2026, 02:30 PM',
     computeHmacSha256Signature:(payload,key)=>Array.from(createHmac('sha256',key).update(payload).digest())},
   LockService:{getScriptLock:()=>({tryLock:()=>{locked=true;return true;},hasLock:()=>locked,releaseLock:()=>{locked=false;}})},
   MailApp:{getRemainingDailyQuota:()=>quota,sendEmail:msg=>sent.push(msg)}};
 vm.createContext(ctx);vm.runInContext(source,ctx);
 function post(id='a'.repeat(64),time=new Date().toISOString(),sig){
   const payload=JSON.stringify({eventId:id,timestamp:time});
   const signature=sig??createHmac('sha256',secret).update(payload).digest('hex');
   return ctx.doPost({postData:{contents:JSON.stringify({payload,signature})}});
 }
 return {ctx,props,sent,post,setQuota:v=>quota=v,setOwner:v=>owner=v,isLocked:()=>locked};
}
test('Google sender rejects unsigned/stale requests and wrong executing account',()=>{
 const h=harness();
 assert.equal(h.post(undefined,undefined,'0'.repeat(64)).ok,false);
 assert.equal(h.post(undefined,'2020-01-01T00:00:00Z').ok,false);
 h.setOwner('wrong@example.com');assert.equal(h.post().ok,false);
 assert.equal(h.sent.length,0);
});
test('authorized request sends branded email only to fixed recipient; replay is harmless',()=>{
 const h=harness();assert.equal(h.post().ok,true);assert.equal(h.sent.length,1);
 const email=h.sent[0];assert.equal(email.to,'adityakadamjd@gmail.com');
 assert.equal(email.subject,'Someone visited your résumé, Aditya');
 assert.match(email.htmlBody,/#1f5fe0/);assert.match(email.htmlBody,/View my résumé/);
 assert.match(email.htmlBody,/IST/);assert.match(email.body,/Page opened/);
 assert.equal(h.post().duplicate,true);assert.equal(h.sent.length,1);assert.equal(h.isLocked(),false);
});
test('Google quota and second-layer hourly/daily caps stop delivery',()=>{
 const h=harness();h.setQuota(0);assert.equal(h.post().ok,false);assert.equal(h.sent.length,0);
 h.setQuota(100);
 const now=new Date();
 const state={day:now.toISOString().slice(0,10),hour:now.toISOString().slice(0,13),daily:90,hourly:0,recent:[]};
 h.props.ALERT_LIMITS=JSON.stringify(state);assert.equal(h.post().ok,false);
 state.daily=0;state.hourly=20;h.props.ALERT_LIMITS=JSON.stringify(state);assert.equal(h.post().ok,false);
 assert.equal(h.sent.length,0);assert.equal(h.isLocked(),false);
});

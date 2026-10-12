const test=require('node:test'),assert=require('node:assert/strict');
const {PGlite}=require('@electric-sql/pglite');
async function testPool(){const db=new PGlite();await db.waitReady;const query=(sql,args)=>db.query(sql,args);return {query,connect:async()=>({query,release(){}}),end:()=>db.close()};}
const {createServer}=require('../server');
const {ensureAuth,passwordHash,passwordMatches}=require('../cv-auth');
const {seed,ensureDisplay,resolveDisplay}=require('../cv-display');

test('display defaults are persisted separately and never overwrite CV records/history',async()=>{
 const pool=await testPool();
 await pool.query('CREATE TABLE cv_documents(id INTEGER PRIMARY KEY,data JSONB,version INTEGER)');await pool.query('CREATE TABLE cv_versions(id INTEGER PRIMARY KEY,document_id INTEGER,version INTEGER,data JSONB)');
 const raw={name:'Saved',ui:{},repositories:[],experience:[{company:'Velocity Media Lab',role:'Lead'}]};
 await pool.query('INSERT INTO cv_documents VALUES(1,$1,7)',[raw]);await pool.query('INSERT INTO cv_versions VALUES(1,1,7,$1)',[raw]);
 await ensureDisplay(pool);await ensureDisplay(pool);
 assert.deepEqual((await pool.query('SELECT data FROM cv_documents')).rows[0].data,raw);
 assert.deepEqual((await pool.query('SELECT data FROM cv_versions')).rows[0].data,raw);
 const stored=(await pool.query('SELECT data FROM cv_display_defaults')).rows[0].data;
 const resolved=resolveDisplay(raw,stored);
 assert.equal(resolved.data.repositories.length,6);assert.equal(resolved.data.repositories.at(-1).private,true);
 assert.equal(resolved.data.repositories.at(-1).url,'');assert.match(resolved.data.experience[0].proof,/velocity-media-lab/);
 assert.ok(resolved.presentation.experienceHTML.includes(stored.proofs.velocity));assert.ok(resolved.data.attachments.resume.url);assert.ok(resolved.presentation.experienceHTML.includes('Rath Infotech'));
 assert.equal((await pool.query('SELECT COUNT(*) AS n FROM cv_display_defaults')).rows[0].n,1);
 const cleared=resolveDisplay({...raw,ui:{contentSchemaVersion:1},attachments:{resume:null,coverLetter:null},repositories:[]},stored);
 assert.deepEqual(cleared.data.repositories,[]);assert.equal(cleared.data.attachments.resume,null);
 await pool.end();
});

test('password hashing is salted and rejects incorrect passwords',async()=>{
 const a=await passwordHash('A long unique test password'),b=await passwordHash('A long unique test password');
 assert.notEqual(a,b);assert.equal(await passwordMatches('A long unique test password',a),true);assert.equal(await passwordMatches('wrong',a),false);
});

test('owner setup, authorization, expiry, logout and throttling protect CV writes',async t=>{
 const pool=await testPool();await ensureAuth(pool);
 await pool.query('CREATE TABLE cv_documents(id INTEGER PRIMARY KEY,data JSONB,version INTEGER,updated_at TIMESTAMPTZ DEFAULT NOW())');await pool.query('CREATE TABLE cv_versions(id SERIAL PRIMARY KEY,document_id INTEGER,version INTEGER,data JSONB)');
 await pool.query('INSERT INTO cv_documents VALUES(1,$1,7,NOW())',[{name:'Preserved'}]);
 const server=createServer(pool,{display:false,auth:{setupToken:'test-only-owner-bootstrap'}});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 t.after(async()=>{await new Promise(r=>server.close(r));await pool.end();});
 const root='http://127.0.0.1:'+server.address().port;
 const post=(path,body={},token='',origin='')=>fetch(root+path,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{}),...(origin?{Origin:origin}:{})},body:JSON.stringify(body)});
 assert.equal((await fetch(root+'/api/cv')).status,200);
 assert.equal((await post('/api/cv',{data:{name:'Bad'},expectedVersion:7})).status,401);
 assert.equal((await post('/api/cv/rollback',{expectedVersion:7})).status,401);
 assert.deepEqual((await pool.query('SELECT data FROM cv_documents')).rows[0].data,{name:'Preserved'});
 let response=await post('/api/auth/setup',{username:'owner',password:'A unique owner test password',setupToken:'test-only-owner-bootstrap'});assert.equal(response.status,200);const first=(await response.json()).token;
 assert.equal((await post('/api/auth/setup',{username:'second',password:'Another unique test password',setupToken:'test-only-owner-bootstrap'})).status,409);
 assert.equal((await post('/api/cv',{data:{name:'Authorized'},expectedVersion:7},first,'https://evil.example')).status,403);
 response=await post('/api/cv',{data:{name:'Authorized'},expectedVersion:7},first);assert.equal(response.status,200);
 assert.equal((await (await fetch(root+'/api/auth/status',{headers:{Authorization:'Bearer '+first}})).json()).authenticated,true);
 assert.equal((await post('/api/auth/logout',{},first)).status,200);assert.equal((await post('/api/cv/rollback',{},first)).status,401);
 response=await post('/api/auth/login',{username:'owner',password:'A unique owner test password'});assert.equal(response.status,200);const second=(await response.json()).token;
 await pool.query("UPDATE cv_admin_sessions SET expires_at=NOW()-INTERVAL '1 hour'");assert.equal((await post('/api/cv/rollback',{},second)).status,401);
 for(let i=0;i<5;i++)assert.equal((await post('/api/auth/login',{username:'owner',password:'bad'})).status,401);
 assert.equal((await post('/api/auth/login',{username:'owner',password:'bad'})).status,429);
});
